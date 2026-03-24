# MacroFactor MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP server layer to the existing MacroFactor project that exposes the API client as 28 tools consumable by AI agents, with stdio (local) and Streamable HTTP (remote) transports.

**Architecture:** `src/mcp/server.ts` exports a `createServer(client)` factory that registers all tools. Two entry points (`stdio.ts`, `http.ts`) handle auth and transport. Tools are grouped by domain in `src/mcp/tools/`. The MCP server is a new consumer of `src/lib/api/` — nothing existing changes.

**Tech Stack:** `@modelcontextprotocol/sdk`, `zod`, `tsup` (bundler), existing `MacroFactorClient`

**Spec:** `docs/superpowers/specs/2026-03-23-mcp-server-design.md`

---

## File Map

### New Files

| File                          | Responsibility                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mcp/server.ts`           | `createServer(client)` factory — imports and calls all tool registration functions                                                                              |
| `src/mcp/tools/profile.ts`    | `get_profile`, `get_goals`, `get_gym_profiles`, `get_custom_exercises`, `search_exercises`, `get_context`                                                       |
| `src/mcp/tools/food.ts`       | `get_food_log`, `search_foods`, `log_food`, `log_manual_food`, `update_food`, `delete_food`, `hard_delete_food`, `copy_food_entries`                            |
| `src/mcp/tools/nutrition.ts`  | `get_nutrition`, `get_steps`                                                                                                                                    |
| `src/mcp/tools/weight.ts`     | `get_weight_entries`, `log_weight`, `delete_weight`                                                                                                             |
| `src/mcp/tools/workout.ts`    | `get_workouts`, `get_workout`, `get_training_program`, `get_next_workout`, `log_workout`, `log_exercise`, `update_workout`, `delete_workout`, `remove_exercise` |
| `src/mcp/stdio.ts`            | stdio entry point — reads creds from env, logs in, connects StdioServerTransport                                                                                |
| `src/mcp/http.ts`             | HTTP entry point — reads creds from env, Bearer auth middleware, StreamableHTTPServerTransport on `/mcp`                                                        |
| `src/mcp/tools/tools.test.ts` | Integration tests — mock client, verify all 28 tools via in-process MCP client                                                                                  |
| `tsup.config.ts`              | Bundle config for MCP server                                                                                                                                    |

### Modified Files

| File           | Change                                               |
| -------------- | ---------------------------------------------------- |
| `package.json` | Add dependencies, `bin`, `files`, `build:mcp` script |
| `README.md`    | Add MCP server section with setup instructions       |

---

## Task 1: Project Setup

**Files:**

- Modify: `package.json`
- Create: `tsup.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @modelcontextprotocol/sdk zod
pnpm add -D tsup
```

- [ ] **Step 2: Add build:mcp script and package metadata to `package.json`**

Add to `package.json`:

```json
{
  "bin": {
    "macrofactor-mcp": "./dist/mcp/stdio.js"
  },
  "files": ["dist/", "data/exercises.json"],
  "scripts": {
    "build:mcp": "tsup"
  }
}
```

Keep `"private": true` for now — we'll remove it when ready to publish.

- [ ] **Step 3: Create tsup config**

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'mcp/stdio': 'src/mcp/stdio.ts',
    'mcp/http': 'src/mcp/http.ts',
  },
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  // Bundle everything except node builtins
  noExternal: [/(.*)/],
  external: ['node:*'],
  banner: {
    // stdio entry needs shebang
    js: '#!/usr/bin/env node',
  },
});
```

Note: The `banner` approach puts the shebang on all files. If that's an issue, we can use a tsup plugin to only add it to stdio.js. Test this during Task 13 (packaging) and fix if needed.

- [ ] **Step 4: Verify build setup**

