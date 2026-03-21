# MacroFactor API Reference

MacroFactor (by Stronger By Science) uses a shared Firebase backend for both its Nutrition and Workouts apps. This document details the reverse-engineered API schema based on the Firestore REST API.

## Architecture & Authentication

- **Firebase Project**: `sbs-diet-app`
- **Base URL**: `https://firestore.googleapis.com/v1/projects/sbs-diet-app/databases/(default)/documents`
- **Auth Endpoint**: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}`
- **Token Refresh**: `https://securetoken.googleapis.com/v1/token?key={API_KEY}`

The API uses standard Firebase Identity Toolkit. Exchanging email/password yields an `idToken` (JWT) which must be passed as `Authorization: Bearer <token>` to Firestore endpoints. Both `com.sbs.diet` and `com.sbs.train` bundle IDs work.

## Universal ID Scheme & Exercise Database

MacroFactor uses a universal hex ID scheme for all reference data (exercises, muscles, equipment, metrics, etc.). IDs are 32-character hex strings containing `c6f170d880` (e.g., `1a35c6f170d880bebc64f4dce0d5f5f1`).

The global reference collections (`exercises/`, `muscles/`, `equipment/`, etc.) exist in Firestore but are read-protected by Firebase App Check (returning 403).

However, the complete reference database is bundled within the workout app APK as `app_file.json`. This JSON contains a `uuidIndex` that acts as a universal dictionary, mapping all 4,170 hex IDs in the system to their human-readable names and types. Our TypeScript client resolves these locally.

## Unit Conversions

- **Duration**: Stored in microseconds. Divide by `1,000,000` for seconds.
- **Rest Timers**: Stored in microseconds. Divide by `1,000,000` for seconds.
- **Weight**: Always stored internally as kg, regardless of user preference.
- **Dates**:
  - Nutrition uses YYYY-MM-DD (`2026-03-18`) or MMDD (`0318`) depending on collection.
  - Workouts use full ISO 8601 timestamps (`2026-03-18T14:30:00.000Z`).

---

## Collections Reference

All user data is stored under the `users/{uid}/` prefix.

### Workout History

**Path:** `users/{uid}/workoutHistory/{uuid}`
**Type:** Collection of completed workout sessions

```typescript
// Field representation
{
  id: string,               // UUID
  name: string,             // e.g., "Workout A"
  startTime: string,        // ISO 8601 timestamp
  duration: number,         // Microseconds
  gymId?: string,           // UUID reference
  gymName?: string,
  gymIcon?: string,
  workoutSource?: {         // Information about the source program
    runtimeType: "program",
    programId: string,
    programName: string,
    dayId: string,
    cycleIndex: number,
  },
  blocks: [                 // Groups of exercises (for supersets/circuits)
    {
      exercises: [
        {
          id: string,       // Instance UUID
          exerciseId: string, // Hex ID -> resolve via database
          baseWeight: number | null,
          note: string,
          sets: [
            {
              setType: "warmUp" | "standard" | "failure",
              log: {
                id: string,
                runtimeType: "single",
                target: {
                  minFullReps: number | null,
                  maxFullReps: number | null,
                  rir: number | null,
                  restTimer: number | null, // microseconds
                } | null,
                value: {
                  weight: number,     // kg
                  fullReps: number,
                  partialReps: number | null,
                  rir: number | null,
                  restTimer: number,  // microseconds
                  isSkipped: boolean,
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Gym Profiles

**Path:** `users/{uid}/gym/{uuid}`
**Type:** Collection of user gym profiles

```typescript
// Field representation
{
  id: string,
  name: string,
  icon: string,
  weightUnit: "kgs" | "lbs",
  selectedEquipmentIds: string[],   // Hex IDs -> resolve via database
  alwaysShowExercises: string[],    // Hex IDs
  alwaysHideExercises: string[],    // Hex IDs
  useBumperPlatesInPlateCalculator: boolean,
  allowMixedUnitsInPlateCalculator: boolean,
  offsetWeightInPlateCalculator: number
}
```

### Food Log

**Path:** `users/{uid}/food/{YYYY-MM-DD}`
**Type:** Document containing all food entries for a specific day.
**Structure:** A map where keys are timestamp-based entry IDs.

| Field      | Type    | Description                                                                                                                                                                                                                                        |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`        | string  | Name / Title                                                                                                                                                                                                                                       |
| `b`        | string  | Brand                                                                                                                                                                                                                                              |
| `c`        | number  | Calories (per `g` amount)                                                                                                                                                                                                                          |
| `p`        | number  | Protein (per `g` amount)                                                                                                                                                                                                                           |
| `e`        | number  | Carbs (per `g` amount)                                                                                                                                                                                                                             |
| `f`        | number  | Fat (per `g` amount)                                                                                                                                                                                                                               |
| `g`        | number  | Serving size in grams                                                                                                                                                                                                                              |
| `w`        | number  | Unit weight                                                                                                                                                                                                                                        |
| `y`        | number  | User quantity                                                                                                                                                                                                                                      |
| `q`        | number  | Computed quantity                                                                                                                                                                                                                                  |
| `s`        | string  | Serving unit string                                                                                                                                                                                                                                |
| `id`       | string  | Global food ID (if from search)                                                                                                                                                                                                                    |
| `h` / `mi` | string  | Hour and minute of meal in user's **local time** (e.g., `"14"`, `"30"`). These are plain integers as strings — NOT zero-padded, NOT suffixed with `.0`. The app does not store timezone info; `h`/`mi` represent the wall-clock time the user ate. |
| `k`        | string  | Source type ("search", "manual", etc.)                                                                                                                                                                                                             |
| `d`        | boolean | True if deleted (soft delete)                                                                                                                                                                                                                      |
| `x`        | string  | Image ID / Barcode                                                                                                                                                                                                                                 |

