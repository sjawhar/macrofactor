# MacroFactor Workout API — Design Spec

## Goal

Document the full MacroFactor API (nutrition + workout), extend the TypeScript client to cover workouts, bundle the exercise database, and create a Claude skill for interacting with the API.

## Background

MacroFactor has two apps sharing the same Firebase backend (`sbs-diet-app`):

- **Nutrition** (`com.sbs.diet`) — food logging, weight, nutrition summaries, steps
- **Workouts** (`com.sbs.train`) — workout tracking, programs, exercise library, gym profiles

Both use Firebase Auth (email/password) and Firestore REST API. The exercise database (1,122 exercises, 4,170 total entities) is bundled in the workout APK as `app_file.json` and also exists in Firestore behind App Check (403 for direct reads).

The existing web app covers nutrition. This project extends coverage to workouts.

## Deliverables

1. **API reference doc** (`docs/api-reference.md`) — complete Firestore schema for both apps
2. **Exercise database** (`data/exercises.json`) — extracted from APK, committed as static JSON
3. **TypeScript client extension** — new modules for workout data + exercise lookup
4. **Claude skill** — teaches Claude how to query the API from code/CLI
5. **CLI wrapper** (bonus) — thin CLI over the TypeScript client

## Architecture

### Data Model

The entire MacroFactor data model uses a universal hex ID scheme. Every entity (exercise, muscle, equipment, metric, etc.) has a 32-character hex ID containing `c6f170d880` at positions 4-13. The `app_file.json` from the APK contains a `uuidIndex` that maps ALL 4,170 IDs to their human-readable names and metadata.

Entity types in the database:

| Type               | Count | Example                                        |
| ------------------ | ----- | ---------------------------------------------- |
| alternativeName    | 1,307 | Alternative exercise names                     |
| exercise           | 1,122 | "Barbell bench press"                          |
| exerciseGroup      | 309   | Exercise groupings                             |
| exclusionGroupings | 292   | Mutual exclusion sets                          |
| equipment          | 262   | "Barbell" (with weight data, gym availability) |
| exerciseNote       | 245   | Technique notes                                |
| muscle             | 232   | Individual muscles                             |
| jointAction        | 148   | Joint movement patterns                        |
| featureMuscleGroup | 23    | "Quads", "Chest", etc.                         |
| exerciseMetric     | 11    | "Weight", "Reps", "Duration"                   |
| exerciseType       | 3     | "Single joint (isolation)", etc.               |
| laterality         | 3     | "Bilateral", "Unilateral", etc.                |
| regionTrained      | 4     | "Upper body", "Lower body", etc.               |
| stability          | 5     | Stability classifications                      |
| rom                | 5     | Range of motion classifications                |

### Firestore Collections

#### Auth

