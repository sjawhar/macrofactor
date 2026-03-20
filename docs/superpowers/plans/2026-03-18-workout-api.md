# MacroFactor Workout API Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the MacroFactor web app with workout API support — exercise database, TypeScript client methods, schema discovery script, API reference docs, CLI, and a Claude skill.

**Architecture:** Firestore REST API (same auth as nutrition). Workout data lives under `users/{uid}/workoutHistory/{uuid}`, `users/{uid}/gym/{uuid}`, `users/{uid}/customExercises/{uuid}`. Exercise name resolution uses a static JSON database extracted from the APK (`app_file.json`). A schema discovery script auto-generates TypeScript types from live Firestore data using quicktype.

**Tech Stack:** TypeScript, SvelteKit (existing), Firestore REST API, quicktype (dev dependency), Node.js CLI

---

## Chunk 1: Exercise Database & Lookup Module

### Task 1: Extract and commit exercise database

**Files:**
- Create: `data/exercises.json`
- Create: `scripts/extract-exercises.mjs`

This task extracts the exercise database from the already-unzipped APK at `/tmp/mf-apk/assets/flutter_assets/packages/macrofactor/assets/import/app_file.json` and commits a cleaned copy to the repo.

- [ ] **Step 1: Write the extraction script**

```javascript
// scripts/extract-exercises.mjs
// Reads app_file.json from APK extraction, outputs cleaned data/exercises.json
// Usage: node scripts/extract-exercises.mjs <path-to-app_file.json>
import { readFileSync, writeFileSync } from 'fs';

const inputPath = process.argv[2] ?? '/tmp/mf-apk/assets/flutter_assets/packages/macrofactor/assets/import/app_file.json';
const raw = JSON.parse(readFileSync(inputPath, 'utf8'));

const output = {
  generatedAt: raw.generatedAt,
  exercises: raw.exercises,
  uuidIndex: raw.uuidIndex,
};

writeFileSync('data/exercises.json', JSON.stringify(output));
console.log(`Wrote ${output.exercises.length} exercises, ${Object.keys(output.uuidIndex).length} index entries`);
```

- [ ] **Step 2: Run the extraction**

Run: `mkdir -p data && node scripts/extract-exercises.mjs`
Expected: `Wrote 1122 exercises, 4170 index entries`

Verify: `ls -lh data/exercises.json` — should be ~3.4MB

- [ ] **Step 3: Describe and advance**

```
jj describe -m "data: extract exercise database from APK (1122 exercises, 4170 entities)"
jj new
```

---

### Task 2: Exercise lookup module

**Files:**
- Create: `src/lib/api/exercises.ts`

Provides functions to resolve hex IDs to names and metadata, and to search exercises by name. Uses the static `data/exercises.json`.

- [ ] **Step 1: Create exercises.ts with lookup functions**

```typescript
// src/lib/api/exercises.ts
import exerciseData from '../../../data/exercises.json';

export interface ExerciseEntity {
  type: string;
  name: string;
  name_jp?: string | null;
  [key: string]: unknown;
}

export interface Exercise {
  id: string;
  name: string;
  name_jp?: string | null;
  exerciseType?: string;
  primaryFeatureMuscle: string[];
  secondaryFeatureMuscle: string[];
  regionTrained?: string;
  laterality: string[];
  exerciseMetrics: string[];
  resistanceEquipmentGroupIds: string[];
  supportEquipmentGroupIds: string[];
  recommendationLevelStrength?: number;
  recommendationLevelHypertrophy?: number;
  bodyweight: number;
  [key: string]: unknown;
}

const uuidIndex = exerciseData.uuidIndex as Record<string, ExerciseEntity>;
const exercises = exerciseData.exercises as Exercise[];
const exerciseById = new Map(exercises.map((e) => [e.id, e]));

/** Resolve any hex ID (exercise, muscle, equipment, etc.) to its entity. */
export function lookupEntity(hexId: string): ExerciseEntity | null {
  return uuidIndex[hexId] ?? null;
}

/** Resolve a hex ID to its human-readable name. Returns the ID itself if not found. */
export function resolveName(hexId: string): string {
  return uuidIndex[hexId]?.name ?? hexId;
}

/** Look up a full exercise by hex ID. */
export function lookupExercise(hexId: string): Exercise | null {
  return exerciseById.get(hexId) ?? null;
}

/** Search exercises by name (case-insensitive substring match). */
export function searchExercises(query: string): Exercise[] {
  const q = query.toLowerCase();
  return exercises.filter((e) => e.name.toLowerCase().includes(q));
}

/** Get all exercises. */
export function getAllExercises(): Exercise[] {
  return exercises;
}

/** Resolve an exercise, returning its name and resolved muscle groups. */
export function resolveExercise(hexId: string): {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  region: string;
  type: string;
} | null {
  const ex = lookupExercise(hexId);
  if (!ex) return null;
  return {
    name: ex.name,
    primaryMuscles: (ex.primaryFeatureMuscle ?? []).map(resolveName),
    secondaryMuscles: (ex.secondaryFeatureMuscle ?? []).map(resolveName),
    equipment: (ex.resistanceEquipmentGroupIds ?? []).map(resolveName),
    region: resolveName(ex.regionTrained ?? ''),
    type: resolveName(ex.exerciseType ?? ''),
  };
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit src/lib/api/exercises.ts` or check via `npm run check`

