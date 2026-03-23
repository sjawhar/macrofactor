# Agent-Native Architecture Audit — MacroFactor

**Date:** 2026-03-22 | **Status:** Ready for review

## Current State

MacroFactor has three interfaces:

1. **Web UI** — SvelteKit 2 + Svelte 5, client-side only, 8 feature pages
2. **CLI** — `npx tsx cli/mf.ts`, 15 commands, JSON I/O
3. **MCP Skill** — `.opencode/skills/macrofactor-api/SKILL.md`, guides agents to use the CLI

Agents interact with MacroFactor by reading the MCP skill (which describes CLI commands) and executing bash commands. There is no MCP server, no structured tool interface, no dynamic capability discovery.

---

## Audit Against Agent-Native Principles

### 1. PARITY — ❌ MAJOR GAPS

**Principle:** Every UI action has a corresponding agent capability.

| UI Capability                            | Page                   | Agent Can Do? | Gap                                                 |
| ---------------------------------------- | ---------------------- | ------------- | --------------------------------------------------- |
| View daily macro targets/goals           | Dashboard, Strategy    | ❌            | No `goals` command                                  |
| View nutrition history (7/30/90d)        | Nutrition, Dashboard   | ❌            | No `nutrition` command                              |
| View weight history + trend              | Weight                 | ❌            | No `weight-history` command                         |
| Delete weight entry                      | Weight                 | ❌            | No `delete-weight` command                          |
| Copy food entries to another date        | Food Log               | ❌            | No `copy-food` command                              |
| Move food entries to another date        | Food Log               | ❌            | No `move-food` command (no client method either)    |
| Quick-add manual food (custom macros)    | Search                 | ❌            | No `log-manual-food` command                        |
| View TDEE / expenditure data             | Expenditure            | ❌            | No `expenditure` command                            |
| View micronutrient averages              | Micros                 | ❌            | No `micros` command                                 |
| View weight insights (3/7/14/30d change) | Weight                 | ❌            | Computed client-side, requires weight data          |
| View food nutrient details               | Food Log modal         | ❌            | `food-log` returns basic macros, not full breakdown |
| View step count data                     | (client method exists) | ❌            | No `steps` command                                  |
| Get custom exercises                     | (client method exists) | ❌            | No `custom-exercises` command                       |

**10 client methods** have no CLI exposure. **13 UI actions** have no agent equivalent.

**Score: 2/5** — Agent can handle basic CRUD on food and workouts, but is blind to the user's goals, history trends, nutrition summaries, and cannot perform multi-entry operations.

---

### 2. GRANULARITY — ⚠️ MIXED

**Principle:** Tools are atomic primitives; features are prompt-defined outcomes.

**Atomic (good):** 12 of 15 commands are proper primitives — `login`, `profile`, `food-log`, `search-food`, `workout`, `workouts`, `exercises search`, `exercise`, `gyms`, `delete-food`, `update-food`, `log-weight`.

**Workflow-shaped (bad):** 3 commands bundle decisions:

| Command        | Bundled Decisions                                                                                              | Agent Judgment Pre-empted                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `log-food`     | search → pick (default: first result) → match serving unit → log                                               | Agent can't inspect results before committing; can't handle ambiguous matches |
| `log-workout`  | search exercises → pick first match → expand sets → select gym (default: first) → default duration 45min → log | Agent can't choose exercise from results; can't customize per-set rest timers |
| `log-exercise` | search exercises → pick first match → expand sets → append                                                     | Same as above                                                                 |

The `log-food` command is the most problematic. It takes a `query` parameter, internally calls `searchFoods()`, picks result by index (default 0), matches servings by string alias, and logs — all in one call. The agent CAN work around this by calling `search-food` first, then `log-food` with `pick`, but the tool still encodes the serving-unit matching logic.

**Score: 3/5** — Most tools are atomic, but the three write-heavy commands bundle critical decisions.

---

### 3. COMPOSABILITY — ⚠️ LIMITED

**Principle:** New features can be added by writing new prompts alone.

**What works:** An agent can compose `search-food` + `log-food` + `food-log` to build a "meal planner" prompt. It can compose `program` + `next-workout` + `log-workout` for training automation.

**What doesn't work:**

