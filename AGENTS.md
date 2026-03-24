# MacroFactor — Project Knowledge Base

**Generated:** 2026-03-22 | **Commit:** 7025f717 | **Branch:** main

## Overview

SvelteKit 2 + Svelte 5 web app + Node.js CLI for the [MacroFactor](https://macrofactorapp.com) nutrition/workout tracker. Talks directly to MacroFactor's Firebase/Firestore backend (`sbs-diet-app`) — no custom server. SSR disabled; client-side auth via Firebase Identity Toolkit.

## Structure

```
macrofactor/
├── src/
│   ├── routes/           # SvelteKit file-based routing (8 feature pages)
│   │   ├── +layout.svelte    # Root layout: auth guard, sidebar nav
│   │   ├── +layout.ts        # Disables SSR (export const ssr = false)
│   │   └── {feature}/+page.svelte
│   ├── lib/
│   │   ├── api/          # ⭐ Core API layer — see src/lib/api/AGENTS.md
│   │   ├── stores/       # Svelte 5 rune stores (auth.svelte.ts only)
│   │   ├── date.ts       # localDate(), today(), daysAgo()
│   │   └── food-icons.ts # imageId → emoji mapping + name heuristics
│   ├── app.css           # Design system: CSS custom properties, dark theme
│   ├── app.html          # HTML shell
│   └── app.d.ts          # SvelteKit type augmentation
├── cli/                  # ⭐ CLI tool — see cli/AGENTS.md
├── data/
│   ├── exercises.json    # Bundled exercise/muscle/equipment DB (2.6MB, from APK)
│   └── samples/          # Firestore schema samples (gitignored)
├── docs/
│   └── api-reference.md  # Firestore REST schema documentation
├── scripts/
│   ├── extract-exercises.mjs  # Extract exercises.json from APK
│   └── discover-schema.mjs    # Sample Firestore collections
├── design-reference/     # App screenshots (gitignored in prettier)
└── DISCREPANCIES.md      # Feature gap tracker vs native app
```

## Where to Look

| Task                     | Location                            | Notes                                               |
| ------------------------ | ----------------------------------- | --------------------------------------------------- |
| Add/modify a page        | `src/routes/{feature}/+page.svelte` | Single file per route, no +server.ts                |
| API calls (read/write)   | `src/lib/api/client.ts`             | `MacroFactorClient` class                           |
| Firestore field encoding | `src/lib/api/firestore.ts`          | `sfv()`, `bfv()`, `nfv()` for food entries          |
| Food search              | `src/lib/api/typesense.ts`          | Typesense multi-collection search                   |
| Exercise ID resolution   | `src/lib/api/exercises.ts`          | Local lookup from `data/exercises.json`             |
| Auth flow (web)          | `src/lib/stores/auth.svelte.ts`     | localStorage refresh token                          |
| Auth flow (Firebase)     | `src/lib/api/auth.ts`               | `signIn()`, `refreshIdToken()`                      |
| CLI commands             | `cli/mf.ts`                         | 15+ commands, JSON in/out                           |
| Design tokens            | `src/app.css`                       | CSS custom properties (colors, spacing, typography) |
| Firestore schema docs    | `docs/api-reference.md`             | Field names, types, collections                     |
| Feature gaps             | `DISCREPANCIES.md`                  | Prioritized list vs native app                      |

## Conventions

- **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props` — no legacy `$:` or stores
- **No SSR**: `+layout.ts` exports `ssr = false`; all data fetching in `$effect` blocks
- **No +server.ts routes**: All API calls go directly to Firebase/Typesense from client
- **CSS**: Scoped `<style>` in each `.svelte` file; global tokens in `app.css`
- **Dark-only theme**: Black background (#000), monochrome with macro colors (blue=cal, red=protein, yellow=fat, green=carbs)
- **Formatting**: Prettier — 120 char width, single quotes, 2-space indent, trailing commas ES5
- **Tests**: Vitest, colocated (`*.test.ts`), only CLI helpers tested currently
- **No ESLint**: Type safety via TypeScript strict mode + svelte-check

## Anti-Patterns (CRITICAL)

### Food Entry Type Safety

All food entry numeric values **MUST** be Firestore `stringValue` — NEVER `integerValue`/`doubleValue`. Wrong types **crash the Android app** for that entire day.

- Use `sfv()`, `bfv()`, `nfv()` from `firestore.ts`
- Use `logSearchedFood()` / `logFood()` — never `patchDocument()` directly for food entries
- Use `updateFoodEntryFields()` for partial updates — `patchFoodDocument()` replaces the entire entry
- The `k` (source type) field **MUST NOT** be `"manual"` — this value crashes the Android app, blanking the entire day. Use `"n"` instead. Confirmed via binary search: `k: "manual"` is the sole crash trigger.

### Meal Time

`h`/`mi` fields are user's wall-clock time with NO timezone. Never round-trip through JS `Date`. Use `LogTime { date, hour, minute }`.

### Entry IDs

Food entries keyed by `Date.now() * 1000` (microseconds). Using meal time as ID causes silent overwrites when logging multiple foods at the same time.

### Weight

Always stored as kg internally. Convert lbs: `lbs / 2.2046226218`.

### Duration/Rest

Firestore stores microseconds. `getWorkout()` returns seconds (parsed). `getRawWorkout()` returns raw (for writes). Multiply seconds × 1,000,000 for raw writes.

### Exercise Resolution

**Bundled exercises** (4,170 hex IDs in `data/exercises.json`): Use `resolveExercise()` / `resolveName()` / `lookupExercise()` from local `exercises.ts`. The `/exercises` Firestore collection returns 403 (App Check).

**Custom exercises** (user-created, UUID IDs in `users/{uid}/customExercises/{uuid}`): Use `client.getCustomExercises()` / `client.createCustomExercise()`. Custom exercises are NOT in the bundled DB — any code that resolves exercise names must check both sources. The MCP `log_workout`/`log_exercise` tools and CLI `log-workout` already handle this fallback. When displaying workout details, `getWorkout()` fetches custom exercises for name resolution automatically.

### Program-Linked Workouts

When logging a workout that belongs to a training program (i.e. has `workoutSource` with `programId`, `dayId`, `cycleIndex`), two things must happen:

1. **Set targets**: Each exercise's sets should have `target` objects from the program's `periodizedTargets.values[cycleIndex]`. These are attached positionally — exercise N in the workout gets targets from exercise N in the program day. The CLI and MCP `log_workout` handle this automatically when `workoutSource` is provided.

2. **Completion tracking**: The program document (`users/{uid}/trainingProgram/{programId}`) has a `workoutCycleCompletions` map that tracks which days have been completed per cycle. Structure: `workoutCycleCompletions[cycleIndex].completionById[dayId] = { runtimeType: 'completed', workoutHistoryIds: [workoutId] }`. Without this, the app won't show the day as checked off in the program view. Use `client.markProgramDayCompleted()` — the CLI and MCP do this automatically.

### `.env` Parsing

Password may contain backticks/special chars. Never `source .env` in bash. CLI has its own `.env` parser.

## Commands

```bash
# Dev
pnpm install              # Install deps
npm run dev               # Start dev server (Vite)
npm run build             # Production build
npm run preview           # Preview production build

# Quality
npm run format            # Prettier format
npm run format:check      # Check formatting
npm run typecheck         # svelte-check + TypeScript
npm run check             # Alias for typecheck
npm run test              # Vitest (single run)
npm run test:watch        # Vitest (watch mode)

# CLI
npx tsx cli/mf.ts <command> [args]   # Run CLI (reads .env automatically)
```

## CI Pipeline

GitHub Actions on push/PR to `main`: format:check → typecheck → build. Tests not in CI.

## Notes

- `data/exercises.json` is 2.6MB bundled — contains 4,170 hex IDs mapping exercises, muscles, equipment
- Workout IDs are UUIDs; bundled exercise/muscle/equipment IDs are 32-char hex containing `c6f170d880`; custom exercise IDs are UUIDs
- Food entries use single-char field names (`t`=title, `c`=cal, `p`=protein, `e`=carbs, `f`=fat, `g`=serving grams, etc.)
- Nutrition summaries may not exist in Firestore — `getNutrition()` computes from food log
- Both `package-lock.json` and `pnpm-lock.yaml` exist; pnpm is primary
- Node 22+ required (engine-strict in `.npmrc`)
