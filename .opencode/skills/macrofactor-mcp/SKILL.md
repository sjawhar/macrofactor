---
name: macrofactor-mcp
description: Use when reading or writing MacroFactor nutrition, food logs, weight, workout, or training program data. Triggers on meal tracking, macro counting, calorie logging, body weight, exercise logging, food search, or any MacroFactor interaction.
mcp:
  macrofactor:
    command: secrets
    args: ['MACROFACTOR_USERNAME', 'MACROFACTOR_PASSWORD', '--', 'npx', '@sjawhar/macrofactor-mcp']
    env:
      SOPS_AGE_KEY: '${SOPS_AGE_KEY}'
---

# MacroFactor

Read and write nutrition, workout, and weight data via the MacroFactor MCP server. Use `skill_mcp(mcp_name="macrofactor", ...)` to invoke tools.

For Firestore schema details, field encodings, and common gotchas, see `references/api-reference.md`.

## MCP Tools

### Read

| Tool                   | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `get_context`          | Today's snapshot: food log, macro targets + remaining, weight trend, program, next workout |
| `get_food_log`         | Food entries for a date (default today)                                                    |
| `get_nutrition`        | Daily macro totals for a date range                                                        |
| `get_weight_entries`   | Scale entries for a date range                                                             |
| `get_steps`            | Step counts for a date range                                                               |
| `get_profile`          | User profile and preferences                                                               |
| `get_goals`            | Current macro targets (cal, protein, carbs, fat, TDEE)                                     |
| `get_workouts`         | Workout history (optional date filter)                                                     |
| `get_workout`          | Full workout detail by ID                                                                  |
| `get_gym_profiles`     | Gym profiles (id, name, equipment)                                                         |
| `get_custom_exercises` | User-created exercises                                                                     |
| `get_training_program` | Active training program days and exercises                                                 |
| `get_next_workout`     | Next workout in the program cycle                                                          |
| `search_foods`         | Search MacroFactor food database (USDA + branded)                                          |
| `search_exercises`     | Search bundled exercise database by name                                                   |

### Write

| Tool                     | Purpose                                                        | Destructive |
| ------------------------ | -------------------------------------------------------------- | ----------- |
| `log_food`               | Search + log a food (`query` + `grams` or `amount`/`unit`)     | No          |
| `log_manual_food`        | Log food with explicit macros (name, cal, protein, carbs, fat) | No          |
| `log_weight`             | Log scale entry (accepts `lbs` or `kg`)                        | No          |
| `log_workout`            | Create workout with exercises and sets                         | No          |
| `log_exercise`           | Append exercises to existing workout                           | No          |
| `update_food`            | Update food entry quantity                                     | No          |
| `update_workout`         | Update workout metadata (name, time, etc.)                     | No          |
| `copy_food_entries`      | Copy food entries between dates                                | No          |
| `delete_food`            | Soft-delete food entry                                         | Yes         |
| `hard_delete_food`       | Permanently delete food entry                                  | Yes         |
| `delete_weight`          | Delete weight entry                                            | Yes         |
| `delete_workout`         | Delete entire workout                                          | Yes         |
| `remove_exercise`        | Remove exercise from workout                                   | Yes         |
| `create_custom_exercise` | Create custom exercise with muscle/joint metadata              | No          |

## Usage Examples

```
# What's my status today?
skill_mcp(mcp_name="macrofactor", tool_name="get_context")

# Log 150g of kale
skill_mcp(mcp_name="macrofactor", tool_name="log_food", arguments='{"query": "kale raw", "grams": 150}')

# Log food with specific macros
skill_mcp(mcp_name="macrofactor", tool_name="log_manual_food", arguments='{"name": "Protein Shake", "calories": 250, "protein": 40, "carbs": 10, "fat": 5}')

# Log weight
skill_mcp(mcp_name="macrofactor", tool_name="log_weight", arguments='{"lbs": 180}')

# Week of nutrition data
skill_mcp(mcp_name="macrofactor", tool_name="get_nutrition", arguments='{"startDate": "2026-03-17", "endDate": "2026-03-23"}')

# Log a workout
skill_mcp(mcp_name="macrofactor", tool_name="log_workout", arguments='{"name": "Push Day", "gym": "Home", "exercises": [{"name": "bench press", "sets": [{"reps": 10, "lbs": 135, "sets": 3}]}]}')

# What's next in my program?
skill_mcp(mcp_name="macrofactor", tool_name="get_next_workout")

# Create a custom exercise (reference a similar bundled exercise for metadata)
skill_mcp(mcp_name="macrofactor", tool_name="create_custom_exercise", arguments='{"name": "Cable goblet squat", "primaryFeatureMuscle": ["2545c6f170d8804bb1fbdfc4471debe5"], "exerciseMetrics": ["2555c6f170d8805cafa6d16d3fdddbaa", "2555c6f170d88072bbf6d9ad3f16ea86"], "resistanceEquipmentGroups": [{"equipmentIds": ["19e5c6f170d880d28b46e9ccddcfba1a"]}]}')
```

## CLI (Alternative)

The CLI is available when MCP is not. Output is JSON. Auth reads from `.env` automatically (do NOT `source .env` — password has special chars).