- Agent can't build a "weekly nutrition report" — `getNutrition()` isn't exposed
- Agent can't build a "weight check-in" workflow — `getWeightEntries()` isn't exposed
- Agent can't implement "copy yesterday's meals" — `copyEntries()` isn't exposed
- Agent can't create a "TDEE calculator" — requires weight + nutrition data over time
- Agent can't do "log a custom food" (not from search) — `logFood()` isn't exposed

**Score: 2/5** — Composable for food logging and workout creation, but missing too many read primitives to compose anything analytical.

---

### 4. EMERGENT CAPABILITY — ❌ LIMITED

**Principle:** Agent can accomplish tasks you didn't explicitly design for.

**Test:** "Cross-reference my nutrition intake with my training program and tell me if I'm eating enough protein on training days vs rest days."

**Result:** Agent CANNOT do this because:

1. No `nutrition` command to get daily intake summaries
2. `program` shows the schedule but `workouts` needs date filtering to correlate
3. No way to get goals/targets to compare against

The agent is limited to the exact workflows the CLI commands support. Open-ended analysis questions are impossible without the read primitives.

**Score: 1/5** — Almost no emergent capability. Agent is a CLI wrapper, not an intelligent assistant.

---

### 5. TOOL DESIGN — ⚠️ MIXED

**5a. Dynamic vs Static:** ❌ Fully static. No `help`, `capabilities`, or discovery command. Agent must be pre-loaded with the SKILL.md file to know what's available.

**5b. CRUD Completeness:**

| Entity          | Create | Read   | Update           | Delete | Score                       |
| --------------- | ------ | ------ | ---------------- | ------ | --------------------------- |
| Food Entry      | ✅     | ✅     | ✅ (qty only)    | ✅     | 4/5 (no field-level update) |
| Weight          | ✅     | ❌ CLI | ❌               | ❌ CLI | 1/5                         |
| Workout         | ✅     | ✅     | ❌ (append only) | ❌     | 2/5                         |
| Exercise (ref)  | ❌     | ✅     | ❌               | ❌     | 1/5 (read-only is fine)     |
| Custom Exercise | ❌     | ❌     | ❌               | ❌     | 0/5                         |
| Program         | ❌     | ✅     | ❌               | ❌     | 1/5                         |
| Gym             | ❌     | ✅     | ❌               | ❌     | 1/5                         |
| Nutrition       | ❌     | ❌ CLI | ❌               | ❌     | 0/5                         |
| Goals           | ❌     | ❌ CLI | ❌               | ❌     | 0/5                         |
| Steps           | ❌     | ❌ CLI | ❌               | ❌     | 0/5                         |
| Profile         | ❌     | ✅     | ❌               | ❌     | 1/5                         |

**5c. Primitives not Workflows:** 3 of 15 commands violate this (see Granularity above).

**Score: 2/5** — Food entries have decent CRUD; everything else is read-only or missing entirely.

---

### 6. FILES & WORKSPACE — ❌ NOT IMPLEMENTED

**6a. Shared Workspace:** ✅ Partial — Both UI and CLI write to the same Firestore backend, so changes in one are visible in the other. This is "shared workspace" at the data layer, but there's no local file-based workspace.

**6b. context.md Pattern:** ❌ None. No accumulated knowledge about user preferences, patterns, or history. Every agent session starts fresh.

**6c. File Organization:** N/A — Not a file-based app.

**Score: 1/5** — Shared data backend is good, but no accumulated context.

---

### 7. AGENT EXECUTION — ❌ NOT IMPLEMENTED

**7a. Completion Signals:** ❌ No `complete_task` tool. CLI commands just output JSON and exit. There's no concept of multi-step task completion.

**7b. Partial Completion:** ❌ No progress tracking. If an agent is logging 5 foods and fails on #3, there's no way to resume from where it stopped.

**7c. Context Limits:** ⚠️ The CLI outputs JSON which is context-efficient, but there's no pagination or truncation for large responses (e.g., `workouts` could return hundreds of entries).

**Score: 1/5** — CLI is fire-and-forget; no execution lifecycle management.

---

### 8. CONTEXT INJECTION — ⚠️ PARTIAL

**8a. Available Resources:** ⚠️ The MCP skill documents available commands and their parameters, but doesn't inject dynamic state (current goals, recent entries, etc.).

**8b. Available Capabilities:** ✅ The SKILL.md file documents all 15 CLI commands with examples, parameter formats, and common mistakes. This is good static context injection.

