---
name: macrofactor-api
description: Use when querying or writing user nutrition, food logs, weight, or workout data via the MacroFactor API, creating new workouts, updating existing workout sets, searching the exercise database, resolving hex IDs to exercise names, or encountering 403 Forbidden errors when reading Firestore collections like /exercises or /equipment.
---

# MacroFactor API Reference

## Overview
This skill guides you in using the reverse-engineered MacroFactor (Stronger By Science) API client and CLI. The API reads and writes live data from the Firebase/Firestore backend (`sbs-diet-app`).

**Core principle:** All user data is live via Firestore REST API, but global reference data (exercises, muscles) is locked behind App Check (403) and must be resolved locally using the bundled JSON database.

## When to Use
- You need to fetch or update a user's workout history, gym profiles, or custom exercises
- You need to create a new workout session programmatically
- You need to query or log daily nutrition macros, food logs, weight, or steps
- You encounter a 32-character hex ID (e.g., `1a35c6f1...`) that needs to be translated to a human-readable exercise or muscle name
- You get a `403 Forbidden` error trying to access `/exercises` or `/equipment` on Firestore

## Quick Reference CLI Commands
The fastest way to explore data is the CLI tool. Output is JSON, perfect for piping to `jq`.

| Action | Command |
|---|---|
| List recent workouts | `npx tsx cli/mf.ts workouts` |
| Specific workout detail | `npx tsx cli/mf.ts workout <uuid>` |
| Search exercise DB | `npx tsx cli/mf.ts exercises search "bench press"` |
| Resolve hex ID | `npx tsx cli/mf.ts exercise <hex-id>` |
| Get today's food log | `npx tsx cli/mf.ts food-log [YYYY-MM-DD]` |
| List gym profiles | `npx tsx cli/mf.ts gyms` |
| Search foods | `npx tsx cli/mf.ts search-food "nutritional yeast"` |
| Log a food | `npx tsx cli/mf.ts log-food "kale raw" 150g --at 7pm` |
| Create a workout | `npx tsx cli/mf.ts log-workout --name "PM Session" --at 5pm` |
| Add exercise to workout | `npx tsx cli/mf.ts log-exercise <workout-id> "bench press" 3x10@135lbs` |

*Auth note:* The CLI has a built-in `.env` parser. Do **NOT** use `source .env` — the password contains backticks and special characters that break bash sourcing. Just run commands directly; the CLI loads credentials automatically.

## Implementation: TypeScript Client
For programmatic access within the app, use `MacroFactorClient`:

```typescript
import { MacroFactorClient } from './src/lib/api/index';
import { resolveExercise } from './src/lib/api/exercises';

const client = await MacroFactorClient.login(process.env.MACROFACTOR_USERNAME, process.env.MACROFACTOR_PASSWORD);

// Read workouts
const workouts = await client.getWorkoutHistory();
const lastWorkout = await client.getWorkout(workouts[0].id);

// Resolve opaque hex IDs from workout blocks
const exerciseId = lastWorkout.blocks[0].exercises[0].exerciseId;
const info = resolveExercise(exerciseId);
console.log(info.name, info.primaryMuscles);

// Update an existing workout (read-modify-write pattern)
const raw = await client.getRawWorkout(workoutId);
raw.blocks[0].exercises[0].sets[0].log.value.weight = 49.44; // kg
await client.updateRawWorkout(workoutId, { blocks: raw.blocks }, ['blocks']);

// Create a new workout (patchDocument upserts — new UUID = new document)
import { randomUUID } from 'crypto';
const newId = randomUUID();
await client.updateRawWorkout(newId, workoutFields, fieldPaths);
```

## Writing Workouts

### Updating Existing Workouts
Use the read-modify-write pattern via `getRawWorkout` → mutate → `updateRawWorkout`:
1. `getRawWorkout(id)` returns the parsed Firestore document (raw field names)
2. Mutate the fields you need (e.g., `sets[i].log.value.weight = newKg`)
3. `updateRawWorkout(id, { blocks }, ['blocks'])` patches only the `blocks` field

### Creating New Workouts
Firestore PATCH to a non-existent document ID acts as an **upsert** (creates it). Use `updateRawWorkout` with a fresh `randomUUID()`.

Required fields and their `fieldPaths` for a new workout:
```typescript
const workout = {
  name: 'Session Name',
  startTime: '2026-03-18T23:00:00.000Z',  // ISO 8601 UTC
  duration: 2_700_000_000,                  // MICROSECONDS (45 min)
  gymId: 'uuid-of-gym',                     // from client.getGymProfiles()
  gymName: 'Gym',
  gymIcon: 'house',
  blocks: [{ exercises: [/* ... */] }],
};
const fieldPaths = ['name', 'startTime', 'duration', 'gymId', 'gymName', 'gymIcon', 'blocks'];
await client.updateRawWorkout(randomUUID(), workout, fieldPaths);
```

