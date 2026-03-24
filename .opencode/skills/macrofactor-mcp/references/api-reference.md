# MacroFactor API Reference

The MacroFactor API is a reverse-engineered Firebase/Firestore backend (`sbs-diet-app`). All user data is live via Firestore REST API. Global reference data (exercises, muscles, equipment) is locked behind Firebase App Check and resolved locally from a bundled database.

## Firestore Collections

| Path                                  | Contents                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| `users/{uid}/food/{YYYY-MM-DD}`       | Daily food log — entries keyed by microsecond timestamp       |
| `users/{uid}/workoutHistory/{uuid}`   | Completed workout sessions                                    |
| `users/{uid}/trainingProgram/{id}`    | Training program definitions (days, exercises, periodization) |
| `users/{uid}/profiles/workout`        | Workout settings, `activeProgramId`, gym IDs                  |
| `users/{uid}/profiles/diet`           | Diet app shortcuts/toolbar config                             |
| `users/{uid}/customExercises/{id}`    | User-created exercises                                        |
| `users/{uid}/gym/{id}`                | Gym profiles with equipment                                   |
| `users/{uid}/scale/{YYYY}`            | Weight entries, fields keyed by `MMDD`                        |
| `users/{uid}/steps/{YYYY}`            | Step counts, fields keyed by `MMDD`                           |
| `users/{uid}/nutritionSummary/{YYYY}` | Computed nutrition summaries, fields keyed by `MMDD`          |

## Food Entry Fields

Food entries use single-character field names within `users/{uid}/food/{YYYY-MM-DD}`:

| Field | Meaning              | Example                                           |
| ----- | -------------------- | ------------------------------------------------- |
| `t`   | Food title/name      | `"Kale, raw"`                                     |
| `c`   | Calories per serving | `"35.0"`                                          |
| `p`   | Protein per serving  | `"2.9"`                                           |
| `e`   | Carbs per serving    | `"4.4"`                                           |
| `f`   | Fat per serving      | `"0.7"`                                           |
| `g`   | Serving gram weight  | `"100.0"`                                         |
| `w`   | Weight multiplier    | `"1"` (gram mode) or serving grams (unit mode)    |
| `y`   | User quantity        | grams (gram mode) or unit count (unit mode)       |
| `q`   | Quantity divisor     | `"1"` (always)                                    |
| `u`   | Unit description     | `"g"` (gram mode) or `"cup, chopped"` (unit mode) |
| `k`   | Kind                 | `"t"` (always)                                    |
| `h`   | Hour (local, 24h)    | `13`                                              |
| `mi`  | Minute (local)       | `30`                                              |
| `d`   | Deleted flag         | `true` when soft-deleted                          |

**Nutrient calculation:** `total = macro × w × y / (g × q)`

### Gram Mode vs Unit Mode

| Field | Gram tracking (`150g`) | Unit tracking (`2 tbsp`) |
| ----- | ---------------------- | ------------------------ |
| `g`   | serving gram weight    | serving gram weight      |
| `w`   | `1`                    | serving gram weight      |
| `y`   | raw grams wanted       | unit count               |
| `q`   | `1`                    | `1`                      |
| `u`   | `"g"`                  | serving description      |

## Food Entry Type Safety (CRITICAL)

ALL food entry numeric values are stored as Firestore `stringValue` — never `integerValue` or `doubleValue`. Writing with native numeric types **crashes the MacroFactor Android app** for that entire day, rendering the food log blank.

The MCP tools and CLI handle this automatically. If using the TypeScript client directly:

- `sfv(value)` — string-typed field (integers get `.0` suffix: `1` → `"1.0"`)
- `bfv(value)` — boolean field
- `nfv()` — null field
- Always use `logSearchedFood()` or `logFood()` — never `patchDocument()` directly

## Food Entry IDs

Entries are keyed by `Date.now() * 1000` (microsecond wall-clock timestamp), NOT the meal time. The meal time is stored separately in `h`/`mi` fields.

Using meal time as ID causes silent overwrites when logging multiple foods at the same time — Firestore PATCH with the same field path replaces the value.

## Meal Time (LogTime)

The `h` and `mi` fields store the user's local wall-clock time with **no timezone**. Never round-trip through a JS `Date` — `Date.getHours()` converts to system timezone, silently shifting the hour.

The MCP tools accept `hour`/`minute` parameters directly and default to now.

## Weight

Always stored as kg internally, regardless of user's display preference. Convert lbs: `lbs / 2.2046226218`.

The `log_weight` MCP tool and CLI accept both `lbs` and `kg` and convert automatically.

## Duration & Rest Timers

Firestore stores durations in **microseconds**. The MCP tools accept human-friendly values:

- `durationMinutes` for workout duration
- `rest` in seconds for set rest timers

If using the client directly, multiply seconds × 1,000,000 for raw writes.

## Exercise Resolution

The `/exercises` Firestore collection returns 403 (Firebase App Check). Exercise names are resolved from a local database bundled with the MCP server/CLI (4,170 exercises extracted from the APK).

- Exercise IDs are 32-character hex strings containing `c6f170d880`
- Workout IDs are standard UUIDs
- `search_exercises` and `log_workout` handle name → ID resolution automatically

## Training Programs

Program definitions live in `users/{uid}/trainingProgram/{id}`. The active program ID comes from `users/{uid}/profiles/workout` → `activeProgramId`.

Each program has a `days` array defining the full cycle. Rest days have empty `blocks` arrays and typically use `name: "---"` and `gymId: "blankSlate"`.

## Workout Structure

Workouts contain `blocks`, each with one or more `exercises`. A block with multiple exercises represents a superset/circuit. Each exercise has `sets` with:

| Field       | Meaning                            |
| ----------- | ---------------------------------- |
| `weight`    | kg (always)                        |
| `fullReps`  | Rep count                          |
| `rir`       | Reps in reserve (nullable)         |
| `restTimer` | Microseconds between sets          |
| `setType`   | `standard`, `warmUp`, or `failure` |

The `log_workout` MCP tool handles set expansion (`sets: 3` → 3 individual sets), weight conversion (lbs → kg), and rest timer conversion (seconds → microseconds) automatically.

## Common Mistakes

| Mistake                         | Fix                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `403 Forbidden` on `/exercises` | Use `search_exercises` tool — the database is bundled locally                              |
| Duration/rest values seem huge  | Firestore uses microseconds. MCP tools convert automatically.                              |
| `source .env` fails             | Password has special chars. CLI has its own `.env` parser — just run commands directly.    |
| Weight in wrong unit            | Internal storage is always kg. Use `lbs` param and tools convert.                          |
| Food entries overwriting        | Entry IDs must be unique per day. Tools use wall-clock microseconds, not meal time.        |
| Food logged at wrong hour       | `h`/`mi` are local time, no timezone. Pass `hour`/`minute` directly, don't use JS `Date`.  |
| Workout shows wrong time        | `startTime` stores hours/minutes without timezone. Offset part of ISO strings is stripped. |
| Ghost entries after delete      | `delete_food` is a soft delete (`d: true`). Use `update_food` to fix mistakes instead.     |
| Can't find program data         | It's in `trainingProgram/{id}`, not `programs/`. Active ID is in `profiles/workout`.       |
