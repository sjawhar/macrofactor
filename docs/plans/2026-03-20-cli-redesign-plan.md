# CLI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite CLI write commands to accept JSON input (positional arg or stdin), add missing write commands, and add optional JSON input to read commands.

**Architecture:** Replace all custom parsers (`parseSets`, `parseAmount`, `parseTime`, `buildDate`) with a single `readInput()` helper that detects JSON from stdin or positional arg. Write commands parse JSON and delegate to the existing `MacroFactorClient`. Read commands gain optional JSON input alongside their existing positional arg/flag syntax.

**Tech Stack:** TypeScript, vitest (new), existing MacroFactorClient API

**Design doc:** `docs/plans/2026-03-20-cli-redesign-design.md`

---

### Task 1: Set up vitest

**Files:**

- Modify: `package.json` (add vitest devDep and test script)
- Create: `vitest.config.ts`

**Step 1: Install vitest**

Run: `npm install -D vitest`

**Step 2: Add test script to package.json**

Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`

**Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['cli/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
```

**Step 4: Verify vitest runs**

Run: `npm test`
Expected: 0 tests found, exit 0

**Step 5: Commit**

```
jj describe -m "chore: add vitest test runner"
jj new
```

---

### Task 2: Extract helpers into `cli/helpers.ts` with tests

Currently all helpers live inside `cli/mf.ts` and aren't importable. Extract new helpers into a separate module so they're testable.

**Files:**

- Create: `cli/helpers.ts`
- Create: `cli/helpers.test.ts`

**Step 1: Write failing tests for `readInput`**

Create `cli/helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseISO, expandSets, resolveWeight } from './helpers';

describe('parseISO', () => {
  it('extracts date/hour/minute from offset-aware ISO string', () => {
    const result = parseISO('2026-03-20T09:00:00-05:00');
    expect(result).toEqual({ date: '2026-03-20', hours: 9, minutes: 0 });
  });

  it('extracts from UTC ISO string', () => {
    const result = parseISO('2026-03-20T16:30:00Z');
    expect(result).toEqual({ date: '2026-03-20', hours: 16, minutes: 30 });
  });

  it('extracts from ISO string without offset (treated as-is)', () => {
    const result = parseISO('2026-03-20T11:15:00');
    expect(result).toEqual({ date: '2026-03-20', hours: 11, minutes: 15 });
  });
});

describe('expandSets', () => {
  it('expands a single set', () => {
    const result = expandSets([{ reps: 10, lbs: 135 }]);
    expect(result).toHaveLength(1);
    expect(result[0].fullReps).toBe(10);
    expect(result[0].weightKg).toBeCloseTo(61.23, 1);
    expect(result[0].setType).toBe('standard');
  });

  it('expands sets with count', () => {
    const result = expandSets([{ reps: 10, lbs: 135, sets: 3 }]);
    expect(result).toHaveLength(3);
    result.forEach((s) => {
      expect(s.fullReps).toBe(10);
      expect(s.weightKg).toBeCloseTo(61.23, 1);
    });
  });

  it('handles kg directly', () => {
    const result = expandSets([{ reps: 8, kg: 60 }]);
    expect(result[0].weightKg).toBe(60);
  });

  it('handles mixed sets with different weights', () => {
    const result = expandSets([
      { reps: 15, lbs: 12.5 },
      { reps: 10, lbs: 47.5, sets: 2 },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].fullReps).toBe(15);
    expect(result[1].fullReps).toBe(10);
    expect(result[2].fullReps).toBe(10);
  });

  it('preserves set type and rir', () => {
    const result = expandSets([{ reps: 8, lbs: 50, type: 'failure', rir: 0 }]);
    expect(result[0].setType).toBe('failure');
    expect(result[0].rir).toBe(0);
  });

  it('uses custom rest timer', () => {
    const result = expandSets([{ reps: 10, lbs: 100, rest: 90 }]);
    expect(result[0].restMicros).toBe(90_000_000);
  });

  it('defaults to 120s rest', () => {
    const result = expandSets([{ reps: 10, lbs: 100 }]);
    expect(result[0].restMicros).toBe(120_000_000);
  });
});

describe('resolveWeight', () => {
  it('converts lbs to kg', () => {
    expect(resolveWeight({ lbs: 135 })).toBeCloseTo(61.23, 1);
  });

  it('passes kg through', () => {
    expect(resolveWeight({ kg: 60 })).toBe(60);
  });

  it('returns 0 when no weight', () => {
    expect(resolveWeight({})).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module `./helpers` not found

**Step 3: Implement helpers**

Create `cli/helpers.ts`:

```typescript
const LBS_TO_KG = 1 / 2.2046226218;