Run: `pnpm run build:mcp`
Expected: Fails (entry points don't exist yet), but confirms tsup is installed and config is valid.

- [ ] **Step 5: Commit**

```bash
jj describe -m "chore: add MCP server dependencies and build config"
jj new
```

---

## Task 2: Server Factory + Test Infrastructure

**Files:**

- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools/profile.ts` (skeleton)
- Create: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Create server factory skeleton**

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../lib/api/index.js';
import { registerProfileTools } from './tools/profile.js';

export function createServer(client: MacroFactorClient): McpServer {
  const server = new McpServer({
    name: 'macrofactor',
    version: '1.0.0',
  });

  registerProfileTools(server, client);

  return server;
}
```

- [ ] **Step 2: Create profile tools with first tool (get_profile)**

```typescript
// src/mcp/tools/profile.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';

export function registerProfileTools(server: McpServer, client: MacroFactorClient): void {
  server.tool(
    'get_profile',
    `Retrieve the user's MacroFactor profile and account preferences. Use this to understand the user's settings (units, timezone, etc.) before performing other operations. Returns profile data as JSON. See also: get_goals for macro targets.`,
    {},
    async () => {
      const profile = await client.getProfile();
      return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] };
    }
  );
}
```

- [ ] **Step 3: Create test infrastructure with first test**

```typescript
// src/mcp/tools/tools.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { MacroFactorClient } from '../../lib/api/index.js';

// Factory for mock client — all methods return empty defaults
function createMockClient(overrides: Partial<Record<keyof MacroFactorClient, unknown>> = {}) {
  const mock = {
    getProfile: vi.fn().mockResolvedValue({ units: 'imperial' }),
    getGoals: vi.fn().mockResolvedValue({ calories: 2000 }),
    getFoodLog: vi.fn().mockResolvedValue([]),
    getNutrition: vi.fn().mockResolvedValue([]),
    getWeightEntries: vi.fn().mockResolvedValue([]),
    getSteps: vi.fn().mockResolvedValue([]),
    getGymProfiles: vi.fn().mockResolvedValue([]),
    getCustomExercises: vi.fn().mockResolvedValue([]),
    getTrainingPrograms: vi.fn().mockResolvedValue([]),
    getNextWorkout: vi.fn().mockResolvedValue(null),
    getWorkoutHistory: vi.fn().mockResolvedValue([]),
    getWorkout: vi.fn().mockResolvedValue({}),
    getRawWorkout: vi.fn().mockResolvedValue({}),
    searchFoods: vi.fn().mockResolvedValue([]),
    logFood: vi.fn().mockResolvedValue(undefined),
    logSearchedFood: vi.fn().mockResolvedValue(undefined),
    logWeight: vi.fn().mockResolvedValue(undefined),
    deleteFoodEntry: vi.fn().mockResolvedValue(undefined),
    hardDeleteFoodEntry: vi.fn().mockResolvedValue(undefined),
    updateFoodEntry: vi.fn().mockResolvedValue(undefined),
    deleteWeightEntry: vi.fn().mockResolvedValue(undefined),
    deleteWorkout: vi.fn().mockResolvedValue(undefined),
    updateRawWorkout: vi.fn().mockResolvedValue(undefined),
    updateWorkout: vi.fn().mockResolvedValue(undefined),
    copyEntries: vi.fn().mockResolvedValue(undefined),
    syncDay: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as MacroFactorClient;
  return mock;
}

// Connect server + client in-process
async function connectServer(mockClient: MacroFactorClient) {
  const server = createServer(mockClient);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe('MCP Tools', () => {
  describe('profile tools', () => {
    it('get_profile calls client.getProfile and returns JSON', async () => {
      const mockClient = createMockClient({
        getProfile: vi.fn().mockResolvedValue({ units: 'imperial', weightUnit: 'lbs' }),
      });
      const client = await connectServer(mockClient);

      const result = await client.callTool({ name: 'get_profile', arguments: {} });

      expect(mockClient.getProfile).toHaveBeenCalled();
      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse((result.content as any)[0].text);
      expect(parsed.units).toBe('imperial');
    });
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: PASS — `get_profile` test passes.

Note: If `InMemoryTransport` import path differs in the installed SDK version, check `node_modules/@modelcontextprotocol/sdk` for the correct export path. The SDK has moved things between versions. Adjust the import if needed.

- [ ] **Step 5: Commit**

```bash
jj describe -m "feat(mcp): server factory, get_profile tool, test infrastructure"
jj new
```

---

## Task 3: Remaining Profile & Context Tools

**Files:**

- Modify: `src/mcp/tools/profile.ts`
- Modify: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Write tests for all profile tools**

Add to the `profile tools` describe block in `tools.test.ts`:

```typescript
it('get_goals calls client.getGoals', async () => {
  const mockClient = createMockClient({
    getGoals: vi.fn().mockResolvedValue({ calories: 2200, protein: 180 }),
  });
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name: 'get_goals', arguments: {} });
  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.calories).toBe(2200);
});