**8c. Dynamic Context:** ❌ No mechanism to refresh context mid-session. Agent can't call a "get-context" command that returns current goals, recent activity, and available actions.

**Score: 2/5** — Good static documentation, but no dynamic context.

---

### 9. UI INTEGRATION — ⚠️ PARTIAL

**9a. Agent → UI:** ✅ When agent logs food/weight via CLI, the web UI reflects it on next load (shared Firestore). No real-time push though.

**9b. No Silent Actions:** ✅ All CLI writes go to Firestore which the UI reads. No orphaned local state.

**9c. Capability Discovery:** ❌ Users can't ask the UI "what can the agent do?" There's no agent integration in the web UI at all — the agent is a separate CLI tool.

**Score: 2/5** — Data consistency is good, but no agent-UI integration.

---

### 10. SELF-MODIFICATION — ❌ NOT IMPLEMENTED

No mechanism for the agent to evolve its own prompts, learn user preferences, or modify its behavior based on feedback.

**Score: 0/5**

---

## Overall Scorecard

| Principle           | Score     | Status                               |
| ------------------- | --------- | ------------------------------------ |
| Parity              | 2/5       | ❌ Major gaps                        |
| Granularity         | 3/5       | ⚠️ Mixed                             |
| Composability       | 2/5       | ⚠️ Limited                           |
| Emergent Capability | 1/5       | ❌ Critical                          |
| Tool Design         | 2/5       | ❌ Incomplete CRUD                   |
| Files & Workspace   | 1/5       | ❌ No context                        |
| Agent Execution     | 1/5       | ❌ Not implemented                   |
| Context Injection   | 2/5       | ⚠️ Static only                       |
| UI Integration      | 2/5       | ⚠️ Data-only                         |
| Self-Modification   | 0/5       | ❌ Not implemented                   |
| **Overall**         | **1.6/5** | **❌ CLI wrapper, not agent-native** |

---

## Proposed Plan: Agent-Native MacroFactor

### Phase 1: Parity + CRUD (Close the data gap)

**Goal:** Agent can read/write everything the UI can.

**New CLI commands (10):**

1. `goals` — Read daily/weekly macro targets (`getGoals()`)
2. `nutrition` — Read nutrition history for date range (`getNutrition()`)
3. `weight-history` — Read weight entries for date range (`getWeightEntries()`)
4. `delete-weight` — Delete weight entry (`deleteWeightEntry()`)
5. `steps` — Read step data (`getSteps()`)
6. `copy-food` — Copy food entries to another date (`copyEntries()`)
7. `log-manual-food` — Log food with custom macros. **Prerequisite:** `logFood()` in `client.ts:304` currently uses generic `patchDocument()` which encodes numbers as `integerValue`/`doubleValue` — this is UNSAFE for food entries (crashes Android app). Must rewrite `logFood()` to use `patchFoodDocument()`/`sfv()` food-safe serialization before exposing via CLI.
8. `custom-exercises` — List custom exercises (`getCustomExercises()`)
9. `update-workout` — Edit workout fields (new client method needed)
10. `delete-workout` — Delete workout (new client method needed)

**Refactor existing commands (3):**

1. `log-food` → Accept `foodId` + `servingIndex` + `quantity` directly (remove internal search)
2. `log-workout` → Accept `exerciseId` directly (remove internal exercise search, remove defaults)
3. `log-exercise` → Accept `exerciseId` directly (same)

**Estimated effort:** Medium (mostly plumbing existing client methods into CLI commands)

**Verification (uses temporary test data — safe against live account):**

