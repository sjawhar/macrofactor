# src/lib/api — MacroFactor API Layer

Firestore REST + Typesense client for MacroFactor's `sbs-diet-app` Firebase backend. All read/write operations, auth, food search, and exercise resolution.

## Structure

```
api/
├── client.ts       # MacroFactorClient — all read/write methods (789 lines)
├── firestore.ts    # Firestore REST helpers + food-safe serialization
├── auth.ts         # Firebase sign-in + token refresh
├── typesense.ts    # Food search (common + branded collections)
├── exercises.ts    # Local exercise DB resolver (from data/exercises.json)
├── types.ts        # Shared types: FoodEntry, ScaleEntry, Goals, etc.
├── workout-types.ts # Workout types: WorkoutDetail, WorkoutSet, GymProfile, etc.
└── index.ts        # Public exports
```

## Where to Look

| Task                      | File                             | Key Symbols                                                                 |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Add new API method        | `client.ts`                      | `MacroFactorClient` class                                                   |
| Add new data type         | `types.ts` or `workout-types.ts` | Interfaces/classes                                                          |
| Change Firestore encoding | `firestore.ts`                   | `toFirestoreValue()`, `parseFirestoreValue()`                               |
| Food entry writes         | `firestore.ts`                   | `sfv()`, `bfv()`, `nfv()`, `patchFoodDocument()`, `updateFoodEntryFields()` |
| Food search behavior      | `typesense.ts`                   | `searchFoods()`, `parseHit()`                                               |
| Exercise name resolution  | `exercises.ts`                   | `resolveName()`, `resolveExercise()`, `searchExercises()`                   |
| Token management          | `auth.ts` + `client.ts`          | `ensureToken()` auto-refreshes                                              |

## Key Patterns

### Two Serialization Paths

1. **Generic** (`toFirestoreValue`): JS types → Firestore native types. Used for weight, workouts, nutrition summaries.
2. **Food-safe** (`sfv`/`bfv`/`nfv`): Everything as `stringValue`. **Mandatory for food entries** — native numeric types crash the Android app.

### Data Access Pattern

```
client.ensureToken() → fetch(Firestore REST) → parseDocument() → typed return
```

- Token auto-refreshes 60s before expiry
- 404 returns empty object (not error) for missing documents
- Pagination handled automatically in `listDocuments()`

### Date Encoding in Firestore

- **Food log**: `users/{uid}/food/{YYYY-MM-DD}` — entries keyed by microsecond timestamp
- **Scale/Steps/Nutrition**: `users/{uid}/{collection}/{YYYY}` — fields keyed by `MMDD`
- **Workouts**: `users/{uid}/workoutHistory/{uuid}` — individual documents
- **Custom exercises**: `users/{uid}/customExercises/{uuid}` — user-created exercise definitions
- **Custom workouts (workout plan library)**: `users/{uid}/customWorkouts/{uuid}` — queued/planned workouts that appear in the app's library tab. Each entry's UUID must also live in `profiles/workout.workoutLibraryIds`. The `createCustomWorkout` / `deleteCustomWorkout` client methods handle this two-write pattern automatically. Sets store **targets** (rep ranges + RIR), not logged values — the user fills in actual numbers when they execute the plan. **Two app-side gotchas (empirically verified)**: (1) `log.weight` on plan sets is **ignored** — the app applies smart progression regardless of prescribed weight. (2) Plan warmups **stack** with `profiles/workout.addSmartWarmUps: true` rather than replacing them, producing double warmups. Either omit warmups from plans or disable smart warmups before queuing.
- **Training programs**: `users/{uid}/trainingProgram/{uuid}` — full multi-day, multi-cycle programs. Same library/active patterns as customWorkouts: id must be in `workoutLibraryIds`, and `profiles/workout.activeProgramId` controls which one is current. The `createTrainingProgram` / `updateTrainingProgram` / `deleteTrainingProgram` / `setActiveProgram` client methods handle these. **Cross-cycle constraint (verified)**: every exercise in a program must have the same number of cycles — mixed `periodizedTargets.values.length` breaks app rendering. The `buildProgramDocument` helper validates this. **Required empty fields**: `workoutCycleCompletions` and `programExerciseIdToNote` must exist as `{}` on new programs, otherwise the app fails to render. **Rest days**: encode as `{ id, name, gymId: "blankSlate", blocks: [] }` — no `isRestDay` field (app infers from empty blocks).

### FoodEntry Class

`types.ts` exports `FoodEntry` — the only class (not interface). Encapsulates macro calculation:

- `multiplier()`: `(userQty * unitWeight) / servingGrams`
- `calories()`, `protein()`, `carbs()`, `fat()`: raw value × multiplier
- Field semantics: gram mode (`w=1, y=grams`) vs unit mode (`w=servingGrams, y=count`)

## Anti-Patterns

- **NEVER** use `patchDocument()` for food entries → use `patchFoodDocument()` (creation) or `updateFoodEntryFields()` (partial update)
- **NEVER** use `patchFoodDocument()` for partial updates → it replaces the entire entry; use `updateFoodEntryFields()`
- **NEVER** read `/exercises` from Firestore → 403 App Check; use local `exercises.ts` for bundled exercises
- **NEVER** assume exercise IDs are hex — custom exercises use UUIDs. `resolveName()` only handles bundled hex IDs; for custom exercises, use `getCustomExercises()` or the `customNameMap` in `getWorkout()`
- **NEVER** pass JS `Date` for meal time → use `LogTime { date, hour, minute }`
- **NEVER** use meal time as entry ID → use `Date.now() * 1000` for unique IDs
- `getRawWorkout()` for writes; `getWorkout()` for reads (parsed types differ from raw)
