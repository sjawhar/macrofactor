# MacroFactor MCP Server — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Goal

Package the existing MacroFactor TypeScript API client as an MCP (Model Context Protocol) server that AI agents can use to read and write nutrition, workout, and weight data. The server supports two transports from a single codebase:

1. **stdio** (primary) — for coding agents (Claude Code, Cursor, Windsurf, etc.) running locally
2. **Streamable HTTP** (secondary) — for Claude.ai custom connectors and other remote MCP clients

The project is open source and self-hosted: each user deploys their own instance with their own MacroFactor credentials.

## Non-Goals

- Centrally hosted multi-tenant service
- OAuth authorization server / dynamic client registration
- Mobile or browser-based MCP client
- Changes to the existing API client, CLI, or SvelteKit frontend

## Architecture

### Approach: Additive layer in the existing repo

The MCP server is a new consumer of `src/lib/api/`, alongside the existing CLI (`cli/`) and SvelteKit frontend (`src/routes/`). No code moves, no monorepo split.

### File Structure

```
src/mcp/
├── server.ts           # createServer(client) factory — registers all tools
├── tools/
│   ├── food.ts         # Food log tools (read + write)
│   ├── workout.ts      # Workout tools (read + write)
│   ├── weight.ts       # Weight tools (read + write)
│   ├── nutrition.ts    # Nutrition + steps tools (read only)
│   └── profile.ts      # Profile, gyms, exercises, context (read only)
├── stdio.ts            # Entry point: StdioServerTransport (local agents)
└── http.ts             # Entry point: StreamableHTTPServerTransport (remote)

tsup.config.ts          # Bundle MCP server + API client → dist/
```

### Server Factory

`createServer(client: MacroFactorClient)` accepts an already-authenticated client and returns a configured `McpServer`. It does not handle auth — each entry point logs in its own way.

```
stdio.ts                          http.ts
  │                                 │
  ├─ Read creds from env/.env       ├─ Read creds from env vars
  ├─ MacroFactorClient.login()      ├─ MacroFactorClient.login()
  ├─ createServer(client)           ├─ createServer(client)
  └─ connect(StdioTransport)        └─ serve on /mcp (StreamableHTTP)
```

### Dependency Direction

```
External APIs (Firebase, Firestore, Typesense)
        ↑
  src/lib/api/  (core client — unchanged)
        ↑
  ┌─────┼──────────────┐
  │     │              │
  cli/  src/mcp/       src/routes/
```

## Tool Surface

28 tools total: 15 read, 13 write. Tools mirror CLI-level abstractions (exercise name resolution, search-then-log, weight unit conversion built in).

### Read Tools

All annotated with `readOnlyHint: true`.