it('get_gym_profiles calls client.getGymProfiles', async () => {
  const mockClient = createMockClient({
    getGymProfiles: vi.fn().mockResolvedValue([{ id: 'gym1', name: 'Home' }]),
  });
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name: 'get_gym_profiles', arguments: {} });
  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed).toHaveLength(1);
  expect(parsed[0].name).toBe('Home');
});

it('get_custom_exercises calls client.getCustomExercises', async () => {
  const mockClient = createMockClient({
    getCustomExercises: vi.fn().mockResolvedValue([{ id: 'ex1', name: 'My Exercise' }]),
  });
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name: 'get_custom_exercises', arguments: {} });
  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed[0].name).toBe('My Exercise');
});

it('search_exercises calls searchExercises with query', async () => {
  // Note: searchExercises is a module function, not a client method.
  // This test verifies the tool is registered and callable.
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name: 'search_exercises', arguments: { query: 'bench' } });
  expect(result.content).toHaveLength(1);
});

it('get_context calls multiple client methods and returns composite', async () => {
  const mockClient = createMockClient({
    getGoals: vi.fn().mockResolvedValue({ calories: 2000 }),
    getFoodLog: vi.fn().mockResolvedValue([]),
    getWeightEntries: vi.fn().mockResolvedValue([]),
    getTrainingPrograms: vi.fn().mockResolvedValue([]),
    getNextWorkout: vi.fn().mockResolvedValue(null),
  });
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name: 'get_context', arguments: {} });
  expect(mockClient.getGoals).toHaveBeenCalled();
  expect(mockClient.getFoodLog).toHaveBeenCalled();
  expect(mockClient.getWeightEntries).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: 5 new tests FAIL (tools not registered yet).

- [ ] **Step 3: Implement remaining profile tools**

Add to `src/mcp/tools/profile.ts`. Import `searchExercises` from the exercises module. For `get_context`, replicate the CLI's `context` command logic — call `getGoals`, `getFoodLog`, `getWeightEntries`, `getTrainingPrograms`, `getNextWorkout` in parallel, compose the same response shape.

Key implementation details:

- `search_exercises` calls `searchExercises(query)` from `../../lib/api/exercises.js` (static module function, not a client method)
- `get_context` computes today's date internally, calls 5 client methods via `Promise.all`, and returns the composite object. Reuse helper logic from `cli/mf.ts` lines 281-322 (`buildTodayContext`, `buildRecentWeight`, `summarizeLastMeal`) — either import them or inline equivalent logic. If importing from cli/ creates path issues, inline the logic.
- All descriptions should be 3-4+ sentences per the spec's tool description guidelines

- [ ] **Step 4: Run tests**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All profile tests PASS.

- [ ] **Step 5: Commit**

```bash
jj describe -m "feat(mcp): profile and context tools (get_goals, get_gym_profiles, get_custom_exercises, search_exercises, get_context)"
jj new
```

---

## Task 4: Food Tools

**Files:**

- Create: `src/mcp/tools/food.ts`
- Modify: `src/mcp/server.ts` (add `registerFoodTools`)
- Modify: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Write tests for food read tools**

Add a `food tools` describe block:

```typescript
describe('food tools', () => {
  it('get_food_log defaults to today when no date provided', async () => {
    const mockClient = createMockClient({
      getFoodLog: vi.fn().mockResolvedValue([{ name: 'Eggs', calories: 200 }]),
    });
    const client = await connectServer(mockClient);
    const result = await client.callTool({ name: 'get_food_log', arguments: {} });
    expect(mockClient.getFoodLog).toHaveBeenCalled();
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed).toHaveLength(1);
  });

  it('get_food_log passes date when provided', async () => {
    const mockClient = createMockClient();
    const client = await connectServer(mockClient);
    await client.callTool({ name: 'get_food_log', arguments: { date: '2026-03-20' } });
    expect(mockClient.getFoodLog).toHaveBeenCalledWith('2026-03-20');
  });

  it('search_foods passes query to client.searchFoods', async () => {
    const mockClient = createMockClient({
      searchFoods: vi.fn().mockResolvedValue([{ name: 'Kale', id: 'n_123' }]),
    });
    const client = await connectServer(mockClient);
    const result = await client.callTool({ name: 'search_foods', arguments: { query: 'kale' } });
    expect(mockClient.searchFoods).toHaveBeenCalledWith('kale');
  });
});
```

- [ ] **Step 2: Write tests for food write tools**

Add to the `food tools` describe block:

```typescript
it('log_food searches and logs food', async () => {
  const mockClient = createMockClient({
    searchFoods: vi.fn().mockResolvedValue([
      {
        name: 'Kale Raw',
        id: 'n_2950',
        servings: [{ description: 'g', gramWeight: 1, amount: 100 }],
        caloriesPer100g: 35,
        proteinPer100g: 2.9,
      },
    ]),
    logSearchedFood: vi.fn().mockResolvedValue(undefined),
  });
  const client = await connectServer(mockClient);
  const result = await client.callTool({
    name: 'log_food',
    arguments: { query: 'kale', grams: 150 },
  });
  expect(mockClient.searchFoods).toHaveBeenCalledWith('kale');
  expect(mockClient.logSearchedFood).toHaveBeenCalled();
});

it('log_manual_food calls client.logFood with explicit macros', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'log_manual_food',
    arguments: { name: 'Custom Meal', calories: 500, protein: 30, carbs: 50, fat: 15 },
  });
  expect(mockClient.logFood).toHaveBeenCalled();
  const args = (mockClient.logFood as any).mock.calls[0];
  expect(args[1]).toBe('Custom Meal');
  expect(args[2]).toBe(500);
});

it('delete_food calls client.deleteFoodEntry', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'delete_food',
    arguments: { date: '2026-03-20', entryId: '1234567890' },
  });
  expect(mockClient.deleteFoodEntry).toHaveBeenCalledWith('2026-03-20', '1234567890');
});

it('hard_delete_food calls client.hardDeleteFoodEntry', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'hard_delete_food',
    arguments: { date: '2026-03-20', entryId: '1234567890' },
  });
  expect(mockClient.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-20', '1234567890');
});

it('update_food calls client.updateFoodEntry', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'update_food',
    arguments: { date: '2026-03-20', entryId: '123', quantity: 200 },
  });
  expect(mockClient.updateFoodEntry).toHaveBeenCalledWith('2026-03-20', '123', 200);
});

it('copy_food_entries calls client.copyEntries', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'copy_food_entries',
    arguments: { fromDate: '2026-03-19', toDate: '2026-03-20' },
  });
  expect(mockClient.copyEntries).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All new food tests FAIL.

- [ ] **Step 4: Implement food tools**

Create `src/mcp/tools/food.ts` with `registerFoodTools(server, client)`. Key details:

- `get_food_log`: When `date` is omitted, compute today's date as `YYYY-MM-DD` in local time. Filter out deleted entries before returning.
- `log_food`: Search first with `client.searchFoods(query)`, take first result, find best serving match (reuse `findServing` logic from `cli/mf.ts`), call `client.logSearchedFood(logTime, food, serving, quantity, gramMode)`. Construct `LogTime` from date/hour/minute params (defaulting to now). The `grams` param means gram mode; `amount` + `unit` means serving mode.
- `log_manual_food`: Call `client.logFood(logTime, name, calories, protein, carbs, fat)`.
- `delete_food`, `hard_delete_food`, `update_food`, `copy_food_entries`: Direct pass-through to corresponding client methods.

Tool descriptions: Follow the detailed style from spec — 3-4+ sentences, include when to use, when NOT to use, prerequisites, related tools.

Add `registerFoodTools` import and call in `src/mcp/server.ts`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All food tests PASS.

- [ ] **Step 6: Commit**

```bash
jj describe -m "feat(mcp): food tools (get_food_log, search_foods, log_food, log_manual_food, update_food, delete_food, hard_delete_food, copy_food_entries)"
jj new
```

---

## Task 5: Nutrition Tools

**Files:**

- Create: `src/mcp/tools/nutrition.ts`
- Modify: `src/mcp/server.ts` (add `registerNutritionTools`)
- Modify: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('nutrition tools', () => {
  it('get_nutrition calls client.getNutrition with date range', async () => {
    const mockClient = createMockClient({
      getNutrition: vi.fn().mockResolvedValue([{ date: '2026-03-20', calories: 1800 }]),
    });
    const client = await connectServer(mockClient);
    const result = await client.callTool({
      name: 'get_nutrition',
      arguments: { startDate: '2026-03-14', endDate: '2026-03-20' },
    });
    expect(mockClient.getNutrition).toHaveBeenCalledWith('2026-03-14', '2026-03-20');
  });

  it('get_steps calls client.getSteps with date range', async () => {
    const mockClient = createMockClient({
      getSteps: vi.fn().mockResolvedValue([{ date: '2026-03-20', steps: 8000 }]),
    });
    const client = await connectServer(mockClient);
    await client.callTool({
      name: 'get_steps',
      arguments: { startDate: '2026-03-14', endDate: '2026-03-20' },
    });
    expect(mockClient.getSteps).toHaveBeenCalledWith('2026-03-14', '2026-03-20');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: 2 new tests FAIL.

- [ ] **Step 3: Implement nutrition tools**

Create `src/mcp/tools/nutrition.ts` with `registerNutritionTools(server, client)`. Both are straightforward pass-throughs with required `startDate`/`endDate` params (Zod `z.string()` with `.describe('ISO date, e.g. 2026-03-20')`).

Add to `src/mcp/server.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
jj describe -m "feat(mcp): nutrition tools (get_nutrition, get_steps)"
jj new
```

---

## Task 6: Weight Tools

**Files:**

- Create: `src/mcp/tools/weight.ts`
- Modify: `src/mcp/server.ts` (add `registerWeightTools`)
- Modify: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('weight tools', () => {
  it('get_weight_entries calls client with date range', async () => {
    const mockClient = createMockClient({
      getWeightEntries: vi.fn().mockResolvedValue([{ date: '2026-03-20', weight: 81.6 }]),
    });
    const client = await connectServer(mockClient);
    await client.callTool({
      name: 'get_weight_entries',
      arguments: { startDate: '2026-03-01', endDate: '2026-03-20' },
    });
    expect(mockClient.getWeightEntries).toHaveBeenCalledWith('2026-03-01', '2026-03-20');
  });

  it('log_weight with lbs converts to kg', async () => {
    const mockClient = createMockClient();
    const client = await connectServer(mockClient);
    await client.callTool({
      name: 'log_weight',
      arguments: { lbs: 180, date: '2026-03-20' },
    });
    expect(mockClient.logWeight).toHaveBeenCalled();
    const [date, kg] = (mockClient.logWeight as any).mock.calls[0];
    expect(date).toBe('2026-03-20');
    expect(kg).toBeCloseTo(81.65, 1); // 180 / 2.2046226218
  });

  it('log_weight with kg passes through directly', async () => {
    const mockClient = createMockClient();
    const client = await connectServer(mockClient);
    await client.callTool({
      name: 'log_weight',
      arguments: { kg: 80 },
    });
    expect(mockClient.logWeight).toHaveBeenCalled();
    const [, kg] = (mockClient.logWeight as any).mock.calls[0];
    expect(kg).toBe(80);
  });

  it('delete_weight calls client.deleteWeightEntry', async () => {
    const mockClient = createMockClient();
    const client = await connectServer(mockClient);
    await client.callTool({
      name: 'delete_weight',
      arguments: { date: '2026-03-20' },
    });
    expect(mockClient.deleteWeightEntry).toHaveBeenCalledWith('2026-03-20');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: 4 new tests FAIL.

- [ ] **Step 3: Implement weight tools**

Create `src/mcp/tools/weight.ts` with `registerWeightTools(server, client)`.

Key detail: `log_weight` accepts `lbs` OR `kg` (both optional in Zod schema). If `lbs` is provided, convert: `kg = lbs / 2.2046226218`. Use `resolveWeight` from `cli/helpers.ts` if importable, otherwise inline the conversion. Date defaults to today if omitted. Pass `bodyFat` if provided (optional).

Add to `src/mcp/server.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
jj describe -m "feat(mcp): weight tools (get_weight_entries, log_weight, delete_weight)"
jj new
```

---

## Task 7: Workout Tools

**Files:**

- Create: `src/mcp/tools/workout.ts`
- Modify: `src/mcp/server.ts` (add `registerWorkoutTools`)
- Modify: `src/mcp/tools/tools.test.ts`

- [ ] **Step 1: Write tests for workout read tools**

```typescript
describe('workout tools', () => {
  it('get_workouts calls client.getWorkoutHistory', async () => {
    const mockClient = createMockClient({
      getWorkoutHistory: vi.fn().mockResolvedValue([{ id: 'w1', name: 'Push Day' }]),
    });
    const client = await connectServer(mockClient);
    const result = await client.callTool({ name: 'get_workouts', arguments: {} });
    expect(mockClient.getWorkoutHistory).toHaveBeenCalled();
  });

  it('get_workout calls client.getWorkout with id', async () => {
    const mockClient = createMockClient({
      getWorkout: vi.fn().mockResolvedValue({ id: 'w1', name: 'Push Day', blocks: [] }),
    });
    const client = await connectServer(mockClient);
    await client.callTool({ name: 'get_workout', arguments: { id: 'w1' } });
    expect(mockClient.getWorkout).toHaveBeenCalledWith('w1');
  });

  it('get_training_program returns active program', async () => {
    const mockClient = createMockClient({
      getTrainingPrograms: vi.fn().mockResolvedValue([{ id: 'p1', name: 'SBS RTF', isActive: true, days: [] }]),
    });
    const client = await connectServer(mockClient);
    const result = await client.callTool({ name: 'get_training_program', arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.name).toBe('SBS RTF');
  });

  it('get_next_workout calls client.getNextWorkout', async () => {
    const mockClient = createMockClient({
      getNextWorkout: vi.fn().mockResolvedValue({ dayName: 'Day A', isRestDay: false }),
    });
    const client = await connectServer(mockClient);
    await client.callTool({ name: 'get_next_workout', arguments: {} });
    expect(mockClient.getNextWorkout).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write tests for workout write tools**

Add to the `workout tools` describe block:

```typescript
it('log_workout creates a workout with resolved exercises', async () => {
  const mockClient = createMockClient({
    getGymProfiles: vi.fn().mockResolvedValue([{ id: 'g1', name: 'Home', icon: 'house' }]),
    updateRawWorkout: vi.fn().mockResolvedValue(undefined),
  });
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'log_workout',
    arguments: {
      name: 'Push Day',
      gym: 'Home',
      exercises: [{ name: 'bench press', sets: [{ reps: 10, lbs: 135, sets: 3 }] }],
    },
  });
  expect(mockClient.updateRawWorkout).toHaveBeenCalled();
});

it('delete_workout calls client.deleteWorkout', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({ name: 'delete_workout', arguments: { id: 'w1' } });
  expect(mockClient.deleteWorkout).toHaveBeenCalledWith('w1');
});

it('remove_exercise calls getRawWorkout then updateRawWorkout', async () => {
  const mockClient = createMockClient({
    getRawWorkout: vi.fn().mockResolvedValue({
      blocks: [{ exercises: [{ id: 'ex1' }, { id: 'ex2' }] }],
    }),
    updateRawWorkout: vi.fn().mockResolvedValue(undefined),
  });
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'remove_exercise',
    arguments: { workoutId: 'w1', exerciseId: 'ex1' },
  });
  expect(mockClient.getRawWorkout).toHaveBeenCalledWith('w1');
  expect(mockClient.updateRawWorkout).toHaveBeenCalled();
});

it('update_workout calls client.updateWorkout', async () => {
  const mockClient = createMockClient();
  const client = await connectServer(mockClient);
  await client.callTool({
    name: 'update_workout',
    arguments: { id: 'w1', name: 'Renamed Workout' },
  });
  expect(mockClient.updateWorkout).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All new workout tests FAIL.

- [ ] **Step 4: Implement workout tools**

Create `src/mcp/tools/workout.ts` with `registerWorkoutTools(server, client)`.

Key implementation details:

- `get_workouts`: Accepts optional `from`/`to` date strings. Passes to `client.getWorkoutHistory()` and filters by date range if provided.
- `log_workout`: The most complex tool. Reuse logic from `cli/mf.ts` lines 734-843:
  1. Resolve gym name → gym profile via `client.getGymProfiles()`
  2. For each exercise input, call `searchExercises(name)` from `../../lib/api/exercises.js` to resolve the exercise ID
  3. Call `expandSets()` from `cli/helpers.ts` (or inline) to expand `{reps, lbs, sets: 3}` → 3 raw sets with kg conversion and microsecond rest timers
  4. Call `buildWorkoutExercise()` from CLI (or inline) to construct raw Firestore exercise structure
  5. Build workout fields and call `client.updateRawWorkout(randomUUID(), fields, fieldPaths)`
- `log_exercise`: Same exercise-building logic, but appends to existing workout via `getRawWorkout` → add blocks → `updateRawWorkout`
- `remove_exercise`: Read-modify-write — `getRawWorkout`, filter out blocks containing the exerciseId, `updateRawWorkout` with new blocks. Match the logic in `cli/mf.ts` lines 924-947.
- `update_workout`: Pass-through to `client.updateWorkout(id, fields)`
- `delete_workout`: Pass-through to `client.deleteWorkout(id)`

**Note on code reuse**: `log_workout` and `log_exercise` share substantial logic with the CLI. Consider extracting shared helpers (`buildWorkoutExercise`, `expandSets`, `normalizeSetInputs`, `findServing`) into a shared location (e.g., `src/lib/helpers.ts` or keep importing from `cli/helpers.ts`). If importing from `cli/` causes tsup bundling issues, inline the logic.

Add to `src/mcp/server.ts`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/mcp/tools/tools.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
jj describe -m "feat(mcp): workout tools (get_workouts, get_workout, get_training_program, get_next_workout, log_workout, log_exercise, update_workout, delete_workout, remove_exercise)"
jj new
```

---

## Task 8: stdio Entry Point

**Files:**

- Create: `src/mcp/stdio.ts`

- [ ] **Step 1: Implement stdio entry point**

```typescript
// src/mcp/stdio.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MacroFactorClient } from '../lib/api/index.js';
import { createServer } from './server.js';

async function main() {
  const username = process.env.MACROFACTOR_USERNAME;
  const password = process.env.MACROFACTOR_PASSWORD;

  if (!username || !password) {
    console.error('Missing credentials. Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD environment variables.');
    process.exit(1);
  }

  const client = await MacroFactorClient.login(username, password);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build:mcp`
Expected: Builds successfully, produces `dist/mcp/stdio.js`.

- [ ] **Step 3: Verify it starts (will fail without creds, but should show the right error)**

Run: `node dist/mcp/stdio.js`
Expected: Exits with "Missing credentials" message (no env vars set).

- [ ] **Step 4: Commit**

```bash
jj describe -m "feat(mcp): stdio entry point"
jj new
```

---

## Task 9: HTTP Entry Point

**Files:**

- Create: `src/mcp/http.ts`

- [ ] **Step 1: Implement HTTP entry point**

```typescript
// src/mcp/http.ts
import { createServer as createHTTPServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MacroFactorClient } from '../lib/api/index.js';
import { createServer } from './server.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/protocol.js';
import { randomUUID } from 'node:crypto';

const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const username = process.env.MACROFACTOR_USERNAME;
const password = process.env.MACROFACTOR_PASSWORD;

if (!username || !password) {
  console.error('Missing credentials. Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD.');
  process.exit(1);
}

const sessions = new Map<string, StreamableHTTPServerTransport>();

const client = await MacroFactorClient.login(username, password);

const httpServer = createHTTPServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url !== '/mcp') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Bearer auth check
  if (AUTH_TOKEN) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  // Parse body for POST
  let body: any;
  if (req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Existing session
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, body);
    return;
  }

  // New session (initialize)
  if (req.method === 'POST' && isInitializeRequest(body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    const server = createServer(client);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  // SSE stream for existing session
  if (req.method === 'GET' && sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Invalid request. Send initialize first.' }));
});

httpServer.listen(PORT, () => {
  console.log(`MacroFactor MCP server listening on http://localhost:${PORT}/mcp`);
  if (!AUTH_TOKEN) {
    console.warn('Warning: MCP_AUTH_TOKEN not set — endpoint is unauthenticated.');
  }
});
```

Note: This uses Node's built-in `node:http` to avoid adding Express as a dependency. If the MCP SDK's `StreamableHTTPServerTransport` requires Express-specific request/response objects, we may need to add Express or use the SDK's `createMcpExpressApp()` helper. Check the SDK docs at implementation time and adjust accordingly.

- [ ] **Step 2: Verify build**

Run: `pnpm run build:mcp`
Expected: Builds successfully, produces `dist/mcp/http.js`.

- [ ] **Step 3: Verify it starts**

Run: `node dist/mcp/http.js` (with creds set)
Expected: Prints "MacroFactor MCP server listening on http://localhost:3001/mcp"

Kill it with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
jj describe -m "feat(mcp): HTTP entry point with bearer auth and session management"
jj new
```

---

## Task 10: npm Packaging

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Update package.json for publishing**

Update `package.json`:

- Change `"name"` to `"@sjawhar/macrofactor-mcp"`
- Keep `"private": true` removed (or add `"publishConfig": { "access": "public" }` for scoped package)
- Verify `"bin"`, `"files"`, `"type": "module"` are set correctly
- Add `"engines": { "node": ">=22" }` (matches `.npmrc`)

- [ ] **Step 2: Test the full build pipeline**

Run: `pnpm run build:mcp`
Expected: `dist/mcp/stdio.js` and `dist/mcp/http.js` exist with no errors.

- [ ] **Step 3: Verify npx dry run**

Run: `node dist/mcp/stdio.js` (without creds)
Expected: Clean error message about missing credentials.

- [ ] **Step 4: Test the shebang**

Run: `head -1 dist/mcp/stdio.js`
Expected: `#!/usr/bin/env node`

If the shebang appears on all files (including http.js) and that's undesirable, update `tsup.config.ts` to only add it to stdio.js. Otherwise leave it — a shebang on http.js is harmless.

- [ ] **Step 5: Verify package contents**

Run: `pnpm pack --dry-run`
Expected: Lists only `dist/`, `data/exercises.json`, `package.json`, `README.md`. No `src/`, no `node_modules/`, no SvelteKit files.

- [ ] **Step 6: Commit**

```bash
jj describe -m "chore: configure npm package for @sjawhar/macrofactor-mcp"
jj new
```

---

## Task 11: README Update

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add MCP server section to README**

Add a new section after "Architecture" (before "Project structure") that covers:

- What the MCP server is and what it provides
- Installation: `npm install -g @sjawhar/macrofactor-mcp`
- Configuration for Claude Code (JSON example with env vars)
- Configuration for other agents (Cursor, Windsurf — same pattern, note they use different config files)
- Remote usage: running `http.ts` with env vars, setting `MCP_AUTH_TOKEN`
- Link to the tool list (or inline a condensed tool table)
- Note about `data/exercises.json` bundled in the package

Keep existing CLI and programmatic usage sections. The MCP section supplements, not replaces.

- [ ] **Step 2: Commit**

```bash
jj describe -m "docs: add MCP server setup instructions to README"
jj new
```

---

## Task 12: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing CLI tests + new MCP tests).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Run format**

Run: `npm run format`
Expected: All files formatted.

- [ ] **Step 4: Verify MCP build is independent of SvelteKit build**

Run: `npm run build && pnpm run build:mcp`
Expected: Both builds succeed without interfering.

- [ ] **Step 5: Commit any remaining fixes**

```bash
jj describe -m "chore: final cleanup and verification"
jj new
```