> **Computing true calories:** `(calories_raw * (userQty * (unitWeight ?? servingGrams)) / servingGrams)`

### Daily Nutrition Summaries

**Path:** `users/{uid}/nutrition/{YYYY}`
**Type:** Document containing daily summaries for an entire year.
**Structure:** Map where keys are `MMDD`.

| Field | Type   | Description           |
| ----- | ------ | --------------------- |
| `k`   | number | Total Calories (kcal) |
| `p`   | number | Total Protein (g)     |
| `c`   | number | Total Carbs (g)       |
| `f`   | number | Total Fat (g)         |

_Note: MacroFactor computes these dynamically. The client API auto-computes missing days from the Food Log._

### Scale / Weight Entries

**Path:** `users/{uid}/scale/{YYYY}`
**Type:** Document containing daily weight entries for a year.
**Structure:** Map where keys are `MMDD`.

| Field | Type   | Description                            |
| ----- | ------ | -------------------------------------- |
| `w`   | number | Weight (in preferred unit, usually kg) |
| `f`   | number | Body fat percentage                    |
| `s`   | string | Source                                 |

### Step Counts

**Path:** `users/{uid}/steps/{YYYY}`
**Type:** Document containing daily step counts.
**Structure:** Map where keys are `MMDD`.

| Field | Type   | Description |
| ----- | ------ | ----------- |
| `st`  | number | Steps taken |
| `s`   | string | Source      |

### Custom Exercises

**Path:** `users/{uid}/customExercises/{uuid}`
**Type:** Collection of user-created exercises.

Follows the same schema as built-in exercises in `app_file.json`, but stored under the user's document tree. Includes fields like `primaryFeatureMuscle`, `resistanceEquipmentGroups`, `laterality`, etc.

### Training Programs

**Path:** `users/{uid}/trainingProgram/{programId}`
**Type:** Collection of program definitions

Each document represents a complete training program with its full cycle structure.

```typescript
{
  id: string,                    // UUID
  name: string,                  // e.g., "Advanced Full Body"
  color: string,                 // e.g., "red"
  icon: string,                  // e.g., "rocket"
  numCycles: number,             // Total cycles in the program
  runIndefinitely: boolean,      // Whether to loop after numCycles
  isPeriodized: boolean,         // Whether sets change across cycles
  deload: string,                // "lastCycle" | "none"
  expanded: boolean,
  programExerciseIdToNote: {},
  days: ProgramDay[],            // Full cycle definition (see below)
}

// ProgramDay — one day in the cycle
{
  id: string,                    // UUID — matches workoutSource.dayId in workout history
  name: string,                  // e.g., "Workout A" or "---" for rest days
  gymId: string,                 // UUID — "blankSlate" for rest days
  blocks: ProgramBlock[],        // Empty array for rest days
}

// ProgramBlock.exercises[]
{
  id: string,                    // UUID — exercise instance within this program
  exerciseId: string,            // 32-char hex ID — resolve via exercises.ts
  periodizedTargets: {           // Set/rep targets that vary by cycle
    runtimeType: "periodized",
    values: CycleTargets[],      // One entry per cycle
    deload: CycleTargets | null,
  }
}
```

**Rest days**: Identified by `blocks.length === 0` (or all blocks having no exercises). Typically named `"---"` with `gymId: "blankSlate"`.

### Workout Profile

**Path:** `users/{uid}/profiles/workout`
**Type:** Single document with workout app settings

Key fields:

- `activeProgramId` — UUID of the currently active training program
- `gymIds` — Array of gym UUIDs
- `workoutLibraryIds` — Array of custom workout template IDs
- `userExerciseConfigs` — Per-exercise settings (weight unit, bar weight, notes)
- `addSmartWarmUps`, `useDeload`, `rirTracking` — Program execution settings

### Diet Profile

**Path:** `users/{uid}/profiles/diet`
**Type:** Single document with diet app toolbar/shortcut config