/**
 * Extract date, hours, minutes from an ISO 8601 string.
 * Reads directly from the string representation (respects embedded offset).
 */
export function parseISO(iso: string): { date: string; hours: number; minutes: number } {
  const match = iso.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return { date: match[1], hours: parseInt(match[2], 10), minutes: parseInt(match[3], 10) };
  }
  // Fallback for date-only or unparseable — use JS Date UTC
  const d = new Date(iso);
  return {
    date: d.toISOString().split('T')[0],
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/** Resolve lbs/kg to kg. */
export function resolveWeight(s: { lbs?: number; kg?: number }): number {
  if (s.kg != null) return s.kg;
  if (s.lbs != null) return s.lbs * LBS_TO_KG;
  return 0;
}

interface SetInput {
  reps: number;
  lbs?: number;
  kg?: number;
  sets?: number;
  type?: 'standard' | 'warmUp' | 'failure';
  rir?: number;
  rest?: number;
}

interface ExpandedSet {
  fullReps: number;
  weightKg: number;
  setType: string;
  rir: number | null;
  restMicros: number;
}

/** Expand JSON set descriptions into flat array of sets. */
export function expandSets(sets: SetInput[]): ExpandedSet[] {
  return sets.flatMap((s) => {
    const count = s.sets ?? 1;
    const weightKg = resolveWeight(s);
    const restMicros = (s.rest ?? 120) * 1_000_000;
    return Array.from({ length: count }, () => ({
      fullReps: s.reps,
      weightKg,
      setType: s.type ?? 'standard',
      rir: s.rir ?? null,
      restMicros,
    }));
  });
}

/**
 * Read JSON input from stdin (piped) or first positional arg.
 * Returns null if no JSON input detected (for read command fallback to positional/flags).
 */
export async function readInput(positional: string[]): Promise<Record<string, any> | null> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (raw) return JSON.parse(raw);
  }
  const first = positional[0];
  if (first?.trimStart().startsWith('{') || first?.trimStart().startsWith('[')) {
    return JSON.parse(first);
  }
  return null;
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```
jj describe -m "feat: extract CLI helpers (parseISO, expandSets, resolveWeight, readInput)"
jj new
```

---

### Task 3: Rewrite `log-workout` to accept JSON

Replace the current `log-workout` case (flags-based, creates empty workout) with JSON input that supports full workout creation including exercises.

**Files:**

- Modify: `cli/mf.ts` — replace `case 'log-workout'` block
- Import helpers from `cli/helpers.ts`

**Step 1: Add imports at top of `cli/mf.ts`**

Add after existing imports:

```typescript
import { readInput, parseISO, expandSets, resolveWeight } from './helpers';
```

**Step 2: Replace `log-workout` case**

Replace the entire `case 'log-workout': { ... break; }` block with:

```typescript
case 'log-workout': {
  const input = await readInput(positional);
  if (!input || !input.name) throw new Error('log-workout requires JSON with "name" field');

  const client = await getClient();

  // Resolve gym
  const gyms = await client.getGymProfiles();
  let gym = gyms[0];
  if (input.gym) {
    const match = gyms.find((g) => g.name.toLowerCase().includes(input.gym.toLowerCase()));
    if (match) gym = match;
  }

  // Parse start time
  const startISO = input.startTime || new Date().toISOString();
  const startDate = new Date(startISO);

  // Build exercise blocks
  const blocks: any[] = [];
  const exerciseSummary: any[] = [];

  for (const ex of input.exercises || []) {
    const matches = searchExercises(ex.name);
    if (matches.length === 0) throw new Error(`No exercise found for "${ex.name}"`);
    const exercise = matches[0];
    const expanded = expandSets(ex.sets || []);

    blocks.push({
      exercises: [{
        id: randomUUID(),
        exerciseId: exercise.id,
        note: ex.note ?? '',
        baseWeight: null,
        sets: expanded.map((s) => ({
          setType: s.setType,
          segments: [],
          log: {
            id: randomUUID(),
            runtimeType: 'single',
            target: null,
            value: {
              weight: s.weightKg,
              fullReps: s.fullReps,
              partialReps: null,
              rir: s.rir,
              distance: null,
              durationSeconds: null,
              restTimer: s.restMicros,
              isSkipped: false,
            },
          },
        })),
      }],
    });

    exerciseSummary.push({
      name: exercise.name,
      exerciseId: exercise.id,
      sets: expanded.map((s) => ({
        reps: s.fullReps,
        kg: Math.round(s.weightKg * 100) / 100,
        type: s.setType,
      })),
    });
  }

  const durationMinutes = input.duration ?? 45;
  const workoutId = randomUUID();

  const fields = {
    name: input.name,
    startTime: startDate.toISOString(),
    duration: durationMinutes * 60 * 1_000_000, // microseconds
    gymId: gym.id,
    gymName: gym.name,
    gymIcon: gym.icon,
    blocks,
  };
  const fieldPaths = ['name', 'startTime', 'duration', 'gymId', 'gymName', 'gymIcon', 'blocks'];
  await client.updateRawWorkout(workoutId, fields, fieldPaths);

  console.log(JSON.stringify({
    status: 'created',
    workoutId,
    name: input.name,
    gym: gym.name,
    startTime: startDate.toISOString(),
    durationMinutes,
    exercises: exerciseSummary,
  }, null, 2));
  break;
}
```

