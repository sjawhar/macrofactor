#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type ToolSummary = {
  name: string;
  description: string;
};

const toolSummaries: ToolSummary[] = [];

function jsonToolResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: string }).stderr?.trim();
    const stdout = (error as Error & { stdout?: string }).stdout?.trim();
    for (const text of [stderr, stdout]) {
      if (!text) continue;
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        if (typeof parsed.error === 'string') return parsed.error;
      } catch {}
      return text;
    }
    return error.message;
  }
  return 'Unknown CLI error';
}

async function runCli(command: string, payload?: unknown): Promise<unknown> {
  const args = ['tsx', 'cli/mf.ts', ...command.split(' ')];
  if (payload !== undefined) {
    args.push(JSON.stringify(payload));
  }
  try {
    const { stdout, stderr } = await execFileAsync('npx', args, {
      cwd: rootDir,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    const text = stdout.trim();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

function registerCliTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: z.ZodRawShape,
  command: string,
  buildPayload?: (args: Record<string, unknown>) => unknown
) {
  toolSummaries.push({ name, description });
  server.registerTool(name, { description, inputSchema }, async (args, _extra) => {
    const payload = buildPayload ? buildPayload(args) : Object.keys(args).length === 0 ? undefined : args;
    return jsonToolResponse(await runCli(command, payload));
  });
}

const server = new McpServer(
  { name: 'macrofactor-mcp', version: '1.0.0' },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      logging: {},
    },
  }
);

const emptySchema: z.ZodRawShape = {};
const rangeSchema: z.ZodRawShape = { from: z.string(), to: z.string() };
const logTimeSchema = z.string().optional();
const setSchema = z
  .object({
    reps: z.number(),
    kg: z.number().optional(),
    lbs: z.number().optional(),
    sets: z.number().int().positive().optional(),
    type: z.enum(['standard', 'warmUp', 'failure']).optional(),
    rir: z.number().optional(),
    rest: z.number().optional(),
  })
  .passthrough();

registerCliTool(
  server,
  'macrofactor.login',
  'Verify MacroFactor credentials and return the authenticated user id.',
  emptySchema,
  'login'
);
registerCliTool(server, 'macrofactor.getProfile', 'Fetch the MacroFactor user profile.', emptySchema, 'profile');
registerCliTool(
  server,
  'macrofactor.getGoals',
  'Fetch the weekly calorie and macro targets from the user planner.',
  emptySchema,
  'goals'
);
registerCliTool(
  server,
  'macrofactor.getFoodLog',
  'Fetch the food log for a given date.',
  { date: z.string() },
  'food-log'
);
registerCliTool(
  server,
  'macrofactor.searchFoods',
  'Search the MacroFactor food database.',
  { query: z.string() },
  'search-food'
);
registerCliTool(
  server,
  'macrofactor.logFood',
  'Log a searched food by foodId, serving index, and quantity.',
  {
    foodId: z.string(),
    servingIndex: z.number().int().nonnegative(),
    quantity: z.number().positive(),
    loggedAt: logTimeSchema,
  },
  'log-food'
);
registerCliTool(
  server,
  'macrofactor.logManualFood',
  'Log a manual/custom food with explicit macros.',
  {
    name: z.string(),
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    loggedAt: logTimeSchema,
  },
  'log-manual-food'
);
registerCliTool(
  server,
  'macrofactor.deleteFoodEntry',
  'Soft-delete a food entry by date and entry id.',
  { date: z.string(), entryId: z.string() },
  'delete-food'
);
registerCliTool(
  server,
  'macrofactor.updateFoodEntry',
  'Update the quantity of an existing food entry.',
  { date: z.string(), entryId: z.string(), quantity: z.number().positive() },
  'update-food'
);
registerCliTool(
  server,
  'macrofactor.hardDeleteFoodEntry',
  'Permanently remove a food entry field from Firestore. Use only to clean up ghost entries left by soft-delete.',
  { date: z.string(), entryId: z.string() },
  'hard-delete-food'
);
registerCliTool(
  server,
  'macrofactor.copyFoodEntries',
  'Copy one or more food entries from a source date to a target date.',
  { sourceDate: z.string(), targetDate: z.string(), entryIds: z.array(z.string()).min(1) },
  'copy-food'
);
registerCliTool(
  server,
  'macrofactor.logWeight',
  'Log a body-weight entry in kg or lbs.',
  {
    date: z.string().optional(),
    kg: z.number().positive().optional(),
    lbs: z.number().positive().optional(),
    bodyFat: z.number().optional(),
  },
  'log-weight'
);
registerCliTool(
  server,
  'macrofactor.getWeightHistory',
  'Fetch weight entries for a date range.',
  rangeSchema,
  'weight-history'
);
registerCliTool(
  server,
  'macrofactor.deleteWeight',
  'Delete a weight entry for a specific date.',
  { date: z.string() },
  'delete-weight'
);
registerCliTool(
  server,
  'macrofactor.getNutrition',
  'Fetch computed nutrition summaries for a date range.',
  rangeSchema,
  'nutrition'
);
registerCliTool(server, 'macrofactor.getSteps', 'Fetch daily step counts for a date range.', rangeSchema, 'steps');
registerCliTool(server, 'macrofactor.getWorkoutHistory', 'List workout history entries.', emptySchema, 'workouts');
registerCliTool(
  server,
  'macrofactor.getWorkout',
  'Fetch the parsed detail for a workout by id.',
  { id: z.string() },
  'workout'
);
registerCliTool(
  server,
  'macrofactor.createWorkout',
  'Create a workout from exercise ids and logged sets.',
  {
    name: z.string(),
    duration: z.number().positive().optional(),
    startTime: z.string().optional(),
    gymId: z.string(),
    exercises: z.array(z.object({ exerciseId: z.string(), note: z.string().optional(), sets: z.array(setSchema) })),
  },
  'log-workout'
);
registerCliTool(
  server,
  'macrofactor.updateWorkout',
  'Update top-level workout fields like name, durationMinutes, gym metadata, or blocks.',
  { id: z.string(), fields: z.record(z.unknown()) },
  'update-workout',
  (args) => {
    const id = typeof args.id === 'string' ? args.id : '';
    const fields = typeof args.fields === 'object' && args.fields !== null ? args.fields : {};
    return { id, ...(fields as Record<string, unknown>) };
  }
);
registerCliTool(server, 'macrofactor.deleteWorkout', 'Delete a workout by id.', { id: z.string() }, 'delete-workout');
registerCliTool(
  server,
  'macrofactor.removeExerciseFromWorkout',
  'Remove an exercise (by exerciseId) from a workout, deleting the entire block that contains it.',
  { workoutId: z.string(), exerciseId: z.string() },
  'remove-exercise'
);
registerCliTool(
  server,
  'macrofactor.addExerciseToWorkout',
  'Append one or more exercise blocks to an existing workout.',
  {
    workoutId: z.string(),
    exercises: z.array(z.object({ exerciseId: z.string(), note: z.string().optional(), sets: z.array(setSchema) })),
  },
  'log-exercise'
);
registerCliTool(server, 'macrofactor.getProgram', 'Fetch the active training program.', emptySchema, 'program');
registerCliTool(
  server,
  'macrofactor.getNextWorkout',
  'Fetch the next workout in the active training cycle.',
  emptySchema,
  'next-workout'
);
registerCliTool(server, 'macrofactor.getGyms', 'List gym profiles.', emptySchema, 'gyms');
registerCliTool(
  server,
  'macrofactor.searchExercises',
  'Search the bundled exercise database by name.',
  { query: z.string() },
  'exercises search'
);
registerCliTool(
  server,
  'macrofactor.resolveExercise',
  'Resolve an exercise id to human-readable details.',
  { id: z.string() },
  'exercise'
);
registerCliTool(server, 'macrofactor.getCustomExercises', 'List custom exercises.', emptySchema, 'custom-exercises');
registerCliTool(
  server,
  'macrofactor.getContext',
  'Fetch the current MacroFactor agent context snapshot.',
  emptySchema,
  'context'
);

server.registerResource(
  'macrofactor-context',
  'macrofactor://context',
  { title: 'MacroFactor Context', mimeType: 'application/json' },
  async (uri) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(await runCli('context'), null, 2) }],
  })
);

server.registerResource(
  'macrofactor-capabilities',
  'macrofactor://capabilities',
  { title: 'MacroFactor Capabilities', mimeType: 'application/json' },
  async (uri) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(toolSummaries, null, 2) }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MacroFactor MCP server running on stdio');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