Note: If `resolveJsonModule` doesn't handle the 3.4MB JSON cleanly, fall back to a dynamic `readFileSync` import or a `createRequire` pattern. The tsconfig already has `"resolveJsonModule": true`.

- [ ] **Step 3: Describe and advance**

```
jj describe -m "feat: add exercise lookup module with name resolution and search"
jj new
```

---

## Chunk 2: Workout Types & Client Methods

### Task 3: Workout type definitions

**Files:**
- Create: `src/lib/api/workout-types.ts`

- [ ] **Step 1: Create workout-types.ts**

Define types that match the Firestore schema discovered during research. Key conversions: microseconds → seconds for duration and rest timers.

```typescript
// src/lib/api/workout-types.ts

export interface WorkoutSource {
  runtimeType: string;
  programId?: string;
  programName?: string;
  dayId?: string;
  cycleIndex?: number;
  programColor?: string;
  programIcon?: string;
}

export interface SetTarget {
  id: string;
  minFullReps?: number | null;
  maxFullReps?: number | null;
  rir?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  restTimer?: number | null;
}

export interface SetValue {
  weight: number;
  fullReps: number;
  partialReps?: number | null;
  rir?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  restTimerSeconds: number;  // converted from microseconds
  isSkipped: boolean;
}

export interface WorkoutSet {
  setType: 'warmUp' | 'standard' | 'failure';
  target?: SetTarget | null;
  value: SetValue;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName?: string;     // resolved from exercise DB
  baseWeight: number | null;
  note: string;
  sets: WorkoutSet[];
}

export interface WorkoutBlock {
  exercises: WorkoutExercise[];
}

export interface WorkoutSummary {
  id: string;
  name: string;
  startTime: string;
  durationSeconds: number;
  gymId?: string;
  gymName?: string;
  gymIcon?: string;
  programName?: string;
  exerciseCount: number;
  setCount: number;
}

export interface WorkoutDetail extends WorkoutSummary {
  workoutSource?: WorkoutSource;
  blocks: WorkoutBlock[];
}

export interface GymProfile {
  id: string;
  name: string;
  icon: string;
  weightUnit: 'kgs' | 'lbs';
  createdAt?: string;
  selectedEquipmentIds: string[];
  equipmentNames?: string[];
  useBumperPlatesInPlateCalculator?: boolean;
  allowMixedUnitsInPlateCalculator?: boolean;
  offsetWeightInPlateCalculator?: number;
  alwaysShowExercises: string[];
  alwaysHideExercises: string[];
}

export interface CustomExercise {
  id: string;
  name: string;
  archived: boolean;
  bodyweight: number;
  exerciseType?: string;
  primaryMuscle: string[];
  secondaryMuscle: string[];
  primaryFeatureMuscle: string[];
  secondaryFeatureMuscle: string[];
  regionTrained?: string;
  laterality: string[];
  exerciseMetrics: string[];
  resistanceEquipmentGroups: { equipmentIds: string[] }[];
  supportEquipmentGroups: { equipmentIds: string[] }[];
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit src/lib/api/workout-types.ts`