**Step 3: Test manually**

Run:

```bash
npx tsx cli/mf.ts log-workout '{"name":"Test Workout","gym":"Gym","exercises":[{"name":"machine hack squat","sets":[{"reps":10,"lbs":135,"sets":2}]}]}'
```

Expected: JSON output with `status: "created"`, resolved exercise name, kg weights

**Step 4: Verify in app, then delete test workout if needed**

**Step 5: Commit**

```
jj describe -m "feat: rewrite log-workout to accept JSON (one-shot with exercises)"
jj new
```

---

### Task 4: Rewrite `log-exercise` to accept JSON

**Files:**

- Modify: `cli/mf.ts` — replace `case 'log-exercise'` block

**Step 1: Replace `log-exercise` case**

Replace entire `case 'log-exercise': { ... break; }` block with:

```typescript
case 'log-exercise': {
  const input = await readInput(positional);
  if (!input || !input.workoutId || !input.exercises?.length) {
    throw new Error('log-exercise requires JSON with "workoutId" and "exercises" array');
  }

  const client = await getClient();
  const raw = await client.getRawWorkout(input.workoutId);
  const blocks = (raw.blocks as any[]) || [];
  const exerciseSummary: any[] = [];

  for (const ex of input.exercises) {
    const matches = searchExercises(ex.name);
    if (matches.length === 0) throw new Error(`No exercise found for "${ex.name}"`);
    const exercise = matches[0];
    const expanded = expandSets(ex.sets || []);

    blocks.push({
      exercises: [{
        id: randomUUID(),
        exerciseId: exercise.id,
        note: ex.note ?? '',
        baseWeight: null,
        sets: expanded.map((s) => ({
          setType: s.setType,
          segments: [],
          log: {
            id: randomUUID(),
            runtimeType: 'single',
            target: null,
            value: {
              weight: s.weightKg,
              fullReps: s.fullReps,
              partialReps: null,
              rir: s.rir,
              distance: null,
              durationSeconds: null,
              restTimer: s.restMicros,
              isSkipped: false,
            },
          },
        })),
      }],
    });

    exerciseSummary.push({
      name: exercise.name,
      exerciseId: exercise.id,
      sets: expanded.map((s) => ({
        reps: s.fullReps,
        kg: Math.round(s.weightKg * 100) / 100,
        type: s.setType,
      })),
    });
  }

  await client.updateRawWorkout(input.workoutId, { blocks }, ['blocks']);

  console.log(JSON.stringify({
    status: 'added',
    workoutId: input.workoutId,
    exercises: exerciseSummary,
  }, null, 2));
  break;
}
```

**Step 2: Test manually**

Run with a known workout ID from previous test.

**Step 3: Commit**

```
jj describe -m "feat: rewrite log-exercise to accept JSON"
jj new
```

---

### Task 5: Rewrite `log-food` to accept JSON (with foodId direct mode)

**Files:**

- Modify: `cli/mf.ts` — replace `case 'log-food'` block

**Step 1: Replace `log-food` case**