| Action           | Command                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Context snapshot | `npx tsx cli/mf.ts context`                                                                         |
| Food log         | `npx tsx cli/mf.ts food-log [YYYY-MM-DD]`                                                           |
| Search foods     | `npx tsx cli/mf.ts search-food "query"`                                                             |
| Log food         | `npx tsx cli/mf.ts log-food '{"query":"kale","grams":150}'`                                         |
| Log manual food  | `npx tsx cli/mf.ts log-manual-food '{"name":"...","calories":200,"protein":30,"carbs":20,"fat":5}'` |
| Log weight       | `npx tsx cli/mf.ts log-weight '{"lbs":180}'`                                                        |
| Workouts         | `npx tsx cli/mf.ts workouts`                                                                        |
| Workout detail   | `npx tsx cli/mf.ts workout <uuid>`                                                                  |
| Log workout      | `npx tsx cli/mf.ts log-workout '{"name":"...","exercises":[...]}'`                                  |
| Training program | `npx tsx cli/mf.ts program`                                                                         |
| Next workout     | `npx tsx cli/mf.ts next-workout`                                                                    |
| Nutrition range  | `npx tsx cli/mf.ts nutrition --from YYYY-MM-DD --to YYYY-MM-DD`                                     |
| Weight history   | `npx tsx cli/mf.ts weight-history --from YYYY-MM-DD --to YYYY-MM-DD`                                |
| Goals            | `npx tsx cli/mf.ts goals`                                                                           |
| Search exercises | `npx tsx cli/mf.ts exercises search "bench press"`                                                  |
| Gyms             | `npx tsx cli/mf.ts gyms`                                                                            |
| Custom exercises | `npx tsx cli/mf.ts custom-exercises`                                                                |
| Create exercise  | `npx tsx cli/mf.ts create-exercise '{"name":"...","primaryFeatureMuscle":[...],...}'`               |

## Key Behaviors

- **Start with `get_context`** — goals, today's intake vs remaining, weight trend, next workout in one call.
- **Dates** are `YYYY-MM-DD`. Most default to today when omitted.
- **Weight** stored as kg internally. `log_weight` accepts `lbs` or `kg`, converts automatically.
- **`log_food`** searches by name and logs top result. Use `search_foods` first to pick a specific match. CLI also accepts `grams` for direct gram input (e.g. `grams: 80` instead of `servingIndex` + fractional `quantity`).
- **`log_workout`** takes exercise names (not IDs) and resolves them against both bundled and custom exercises. `sets: 3` expands to 3 individual sets.
- **Food times** default to now. Pass `hour`/`minute` for override (24h wall-clock, no timezone).
- **Entry IDs** for `update_food`/`delete_food` come from `get_food_log`.
- **Food corrections**: Use `update_food` to fix quantity — don't delete and re-log (creates ghost entries).
- **`log_manual_food`** works for custom-macro entries (e.g. restaurant meals). NEVER set the source type field `k` to `"manual"` — this crashes the Android app, blanking the entire day. The CLI/API already handles this correctly (uses `"n"`).
- **Custom exercises**: Use `create_custom_exercise` when an exercise isn't in the bundled DB. Reference a similar bundled exercise (via `search_exercises`) to populate muscle/joint metadata. Once created, use the exercise by name in `log_workout`/`log_exercise`.
- **Supersets**: In `log_workout`, use `blocks: [[ex1, ex2]]` instead of `exercises: [...]` for superset grouping.
- **Program-linked workouts**: When logging a workout for a training program, pass `workoutSource` with `programId`, `dayId`, and `cycleIndex`. The tool will automatically (1) attach set targets from `periodizedTargets.values[cycleIndex]` and (2) update `workoutCycleCompletions` on the program document so the day shows as checked off. Use `get_training_program` to find dayIds and `get_next_workout` for the current cycle position.
- **Dashboard sync**: After logging food, the CLI and MCP tools automatically trigger the app's dashboard to recompute by adding and hard-deleting a `_sync` entry. This works when the app is running. If the dashboard still shows stale totals, the user can force a refresh by adding and deleting any food on that day from within the app. This is a limitation of the app's local caching — the dashboard reads from a local cache updated by `FoodLogViewModel.updateNutrition`, which only fires reliably when food changes go through the app's own write pipeline.

## User Preferences

On first use, check for a user preferences file at `~/.config/macrofactor/preferences.md` (or `$XDG_CONFIG_HOME/macrofactor/preferences.md` if set). If it exists, read it and follow the instructions — it contains personal context like preferred units, equipment details, workout naming conventions, etc.

If the file doesn't exist, use sensible defaults and offer to create one when you learn user-specific preferences (e.g. "You mentioned you prefer kg — want me to save that to your preferences?").

## Analytical Patterns

| Analysis                           | Tools to combine                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Weekly nutrition report            | `get_context` → `get_nutrition` (7d range) → `get_goals` → compare daily intake vs targets  |
| Training-day vs rest-day nutrition | `get_training_program` → `get_nutrition` (range) → group by training/rest days              |
| TDEE estimation                    | `get_weight_entries` (30d) + `get_nutrition` (30d) → compare intake vs weight trend         |
| Protein consistency                | `get_goals` + `get_nutrition` (range) → daily protein attainment                            |
| Training volume analysis           | `get_training_program` → `get_workouts` → `get_workout` per session → sets/reps by exercise |

## Setup

The default frontmatter uses `secrets` for SOPS-encrypted credential injection. If you don't use SOPS, replace the MCP section in the frontmatter with direct env vars:

```yaml
mcp:
  macrofactor:
    command: npx
    args: ['@sjawhar/macrofactor-mcp']
    env:
      MACROFACTOR_USERNAME: '${MACROFACTOR_USERNAME}'
      MACROFACTOR_PASSWORD: '${MACROFACTOR_PASSWORD}'
```