- [ ] **Step 3: Describe and advance**

```
jj describe -m "feat: add workout type definitions"
jj new
```

---

### Task 4: Add workout methods to MacroFactorClient

**Files:**
- Modify: `src/lib/api/client.ts` — add workout section
- Modify: `src/lib/api/firestore.ts` — add `listDocuments` function
- Modify: `src/lib/api/index.ts` — re-export new modules

- [ ] **Step 1: Add `listDocuments` to firestore.ts**

The existing `getDocument` reads a single document. Workout history is a collection of documents keyed by UUID, so we need to list them.

Add after the existing `getDocument` function:

```typescript
export async function listDocuments(
  collectionPath: string,
  idToken: string,
  pageSize = 100
): Promise<FirestoreDocument[]> {
  const allDocs: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${BASE_URL}/${collectionPath}?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (resp.status === 404) break;
    if (!resp.ok) {
      throw new Error(`Firestore LIST ${collectionPath} failed (${resp.status}): ${await resp.text()}`);
    }
    const data = await resp.json();
    if (data.documents) allDocs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allDocs;
}
```

- [ ] **Step 2: Add workout methods to client.ts**

Add new imports at top of client.ts:

```typescript
import type {
  WorkoutSummary,
  WorkoutDetail,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSet,
  SetValue,
  SetTarget,
  GymProfile,
  CustomExercise,
} from './workout-types';
import { listDocuments } from './firestore';
import { resolveName } from './exercises';
```

Add a new section after the `// Steps` section:

```typescript
  // -------------------------------------------------------------------------
  // Workouts
  // -------------------------------------------------------------------------

  async getWorkoutHistory(): Promise<WorkoutSummary[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/workoutHistory`, token);
    return docs.map((doc) => {
      const d = parseDocument(doc);
      const blocks = (d.blocks ?? []) as any[];
      let exerciseCount = 0;
      let setCount = 0;
      for (const block of blocks) {
        const exercises = block.exercises ?? [];
        exerciseCount += exercises.length;
        for (const ex of exercises) {
          setCount += (ex.sets ?? []).length;
        }
      }
      return {
        id: d.id as string,
        name: d.name as string,
        startTime: d.startTime as string,
        durationSeconds: (d.duration as number) / 1_000_000,
        gymId: d.gymId as string | undefined,
        gymName: d.gymName as string | undefined,
        gymIcon: d.gymIcon as string | undefined,
        programName: (d.workoutSource as any)?.programName as string | undefined,
        exerciseCount,
        setCount,
      };
    }).sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  async getWorkout(id: string): Promise<WorkoutDetail> {
    const token = await this.ensureToken();
    const doc = await getDocument(`users/${this.uid}/workoutHistory/${id}`, token);
    const d = parseDocument(doc);
    return this.parseWorkoutDetail(d);
  }

  private parseWorkoutDetail(d: Record<string, any>): WorkoutDetail {
    const blocks: WorkoutBlock[] = ((d.blocks ?? []) as any[]).map((block: any) => ({
      exercises: ((block.exercises ?? []) as any[]).map((ex: any): WorkoutExercise => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        exerciseName: resolveName(ex.exerciseId),
        baseWeight: ex.baseWeight ?? null,
        note: ex.note ?? '',
        sets: ((ex.sets ?? []) as any[]).map((s: any): WorkoutSet => ({
          setType: s.setType,
          target: s.log?.target ? {
            id: s.log.target.id,
            minFullReps: s.log.target.minFullReps ?? null,
            maxFullReps: s.log.target.maxFullReps ?? null,
            rir: s.log.target.rir ?? null,
            distance: s.log.target.distance ?? null,
            durationSeconds: s.log.target.durationSeconds ?? null,
            restTimer: s.log.target.restTimer != null
              ? s.log.target.restTimer / 1_000_000 : null,
          } : null,
          value: {
            weight: s.log?.value?.weight ?? 0,
            fullReps: s.log?.value?.fullReps ?? 0,
            partialReps: s.log?.value?.partialReps ?? null,
            rir: s.log?.value?.rir ?? null,
            distance: s.log?.value?.distance ?? null,
            durationSeconds: s.log?.value?.durationSeconds ?? null,
            restTimerSeconds: (s.log?.value?.restTimer ?? 0) / 1_000_000,
            isSkipped: s.log?.value?.isSkipped ?? false,
          },
        })),
      })),
    }));

    let exerciseCount = 0;
    let setCount = 0;
    for (const block of blocks) {
      exerciseCount += block.exercises.length;
      for (const ex of block.exercises) {
        setCount += ex.sets.length;
      }
    }

    const ws = d.workoutSource as any;
    return {
      id: d.id as string,
      name: d.name as string,
      startTime: d.startTime as string,
      durationSeconds: (d.duration as number) / 1_000_000,
      gymId: d.gymId as string | undefined,
      gymName: d.gymName as string | undefined,
      gymIcon: d.gymIcon as string | undefined,
      programName: ws?.programName as string | undefined,
      exerciseCount,
      setCount,
      workoutSource: ws ? {
        runtimeType: ws.runtimeType,
        programId: ws.programId,
        programName: ws.programName,
        dayId: ws.dayId,
        cycleIndex: ws.cycleIndex,
        programColor: ws.programColor,
        programIcon: ws.programIcon,
      } : undefined,
      blocks,
    };
  }

  async getGymProfiles(): Promise<GymProfile[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/gym`, token);
    return docs.map((doc) => {
      const d = parseDocument(doc);
      const equipmentIds = (d.selectedEquipmentIds ?? []) as string[];
      return {
        id: d.id as string,
        name: d.name as string,
        icon: d.icon as string,
        weightUnit: (d.weightUnit as 'kgs' | 'lbs') ?? 'kgs',
        createdAt: d.createdAt as string | undefined,
        selectedEquipmentIds: equipmentIds,
        equipmentNames: equipmentIds.map(resolveName),
        useBumperPlatesInPlateCalculator: d.useBumperPlatesInPlateCalculator as boolean | undefined,
        allowMixedUnitsInPlateCalculator: d.allowMixedUnitsInPlateCalculator as boolean | undefined,
        offsetWeightInPlateCalculator: d.offsetWeightInPlateCalculator as number | undefined,
        alwaysShowExercises: (d.alwaysShowExercises ?? []) as string[],
        alwaysHideExercises: (d.alwaysHideExercises ?? []) as string[],
      };
    });
  }

  async getCustomExercises(): Promise<CustomExercise[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/customExercises`, token);
    return docs.map((doc) => {
      const d = parseDocument(doc);
      return d as unknown as CustomExercise;
    });
  }
```

- [ ] **Step 3: Update index.ts exports**

```typescript
export { MacroFactorClient } from './client';
export * from './types';
export * from './workout-types';
export { searchFoods } from './typesense';
export {
  lookupEntity,
  lookupExercise,
  resolveName,
  searchExercises,
  resolveExercise,
  getAllExercises,
} from './exercises';
```

- [ ] **Step 4: Verify everything compiles**

Run: `npm run check`
Expected: No new errors from our changes.

- [ ] **Step 5: Describe and advance**

```
jj describe -m "feat: add workout client methods (history, gym profiles, exercises)"
jj new
```

---

### Task 5: Write integration test script

**Files:**
- Create: `test-workouts.mjs`

Follow the pattern of existing `test-foodlog.mjs` and `test-search.mjs`.

- [ ] **Step 1: Create test-workouts.mjs**

```javascript
// test-workouts.mjs
// Quick integration test for workout API methods
// Usage: MACROFACTOR_USERNAME=x MACROFACTOR_PASSWORD=y node test-workouts.mjs
import { MacroFactorClient } from './src/lib/api/index.ts';
import { searchExercises, resolveExercise, resolveName } from './src/lib/api/exercises.ts';

const email = process.env.MACROFACTOR_USERNAME;
const password = process.env.MACROFACTOR_PASSWORD;
if (!email || !password) {
  console.error('Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD');
  process.exit(1);
}