Replace entire `case 'log-food': { ... break; }` block. Key change: support both `query` (search) and `foodId` (direct) modes, and replace `parseAmount`/`parseTime`/`buildDate` with JSON fields.

```typescript
case 'log-food': {
  const input = await readInput(positional);
  if (!input || (!input.query && !input.foodId)) {
    throw new Error('log-food requires JSON with "query" or "foodId" field');
  }
  if (!input.grams && !(input.amount && input.unit)) {
    throw new Error('log-food requires "grams" or "amount"+"unit" fields');
  }

  const client = await getClient();

  // Resolve food
  let food: any;
  if (input.foodId) {
    // Direct mode: search by ID from cached results
    const results = await client.searchFoods(input.foodId);
    food = results.find((r: any) => r.foodId === input.foodId) || results[0];
    if (!food) throw new Error(`No food found for foodId "${input.foodId}"`);
  } else {
    const results = await client.searchFoods(input.query);
    if (results.length === 0) throw new Error(`No foods found for "${input.query}"`);
    const pickIndex = input.pick ?? 0;
    if (pickIndex >= results.length) throw new Error(`--pick ${pickIndex} out of range (${results.length} results)`);
    food = results[pickIndex];
  }

  // Resolve serving and quantity
  const isGramMode = input.grams != null;
  const quantity = isGramMode ? input.grams : input.amount;

  let serving: any;
  if (isGramMode) {
    serving = findServing(food.servings, 'g');
  } else {
    serving = findServing(food.servings, input.unit);
  }
  if (!serving) {
    const available = food.servings.map((s: any) => s.description).join(', ');
    throw new Error(`No serving matching "${isGramMode ? 'g' : input.unit}" for ${food.name}. Available: ${available}`);
  }

  // Parse logged time
  const loggedAtISO = input.loggedAt || new Date().toISOString();
  const logTime = new Date(loggedAtISO);

  await client.logSearchedFood(logTime, food, serving, quantity, isGramMode);

  const totalGrams = isGramMode ? input.grams : serving.gramWeight * quantity;
  const totalCal = Math.round((food.caloriesPer100g * totalGrams) / 100);
  const totalProt = Math.round(((food.proteinPer100g * totalGrams) / 100) * 10) / 10;

  const { date } = parseISO(loggedAtISO);

  console.log(JSON.stringify({
    status: 'logged',
    food: food.name,
    foodId: food.foodId,
    serving: serving.description,
    quantity,
    totalGrams: Math.round(totalGrams),
    totalCalories: totalCal,
    totalProtein: totalProt,
    date,
  }, null, 2));
  break;
}
```

**Step 2: Test both modes manually**

```bash
# Query mode
npx tsx cli/mf.ts log-food '{"query":"broccoli raw","grams":150,"loggedAt":"2026-03-20T11:00:00-05:00"}'

# Direct foodId mode
npx tsx cli/mf.ts log-food '{"foodId":"n_2950","grams":100}'
```

**Step 3: Commit**

```
jj describe -m "feat: rewrite log-food to accept JSON (with foodId direct mode)"
jj new
```

---

### Task 6: Add `log-weight`, `delete-food`, `update-food` commands

**Files:**

- Modify: `cli/mf.ts` — add 3 new cases + update `ALL_COMMANDS`

**Step 1: Add the three new cases before the `default:` case**

```typescript
case 'log-weight': {
  const input = await readInput(positional);
  if (!input || (!input.kg && !input.lbs)) {
    throw new Error('log-weight requires JSON with "kg" or "lbs" field');
  }

  const client = await getClient();
  const weightKg = resolveWeight(input);
  const date = input.date || new Date().toISOString().split('T')[0];

  await client.logWeight(date, weightKg, input.bodyFat);

  console.log(JSON.stringify({
    status: 'logged',
    date,
    kg: Math.round(weightKg * 100) / 100,
    bodyFat: input.bodyFat ?? null,
  }, null, 2));
  break;
}

case 'delete-food': {
  const input = await readInput(positional);
  if (!input || !input.date || !input.entryId) {
    throw new Error('delete-food requires JSON with "date" and "entryId" fields');
  }

  const client = await getClient();
  await client.deleteFoodEntry(input.date, input.entryId);

  console.log(JSON.stringify({
    status: 'deleted',
    date: input.date,
    entryId: input.entryId,
  }, null, 2));
  break;
}

case 'update-food': {
  const input = await readInput(positional);
  if (!input || !input.date || !input.entryId || input.quantity == null) {
    throw new Error('update-food requires JSON with "date", "entryId", and "quantity" fields');
  }

  const client = await getClient();
  await client.updateFoodEntry(input.date, input.entryId, input.quantity);

  console.log(JSON.stringify({
    status: 'updated',
    date: input.date,
    entryId: input.entryId,
    quantity: input.quantity,
  }, null, 2));
  break;
}
```

