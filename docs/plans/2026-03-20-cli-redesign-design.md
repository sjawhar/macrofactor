# CLI Redesign: JSON-First Interface

**Date:** 2026-03-20
**Status:** Approved

## Problem

The CLI's write commands use custom DSLs (`3x10@135lbs`, `150g`, `7pm`) that are lossy abstractions over a rich data model. The primary consumer is an AI agent, which prefers JSON. The custom parsers can't express varying weights per set, set types, RIR, or per-set rest timers. The timezone is hardcoded to `-6`.

## Design Principles

1. **JSON-in, JSON-out** — all commands accept JSON via positional arg or stdin
2. **Full expressiveness** — JSON schemas expose the complete data model, nothing is lossy
3. **Backward-compatible reads** — read commands keep positional args, gain optional stdin/JSON
4. **No timezone logic** — datetime fields are ISO 8601 with offset; CLI does zero tz math
5. **Resolved output** — write confirmations show resolved values (matched names, converted kg)

## Input Handling

Every command accepts JSON via positional argument or stdin. Stdin takes precedence when present (detected via `!process.stdin.isTTY`). Read commands additionally accept their current positional arg / flag syntax.

```typescript
async function readInput(positional: string[]): Promise<Record<string, any> | null> {
  if (!process.stdin.isTTY) {
    const raw = await readStdin();
    return JSON.parse(raw);
  }
  if (positional[0]?.trimStart().startsWith('{') || positional[0]?.trimStart().startsWith('[')) {
    return JSON.parse(positional[0]);
  }
  return null; // no JSON input — fall through to positional/flag parsing for reads
}
```

## Timestamps

All datetime fields are **ISO 8601 with timezone offset**. The CLI does zero timezone math — it parses the offset-aware string and extracts date/hour/minute directly.

```
"startTime": "2026-03-20T09:00:00-05:00"   // 9am Panama time
"loggedAt":  "2026-03-20T16:00:00Z"         // UTC is fine too
```

The caller (AI agent) knows the user's timezone from its env context and constructs correct timestamps. Date-only fields (`log-weight`, `food-log` queries) remain plain `"YYYY-MM-DD"` strings. Default when omitted: `new Date().toISOString()` (current UTC).

## Write Commands

All write commands require JSON input. Custom parsers (`parseSets`, `parseAmount`, `parseTime`) are removed.

### `log-workout` — Create a workout (one-shot with exercises)

```jsonc
{
  "name": "Morning Session",         // required
  "gym": "Gym",                      // optional, fuzzy-matches gym name
  "startTime": "2026-03-20T09:00:00-05:00",  // optional, ISO 8601, defaults to now
  "duration": 45,                    // optional, minutes, defaults to 45
  "exercises": [                     // optional, can create empty workout
    {
      "name": "EZ bar preacher curl",    // fuzzy-searches exercise DB
      "note": "",                        // optional
      "sets": [
        { "reps": 15, "lbs": 12.5 },
        { "reps": 12, "lbs": 32.5 },
        { "reps": 10, "lbs": 47.5, "sets": 2 },
        { "reps": 8, "lbs": 50, "type": "failure", "rir": 0 }
      ]
    }
  ]
}
```

**Set fields:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `reps` | yes | number | — | |
| `lbs` | no | number | 0 | Use `lbs` or `kg`, not both |
| `kg` | no | number | 0 | Use `lbs` or `kg`, not both |
| `sets` | no | number | 1 | Expands to N identical sets |
| `type` | no | string | `"standard"` | `"standard"` \| `"warmUp"` \| `"failure"` |
| `rir` | no | number | null | Reps in reserve |
| `rest` | no | number | 120 | Rest timer in seconds |

**Output:**
```jsonc
{
  "status": "created",
  "workoutId": "uuid",
  "name": "Morning Session",
  "gym": "Gym",
  "startTime": "2026-03-20T14:00:00.000Z",
  "durationMinutes": 45,
  "exercises": [
    {
      "name": "EZ bar preacher curl",
      "exerciseId": "1a15c6f1...",
      "sets": [
        { "reps": 15, "kg": 5.67, "type": "standard" }
      ]
    }
  ]
}
```

### `log-exercise` — Append exercise(s) to an existing workout

```jsonc
{
  "workoutId": "uuid",              // required
  "exercises": [                    // required, same structure as log-workout
    {
      "name": "cable rope triceps pushdown",
      "sets": [
        { "reps": 15, "lbs": 30, "sets": 2 },
        { "reps": 12, "lbs": 45, "sets": 3 }
      ]
    }
  ]
}
```

### `log-food` — Log a food entry

```jsonc
{
  // Food identification — one of:
  "query": "broccoli raw",          // searches food DB, picks top result
  "foodId": "n_2950",               // OR direct food ID (skip search)

  // Quantity — one of:
  "grams": 150,                     // gram mode
  // OR
  "amount": 2,                      // unit mode
  "unit": "cup",

  "loggedAt": "2026-03-20T11:00:00-05:00",  // optional, ISO 8601, defaults to now
  "pick": 0                         // optional, search result index, default 0
}
```

**Output:**
```jsonc
{
  "status": "logged",
  "food": "Broccoli, Raw",
  "foodId": "n_2950",
  "serving": "100 g",
  "quantity": 150,
  "totalGrams": 150,
  "totalCalories": 51,
  "totalProtein": 4.2,
  "date": "2026-03-20"
}
```

### `log-weight` — Log a scale entry *(new)*

```jsonc
{
  "kg": 81.5,                       // use kg or lbs, not both
  "lbs": 179.7,
  "date": "2026-03-20",             // optional, defaults to today
  "bodyFat": 15.2                   // optional, percentage
}
```

### `delete-food` — Remove a food entry *(new)*

```jsonc
{
  "date": "2026-03-20",             // required
  "entryId": "1710000000000000"     // required
}
```

### `update-food` — Update quantity on a food entry *(new)*

```jsonc
{
  "date": "2026-03-20",             // required
  "entryId": "1710000000000000",    // required
  "quantity": 200                   // required
}
```

## Read Commands

Read commands keep their current positional arg / flag syntax. They also accept optional JSON via stdin or positional arg for MCP compatibility.

| Command | Current syntax (stays) | JSON alternative |
|---------|----------------------|-----------------|
| `workouts` | `--from <date> --to <date>` | `{"from":"...","to":"..."}` |
| `workout <uuid>` | positional | `{"id":"uuid"}` |
| `exercises search <query>` | positional | `{"query":"..."}` |
| `exercise <hex-id>` | positional | `{"id":"hex"}` |
| `gyms` | no args | no JSON needed |
| `profile` | no args | no JSON needed |
| `food-log [date]` | positional | `{"date":"YYYY-MM-DD"}` |
| `search-food <query>` | positional | `{"query":"..."}` |
| `program` | no args | no JSON needed |
| `next-workout` | no args | no JSON needed |

When JSON input is present, it takes precedence over positional args/flags.

## Removed

- `parseSets()` — replaced by JSON sets array
- `parseAmount()` — replaced by `grams` / `amount`+`unit` fields
- `parseTime()` — replaced by ISO 8601 timestamps
- `findServing()` — still used internally, hidden behind JSON interface
- `buildDate()` — removed entirely, no timezone math needed
- `TIMEZONE_OFFSET_HOURS = -6` — removed entirely

## Documentation Updates

- **SKILL.md** (lines 22-37): Update quick reference table with JSON examples
- **README.md** (lines 32-63): Update command reference and examples