- Firebase project: `sbs-diet-app`
- API key: `AIzaSyA17Uwy37irVEQSwz6PIyX3wnkHrDBeleA`
- Sign-in: `POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
- Refresh: `POST securetoken.googleapis.com/v1/token`
- Both `com.sbs.diet` and `com.sbs.train` bundle IDs work

#### User Data (`users/{uid}/`)

**Nutrition (existing in web app):**

| Collection          | Key Format         | Description                   |
| ------------------- | ------------------ | ----------------------------- |
| `food/{YYYY-MM-DD}` | timestamp entry ID | Food log entries              |
| `scale/{year}`      | MMDD               | Weight/body fat entries       |
| `nutrition/{year}`  | MMDD               | Daily macro summaries         |
| `micro/{year}`      | MMDD               | Micronutrient daily totals    |
| `steps/{year}`      | MMDD               | Step counts                   |
| `body/{year}`       | MMDD               | Body measurements             |
| `customFoods/{id}`  | food ID            | User-created foods            |
| `history/fh{N}`     | mixed keys         | Food log history/search index |

**Workout (new):**

| Collection               | Key Format | Description            |
| ------------------------ | ---------- | ---------------------- |
| `workoutHistory/{uuid}`  | UUID       | Completed workout logs |
| `gym/{uuid}`             | UUID       | Gym/equipment profiles |
| `customExercises/{uuid}` | UUID       | User-created exercises |

**Profile documents (exist as documents, not collections):**

| Document                      | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| `users/{uid}`                 | Main profile (75 fields, includes planner, workout prefs) |
| `users/{uid}/workoutProfile`  | Workout profile (empty in test account)                   |
| `users/{uid}/trainingProfile` | Training profile (empty in test account)                  |
| `users/{uid}/gymProfile`      | Gym profile (empty in test account)                       |

**Global collections (403 — behind App Check):**

`exercises/`, `muscles/`, `equipment/`, `exerciseCategories/`, `muscleGroups/`, `tags/`, `config/`, `catalog/`, `metadata/`, `exerciseData/`, `trainData/`, `appConfig/`, `library/`, `reference/`, `static/`, `shared/`

These exist in Firestore but are read-protected. The data is equivalent to what's in `app_file.json`.

### Workout History Schema

```
workoutHistory/{uuid}
├── id: string (UUID)
├── name: string ("Workout A", "Workout C")
├── startTime: timestamp (ISO 8601)
├── duration: number (microseconds — divide by 1,000,000 for seconds)
├── gymId: string (references gym/{uuid})
├── gymName: string (denormalized)
├── gymIcon: string (icon identifier)
├── workoutSource: object
│   ├── runtimeType: "program"
│   ├── programId: string (UUID)
│   ├── programName: string
│   ├── dayId: string (UUID)
│   ├── cycleIndex: number
│   ├── programColor: string
│   └── programIcon: string
└── blocks: array
    └── [block]
        └── exercises: array
            └── [exercise]
                ├── id: string (UUID — instance ID)
                ├── exerciseId: string (hex ID → resolves via uuidIndex)
                ├── baseWeight: number | null (bodyweight component)
                ├── note: string
                └── sets: array
                    └── [set]
                        ├── setType: "warmUp" | "standard" | "failure"
                        ├── segments: array (for supersets/circuits)
                        └── log: object
                            ├── id: string (UUID)
                            ├── runtimeType: "single"
                            ├── target: object | null
                            │   ├── id: string (UUID)
                            │   ├── minFullReps: number
                            │   ├── maxFullReps: number
                            │   ├── rir: number (Reps In Reserve)
                            │   ├── distance: number | null
                            │   ├── durationSeconds: number | null
                            │   └── restTimer: number | null (microseconds)
                            └── value: object
                                ├── weight: number (kg)
                                ├── fullReps: number
                                ├── partialReps: number | null
                                ├── rir: number | null
                                ├── distance: number | null
                                ├── durationSeconds: number | null
                                ├── restTimer: number (microseconds)
                                └── isSkipped: boolean
```

### Gym Profile Schema

```
gym/{uuid}
├── id: string (UUID)
├── name: string ("Constellation", "Home Gym")
├── icon: string
├── weightUnit: "kgs" | "lbs"
├── createdAt: timestamp
├── selectedEquipmentIds: string[] (hex IDs → equipment names)
├── equipmentConfigById: object (per-equipment overrides)
├── useBumperPlatesInPlateCalculator: boolean
├── allowMixedUnitsInPlateCalculator: boolean
├── offsetWeightInPlateCalculator: number
├── alwaysShowExercises: string[] (exercise hex IDs)
└── alwaysHideExercises: string[] (exercise hex IDs)
```

### Exercise Schema (from app_file.json)

```
exercise
├── id: string (hex ID)
├── name: string ("Barbell bench press")
├── name_jp: string | null (Japanese name)
├── alternativeName: string[] (hex IDs → alternativeName entities)
├── exerciseType: string (hex ID → "Single joint", "Multi-joint", etc.)
├── primaryJointAction: string[] (hex IDs)
├── secondaryJointAction: string[] (hex IDs)
├── primaryFeatureMuscle: string[] (hex IDs → "Chest", "Quads", etc.)
├── secondaryFeatureMuscle: string[] (hex IDs)
├── primaryMuscle: string[] (hex IDs → individual muscles)
├── secondaryMuscle: string[] (hex IDs)
├── emphasizedAgonist: string[] (hex IDs)
├── deemphasizedAgonist: string[] (hex IDs)
├── preconditions: string[] (hex IDs)
├── stretchedMuscle: string[] (hex IDs)
├── regionTrained: string (hex ID → "Upper body", "Lower body", etc.)
├── laterality: string[] (hex IDs → "Bilateral", "Unilateral")
├── movementPattern: string[] (hex IDs)
├── exerciseGroup: string[] (hex IDs)
├── exclusionGroupings: string[] (hex IDs)
├── resistanceEquipmentGroupIds: string[] (hex IDs)
├── supportEquipmentGroupIds: string[] (hex IDs)
├── recommendationLevelStrength: number
├── recommendationLevelHypertrophy: number
├── exerciseClassificationStrength: string (hex ID)
├── exerciseClassificationHypertrophy: string (hex ID)
├── rom: string (hex ID)
├── exerciseMetrics: string[] (hex IDs → "Weight", "Reps", etc.)
├── stability: string (hex ID)
├── bodyweight: number
├── exerciseNote: string[] (hex IDs)
└── searchBoostValue: number
```

## File Structure

```
macro-factor/
├── data/
│   └── exercises.json              # Full exercise DB extracted from APK
├── docs/
│   ├── api-reference.md            # Complete API reference
│   └── superpowers/specs/          # This spec
├── src/lib/api/
│   ├── auth.ts                     # Existing (unchanged)
│   ├── client.ts                   # Existing — add workout methods
│   ├── firestore.ts                # Existing (unchanged)
│   ├── types.ts                    # Existing — add workout types
│   ├── typesense.ts                # Existing (unchanged)
│   ├── exercises.ts                # NEW: exercise database + lookup
│   ├── workout-types.ts            # NEW: workout-specific types
│   └── index.ts                    # Updated exports
├── cli/
│   ├── index.ts                    # CLI entry point
│   └── commands.ts                 # Command implementations
└── skills/
    └── macrofactor-api/
        └── SKILL.md                # Claude skill
