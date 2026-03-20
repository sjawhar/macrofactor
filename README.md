# MacroFactor CLI & API Client

A TypeScript client and CLI for interacting with [MacroFactor](https://macrofactorapp.com) programmatically — the nutrition and workout tracker by [Stronger By Science](https://www.strongerbyscience.com/).

> **This is not a replacement for MacroFactor.** You need an active MacroFactor subscription to use this. We love MacroFactor and the team behind it. This project exists because sometimes you want to interact with your own data without opening an app — batch-log meals from a script, update workout weights from a spreadsheet, or build your own integrations on top of an already great product.

## What it does

- **Read** your workout history, food logs, weight entries, nutrition summaries, gym profiles, and custom exercises
- **Write** food log entries, create new workouts, update existing workout sets, and log weight
- **Search** the MacroFactor food database (common foods + branded items via Typesense)
- **Resolve** the opaque 32-character hex IDs used for exercises, muscles, and equipment to human-readable names using the bundled reference database

## Quick start

```bash
# Install dependencies
pnpm install

# Set up credentials
cat > .env << 'EOF'
MACROFACTOR_USERNAME=your@email.com
MACROFACTOR_PASSWORD=your-password
EOF

# Try it out
npx tsx cli/mf.ts workouts          # List recent workouts
npx tsx cli/mf.ts food-log          # Today's food log
npx tsx cli/mf.ts search-food "kale"  # Search the food database
```

## CLI commands

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `workouts`                 | List recent workouts with exercise/set counts     |
| `workout <uuid>`           | Full detail for a specific workout                |
| `exercises search "query"` | Search the bundled exercise database              |
| `exercise <hex-id>`        | Resolve a hex ID to exercise name + muscles       |
| `gyms`                     | List gym profiles                                 |
| `food-log [YYYY-MM-DD]`    | Show food log for a date (default: today)         |
| `search-food "query"`      | Search the food database without logging          |
| `log-food '{JSON}'`        | Search and log a food entry (JSON input)          |
| `log-workout '{JSON}'`     | Create a workout with exercises (JSON input)      |
| `log-exercise '{JSON}'`    | Add exercises to an existing workout (JSON input) |
| `log-weight '{JSON}'`      | Log a scale entry (JSON input)                    |
| `delete-food '{JSON}'`     | Delete a food entry (JSON input)                  |
| `update-food '{JSON}'`     | Update a food entry quantity (JSON input)         |
| `profile`                  | Show user profile and preferences                 |

### Examples

```bash
# Read commands (positional args or JSON via stdin)
npx tsx cli/mf.ts workouts
npx tsx cli/mf.ts food-log 2026-03-20
echo '{"date":"2026-03-20"}' | npx tsx cli/mf.ts food-log

# Log a food (JSON input — positional arg or stdin)
npx tsx cli/mf.ts log-food '{"query":"kale raw","grams":150,"loggedAt":"2026-03-20T19:00:00-05:00"}'
npx tsx cli/mf.ts log-food '{"foodId":"n_2950","grams":100}'  # skip search with direct foodId

# Create a full workout in one call
npx tsx cli/mf.ts log-workout '{
  "name": "PM Session",
  "gym": "Gym",
  "startTime": "2026-03-20T17:00:00-05:00",
  "exercises": [
    {"name": "bench press", "sets": [{"reps": 10, "lbs": 135, "sets": 3}]},
    {"name": "cable crunch", "sets": [{"reps": 15, "lbs": 120, "sets": 3, "rest": 90}]}
  ]
}'

# Append exercise to existing workout
npx tsx cli/mf.ts log-exercise '{"workoutId": "<uuid>", "exercises": [{"name": "pullup", "sets": [{"reps": 10, "sets": 3}]}]}'

# Log weight
npx tsx cli/mf.ts log-weight '{"lbs": 180, "date": "2026-03-20"}'
```

## Programmatic usage

```typescript
import { MacroFactorClient } from './src/lib/api/index';
import { resolveExercise } from './src/lib/api/exercises';

const client = await MacroFactorClient.login(email, password);

// Read workouts
const workouts = await client.getWorkoutHistory();
const detail = await client.getWorkout(workouts[0].id);

// Resolve hex exercise IDs to names
const info = resolveExercise(detail.blocks[0].exercises[0].exerciseId);
console.log(info.name, info.primaryMuscles);

// Read today's food log
const food = await client.getFoodLog('2026-03-19');

// Search and log food
const results = await client.searchFoods('broccoli raw');
const serving = results[0].servings.find((s) => s.description === 'baby leaf');
await client.logSearchedFood(new Date(), results[0], serving, 150, true);
```

## Architecture

The MacroFactor app uses a Firebase/Firestore backend (`sbs-diet-app`). This client talks directly to the Firestore REST API using standard Firebase authentication.

- **User data** (workouts, food logs, weight, etc.) is read/write accessible via Firestore REST with a valid auth token
- **Reference data** (exercises, muscles, equipment) is locked behind Firebase App Check and returns 403 — this client resolves them locally using a bundled JSON database extracted from the app
- **Food search** uses MacroFactor's Typesense instance, which combines USDA common foods with a branded food database

All numeric food entry values are stored as Firestore `stringValue` (not `integerValue`/`doubleValue`) to match the Android app's parser expectations. The client enforces this at the type level to prevent entries that would crash the app.

See [`docs/api-reference.md`](docs/api-reference.md) for the full Firestore schema.

## Project structure

```
cli/mf.ts              CLI entry point
  helpers.ts           JSON input parsing, set expansion, weight conversion
  helpers.test.ts      Tests for CLI helpers
src/lib/api/
  auth.ts              Firebase auth (sign-in, token refresh)
  client.ts            MacroFactorClient class (all read/write methods)
  firestore.ts         Firestore REST helpers + food entry type safety
  typesense.ts         Food search via Typesense
  exercises.ts         Local exercise database resolver
  types.ts             Shared TypeScript types
  workout-types.ts     Workout-specific types
data/
  exercises.json       Bundled exercise/muscle/equipment database
docs/
  api-reference.md     Full Firestore schema documentation
```

## License

MIT