**Step 2: Update `ALL_COMMANDS` array**

Add `'log-weight'`, `'delete-food'`, `'update-food'` to the array.

**Step 3: Test `log-weight` manually**

```bash
npx tsx cli/mf.ts log-weight '{"lbs":180,"date":"2026-03-20"}'
```

**Step 4: Commit**

```
jj describe -m "feat: add log-weight, delete-food, update-food commands"
jj new
```

---

### Task 7: Add JSON input support to read commands

Add optional JSON input to read commands. When JSON is present, it takes precedence over positional args/flags.

**Files:**

- Modify: `cli/mf.ts` — update each read command case

**Step 1: Update each read command to check for JSON input first**

For each read command, add a `readInput()` check at the top. Example pattern:

```typescript
case 'workouts': {
  const input = await readInput(positional);
  const client = await getClient();
  let workouts = await client.getWorkoutHistory();
  const from = input?.from || opts.from;
  const to = input?.to || opts.to;
  if (from) workouts = workouts.filter((w) => w.startTime >= from);
  if (to) workouts = workouts.filter((w) => w.startTime <= to);
  console.log(JSON.stringify(workouts, null, 2));
  break;
}
```

Apply the same pattern to all read commands:

- `workout`: `const id = input?.id || positional[0]`
- `exercises search`: `const query = input?.query || positional.slice(1).join(' ')`
- `exercise`: `const id = input?.id || positional[0]`
- `food-log`: `const date = input?.date || positional[0] || today()`
- `search-food`: `const query = input?.query || positional.join(' ')`

No changes needed for `gyms`, `profile`, `program`, `next-workout` (no parameters).

**Step 2: Test one via stdin**

```bash
echo '{"date":"2026-03-20"}' | npx tsx cli/mf.ts food-log
```

**Step 3: Commit**

```
jj describe -m "feat: add JSON stdin support to read commands"
jj new
```

---

### Task 8: Remove dead code

**Files:**

- Modify: `cli/mf.ts` — delete unused helpers

**Step 1: Delete these functions/constants from `cli/mf.ts`**

- `TIMEZONE_OFFSET_HOURS` constant
- `parseAmount()` function
- `parseTime()` function
- `buildDate()` function
- `parseSets()` function (the entire function including the JSON branch we added earlier)

Keep `findServing()` — it's still used by `log-food` internally.

**Step 2: Run type check**

Run: `npm run check`
Expected: No type errors

**Step 3: Run tests**

Run: `npm test`
Expected: All pass

**Step 4: Commit**

```
jj describe -m "refactor: remove dead custom parsers (parseSets, parseAmount, parseTime, buildDate)"
jj new
```

---

### Task 9: Update documentation

**Files:**

- Modify: `.opencode/skills/macrofactor-api/SKILL.md`
- Modify: `README.md`

**Step 1: Update SKILL.md quick reference table**

Replace the current CLI command table (around lines 22-37) with JSON examples. Show both positional arg and stdin styles. Show the new commands (`log-weight`, `delete-food`, `update-food`).

**Step 2: Update README.md command reference**

Replace the command table (around lines 32-46) and examples (lines 48-63) with JSON-based examples.

**Step 3: Commit**

```
jj describe -m "docs: update SKILL.md and README.md for JSON-first CLI"
jj new
```

---

### Summary

| Task      | Description                              | Estimated effort |
| --------- | ---------------------------------------- | ---------------- |
| 1         | Set up vitest                            | 5 min            |
| 2         | Extract helpers + tests                  | 15 min           |
| 3         | Rewrite log-workout                      | 10 min           |
| 4         | Rewrite log-exercise                     | 5 min            |
| 5         | Rewrite log-food                         | 10 min           |
| 6         | Add log-weight, delete-food, update-food | 10 min           |
| 7         | JSON input for read commands             | 10 min           |
| 8         | Remove dead code                         | 5 min            |
| 9         | Update documentation                     | 10 min           |
| **Total** |                                          | **~80 min**      |