```

## TypeScript Client Extensions

### New Types (`src/lib/api/workout-types.ts`)

```typescript
interface WorkoutSummary {
  id: string;
  name: string;
  startTime: string; // ISO timestamp
  durationSeconds: number; // converted from microseconds
  gymName: string;
  programName?: string;
  exerciseCount: number;
  setCount: number;
}

interface WorkoutDetail extends WorkoutSummary {
  gymId: string;
  workoutSource: WorkoutSource;
  blocks: WorkoutBlock[];
}

interface WorkoutSource {
  runtimeType: string;
  programId: string;
  programName: string;
  dayId: string;
  cycleIndex: number;
}

interface WorkoutBlock {
  exercises: WorkoutExercise[];
}

interface WorkoutExercise {
  id: string;
  exerciseId: string; // hex ID — resolve via exercises.ts
  exerciseName?: string; // resolved from exercise DB
  baseWeight: number | null;
  note: string;
  sets: WorkoutSet[];
}

interface WorkoutSet {
  setType: 'warmUp' | 'standard' | 'failure';
  target?: SetTarget;
  value: SetValue;
}

interface SetTarget {
  minFullReps?: number;
  maxFullReps?: number;
  rir?: number;
}

interface SetValue {
  weight: number; // kg
  fullReps: number;
  partialReps?: number;
  rir?: number;
  distance?: number;
  durationSeconds?: number;
  restTimerSeconds?: number; // converted from microseconds
  isSkipped: boolean;
}

interface GymProfile {
  id: string;
  name: string;
  icon: string;
  weightUnit: 'kgs' | 'lbs';
  equipmentIds: string[];
  equipmentNames?: string[]; // resolved from exercise DB
}
```

### New Client Methods

```typescript
// On MacroFactorClient:
getWorkoutHistory(): Promise<WorkoutSummary[]>
getWorkout(id: string): Promise<WorkoutDetail>
getWorkouts(start: string, end: string): Promise<WorkoutSummary[]>
getGymProfiles(): Promise<GymProfile[]>
getCustomExercises(): Promise<Exercise[]>
```

### Exercise Lookup (`src/lib/api/exercises.ts`)

```typescript
import exerciseData from '../../../data/exercises.json';

function lookupEntity(hexId: string): { type: string; name: string; [key: string]: any } | null;
function lookupExercise(hexId: string): Exercise | null;
function searchExercises(query: string): Exercise[];
function resolveExerciseId(hexId: string): string; // returns name
```

## CLI Design (Bonus)

Thin wrapper using the TypeScript client. Commands:

```
mf login                           # Auth with env vars or prompt
mf workouts [--from DATE] [--to DATE]  # List workout history
mf workout <id>                    # Show workout detail
mf exercises search <query>        # Search exercise database
mf exercise <id>                   # Show exercise detail
mf food-log [DATE]                 # Show food log
mf weight [--from DATE] [--to DATE]   # Show weight entries
mf nutrition [--from DATE] [--to DATE] # Show nutrition summaries
mf profile                         # Show user profile
mf gyms                            # List gym profiles
```

All commands output JSON by default. Add `--pretty` for formatted output.

## Skill Design

The skill teaches Claude how to:

1. Use the TypeScript client or CLI to query data
2. Understand the data model (workouts, exercises, nutrition)
3. Resolve hex IDs to human-readable names
4. Common query patterns (recent workouts, PR tracking, nutrition trends)

## Unit Conversions

Key unit conversions to handle in the client:

- **Duration**: Firestore stores microseconds → client returns seconds
- **Rest timers**: Firestore stores microseconds → client returns seconds
- **Weight**: Always stored in kg in Firestore (regardless of user's weightUnit preference)
- **Dates**: Workout history uses ISO timestamps; nutrition uses YYYY-MM-DD strings

## What's NOT in Scope

- Web UI for workouts (future project)
- Writing workout data back to Firestore (read-only for now)
- Program generation or adaptive algorithm replication
- Bypassing App Check to read global Firestore collections directly