const client = await MacroFactorClient.login(email, password);

// 1. Workout history
console.log('=== Workout History ===');
const workouts = await client.getWorkoutHistory();
console.log(`Total workouts: ${workouts.length}`);
for (const w of workouts.slice(0, 5)) {
  const mins = Math.round(w.durationSeconds / 60);
  console.log(`  ${w.startTime.substring(0, 10)} | ${w.name} | ${mins}min | ${w.exerciseCount} exercises, ${w.setCount} sets | ${w.programName ?? 'no program'}`);
}

// 2. Workout detail (most recent)
if (workouts.length > 0) {
  console.log('\n=== Most Recent Workout Detail ===');
  const detail = await client.getWorkout(workouts[0].id);
  console.log(`${detail.name} @ ${detail.gymName} (${Math.round(detail.durationSeconds / 60)}min)`);
  for (const block of detail.blocks) {
    for (const ex of block.exercises) {
      console.log(`  ${ex.exerciseName}: ${ex.sets.length} sets`);
      for (const set of ex.sets) {
        const v = set.value;
        console.log(`    ${set.setType}: ${v.weight}kg × ${v.fullReps} reps${v.rir != null ? ` @${v.rir}RIR` : ''}`);
      }
    }
  }
}

// 3. Gym profiles
console.log('\n=== Gym Profiles ===');
const gyms = await client.getGymProfiles();
for (const g of gyms) {
  console.log(`  ${g.name} (${g.weightUnit}) — ${g.selectedEquipmentIds.length} equipment`);
}

// 4. Exercise search
console.log('\n=== Exercise Search: "bench press" ===');
const results = searchExercises('bench press');
for (const r of results.slice(0, 5)) {
  const resolved = resolveExercise(r.id);
  console.log(`  ${r.name} — ${resolved?.primaryMuscles.join(', ')} (${resolved?.type})`);
}

// 5. Custom exercises
console.log('\n=== Custom Exercises ===');
const custom = await client.getCustomExercises();
for (const c of custom) {
  console.log(`  ${c.name} (${c.archived ? 'archived' : 'active'})`);
}

