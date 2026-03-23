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

## Agent Context

- Read `data/agent-context.md` before doing open-ended nutrition or training analysis
- Update `data/agent-context.md` when you learn stable user preferences or recurring patterns
- Use `npx tsx cli/mf.ts context` first when you need a current snapshot of goals, today's intake, weight trend, and next workout

## Quick Reference CLI Commands

The fastest way to explore data is the CLI tool. Output is JSON, perfect for piping to `jq`.

| Action                  | Command                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current context         | `npx tsx cli/mf.ts context`                                                                                                                                        |
| List recent workouts    | `npx tsx cli/mf.ts workouts`                                                                                                                                       |
| Specific workout detail | `npx tsx cli/mf.ts workout <uuid>`                                                                                                                                 |
| Search exercise DB      | `npx tsx cli/mf.ts exercises search "bench press"`                                                                                                                 |
| Resolve hex ID          | `npx tsx cli/mf.ts exercise <hex-id>`                                                                                                                              |
| Get today's food log    | `npx tsx cli/mf.ts food-log [YYYY-MM-DD]`                                                                                                                          |
| Nutrition range         | `npx tsx cli/mf.ts nutrition --from 2026-03-01 --to 2026-03-22`                                                                                                    |
| Weight history          | `npx tsx cli/mf.ts weight-history --from 2026-03-01 --to 2026-03-22`                                                                                               |
| Daily goals             | `npx tsx cli/mf.ts goals`                                                                                                                                          |
| List gym profiles       | `npx tsx cli/mf.ts gyms`                                                                                                                                           |
| Search foods            | `npx tsx cli/mf.ts search-food "nutritional yeast"`                                                                                                                |
| Log a searched food     | `npx tsx cli/mf.ts log-food '{"foodId":"<food-id>","servingIndex":0,"quantity":1.5,"loggedAt":"2026-03-20T19:00:00-05:00"}'`                                       |
| Log a manual food       | `npx tsx cli/mf.ts log-manual-food '{"name":"Protein Shake","calories":220,"protein":35,"carbs":12,"fat":4}'`                                                      |
| Copy food entries       | `npx tsx cli/mf.ts copy-food '{"sourceDate":"2026-03-20","targetDate":"2026-03-21","entryIds":["..."]}'`                                                           |
| Create a workout        | `npx tsx cli/mf.ts log-workout '{"name":"PM Session","gymId":"<gym-id>","startTime":"2026-03-20T17:00:00-05:00","exercises":[{"exerciseId":"...","sets":[...]}]}'` |
| Add exercise to workout | `npx tsx cli/mf.ts log-exercise '{"workoutId":"<uuid>","exercises":[{"exerciseId":"...","sets":[{"reps":10,"lbs":135,"sets":3}]}]}'`                               |
| Update workout          | `npx tsx cli/mf.ts update-workout '{"id":"<uuid>","name":"Renamed Session"}'`                                                                                      |
| Delete workout          | `npx tsx cli/mf.ts delete-workout '{"id":"<uuid>"}'`                                                                                                               |
| Log weight              | `npx tsx cli/mf.ts log-weight '{"lbs":180,"date":"2026-03-20"}'`                                                                                                   |
| Delete weight           | `npx tsx cli/mf.ts delete-weight '{"date":"2026-03-20"}'`                                                                                                          |
| Delete food entry       | `npx tsx cli/mf.ts delete-food '{"date":"2026-03-20","entryId":"..."}'`                                                                                            |
| Update food quantity    | `npx tsx cli/mf.ts update-food '{"date":"2026-03-20","entryId":"...","quantity":200}'`                                                                             |

_Auth note:_ The CLI has a built-in `.env` parser. Do **NOT** use `source .env` — the password contains backticks and special characters that break bash sourcing. Just run commands directly; the CLI loads credentials automatically.

### Logging Food via CLI

The `log-food` command is atomic: provide `foodId`, `servingIndex`, and `quantity`. Gram-mode is detected automatically when the serving's `gramWeight` is 1 (e.g., a "gram" serving). You do NOT need to set gram-mode manually.

**Workflow for correcting a food entry mistake:**