```bash
# ═══ SETUP: create temporary records for safe QA ═══
TEST_DATE=$(date -d '+1 day' +%Y-%m-%d)  # tomorrow, avoids touching real data

# ═══ READ COMMANDS ═══
npx tsx cli/mf.ts goals | jq '.calories | length'    # → 7 (one target per weekday)
npx tsx cli/mf.ts goals | jq '.calories[0]'           # → number > 0 (Monday target)
npx tsx cli/mf.ts nutrition --from 2026-03-15 --to 2026-03-22 | jq 'length'  # → ≥ 1
npx tsx cli/mf.ts weight-history --from 2026-03-01 --to 2026-03-22 | jq 'length'  # → ≥ 1
npx tsx cli/mf.ts steps --from 2026-03-15 --to 2026-03-22 | jq 'length'  # → ≥ 0
npx tsx cli/mf.ts custom-exercises | jq 'type'     # → "array"

# ═══ REFACTORED log-food: accepts foodId directly ═══
FOOD_ID=$(npx tsx cli/mf.ts search-food 'banana' | jq -r '.[0].foodId')
npx tsx cli/mf.ts log-food '{"foodId":"'$FOOD_ID'","servingIndex":0,"quantity":1,"loggedAt":"'$TEST_DATE'T08:00:00"}' | jq '.status'  # → "logged"

# ═══ REFACTORED log-workout: accepts exerciseId directly ═══
EX_ID=$(npx tsx cli/mf.ts exercises search 'bench press' | jq -r '.[0].id')
npx tsx cli/mf.ts log-workout '{"name":"QA-Test-Workout","exercises":[{"exerciseId":"'$EX_ID'","sets":[{"reps":10,"kg":60}]}]}' | jq '.status'  # → "created"
QA_WORKOUT=$(npx tsx cli/mf.ts workouts | jq -r '[.[] | select(.name=="QA-Test-Workout")][0].id')

# ═══ log-manual-food: food-safe custom macros ═══
npx tsx cli/mf.ts log-manual-food '{"name":"QA-Custom-Food","calories":200,"protein":15,"carbs":20,"fat":8,"loggedAt":"'$TEST_DATE'T12:00:00"}' | jq '.status'  # → "logged"
npx tsx cli/mf.ts food-log $TEST_DATE | jq '[.[] | select(.name=="QA-Custom-Food")] | length'  # → 1

# ═══ copy-food: fetch entryIds from test date, copy to another date ═══
ENTRY_IDS=$(npx tsx cli/mf.ts food-log $TEST_DATE | jq '[.[0:2] | .[].entryId]')
COPY_DATE=$(date -d '+2 days' +%Y-%m-%d)
npx tsx cli/mf.ts copy-food '{"sourceDate":"'$TEST_DATE'","targetDate":"'$COPY_DATE'","entryIds":'$ENTRY_IDS'}' | jq '.status'  # → "copied"
npx tsx cli/mf.ts food-log $COPY_DATE | jq 'length'  # → ≥ 2

# ═══ delete-weight: create then delete (safe) ═══
npx tsx cli/mf.ts log-weight '{"kg":80,"date":"'$TEST_DATE'"}' | jq '.status'  # → "logged"
npx tsx cli/mf.ts delete-weight '{"date":"'$TEST_DATE'"}' | jq '.status'  # → "deleted"

# ═══ update-workout + delete-workout: use QA-Test-Workout ═══
npx tsx cli/mf.ts update-workout '{"id":"'$QA_WORKOUT'","name":"QA-Renamed"}' | jq '.status'  # → "updated"
npx tsx cli/mf.ts workout $QA_WORKOUT | jq '.name'  # → "QA-Renamed"
npx tsx cli/mf.ts delete-workout '{"id":"'$QA_WORKOUT'"}' | jq '.status'  # → "deleted"

# ═══ TEARDOWN: clean up all test data ═══
for EID in $(npx tsx cli/mf.ts food-log $TEST_DATE | jq -r '.[].entryId'); do
  npx tsx cli/mf.ts delete-food '{"date":"'$TEST_DATE'","entryId":"'$EID'"}'
done
for EID in $(npx tsx cli/mf.ts food-log $COPY_DATE | jq -r '.[].entryId'); do
  npx tsx cli/mf.ts delete-food '{"date":"'$COPY_DATE'","entryId":"'$EID'"}'
done
```

### Phase 2: MCP Server (Structured tool interface)

**Goal:** Replace CLI-via-bash with a proper MCP server that provides structured tools.

**Why:** CLI-via-bash is fragile — agents must construct bash commands, parse JSON stdout, handle stderr errors. An MCP server gives:

- Typed tool definitions with JSON Schema
- Structured error handling
- Dynamic capability discovery (MCP's `tools/list`)
- No bash escaping issues

**Implementation:**

- Create `mcp-server/` directory with MCP server using `@modelcontextprotocol/sdk`
- Each CLI command becomes an MCP tool with proper input schemas
- Add `resources/` for dynamic context (current goals, recent activity)
- Register in `.opencode/mcp.json` or equivalent

**New tools (mapping from CLI):**

```
macrofactor.login
macrofactor.getProfile
macrofactor.getGoals
macrofactor.getFoodLog
macrofactor.searchFoods
macrofactor.logFood          # atomic: foodId + serving + qty
macrofactor.logManualFood    # atomic: name + macros
macrofactor.deleteFoodEntry
macrofactor.updateFoodEntry
macrofactor.copyFoodEntries
macrofactor.logWeight
macrofactor.getWeightHistory
macrofactor.deleteWeight
macrofactor.getNutrition
macrofactor.getSteps
macrofactor.getWorkoutHistory
macrofactor.getWorkout
macrofactor.createWorkout    # atomic: blocks with exerciseIds
macrofactor.updateWorkout
macrofactor.deleteWorkout
macrofactor.addExerciseToWorkout  # atomic: exerciseId + sets
macrofactor.getProgram
macrofactor.getNextWorkout
macrofactor.getGyms
macrofactor.searchExercises
macrofactor.resolveExercise
macrofactor.getCustomExercises
macrofactor.getContext       # dynamic: goals, recent logs, program state
```

**New resources (MCP resources for context injection):**

```
macrofactor://context        # Current goals, last 3 days food, weight trend
macrofactor://capabilities   # What the agent can do, in user vocabulary
```

**Estimated effort:** High (new server, tool definitions, resource providers)

**Verification:**

```bash
# Start MCP Inspector (opens browser-based tool explorer)
npx @modelcontextprotocol/inspector node mcp-server/index.js
# In the Inspector UI:
#   1. Click 'List Tools' → expect ≥ 25 tools listed
#   2. Each tool shows: name, description, inputSchema with JSON Schema properties
#   3. Click 'List Resources' → expect macrofactor://context and macrofactor://capabilities
#   4. Click macrofactor://context → expect JSON with keys: goals, today, recentWeight, program, lastMeal

# Alternatively, test via opencode integration:
#   1. Add server to .opencode/mcp.json: { "macrofactor": { "command": "node", "args": ["mcp-server/index.js"] } }
#   2. Start opencode session
#   3. Verify: agent can call macrofactor.getFoodLog without bash
#   4. Verify: agent gets structured JSON response, not stdout text
#   5. Verify: agent sees all tools via MCP discovery
```

### Phase 3: Dynamic Context (Make the agent smart)

**Goal:** Agent has real-time awareness of user state.

**Deliverable:** A `context` CLI command (Phase 1 adds the read primitives; Phase 3 composes them into a single snapshot). This is a CLI command — not an MCP-only tool — so it works whether or not Phase 2 is complete.

**Implementation:**

1.  **`context` CLI command** — New command in `cli/mf.ts` that calls `getGoals()`, `getFoodLog(today)`, `getWeightEntries(last30d)`, `getTrainingPrograms()`, and `getNextWorkout()`, returning a single structured snapshot:

```json
{
  "goals": { "calories": [2200, 2200, 2200, 2200, 2200, 2000, 2000], "protein": [180, 180, 180, 180, 180, 160, 160] },
  "today": { "logged": 1450, "protein": 95, "remaining": 750, "meals": 2 },
  "recentWeight": { "latest": 82.5, "trend7d": -0.3 },
  "program": { "name": "PPL", "nextDay": "Pull A", "cycle": 3 },
  "lastMeal": { "time": "12:30", "items": 3, "calories": 650 }
}
```

2.  **System prompt template** — Update MCP skill to instruct agents to call `context` first:

```
You are a nutrition and fitness assistant for {name}.
Current goals: {calories} cal, {protein}g protein, {carbs}g carbs, {fat}g fat.
Today so far: {todayCalories} cal ({remaining} remaining), ...
Weight trend: {trend} over last 7 days.
Training: {programName}, next workout is {nextDay}.
```

3. **Refresh mechanism** — Agent can re-call `context` mid-session after logging to get updated state.

**Estimated effort:** Medium

**Verification:**

```bash
# context command returns complete snapshot
npx tsx cli/mf.ts context | jq 'keys'  # → ["goals", "lastMeal", "program", "recentWeight", "today"]

# Each section has expected fields
npx tsx cli/mf.ts context | jq '.goals.calories | length'  # → 7 (array of daily targets)
npx tsx cli/mf.ts context | jq '.goals.calories[0]'       # → number > 0
npx tsx cli/mf.ts context | jq '.today.logged'      # → number ≥ 0
npx tsx cli/mf.ts context | jq '.program.name'      # → non-empty string

# Context reflects real-time state: log food, then re-check
BEFORE=$(npx tsx cli/mf.ts context | jq '.today.logged')
npx tsx cli/mf.ts log-food '{"foodId":"'$(npx tsx cli/mf.ts search-food banana | jq -r '.[0].foodId')'","servingIndex":0,"quantity":1}' | jq '.status'  # → "logged"
AFTER=$(npx tsx cli/mf.ts context | jq '.today.logged')
# AFTER > BEFORE (logged calories increased after food entry)
```

**Goal:** Agent remembers user preferences and patterns across sessions.

**Implementation:**

1. **`data/agent-context.md`** — Persisted file the agent reads/updates:

   ```markdown
   # User Preferences

   - Prefers logging in grams, not servings
   - Usually eats 3 meals: breakfast ~7am, lunch ~12pm, dinner ~7pm
   - Training days: Mon/Wed/Fri
   - Favorite foods: Greek yogurt, chicken breast, rice

   # Learned Patterns

   - Protein is usually low on rest days
   - Tends to forget logging dinner

   # Recent Context

   - Last check-in: 2026-03-20, weight stable at 82.5kg
   - Current program cycle: 3 of 8
   ```

2. **Agent instructions** — Skill file tells agent to read and update this file
3. **No code required** — This is a pure prompt/file pattern

**Estimated effort:** Low

**Verification:**

```bash
# Context file exists and is readable
cat data/agent-context.md  # → markdown with headings: User Preferences, Learned Patterns, Recent Context

# Agent skill references the file
grep 'agent-context' .opencode/skills/macrofactor-api/SKILL.md  # → instruction to read/update
```

### Phase 5: Emergent Capability (Prompt engineering)

**Goal:** Agent can answer open-ended questions about nutrition, training, and progress.

**Approach (decided):** Expose raw data primitives, let the agent reason. Do NOT build computed analytical tools like `analyzeNutrition` or `analyzeTraining` — this violates the agent-native principle of "features are prompt-defined outcomes." Phases 1–3 give the agent every data primitive it needs. Phase 5 is purely about the system prompt and skill instructions that teach the agent HOW to compose those primitives for analysis.

**Implementation:**

1. **Skill prompt update** — Add analytical prompt patterns to the MCP skill:
   - "To compare training-day vs rest-day nutrition: call `program` to get training days, `nutrition` for the range, then group and average."
   - "To estimate TDEE: call `weight-history` and `nutrition` for 30 days, compute caloric surplus/deficit against weight change rate."
   - "To identify protein gaps: call `goals` for targets, `nutrition` for actuals, compute percentage met per day."
2. **Example compositions** — Add 3–5 worked examples to the skill showing multi-tool compositions:
   - Weekly nutrition report (goals + nutrition + weight-history)
   - Training volume analysis (workouts + program + exercises)
   - Progress check (weight-history + nutrition + goals)

**Verification:**

```bash
# Skill file contains analytical patterns
grep -c 'To compare\|To estimate\|To identify' .opencode/skills/macrofactor-api/SKILL.md  # → ≥ 3

# Worked examples section exists
grep 'Worked Examples\|Multi-Tool Compositions' .opencode/skills/macrofactor-api/SKILL.md  # → match
```

**Estimated effort:** Low (prompt engineering only, no code changes)

_Phase 6 (UI Integration) is intentionally excluded from this plan. It requires a separate product design session before any implementation planning can begin. Phases 1–5 deliver a fully agent-native backend; Phase 6 would layer a UI on top and will be planned independently if/when the product decision is made._

---

## Priority Ranking

| Phase                  | Impact      | Effort | Priority                |
| ---------------------- | ----------- | ------ | ----------------------- |
| 1: Parity + CRUD       | 🔴 Critical | Medium | **P0 — Do first**       |
| 2: MCP Server          | 🟠 High     | High   | **P1 — Foundation**     |
| 3: Dynamic Context     | 🟠 High     | Medium | **P1 — Intelligence**   |
| 4: Accumulated Context | 🟡 Medium   | Low    | **P2 — Easy win**       |
| 5: Emergent Capability | 🟢 Bonus    | Low    | **P2 — Unlocked by P0** |

Phase 1 is the highest-leverage change: 10 new commands + 3 refactored commands unlocks composability, emergent capability, and analytical use cases. Everything else builds on top.