console.log('\n✅ All tests passed');
```

- [ ] **Step 2: Run the integration test**

Run: `source .env && node test-workouts.mjs`
Expected: All sections print data, no errors. Verify exercise names resolve correctly.

Note: If the `.env` file uses different variable syntax, adapt accordingly. Check `test-foodlog.mjs` for the pattern.

- [ ] **Step 3: Describe and advance**

```
jj describe -m "test: add workout API integration test"
jj new
```

---

## Chunk 3: Schema Discovery Script

### Task 6: Schema discovery and type generation

**Files:**
- Create: `scripts/discover-schema.mjs`
- Create: `data/samples/` (directory for JSON samples)

This script authenticates, fetches sample documents from all known collections, saves them as plain JSON, and optionally runs quicktype to generate TypeScript types.

- [ ] **Step 1: Install quicktype as dev dependency**

Run: `npm install -D quicktype-core` or determine if the CLI `npx quicktype` is sufficient (it is — no install needed).

Test: `npx quicktype --help`

- [ ] **Step 2: Write discover-schema.mjs**

```javascript
// scripts/discover-schema.mjs
// Discovers Firestore schema by sampling documents from all known collections.
// Outputs JSON samples to data/samples/ and optionally generates TypeScript types.
//
// Usage: MACROFACTOR_USERNAME=x MACROFACTOR_PASSWORD=y node scripts/discover-schema.mjs
//
// The script:
// 1. Authenticates with Firebase
// 2. Fetches sample documents from each known collection
// 3. Parses Firestore wire format → plain JSON
// 4. Saves samples to data/samples/<collection>.json
// 5. Prints a summary of discovered fields and types
```

The script should:
- Import `signIn` from `src/lib/api/auth.ts`
- Import `getDocument`, `listDocuments`, `parseDocument` from `src/lib/api/firestore.ts`
- Define the known collections list:
  ```javascript
  const USER_COLLECTIONS = [
    { path: 'workoutHistory', type: 'list' },
    { path: 'gym', type: 'list' },
    { path: 'customExercises', type: 'list' },
    { path: 'body/2024', type: 'doc' },
    { path: 'body/2025', type: 'doc' },
  ];
  ```
- For each collection, fetch up to 3 sample documents
- Parse and save to `data/samples/<name>.json`
- Print a schema summary: field names, inferred types, nesting depth

- [ ] **Step 3: Run the discovery script**

Run: `source .env && node scripts/discover-schema.mjs`
Expected: Creates `data/samples/workoutHistory.json`, `data/samples/gym.json`, etc.

- [ ] **Step 4: Generate types with quicktype (optional verification)**

Run: `npx quicktype data/samples/workoutHistory.json --lang typescript --just-types --top-level WorkoutHistoryDoc`
Expected: Outputs TypeScript interfaces that roughly match our hand-written `workout-types.ts`. This validates our types are accurate.

- [ ] **Step 5: Describe and advance**

```
jj describe -m "feat: add schema discovery script for Firestore collections"
jj new
```

---

## Chunk 4: API Reference Documentation

### Task 7: Write comprehensive API reference

**Files:**
- Create: `docs/api-reference.md`

- [ ] **Step 1: Write the API reference document**

Structure:
1. **Overview** — Firebase project, auth flow, both apps
2. **Authentication** — sign-in endpoint, token refresh, bundle IDs
3. **Firestore REST API** — base URL, how document paths work
4. **Collections Reference** — for each collection:
   - Path pattern
   - Document schema (with TypeScript type reference)
   - Field encoding notes (compact keys, unit conversions)
   - Example response (redacted)
5. **Exercise Database** — hex ID scheme, uuidIndex, entity types
6. **Unit Conversions** — microseconds, kg-always, date formats
7. **Known Limitations** — App Check on global collections, no write docs yet

Use the design spec (`docs/superpowers/specs/2026-03-18-workout-api-design.md`) as the primary source. Incorporate real data samples from our probing scripts.

- [ ] **Step 2: Verify accuracy against live data**

Run these commands and compare the output fields against what the doc describes:

```bash
source .env
# Check workoutHistory schema matches docs
node cli/mf.mjs workouts 2>&1 | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const w=d[0]; console.log('Fields:', Object.keys(w).sort().join(', ')); console.log('Types:', Object.entries(w).map(([k,v])=>k+':'+typeof v).join(', '))"
# Check gym profile schema matches docs
node cli/mf.mjs gyms 2>&1 | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const g=d[0]; console.log('Fields:', Object.keys(g).sort().join(', ')); console.log('Types:', Object.entries(g).map(([k,v])=>k+':'+typeof v).join(', '))"
```

Expected: The field names and types printed should match the Collections Reference section in `docs/api-reference.md`. If any field is missing from the doc or has the wrong type, update the doc before proceeding.

- [ ] **Step 3: Describe and advance**

```
jj describe -m "docs: comprehensive API reference for nutrition + workout APIs"
jj new
```

---

## Chunk 5: CLI Wrapper

### Task 8: CLI tool

**Files:**
- Create: `cli/mf.mjs`

Single-file CLI that imports from `src/lib/api/`. Uses raw Node.js arg parsing (no framework — keep it simple).

- [ ] **Step 1: Write the CLI**

```javascript
// cli/mf.mjs
// Usage: node cli/mf.mjs <command> [options]
//
// Commands:
//   workouts [--from DATE] [--to DATE]    List workout history
//   workout <id>                          Show workout detail
//   exercises search <query>              Search exercise database
//   exercise <id>                         Show exercise detail
//   food-log [DATE]                       Show food log (default: today)
//   weight [--from DATE] [--to DATE]      Show weight entries
//   nutrition [--from DATE] [--to DATE]   Show nutrition summaries
//   gyms                                  List gym profiles
//   profile                               Show user profile
//
// Auth: Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD env vars,
//       or MACROFACTOR_REFRESH_TOKEN for token-based auth.
//
// Output: JSON to stdout. Use `| jq .` for pretty printing.
```

Implementation approach:
- Parse `process.argv` manually
- Create client via `MacroFactorClient.login()` or `.fromRefreshToken()`
- Switch on command, call appropriate client method
- `JSON.stringify(result, null, 2)` to stdout
- Exit codes: 0 success, 1 error

- [ ] **Step 2: Test each command**

Run each command and verify output:
```bash
source .env
node cli/mf.mjs workouts | head -20
node cli/mf.mjs workout <first-id> | head -40
node cli/mf.mjs exercises search "bench press" | head -20
node cli/mf.mjs gyms
node cli/mf.mjs profile | head -20
```

- [ ] **Step 3: Describe and advance**

```
jj describe -m "feat: add CLI tool for querying MacroFactor API"
jj new
```

---

## Chunk 6: Claude Skill

### Task 9: Write Claude skill for MacroFactor API

**Files:**
- Create: `skills/macrofactor-api/SKILL.md`

- [ ] **Step 1: Write the skill**

The skill should cover:

1. **When to use**: Querying MacroFactor nutrition or workout data, searching exercises, checking workout history
2. **Authentication**: How to set env vars, login
3. **CLI usage**: Command reference with examples
4. **TypeScript API**: Key imports, client creation, method signatures
5. **Data model**: Quick reference for hex IDs, unit conversions, collection paths
6. **Common patterns**: Recent workouts, exercise lookup, nutrition trends, PR tracking
7. **Gotchas**: Microsecond units, kg-only weights, App Check on global collections

Target length: 100-200 lines. Concise, example-heavy.

- [ ] **Step 2: Verify the skill is discoverable**

Run: `ls -la skills/macrofactor-api/SKILL.md && head -5 skills/macrofactor-api/SKILL.md`
Expected: File exists, first line is a markdown heading, file size is between 3KB and 15KB.

Also verify the skill location matches the project convention:
Run: `ls skills/*/SKILL.md 2>/dev/null || ls .skills/*/SKILL.md 2>/dev/null || echo 'No existing skills — skills/ is fine'`
Expected: Either existing skills are found in `skills/` (confirming our path is correct) or no existing skills exist (our path is the first, which is fine).

- [ ] **Step 3: Describe and advance**

```
jj describe -m "feat: add Claude skill for MacroFactor API usage"
jj new
```

---

## Chunk 7: Final Verification

### Task 10: End-to-end verification

- [ ] **Step 1: Run type checking**

Run: `npm run check`
Expected: No errors from our new files.

- [ ] **Step 2: Run integration test**

Run: `source .env && node test-workouts.mjs`
Expected: All sections pass.

- [ ] **Step 3: Test CLI end-to-end**

Run: `source .env && node cli/mf.mjs workouts --from 2026-03-01 --to 2026-03-18`
Expected: JSON output with recent workouts, exercise names resolved.

- [ ] **Step 4: Verify API docs accuracy**

Run these concrete checks against the live API:

```bash
source .env
# 1. Verify workoutHistory field list matches docs
node -e "
  import {MacroFactorClient} from './src/lib/api/index.ts';
  const c = await MacroFactorClient.login(process.env.MACROFACTOR_USERNAME, process.env.MACROFACTOR_PASSWORD);
  const ws = await c.getWorkoutHistory();
  console.log('workoutHistory fields:', Object.keys(ws[0]).sort().join(', '));
  const d = await c.getWorkout(ws[0].id);
  console.log('workoutDetail fields:', Object.keys(d).sort().join(', '));
  console.log('block.exercise fields:', Object.keys(d.blocks[0].exercises[0]).sort().join(', '));
  console.log('set fields:', Object.keys(d.blocks[0].exercises[0].sets[0]).sort().join(', '));
  const gyms = await c.getGymProfiles();
  console.log('gym fields:', Object.keys(gyms[0]).sort().join(', '));
"
```

Expected: Each field list printed should match the corresponding schema section in `docs/api-reference.md`. Grep for each field name in the doc:

```bash
# Verify key fields are documented
for field in durationSeconds exerciseName setType restTimerSeconds weightUnit; do
  grep -q "$field" docs/api-reference.md && echo "✅ $field documented" || echo "❌ $field MISSING from docs"
done
```

Expected: All fields show ✅.

- [ ] **Step 5: Final describe**

```
jj describe -m "chore: workout API implementation complete"
```