1. Use `update-food` to change the quantity — never delete and re-log
2. `delete-food` is a **soft delete** (`d: true`) — the ghost entry persists in Firestore and may still appear in the app
3. If you need to change the food entirely (wrong item), you must delete the old AND log the new — but understand the ghost will remain

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
  startTime: '2026-03-18T23:00:00.000Z', // ISO 8601 UTC
  duration: 2_700_000_000, // MICROSECONDS (45 min)
  gymId: 'uuid-of-gym', // from client.getGymProfiles()
  gymName: 'Gym',
  gymIcon: 'house',
  blocks: [
    {
      exercises: [
        /* ... */
      ],
    },
  ],
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

## Writing Food Entries

### Entry IDs Must Be Unique

Food entries are keyed by a 16-digit microsecond timestamp within a per-day Firestore document (`users/{uid}/food/YYYY-MM-DD`). Each entry ID must be unique **within that day's document**.

**Use `Date.now() * 1000` (current wall-clock microseconds) — NOT the meal time.**

The meal time is stored separately in `h` (hour) and `mi` (minute) fields. If you log multiple foods "at 7am", each still needs a distinct entry ID. Using the meal time as the ID causes later entries to silently overwrite earlier ones — Firestore PATCH with the same field path replaces the value.

When logging multiple items for the same meal, either add a small delay between calls or add a random offset to the timestamp.

### Meal Time is Local Time (LogTime)

`logFood()` and `logSearchedFood()` accept a `LogTime` object — **not** a JS `Date`:

```typescript
import type { LogTime } from './src/lib/api/index';

const logTime: LogTime = { date: '2026-03-21', hour: 13, minute: 30 };
await client.logSearchedFood(logTime, food, serving, quantity, gramMode);
```

The `h` and `mi` fields in Firestore represent the user's **local wall-clock time** (no timezone). Never round-trip through a JS `Date` object — `Date.getHours()` converts to the system's timezone, silently shifting the hour.

### Firestore Type Safety (CRITICAL)

The MacroFactor Android app stores ALL food entry numeric values as Firestore `stringValue` — never `integerValue` or `doubleValue`. Writing a food entry with native numeric types will **crash the Android app** for that entire day, rendering the food log blank.

The client enforces this via the `FoodFieldValue` type system and helper functions:

- `sfv(value)` — string-typed field (integers get `.0` suffix: `1` → `"1.0"`)
- `bfv(value)` — boolean field
- `nfv()` — null field
- `servingsArray(servings)` — the `m` (measurements) array

**Always use `logSearchedFood()` or `logFood()` — never call `patchDocument()` directly for food entries.**

### Field Semantics for Food Entries

The app computes total nutrients via: `total = macro × w × y / (g × q)`

| Field | Gram tracking (`150g`) | Unit tracking (`2 tbsp`) |
| ----- | ---------------------- | ------------------------ |
| `g`   | serving gram weight    | serving gram weight      |
| `w`   | `1`                    | serving gram weight      |
| `y`   | raw grams wanted       | unit count               |
| `q`   | `1` (always)           | `1` (always)             |
| `u`   | `"g"`                  | serving description      |
| `k`   | `"t"`                  | `"t"`                    |

The `gramMode` parameter on `logSearchedFood()` controls this distinction.

### Updating vs Creating Food Entries

- **Creating**: `patchFoodDocument()` — replaces the entire entry map (correct for new entries)
- **Updating fields**: `updateFoodEntryFields()` — per-subfield update masks, preserves all other fields
- **Deleting**: `deleteFoodEntry()` — **soft delete only** — sets `d: true` flag. The entry remains in Firestore and **may still appear in the app**. There is no hard delete.

**If you logged food incorrectly, use `update-food` to fix it — do NOT delete and re-log.** Delete + re-log creates a soft-deleted ghost entry alongside the new one, which can show up as a duplicate in the app.

**Never use `patchFoodDocument()` for partial updates** — it replaces the entire entry, wiping all fields not included in the patch.

## Training Programs

### Discovering Program Structure

Program data lives in `users/{uid}/trainingProgram/{programId}`. This collection is NOT documented in any Firebase docs — it was found by reverse-engineering the SBS Train APK binary (`com.sbs.train`). The active program ID comes from `users/{uid}/profiles/workout` → `activeProgramId`.

