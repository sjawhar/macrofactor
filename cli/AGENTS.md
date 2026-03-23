# cli — MacroFactor CLI Tool

Standalone CLI for MacroFactor API. JSON in/out. Invoked via `npx tsx cli/mf.ts <command>`.

## Structure

```
cli/
├── mf.ts           # Entry point: arg parsing, command dispatch (759 lines)
├── helpers.ts      # parseISO, resolveWeight, expandSets, readInput
├── helpers.test.ts # 20 Vitest tests (only test file in project)
└── shims.d.ts      # Type declarations
```

## Commands

| Command            | Input                         | Description                  |
| ------------------ | ----------------------------- | ---------------------------- |
| `login`            | —                             | Verify credentials           |
| `workouts`         | `{from?, to?}`                | List workout history         |
| `workout`          | `<uuid>` or `{id}`            | Full workout detail          |
| `exercises search` | `<query>`                     | Search bundled exercise DB   |
| `exercise`         | `<hex-id>`                    | Resolve exercise ID          |
| `gyms`             | —                             | List gym profiles            |
| `profile`          | —                             | User profile                 |
| `food-log`         | `[YYYY-MM-DD]`                | Day's food log               |
| `search-food`      | `<query>`                     | Search food DB               |
| `log-food`         | `{query, grams\|amount+unit}` | Search + log food            |
| `log-weight`       | `{kg\|lbs, date?}`            | Log scale entry              |
| `delete-food`      | `{date, entryId}`             | Soft-delete food entry       |
| `update-food`      | `{date, entryId, quantity}`   | Update food qty              |
| `log-workout`      | `{name, exercises[]}`         | Create workout               |
| `log-exercise`     | `{workoutId, exercises[]}`    | Append to workout            |
| `program`          | —                             | Show active training program |
| `next-workout`     | —                             | Next day in training cycle   |

## Key Patterns

- **Input**: Positional JSON arg OR piped stdin. `readInput()` handles both.
- **Output**: Always `JSON.stringify(result, null, 2)` to stdout. Errors to stderr.
- **Auth**: Reads `.env` with custom parser (NOT `source .env` — password has special chars). Falls back to env vars.
- **Weight**: Accepts `kg` or `lbs`. Internal conversion via `resolveWeight()`.
- **Sets**: `expandSets()` expands `{reps, lbs, sets: 3}` → 3 individual set objects with kg conversion and microsecond rest timers.
- **Timestamps**: `parseISO()` extracts date/hour/minute directly from ISO string regex — never round-trips through JS `Date`.

## Testing

- Vitest colocated: `helpers.test.ts`
- Tests cover: `parseISO` (7), `resolveWeight` (3), `expandSets` (4), `readInput` (6)
- Run: `npm test` or `npm run test:watch`
- Notable: test for timezone bug documents why `LogTime` exists (never use `Date.getHours()`)