### Raw Firestore Workout Structure (for writes)
The parsed TypeScript types differ from raw Firestore fields. When writing, use the **raw** structure:
```typescript
// Raw set structure (what Firestore expects)
{
  setType: 'standard',         // 'warmUp' | 'standard' | 'failure'
  segments: [],                 // always empty array for standard sets
  log: {
    id: 'uuid',                // unique per set — use randomUUID()
    runtimeType: 'single',     // always 'single'
    target: null,              // null for non-program sets
    value: {
      weight: 49.44,           // kg (ALWAYS kg, even if user prefers lbs)
      fullReps: 12,
      partialReps: null,
      rir: null,               // reps in reserve
      distance: null,
      durationSeconds: null,
      restTimer: 120_000_000,  // MICROSECONDS (120s = 120,000,000)
      isSkipped: false,
    },
  },
}

// Raw exercise structure
{
  id: 'uuid',                  // exercise instance UUID — use randomUUID()
  exerciseId: '1a05c6f1...',   // 32-char hex ID from exercise database
  note: '',
  baseWeight: null,
  sets: [/* raw sets above */],
}
```

### Gym Profile References
New workouts need a `gymId`. Fetch available gyms with `client.getGymProfiles()` or `npx tsx cli/mf.ts gyms`. Use the `id`, `name`, and `icon` fields from the result.

## Common Mistakes & Red Flags
| Red Flag / Error | Reality / Fix |
|---|---|
| `403 Forbidden` on `/exercises` | App Check blocks global collections. Use `resolveExercise()` from `src/lib/api/exercises.ts` which reads the local `data/exercises.json`. |
| "Duration is 3 million seconds" | Firestore stores duration/rest timers in **microseconds**. The client converts to seconds (`durationSeconds`), but raw Firestore writes need `value * 1,000,000`. |
| Using `source .env` | The `.env` password contains backticks and backslashes. Do NOT use `source .env` in bash — it will fail. The CLI has a built-in parser; just run commands directly. |
| Parsed types vs raw types for writes | The client's `getWorkout()` returns parsed types (seconds, clean nesting). Writes require **raw** Firestore structure (`log.value.weight`, microseconds). Use `getRawWorkout()` for the write-compatible format. |
| "Weight is wrong unit" | Weight is ALWAYS stored as **kg** internally, regardless of the user's `weightUnit` preference. Convert lbs to kg with `lbs / 2.2046226218`. |
| Confusion over ID formats | Workouts/blocks use standard **UUIDs**. Reference data (exercises) uses **32-char hex IDs** containing `c6f170d880`. |

## Key Client Methods

### Read Methods
| Method | Returns | Notes |
|---|---|---|
| `getWorkoutHistory()` | `WorkoutSummary[]` | Sorted by date descending |
| `getWorkout(id)` | `WorkoutDetail` | Parsed types (seconds, resolved names) |
| `getRawWorkout(id)` | `Record<string, any>` | Raw Firestore fields — use for read-modify-write |
| `getGymProfiles()` | `GymProfile[]` | Needed for `gymId` when creating workouts |
| `getCustomExercises()` | `CustomExercise[]` | User-created exercises |
| `getFoodLog(date)` | `FoodEntry[]` | Date format: `YYYY-MM-DD` |
| `getNutrition(start, end)` | `NutritionSummary[]` | Date range |
| `getWeightEntries(start, end)` | `ScaleEntry[]` | Date range |
| `searchFoods(query)` | `SearchFoodResult[]` | Typesense-backed search |

### Write Methods
| Method | Purpose | Notes |
|---|---|---|
| `updateRawWorkout(id, fields, fieldPaths)` | Update or create workout | Upserts — new UUID creates, existing UUID patches |
| `logWeight(date, kg, bodyFat?)` | Log scale entry | Date format: `YYYY-MM-DD` |
| `logFood(...)` | Log a food entry | |
| `logSearchedFood(...)` | Log from search result | |
| `deleteFoodEntry(date, entryId)` | Remove food entry | |
| `updateFoodEntry(date, entryId, qty)` | Update quantity | |
| `deleteWeightEntry(date)` | Remove scale entry | |

## Heavy Reference
For the complete schema of all collections, field mappings, and type definitions, read `docs/api-reference.md`.