Each program has a `days` array defining the full cycle. Rest days have empty `blocks` arrays and typically use `name: "---"` and `gymId: "blankSlate"`.

### CLI Commands

| Action                            | Command                          |
| --------------------------------- | -------------------------------- |
| Show active program with all days | `npx tsx cli/mf.ts program`      |
| Show next workout in cycle        | `npx tsx cli/mf.ts next-workout` |

### Key Firestore Paths (Workout App)

| Path                               | Contents                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `users/{uid}/profiles/workout`     | Workout settings, `activeProgramId`, gym IDs, exercise configs                 |
| `users/{uid}/profiles/diet`        | Diet app shortcuts/toolbar config                                              |
| `users/{uid}/trainingProgram/{id}` | Full program definition: days, exercises, periodization targets                |
| `users/{uid}/workoutHistory/{id}`  | Completed workout sessions (with `workoutSource.dayId` linking to program day) |
| `users/{uid}/customExercises/{id}` | User-created exercises                                                         |
| `users/{uid}/gym/{id}`             | Gym profiles with equipment configs                                            |

### Programmatic Usage

```typescript
// Get all programs (with active flag)
const programs = await client.getTrainingPrograms();
const active = programs.find((p) => p.isActive);

// Inspect the cycle
for (const day of active.days) {
  if (day.isRestDay) {
    console.log(`${day.name}: REST`);
  } else {
    const names = day.exercises.map((e) => resolveExercise(e.exerciseId)?.name);
    console.log(`${day.name}: ${names.join(', ')}`);
  }
}

// What's next?
const next = await client.getNextWorkout();
console.log(next.dayName, next.isRestDay ? 'REST' : next.exercises.length + ' exercises');
```

## Common Mistakes & Red Flags

| Red Flag / Error                     | Reality / Fix                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `403 Forbidden` on `/exercises`      | App Check blocks global collections. Use `resolveExercise()` from `src/lib/api/exercises.ts` which reads the local `data/exercises.json`.                                                                                       |
| "Duration is 3 million seconds"      | Firestore stores duration/rest timers in **microseconds**. The client converts to seconds (`durationSeconds`), but raw Firestore writes need `value * 1,000,000`.                                                               |
| Using `source .env`                  | The `.env` password contains backticks and backslashes. Do NOT use `source .env` in bash — it will fail. The CLI has a built-in parser; just run commands directly.                                                             |
| Parsed types vs raw types for writes | The client's `getWorkout()` returns parsed types (seconds, clean nesting). Writes require **raw** Firestore structure (`log.value.weight`, microseconds). Use `getRawWorkout()` for the write-compatible format.                |
| "Weight is wrong unit"               | Weight is ALWAYS stored as **kg** internally, regardless of the user's `weightUnit` preference. Convert lbs to kg with `lbs / 2.2046226218`.                                                                                    |
| Confusion over ID formats            | Workouts/blocks use standard **UUIDs**. Reference data (exercises) uses **32-char hex IDs** containing `c6f170d880`.                                                                                                            |
| Food entries overwriting each other  | Entry IDs must be unique per day. Use `Date.now() * 1000` (wall clock), NOT the meal time. Logging 3 foods "at 7am" with the same timestamp silently overwrites to just the last one.                                           |
| Food entry crashes Android app       | ALL food numeric values must be Firestore `stringValue`. Using `integerValue`/`doubleValue` causes a blank timeline for that day. Use `sfv()` helper, never raw numbers.                                                        |
| `deleteFoodEntry` wipes entry data   | Use `updateFoodEntryFields()` (per-subfield masks), not `patchFoodDocument()` (whole-entry replace). The latter replaces the entire entry with just `{d: true, ua: "..."}`, creating ghost stubs that crash the app.            |
| `w` and `q` field values wrong       | For gram tracking: `w=1, q=1, y=grams`. For unit tracking: `w=servingGrams, q=1, y=count`. Getting this wrong makes calorie/macro totals display incorrectly in the app.                                                        |
| Can't find program/schedule data     | Program definitions are in `users/{uid}/trainingProgram/{id}`, NOT under `programs/` or `activeProgram/`. The active program ID is in `users/{uid}/profiles/workout` → `activeProgramId`. Rest days have empty `blocks` arrays. |
| Food logged at wrong hour            | `logFood`/`logSearchedFood` accept `LogTime` (`{ date, hour, minute }`) — NOT a JS `Date`. The `h`/`mi` fields are local wall-clock time. Never pass a `Date` object and call `getHours()` — that converts to system timezone.  |