| Tool                   | Input                                  | Description                                                                                                                                              |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_context`          | `{}`                                   | Today's snapshot: food log summary, macro targets + remaining, recent weight trend, active program, next workout. The go-to tool for "what's my status?" |
| `get_food_log`         | `{date?: string}`                      | Food entries for a date (default: today). Returns name, macros, serving, meal time for each entry.                                                       |
| `get_nutrition`        | `{startDate: string, endDate: string}` | Daily macro totals (calories, protein, carbs, fat) for a date range. Computed from food log.                                                             |
| `get_weight_entries`   | `{startDate: string, endDate: string}` | Scale entries for a date range. Returns date, weight (kg), body fat %.                                                                                   |
| `get_steps`            | `{startDate: string, endDate: string}` | Step counts for a date range.                                                                                                                            |
| `get_profile`          | `{}`                                   | User profile and preferences.                                                                                                                            |
| `get_goals`            | `{}`                                   | Current macro targets (calories, protein, carbs, fat, TDEE).                                                                                             |
| `get_workouts`         | `{from?: string, to?: string}`         | Workout history. Returns name, date, exercise count, set count, gym, duration.                                                                           |
| `get_workout`          | `{id: string}`                         | Full workout detail with exercise names resolved, sets with weight/reps/rest.                                                                            |
| `get_gym_profiles`     | `{}`                                   | List gym profiles (id, name, icon, equipment).                                                                                                           |
| `get_custom_exercises` | `{}`                                   | List user-created exercises.                                                                                                                             |
| `get_training_program` | `{}`                                   | Active training program: days, exercises per day, periodization.                                                                                         |
| `get_next_workout`     | `{}`                                   | Next workout in the program cycle: day name, exercises, cycle position.                                                                                  |
| `search_foods`         | `{query: string}`                      | Search MacroFactor's food database (USDA + branded). Returns food ID, name, macros per 100g, available servings.                                         |
| `search_exercises`     | `{query: string}`                      | Search the bundled exercise database by name. Returns exercise ID, name, primary/secondary muscles, equipment.                                           |

### Write Tools

Annotated with `destructiveHint: false` unless noted.

| Tool                | Input                                                                                                                                                                                                    | Description                                                                                                                 | Destructive |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `log_food`          | `{query: string, grams?: number, amount?: number, unit?: string, date?: string, hour?: number, minute?: number}`                                                                                         | Search for a food and log it. Grams mode (`grams` param) or unit mode (`amount` + `unit` params). Date/time default to now. | No          |
| `log_manual_food`   | `{name: string, calories: number, protein: number, carbs: number, fat: number, date?: string, hour?: number, minute?: number}`                                                                           | Log food with explicit macro values (no search). For foods not in the database.                                             | No          |
| `log_weight`        | `{lbs?: number, kg?: number, date?: string, bodyFat?: number}`                                                                                                                                           | Log a scale entry. Accepts lbs or kg (auto-converts). Date defaults to today.                                               | No          |
| `log_workout`       | `{name: string, gym?: string, startTime?: string, durationMinutes?: number, exercises: [{name: string, sets: [{reps: number, lbs?: number, kg?: number, sets?: number, rest?: number, rir?: number}]}]}` | Create a new workout. Exercise names resolved automatically. Sets expanded (e.g., `sets: 3` → 3 individual sets).           | No          |
| `log_exercise`      | `{workoutId: string, exercises: [{name: string, sets: [...]}]}`                                                                                                                                          | Append exercises to an existing workout. Same input format as `log_workout` exercises.                                      | No          |
| `update_food`       | `{date: string, entryId: string, quantity: number}`                                                                                                                                                      | Update the quantity of an existing food entry.                                                                              | No          |
| `update_workout`    | `{id: string, name?: string, startTime?: string, durationMinutes?: number, ...}`                                                                                                                         | Update workout metadata (name, time, duration, etc.) by ID.                                                                 | No          |
| `copy_food_entries` | `{fromDate: string, toDate: string, entryIds?: string[]}`                                                                                                                                                | Copy food entries from one date to another. Optionally specify which entries to copy.                                       | No          |
| `delete_food`       | `{date: string, entryId: string}`                                                                                                                                                                        | Soft-delete a food entry (sets `d: true` flag, preserves data).                                                             | **Yes**     |
| `hard_delete_food`  | `{date: string, entryId: string}`                                                                                                                                                                        | Permanently delete a food entry from Firestore.                                                                             | **Yes**     |
| `delete_weight`     | `{date: string}`                                                                                                                                                                                         | Delete a weight entry for a date.                                                                                           | **Yes**     |
| `delete_workout`    | `{id: string}`                                                                                                                                                                                           | Delete an entire workout.                                                                                                   | **Yes**     |
| `remove_exercise`   | `{workoutId: string, exerciseId: string}`                                                                                                                                                                | Remove a specific exercise from a workout.                                                                                  | **Yes**     |

## Credentials & Auth

### Two Layers

1. **App → MacroFactor** (inner): Email/password for Firebase auth. Env vars `MACROFACTOR_USERNAME` and `MACROFACTOR_PASSWORD`.
2. **User → MCP Server** (outer, HTTP only): Bearer token to protect the `/mcp` endpoint.

### stdio Mode

Credentials read from environment variables. Lookup order:

1. `MACROFACTOR_USERNAME` + `MACROFACTOR_PASSWORD` env vars
2. `.env` file in current working directory

No transport auth — stdio runs as a local subprocess, OS-level access control is sufficient.

### HTTP Mode

Same credential sources for MacroFactor login. Additionally:

- `MCP_AUTH_TOKEN` env var — a random secret the user generates during setup.
- `http.ts` checks `Authorization: Bearer <token>` on every request. Rejects with 401 if missing or wrong.
- The user pastes the same token into their Claude.ai connector settings (or any remote MCP client).

### Token Lifecycle

`MacroFactorClient` handles Firebase token refresh internally (auto-refreshes 60s before expiry). One login at server startup, no re-auth needed.

## Distribution & Packaging

### npm Package

Published as `@sjawhar/macrofactor-mcp` on npm. Bundled with `tsup` to produce self-contained JS files.

```json
{
  "name": "@sjawhar/macrofactor-mcp",
  "bin": { "macrofactor-mcp": "./dist/mcp/stdio.js" },
  "files": ["dist/", "data/exercises.json"]
}
```

The `data/exercises.json` (2.5MB) is bundled in the package. It's required at runtime for exercise name resolution.

### Build

```bash
npm run build:mcp    # tsup bundles src/mcp/ + src/lib/api/ → dist/
```

Independent from the SvelteKit build. Neither affects the other.

### Usage: Local Agents (stdio)

```bash
# Option A: npx (no install)
npx @sjawhar/macrofactor-mcp