## Key Client Methods

### Read Methods

| Method                         | Returns               | Notes                                            |
| ------------------------------ | --------------------- | ------------------------------------------------ |
| `getWorkoutHistory()`          | `WorkoutSummary[]`    | Sorted by date descending                        |
| `getWorkout(id)`               | `WorkoutDetail`       | Parsed types (seconds, resolved names)           |
| `getRawWorkout(id)`            | `Record<string, any>` | Raw Firestore fields — use for read-modify-write |
| `getGymProfiles()`             | `GymProfile[]`        | Needed for `gymId` when creating workouts        |
| `getCustomExercises()`         | `CustomExercise[]`    | User-created exercises                           |
| `getFoodLog(date)`             | `FoodEntry[]`         | Date format: `YYYY-MM-DD`                        |
| `getNutrition(start, end)`     | `NutritionSummary[]`  | Date range                                       |
| `getWeightEntries(start, end)` | `ScaleEntry[]`        | Date range                                       |
| `searchFoods(query)`           | `SearchFoodResult[]`  | Typesense-backed search                          |

### Write Methods

| Method                                     | Purpose                  | Notes                                             |
| ------------------------------------------ | ------------------------ | ------------------------------------------------- |
| `updateRawWorkout(id, fields, fieldPaths)` | Update or create workout | Upserts — new UUID creates, existing UUID patches |
| `logWeight(date, kg, bodyFat?)`            | Log scale entry          | Date format: `YYYY-MM-DD`                         |
| `logFood(logTime, ...)`                    | Log a food entry         | `logTime` is `LogTime` (`{ date, hour, minute }`) |
| `logSearchedFood(logTime, ...)`            | Log from search result   | `logTime` is `LogTime` (`{ date, hour, minute }`) |
| `deleteFoodEntry(date, entryId)`           | Remove food entry        |                                                   |
| `updateFoodEntry(date, entryId, qty)`      | Update quantity          |                                                   |
| `deleteWeightEntry(date)`                  | Remove scale entry       |                                                   |

## Heavy Reference

For the complete schema of all collections, field mappings, and type definitions, read `docs/api-reference.md`.

## MCP Server

If `.opencode/mcp.json` is registered, prefer the MCP tools over bash-wrapping the CLI.

- Server entry: `mcp-server/index.ts`
- Tool namespace: `macrofactor.*`
- Context resource: `macrofactor://context`
- Capability resource: `macrofactor://capabilities`

Use MCP when you want typed inputs, structured errors, and tool discovery. Use the CLI when you are outside an MCP-aware environment.

## Analytical Patterns

- To compare training-day vs rest-day nutrition: call `program` to get the schedule, `nutrition` for the range, then group days by whether they map to training or rest
- To estimate TDEE from recent history: call `weight-history` and `nutrition` for the same 30-day window, compare intake against weight trend
- To identify protein gaps: call `goals`, `nutrition`, and compute daily protein attainment against the matching weekday target

## Worked Examples

### Weekly Nutrition Report

1. Call `context` for the current snapshot
2. Call `nutrition --from ... --to ...` for the last 7 days
3. Call `goals` and compare each day to the matching weekday target
4. Summarize calorie adherence, protein consistency, and over/under days

### Training Volume Analysis

1. Call `program` to inspect the active split
2. Call `workouts` to list recent sessions
3. Call `workout <id>` for the last 3-5 relevant sessions
4. Group sets/reps by exercise and compare against the planned day structure

### Progress Check

1. Call `weight-history --from ... --to ...` for the last 30 days
2. Call `nutrition --from ... --to ...` for the same window
3. Call `goals` and `context`
4. Explain whether intake, weight trend, and training cadence agree with the user's stated goal