# Option B: global install
npm install -g @sjawhar/macrofactor-mcp
macrofactor-mcp
```

Agent MCP config (e.g., Claude Code):

```json
{
  "mcpServers": {
    "macrofactor": {
      "command": "npx",
      "args": ["@sjawhar/macrofactor-mcp"],
      "env": {
        "MACROFACTOR_USERNAME": "you@email.com",
        "MACROFACTOR_PASSWORD": "yourpass"
      }
    }
  }
}
```

### Usage: Remote (HTTP)

```bash
# Run locally
MACROFACTOR_USERNAME=you@email.com \
MACROFACTOR_PASSWORD=yourpass \
MCP_AUTH_TOKEN=your-secret \
node dist/mcp/http.js
# → Listening on http://localhost:3001/mcp

# Or deploy to any platform that runs Node.js
# Set env vars through platform dashboard, then paste URL into Claude.ai
```

The HTTP entry point is platform-agnostic. No Cloudflare/Vercel/AWS-specific code in the application layer. Deployment platform is an operational choice, not an architectural one.

## Testing Strategy

The MCP tool layer is thin wiring — inputs go in, client methods get called, JSON comes out. The interesting logic (Firestore encoding, exercise resolution, weight conversion, set expansion) lives in the core client and CLI helpers, which are already tested.

New tests for the MCP layer:

- **Integration tests**: Spin up the MCP server in-process using the SDK's client. Call each tool and verify it returns the expected shape. Mock the `MacroFactorClient` to avoid hitting real Firebase.
- **Wiring tests**: Verify that tool input schemas match what the underlying client methods expect (e.g., `log_food` with `grams: 150` actually calls `logSearchedFood` with `gramMode: true`).

## What Does NOT Change

- `src/lib/api/` — Core client, untouched
- `cli/` — CLI, untouched
- `src/routes/` — SvelteKit frontend, untouched
- `data/exercises.json` — Bundled as-is
- Existing tests, CI pipeline, dev workflow

## Dependencies Added

- `@modelcontextprotocol/sdk` — MCP server SDK (provides `McpServer`, transports)
- `zod` — Input schema validation (required by MCP SDK)
- `tsup` (devDependency) — Bundler for producing self-contained dist files

## Resolved Decisions

1. **Package name**: `@sjawhar/macrofactor-mcp` — scoped to the author's npm account since this is a community/reverse-engineered tool, not official.
2. **HTTP port**: Default port (e.g., 3001) with `PORT` env var override. Standard pattern.
3. **Tool descriptions**: Detailed (3-4+ sentences per tool). Each description covers: what it does, when to use it, when NOT to use it (disambiguation), prerequisites ("call X first"), related tools, and return shape. Complex tools (e.g., `log_workout`) use MCP SDK's `input_examples` field for structured examples. Based on Anthropic's guidance that detailed descriptions are "by far the most important factor in tool performance" and Arcade's 54 Patterns taxonomy.
4. **Resource exposure**: No. `search_exercises` and `get_custom_exercises` tools are sufficient. Exposing 2.5MB of raw JSON as an MCP resource adds complexity without clear benefit.
