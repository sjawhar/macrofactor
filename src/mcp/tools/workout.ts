import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import type {
  PlanBlock,
  PlanExercise,
  PlanSet,
  ProgramBlockInput,
  ProgramDayInput,
  ProgramExerciseInput,
  SetTarget,
  TrainingProgramInput,
  WorkoutPlan,
  WorkoutSource,
} from '../../lib/api/workout-types.js';
import { searchExercises } from '../../lib/api/exercises.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';

type SetInput = {
  reps: number;
  lbs?: number;
  kg?: number;
  sets?: number;
  rest?: number;
  rir?: number;
  type?: 'standard' | 'warmUp' | 'failure';
};

type ExpandedSet = {
  fullReps: number;
  weightKg: number;
  setType: 'standard' | 'warmUp' | 'failure';
  rir: number | null;
  restMicros: number;
};

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseIsoDateTime(value: string): { date: string; hours: number; minutes: number } {
  const match = value.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Invalid startTime: ${value}`);
  }
  return {
    date: match[1],
    hours: Number.parseInt(match[2], 10),
    minutes: Number.parseInt(match[3], 10),
  };
}

function parseStartTime(value?: string): string {
  if (!value) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${todayDate()}T${h}:${m}:00.000Z`;
  }

  const parsed = parseIsoDateTime(value);
  return `${parsed.date}T${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00.000Z`;
}

function resolveWeight(set: SetInput): number {
  if (set.kg != null) return set.kg;
  if (set.lbs != null) return set.lbs / 2.2046226218;
  return 0;
}

function expandSets(sets: SetInput[]): ExpandedSet[] {
  return sets.flatMap((set) => {
    const count = set.sets ?? 1;
    const expanded: ExpandedSet = {
      fullReps: set.reps,
      weightKg: resolveWeight(set),
      setType: set.type ?? 'standard',
      rir: set.rir ?? null,
      restMicros: (set.rest ?? 120) * 1_000_000,
    };

    return Array.from({ length: count }, () => ({ ...expanded }));
  });
}

function normalizeSetInputs(sets: unknown, exerciseName: string): ExpandedSet[] {
  if (!Array.isArray(sets)) {
    throw new Error(`Exercise "${exerciseName}" requires a sets array`);
  }

  const normalized = sets.map((set): SetInput => {
    if (!set || typeof set !== 'object') {
      throw new Error(`Exercise "${exerciseName}" contains an invalid set object`);
    }

    const record = set as Record<string, unknown>;
    const reps = Number(record.reps);
    if (!Number.isFinite(reps)) {
      throw new Error(`Each set for "${exerciseName}" requires numeric reps`);
    }

    return {
      reps,
      lbs: record.lbs != null ? Number(record.lbs) : undefined,
      kg: record.kg != null ? Number(record.kg) : undefined,
      sets: record.sets != null ? Number(record.sets) : undefined,
      rest: record.rest != null ? Number(record.rest) : undefined,
      rir: record.rir != null ? Number(record.rir) : undefined,
      type:
        record.type === 'standard' || record.type === 'warmUp' || record.type === 'failure' ? record.type : undefined,
    };
  });

  return expandSets(normalized);
}

function buildWorkoutExercise(
  exerciseName: string,
  setsValue: unknown,
  customExercises?: Array<{ id: string; name: string }>,
  targetsByExerciseId?: Map<string, SetTarget[]>
) {
  const matches = searchExercises(exerciseName);
  let exerciseId: string;
  let resolvedName: string;
  if (matches.length > 0) {
    exerciseId = matches[0].id;
    resolvedName = matches[0].name;
  } else {
    const custom = customExercises?.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (!custom) {
      throw new Error(`Exercise "${exerciseName}" not found in bundled or custom exercises`);
    }
    exerciseId = custom.id;
    resolvedName = custom.name;
  }

  const expanded = normalizeSetInputs(setsValue, exerciseName);
  const setTargets = targetsByExerciseId?.get(exerciseId);
  return {
    rawExercise: {
      id: randomUUID(),
      exerciseId,
      note: '',
      baseWeight: null,
      sets: expanded.map((set, setIndex) => ({
        setType: set.setType,
        segments: [],
        log: {
          id: randomUUID(),
          runtimeType: 'single',
          target: setTargets?.[setIndex] ?? null,
          value: {
            weight: set.weightKg,
            fullReps: set.fullReps,
            partialReps: null,
            rir: set.rir,
            distance: null,
            durationSeconds: null,
            restTimer: set.restMicros,
            isSkipped: false,
          },
        },
      })),
    },
    summary: {
      name: resolvedName,
      exerciseId,
      setCount: expanded.length,
    },
  };
}

function coerceWorkoutSource(input: unknown): WorkoutSource | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const source = input as Record<string, unknown>;
  // MUST be 'program' — 'trainingProgram' crashes the app
  const runtimeType = 'program';
  const cycleIndex = source.cycleIndex == null ? undefined : Number(source.cycleIndex);
  return {
    runtimeType,
    programId: typeof source.programId === 'string' ? source.programId : undefined,
    programName: typeof source.programName === 'string' ? source.programName : undefined,
    dayId: typeof source.dayId === 'string' ? source.dayId : undefined,
    cycleIndex: Number.isFinite(cycleIndex) ? cycleIndex : undefined,
    programColor: typeof source.programColor === 'string' ? source.programColor : undefined,
    programIcon: typeof source.programIcon === 'string' ? source.programIcon : undefined,
  };
}

async function getProgramTargetsByExerciseId(client: MacroFactorClient, workoutSource?: WorkoutSource) {
  const targetsByExerciseId = new Map<string, SetTarget[]>();
  if (!workoutSource?.dayId || workoutSource.cycleIndex == null) {
    return targetsByExerciseId;
  }

  const programs = await client.getTrainingPrograms();
  const program =
    programs.find((candidate) => candidate.id === workoutSource.programId) ||
    programs.find((candidate) => candidate.isActive) ||
    programs[0];
  if (!program) return targetsByExerciseId;

  const day = program.days.find((candidate) => candidate.id === workoutSource.dayId);
  if (!day) return targetsByExerciseId;

  const cycleTargetsIndex = workoutSource.cycleIndex;
  for (const exercise of day.exercises) {
    const programSets = exercise.periodizedTargets?.values?.[cycleTargetsIndex]?.sets ?? [];
    if (programSets.length === 0) continue;
    targetsByExerciseId.set(
      exercise.exerciseId,
      programSets.map((programSet) => ({ ...programSet.log }))
    );
  }

  return targetsByExerciseId;
}

type PlanSetInput = {
  reps?: number | string;
  minReps?: number;
  maxReps?: number;
  sets?: number;
  rir?: number;
  rest?: number;
  type?: 'standard' | 'warmUp' | 'failure';
  kg?: number;
  lbs?: number;
};

function parseRepsTarget(input: unknown): { min: number | null; max: number | null } {
  if (input == null) return { min: null, max: null };
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error(`Invalid reps target: ${input}`);
    return { min: input, max: input };
  }
  if (typeof input !== 'string') throw new Error(`Invalid reps target type: ${typeof input}`);
  const trimmed = input.trim();
  if (trimmed === '') return { min: null, max: null };
  if (!trimmed.includes('-')) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new Error(`Invalid reps target: "${input}"`);
    return { min: n, max: n };
  }
  const parts = trimmed.split('-').map((p) => p.trim());
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    throw new Error(`Invalid reps range: "${input}" (expected "min-max")`);
  }
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error(`Invalid reps range: "${input}"`);
  if (min > max) throw new Error(`Invalid reps range: "${input}" (min ${min} > max ${max})`);
  return { min, max };
}

function buildPlanExercise(
  exerciseName: string,
  setsValue: unknown,
  customExercises: Array<{ id: string; name: string }>
): { planExercise: PlanExercise; summary: { name: string; exerciseId: string; setCount: number } } {
  const matches = searchExercises(exerciseName);
  let exerciseId: string;
  let resolvedName: string;
  if (matches.length > 0) {
    exerciseId = matches[0].id;
    resolvedName = matches[0].name;
  } else {
    const custom = customExercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (!custom) throw new Error(`Exercise "${exerciseName}" not found in bundled or custom exercises`);
    exerciseId = custom.id;
    resolvedName = custom.name;
  }

  if (!Array.isArray(setsValue)) throw new Error(`Exercise "${exerciseName}" requires "sets" (array)`);
  const expanded: PlanSet[] = setsValue.flatMap((set, idx) => {
    if (!set || typeof set !== 'object') {
      throw new Error(`Exercise "${exerciseName}" set ${idx + 1} must be an object`);
    }
    const record = set as Record<string, unknown> & PlanSetInput;
    const count = record.sets != null ? Number(record.sets) : 1;
    let min: number | null;
    let max: number | null;
    if (record.minReps != null || record.maxReps != null) {
      min = record.minReps ?? record.maxReps ?? null;
      max = record.maxReps ?? record.minReps ?? null;
    } else {
      const parsed = parseRepsTarget(record.reps);
      min = parsed.min;
      max = parsed.max;
    }
    const restMicros = record.rest != null ? Number(record.rest) * 1_000_000 : null;
    const weight =
      record.kg != null ? Number(record.kg) : record.lbs != null ? Number(record.lbs) / 2.2046226218 : null;
    const setType = record.type === 'warmUp' || record.type === 'failure' ? record.type : 'standard';
    const single: PlanSet = {
      setType,
      segments: [],
      log: {
        minFullReps: min,
        maxFullReps: max,
        rir: record.rir != null ? Number(record.rir) : null,
        restTimer: restMicros,
        distance: null,
        durationSeconds: null,
        weight,
      },
    };
    return Array.from({ length: count }, () => ({ ...single, log: { ...single.log } }));
  });

  const overrideRestTimers = expanded.some((set) => set.log.restTimer != null);
  const planExercise: PlanExercise = {
    id: randomUUID(),
    exerciseId,
    target: { overrideRestTimers, sets: expanded },
  };
  return {
    planExercise,
    summary: { name: resolvedName, exerciseId, setCount: expanded.length },
  };
}

export function registerWorkoutTools(server: McpServer, client: MacroFactorClient): void {
  server.tool(
    'get_workouts',
    `List workout history entries and optionally filter the response by start-time range. Use this when you need a quick index of sessions before opening a specific workout in detail. Do not use this for full set-by-set payloads, because get_workout returns the richer detail object for one workout ID. If you plan to update or delete a workout, call this first to obtain the target ID and then use update_workout or delete_workout.`,
    {
      from: z.string().optional(),
      to: z.string().optional(),
    },
    { readOnlyHint: true },
    async ({ from, to }) => {
      let workouts = await client.getWorkoutHistory();
      if (from) workouts = workouts.filter((w) => w.startTime >= from);
      if (to) workouts = workouts.filter((w) => w.startTime <= to);
      return { content: [{ type: 'text' as const, text: JSON.stringify(workouts, null, 2) }] };
    }
  );

  server.tool(
    'get_workout',
    `Fetch full detail for a single workout ID, including blocks, exercises, and set logs. Use this when you need complete session structure for analysis or before making append/remove updates. Do not use this to list all workouts; get_workouts is the discovery tool for IDs and date filtering. Prerequisite: obtain a valid workout ID first, typically from get_workouts.`,
    { id: z.string().min(1) },
    { readOnlyHint: true },
    async ({ id }) => {
      const workout = await client.getWorkout(id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(workout, null, 2) }] };
    }
  );

  server.tool(
    'get_training_program',
    `Return the active training program definition for the user, including cycle metadata and day structure. Use this when you need to understand planned training context rather than completed history. Do not use this for the next scheduled day alone, because get_next_workout gives the direct next-day answer. If no active flag exists, this tool falls back to the first available program in the list.`,
    {},
    { readOnlyHint: true },
    async () => {
      const programs = await client.getTrainingPrograms();
      const active = programs.find((program) => program.isActive) || programs[0] || null;
      return { content: [{ type: 'text' as const, text: JSON.stringify(active, null, 2) }] };
    }
  );

  server.tool(
    'get_next_workout',
    `Return the computed next workout day in the active cycle, including day name and exercise references. Use this for short-term planning or context generation when deciding what session is next. Do not use this for full historical tracking or full program inspection; use get_workouts and get_training_program for those workflows. This tool has no required inputs and should be called after profile authentication is ready.`,
    {},
    { readOnlyHint: true },
    async () => {
      const next = await client.getNextWorkout();
      return { content: [{ type: 'text' as const, text: JSON.stringify(next, null, 2) }] };
    }
  );

  server.tool(
    'log_workout',
    `Create a new workout session with one or more exercises and expanded sets, then write it as a raw workout document. Use this when logging an entire new session from scratch with gym, timing, and exercise data in one call. Do not use this to append exercises to an existing session; use log_exercise for incremental additions and update_workout for metadata-only edits. Prerequisites: provide exercise names and set definitions, and optionally call get_gym_profiles first to pick a known gym name.`,
    {
      name: z.string().min(1),
      gym: z.string().optional(),
      startTime: z.string().optional(),
      durationMinutes: z.number().positive().optional(),
      workoutSource: z
        .object({
          runtimeType: z.string().optional(),
          programId: z.string().optional(),
          programName: z.string().optional(),
          dayId: z.string().optional(),
          cycleIndex: z.number().optional(),
          programColor: z.string().optional(),
          programIcon: z.string().optional(),
        })
        .optional(),
      exercises: z.array(
        z.object({
          name: z.string().min(1),
          sets: z.array(
            z.object({
              reps: z.number(),
              lbs: z.number().optional(),
              kg: z.number().optional(),
              sets: z.number().optional(),
              rest: z.number().optional(),
              rir: z.number().optional(),
              type: z.enum(['standard', 'warmUp', 'failure']).optional(),
            })
          ),
        })
      ),
    },
    { destructiveHint: false },
    async ({ name, gym, startTime, durationMinutes, workoutSource, exercises }) => {
      const [gyms, customExercises] = await Promise.all([client.getGymProfiles(), client.getCustomExercises()]);
      const selectedGym = gym ? gyms.find((candidate) => candidate.name.toLowerCase() === gym.toLowerCase()) : gyms[0];
      const resolvedWorkoutSource = coerceWorkoutSource(workoutSource);
      const targetsByExerciseId = await getProgramTargetsByExerciseId(client, resolvedWorkoutSource);
      // Clamp cycleIndex to 999 for post-program (deload) workouts
      if (resolvedWorkoutSource?.cycleIndex != null && resolvedWorkoutSource.programId) {
        const programs = await client.getTrainingPrograms();
        const prog = programs.find((p) => p.id === resolvedWorkoutSource.programId);
        if (prog && resolvedWorkoutSource.cycleIndex >= (prog as any).numCycles) {
          resolvedWorkoutSource.cycleIndex = 999;
        }
      }

      const workoutId = randomUUID();
      const blocks: Array<{ exercises: unknown[] }> = [];
      const summary: unknown[] = [];

      for (const exercise of exercises) {
        const { rawExercise, summary: exerciseSummary } = buildWorkoutExercise(
          exercise.name,
          exercise.sets,
          customExercises,
          targetsByExerciseId
        );
        blocks.push({ exercises: [rawExercise] });
        summary.push(exerciseSummary);
      }

      const workout = {
        id: workoutId,
        name,
        startTime: parseStartTime(startTime),
        duration: (durationMinutes ?? 45) * 60 * 1_000_000,
        gymId: selectedGym?.id || '',
        gymName: selectedGym?.name || 'Gym',
        gymIcon: selectedGym?.icon || 'house',
        ...(resolvedWorkoutSource ? { workoutSource: resolvedWorkoutSource } : {}),
        blocks,
      };

      await client.updateRawWorkout(workoutId, workout, [
        'id',
        'name',
        'startTime',
        'duration',
        'gymId',
        'gymName',
        'gymIcon',
        ...(resolvedWorkoutSource ? ['workoutSource'] : []),
        'blocks',
      ]);

      // Mark program day as completed so it shows checked in the app
      if (resolvedWorkoutSource?.programId && resolvedWorkoutSource.dayId && resolvedWorkoutSource.cycleIndex != null) {
        await client.markProgramDayCompleted(
          resolvedWorkoutSource.programId,
          resolvedWorkoutSource.cycleIndex,
          resolvedWorkoutSource.dayId,
          workoutId
        );
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { status: 'created', workoutId, name, gym: workout.gymName, exercises: summary },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'log_exercise',
    `Append one or more exercises to an existing workout by reading raw blocks, adding new exercise blocks, and writing them back. Use this for incremental logging after a workout document already exists. Do not use this to create a new workout session from scratch; use log_workout for that full creation flow. Prerequisite: provide a valid workoutId, and use get_workout first if you need to inspect the existing session before appending.`,
    {
      workoutId: z.string().min(1),
      exercises: z.array(
        z.object({
          name: z.string().min(1),
          sets: z.array(
            z.object({
              reps: z.number(),
              lbs: z.number().optional(),
              kg: z.number().optional(),
              sets: z.number().optional(),
              rest: z.number().optional(),
              rir: z.number().optional(),
              type: z.enum(['standard', 'warmUp', 'failure']).optional(),
            })
          ),
        })
      ),
    },
    { destructiveHint: false },
    async ({ workoutId, exercises }) => {
      const [raw, customExercises] = await Promise.all([client.getRawWorkout(workoutId), client.getCustomExercises()]);
      const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
      const summary: unknown[] = [];

      for (const exercise of exercises) {
        const { rawExercise, summary: exerciseSummary } = buildWorkoutExercise(
          exercise.name,
          exercise.sets,
          customExercises
        );
        blocks.push({ exercises: [rawExercise] });
        summary.push(exerciseSummary);
      }

      await client.updateRawWorkout(workoutId, { blocks }, ['blocks']);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ status: 'added', workoutId, exercises: summary }, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'update_workout',
    `Update top-level workout metadata fields (such as name or durationMinutes) without rebuilding exercise blocks. Use this for lightweight edits to existing sessions after they have been created. Do not use this for adding or removing exercises, because log_exercise and remove_exercise handle block-level changes. Prerequisite: provide the workout ID and at least one mutable field to update; get_workouts can be used to locate IDs first.`,
    {
      id: z.string().min(1),
      name: z.string().optional(),
      startTime: z.string().optional(),
      durationMinutes: z.number().positive().optional(),
      gymId: z.string().optional(),
      gymName: z.string().optional(),
      gymIcon: z.string().optional(),
    },
    { destructiveHint: false },
    async ({ id, ...fields }) => {
      await client.updateWorkout(id, fields);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ status: 'updated', id, fields: Object.keys(fields) }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_workout',
    `Delete an entire workout history document by ID and return a deletion confirmation object. Use this when a session was logged incorrectly and should be removed completely. Do not use this for minor metadata corrections or exercise edits; update_workout and remove_exercise are safer targeted alternatives. Prerequisite: obtain the workout ID from get_workouts before calling this destructive operation.`,
    { id: z.string().min(1) },
    { destructiveHint: true },
    async ({ id }) => {
      await client.deleteWorkout(id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deleted', id }, null, 2) }] };
    }
  );

  server.tool(
    'remove_exercise',
    `Remove all blocks containing a target exercise ID from an existing workout and write the modified block list back. Use this when an exercise was logged in the wrong workout and needs to be removed cleanly. Do not use this to tweak set values inside an exercise block, because that requires full raw workout editing via get_workout/getRawWorkout patterns outside this tool. Prerequisites: know workoutId and exerciseId first, typically by calling get_workout to inspect the current block structure.`,
    {
      workoutId: z.string().min(1),
      exerciseId: z.string().min(1),
    },
    { destructiveHint: true },
    async ({ workoutId, exerciseId }) => {
      const raw = await client.getRawWorkout(workoutId);
      const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
      const filtered = blocks.filter((block: any) => {
        const exs = Array.isArray(block.exercises) ? block.exercises : [];
        return !exs.some((exercise: any) => exercise.exerciseId === exerciseId);
      });

      await client.updateRawWorkout(workoutId, { blocks: filtered }, ['blocks']);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { status: 'removed', workoutId, exerciseId, blocksRemoved: blocks.length - filtered.length },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_custom_workouts',
    `List all custom workouts ("workout plan" library entries) for the user. Use this to discover queued/planned sessions before reading a specific plan with get_custom_workout, or before updating/deleting one. Returns id, name, gym, and block/exercise counts — not full set details.`,
    {},
    { readOnlyHint: true },
    async () => {
      const customWorkouts = await client.getCustomWorkouts();
      const summary = customWorkouts.map((cw) => ({
        id: cw.id,
        name: cw.workoutPlan.name,
        gymId: cw.workoutPlan.gymId,
        blockCount: cw.workoutPlan.blocks.length,
        exerciseCount: cw.workoutPlan.blocks.reduce((sum, b) => sum + b.exercises.length, 0),
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    'get_custom_workout',
    `Fetch a single custom workout (workout plan) by id, including all blocks, exercises, set targets (rep ranges, RIR, optional weight), and exercise names. Use this to inspect a queued plan before updating it. Prerequisite: obtain the id from get_custom_workouts.`,
    { id: z.string().min(1) },
    { readOnlyHint: true },
    async ({ id }) => {
      const customWorkout = await client.getCustomWorkout(id);
      if (!customWorkout) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'not_found', id }, null, 2) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(customWorkout, null, 2) }] };
    }
  );

  server.tool(
    'create_custom_workout',
    `Queue up a workout for the user to do later by creating a custom workout plan in the app's library. Each block represents a superset (multiple exercises in one block = grouped). Sets are TARGETS (rep ranges + optional RIR + optional prescribed weight), not logged values — the user fills in actual reps/weight when they execute the plan. Use this when designing workouts the user will perform later. Do not use this to log a completed workout (use log_workout for that). The plan id is auto-added to the workout library so it appears in the app's library tab.`,
    {
      name: z.string().min(1),
      gym: z.string().optional(),
      gymId: z.string().optional(),
      blocks: z
        .array(
          z.array(
            z.object({
              name: z.string().min(1),
              sets: z.array(
                z.object({
                  reps: z.union([z.string(), z.number()]).optional(),
                  minReps: z.number().optional(),
                  maxReps: z.number().optional(),
                  sets: z.number().optional(),
                  rir: z.number().optional(),
                  rest: z.number().optional(),
                  kg: z.number().optional(),
                  lbs: z.number().optional(),
                  type: z.enum(['standard', 'warmUp', 'failure']).optional(),
                })
              ),
            })
          )
        )
        .optional(),
      exercises: z
        .array(
          z.object({
            name: z.string().min(1),
            sets: z.array(
              z.object({
                reps: z.union([z.string(), z.number()]).optional(),
                minReps: z.number().optional(),
                maxReps: z.number().optional(),
                sets: z.number().optional(),
                rir: z.number().optional(),
                rest: z.number().optional(),
                kg: z.number().optional(),
                lbs: z.number().optional(),
                type: z.enum(['standard', 'warmUp', 'failure']).optional(),
              })
            ),
          })
        )
        .optional(),
    },
    { destructiveHint: false },
    async ({ name, gym, gymId, blocks, exercises }) => {
      const [gyms, customExercises] = await Promise.all([client.getGymProfiles(), client.getCustomExercises()]);
      const selectedGym = gymId
        ? gyms.find((candidate) => candidate.id === gymId)
        : gym
          ? gyms.find((candidate) => candidate.name.toLowerCase() === gym.toLowerCase())
          : gyms[0];
      if (!selectedGym) {
        throw new Error(`Gym not found. Available: ${gyms.map((g) => g.name).join(', ')}`);
      }
      if (blocks != null && exercises != null) {
        throw new Error('Provide either "exercises" (flat) or "blocks" (grouped), not both');
      }

      const planBlocks: PlanBlock[] = [];
      const summaries: unknown[] = [];
      if (blocks) {
        for (const blockGroup of blocks) {
          const blockExercises: PlanExercise[] = [];
          const blockSummary: unknown[] = [];
          for (const exercise of blockGroup) {
            const built = buildPlanExercise(exercise.name, exercise.sets, customExercises);
            blockExercises.push(built.planExercise);
            blockSummary.push(built.summary);
          }
          planBlocks.push({ id: randomUUID(), exercises: blockExercises });
          summaries.push(blockSummary);
        }
      } else if (exercises) {
        for (const exercise of exercises) {
          const built = buildPlanExercise(exercise.name, exercise.sets, customExercises);
          planBlocks.push({ id: randomUUID(), exercises: [built.planExercise] });
          summaries.push(built.summary);
        }
      }

      const plan: WorkoutPlan = { name, gymId: selectedGym.id, blocks: planBlocks };
      const created = await client.createCustomWorkout(plan);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { status: 'created', id: created.id, name, gym: selectedGym.name, blocks: summaries },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'update_custom_workout',
    `Replace the contents of an existing custom workout plan. Pass the full plan — the entire workoutPlan field is overwritten. Use this to revise a queued workout before the user does it. Do not use this for partial edits to a single set; the entire plan must be rebuilt.`,
    {
      id: z.string().min(1),
      name: z.string().min(1),
      gym: z.string().optional(),
      gymId: z.string().optional(),
      blocks: z
        .array(
          z.array(
            z.object({
              name: z.string().min(1),
              sets: z.array(
                z.object({
                  reps: z.union([z.string(), z.number()]).optional(),
                  minReps: z.number().optional(),
                  maxReps: z.number().optional(),
                  sets: z.number().optional(),
                  rir: z.number().optional(),
                  rest: z.number().optional(),
                  kg: z.number().optional(),
                  lbs: z.number().optional(),
                  type: z.enum(['standard', 'warmUp', 'failure']).optional(),
                })
              ),
            })
          )
        )
        .optional(),
      exercises: z
        .array(
          z.object({
            name: z.string().min(1),
            sets: z.array(
              z.object({
                reps: z.union([z.string(), z.number()]).optional(),
                minReps: z.number().optional(),
                maxReps: z.number().optional(),
                sets: z.number().optional(),
                rir: z.number().optional(),
                rest: z.number().optional(),
                kg: z.number().optional(),
                lbs: z.number().optional(),
                type: z.enum(['standard', 'warmUp', 'failure']).optional(),
              })
            ),
          })
        )
        .optional(),
    },
    { destructiveHint: false },
    async ({ id, name, gym, gymId, blocks, exercises }) => {
      const [gyms, customExercises] = await Promise.all([client.getGymProfiles(), client.getCustomExercises()]);
      const selectedGym = gymId
        ? gyms.find((candidate) => candidate.id === gymId)
        : gym
          ? gyms.find((candidate) => candidate.name.toLowerCase() === gym.toLowerCase())
          : gyms[0];
      if (!selectedGym) {
        throw new Error(`Gym not found. Available: ${gyms.map((g) => g.name).join(', ')}`);
      }
      if (blocks != null && exercises != null) {
        throw new Error('Provide either "exercises" (flat) or "blocks" (grouped), not both');
      }

      const planBlocks: PlanBlock[] = [];
      const summaries: unknown[] = [];
      if (blocks) {
        for (const blockGroup of blocks) {
          const blockExercises: PlanExercise[] = [];
          const blockSummary: unknown[] = [];
          for (const exercise of blockGroup) {
            const built = buildPlanExercise(exercise.name, exercise.sets, customExercises);
            blockExercises.push(built.planExercise);
            blockSummary.push(built.summary);
          }
          planBlocks.push({ id: randomUUID(), exercises: blockExercises });
          summaries.push(blockSummary);
        }
      } else if (exercises) {
        for (const exercise of exercises) {
          const built = buildPlanExercise(exercise.name, exercise.sets, customExercises);
          planBlocks.push({ id: randomUUID(), exercises: [built.planExercise] });
          summaries.push(built.summary);
        }
      }

      const plan: WorkoutPlan = { name, gymId: selectedGym.id, blocks: planBlocks };
      await client.updateCustomWorkout(id, plan);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ status: 'updated', id, name, gym: selectedGym.name, blocks: summaries }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_custom_workout',
    `Delete a queued/custom workout plan from the user's library. Removes both the customWorkouts document and the id from workoutLibraryIds so it disappears from the app's library tab. Idempotent. Use this when a planned workout is no longer needed (replaced, completed differently, or never going to happen).`,
    { id: z.string().min(1) },
    { destructiveHint: true },
    async ({ id }) => {
      await client.deleteCustomWorkout(id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deleted', id }, null, 2) }] };
    }
  );

  // ---------------------------------------------------------------------
  // Training programs (full multi-day, multi-cycle programs)
  // ---------------------------------------------------------------------

  const programSetSchema = z.object({
    reps: z.union([z.string(), z.number()]).optional(),
    minReps: z.number().optional(),
    maxReps: z.number().optional(),
    sets: z.number().optional(),
    rir: z.number().optional(),
    rest: z.number().optional(),
    type: z.enum(['standard', 'warmUp', 'failure']).optional(),
  });

  const programExerciseSchema = z.object({
    name: z.string().min(1),
    cycles: z.array(z.array(programSetSchema)).optional(),
    sets: z.array(programSetSchema).optional(),
  });

  const programDaySchema = z.object({
    name: z.string().min(1),
    gym: z.string().optional(),
    gymId: z.string().optional(),
    blocks: z.array(z.array(programExerciseSchema)).optional(),
    exercises: z.array(programExerciseSchema).optional(),
  });

  function buildProgramExerciseFromInput(
    exerciseName: string,
    cyclesInput: unknown,
    setsInput: unknown,
    customExercises: Array<{ id: string; name: string }>,
    numCyclesHint: number | null
  ): { pe: ProgramExerciseInput; sum: { name: string; exerciseId: string; cycleCount: number; setsPerCycle: number } } {
    const matches = searchExercises(exerciseName);
    let exerciseId: string;
    let resolvedName: string;
    if (matches.length > 0) {
      exerciseId = matches[0].id;
      resolvedName = matches[0].name;
    } else {
      const custom = customExercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
      if (!custom) throw new Error(`Exercise "${exerciseName}" not found in bundled or custom exercises`);
      exerciseId = custom.id;
      resolvedName = custom.name;
    }

    const expandSetsArr = (setsArr: unknown, label: string): PlanSet[] => {
      if (!Array.isArray(setsArr)) throw new Error(`${label} requires sets array`);
      return setsArr.flatMap((set, idx) => {
        if (!set || typeof set !== 'object') {
          throw new Error(`${label} set ${idx + 1} must be an object`);
        }
        const r = set as Record<string, unknown>;
        const count = r.sets != null ? Number(r.sets) : 1;
        let min: number | null;
        let max: number | null;
        if (r.minReps != null || r.maxReps != null) {
          min = r.minReps != null ? Number(r.minReps) : r.maxReps != null ? Number(r.maxReps) : null;
          max = r.maxReps != null ? Number(r.maxReps) : r.minReps != null ? Number(r.minReps) : null;
        } else {
          const parsed = parseRepsTarget(r.reps);
          min = parsed.min;
          max = parsed.max;
        }
        const restMicros = r.rest != null ? Number(r.rest) * 1_000_000 : null;
        const setType = r.type === 'warmUp' || r.type === 'failure' ? r.type : 'standard';
        const single: PlanSet = {
          setType,
          segments: [],
          log: {
            minFullReps: min,
            maxFullReps: max,
            rir: r.rir != null ? Number(r.rir) : null,
            restTimer: restMicros,
            distance: null,
            durationSeconds: null,
            weight: null,
          },
        };
        return Array.from({ length: count }, () => ({ ...single, log: { ...single.log } }));
      });
    };

    let cycles: { sets: PlanSet[]; overrideRestTimers: boolean }[];
    if (Array.isArray(cyclesInput) && cyclesInput.length > 0) {
      cycles = cyclesInput.map((cycle, idx) => {
        const planSets = expandSetsArr(cycle, `${resolvedName} cycle ${idx + 1}`);
        return { sets: planSets, overrideRestTimers: planSets.some((s) => s.log.restTimer != null) };
      });
    } else if (Array.isArray(setsInput) && setsInput.length > 0) {
      const cycleCount = numCyclesHint ?? 1;
      const planSets = expandSetsArr(setsInput, resolvedName);
      const override = planSets.some((s) => s.log.restTimer != null);
      cycles = Array.from({ length: cycleCount }, () => ({ sets: planSets, overrideRestTimers: override }));
    } else {
      throw new Error(`Exercise "${resolvedName}" requires "cycles" or "sets"`);
    }
    return {
      pe: { exerciseId, cycles },
      sum: { name: resolvedName, exerciseId, cycleCount: cycles.length, setsPerCycle: cycles[0]?.sets.length ?? 0 },
    };
  }

  async function buildProgramFromInput(
    name: string,
    color: string | undefined,
    icon: string | undefined,
    numCyclesHint: number | null,
    runIndefinitely: boolean | undefined,
    isPeriodized: boolean | undefined,
    deload: 'lastCycle' | 'none' | undefined,
    expanded: boolean | undefined,
    gymHint: string | undefined,
    gymIdHint: string | undefined,
    daysInput: Array<z.infer<typeof programDaySchema>>
  ): Promise<{ program: TrainingProgramInput; summary: Record<string, unknown> }> {
    const [gyms, customExercises] = await Promise.all([client.getGymProfiles(), client.getCustomExercises()]);
    const resolveGym = (idVal: string | undefined, nameVal: string | undefined): string | null => {
      if (idVal) {
        const found = gyms.find((g) => g.id === idVal);
        if (!found) throw new Error(`Gym id "${idVal}" not found. Available: ${gyms.map((g) => g.name).join(', ')}`);
        return found.id;
      }
      if (nameVal) {
        const found = gyms.find((g) => g.name.toLowerCase() === nameVal.toLowerCase());
        if (!found) throw new Error(`Gym "${nameVal}" not found. Available: ${gyms.map((g) => g.name).join(', ')}`);
        return found.id;
      }
      return null;
    };
    const defaultGymId = resolveGym(gymIdHint, gymHint);

    const days: ProgramDayInput[] = [];
    const summaries: unknown[] = [];
    for (const day of daysInput) {
      const dayGymId = resolveGym(day.gymId, day.gym);
      const isRest = (!day.blocks || day.blocks.length === 0) && (!day.exercises || day.exercises.length === 0);
      if (isRest) {
        days.push({ name: day.name, gymId: 'blankSlate' });
        summaries.push({ name: day.name, restDay: true });
        continue;
      }
      if (day.blocks && day.exercises) {
        throw new Error(`Day "${day.name}" — provide either blocks or exercises, not both`);
      }
      const programBlocks: ProgramBlockInput[] = [];
      const blockSummaries: unknown[] = [];
      if (day.blocks) {
        for (const blockGroup of day.blocks) {
          const blockExercises: ProgramExerciseInput[] = [];
          const blockSummary: unknown[] = [];
          for (const ex of blockGroup) {
            const built = buildProgramExerciseFromInput(ex.name, ex.cycles, ex.sets, customExercises, numCyclesHint);
            blockExercises.push(built.pe);
            blockSummary.push(built.sum);
          }
          programBlocks.push({ exercises: blockExercises });
          blockSummaries.push(blockSummary);
        }
      } else if (day.exercises) {
        for (const ex of day.exercises) {
          const built = buildProgramExerciseFromInput(ex.name, ex.cycles, ex.sets, customExercises, numCyclesHint);
          programBlocks.push({ exercises: [built.pe] });
          blockSummaries.push(built.sum);
        }
      }
      const resolvedDayGymId = dayGymId ?? defaultGymId;
      if (!resolvedDayGymId) {
        throw new Error(`Day "${day.name}" — no gym specified (provide gym/gymId on day or program)`);
      }
      days.push({ name: day.name, gymId: resolvedDayGymId, blocks: programBlocks });
      summaries.push({ name: day.name, gymId: resolvedDayGymId, blocks: blockSummaries });
    }

    const program: TrainingProgramInput = {
      name,
      color,
      icon,
      numCycles: numCyclesHint ?? undefined,
      runIndefinitely,
      isPeriodized,
      deload,
      expanded,
      gymId: defaultGymId ?? undefined,
      days,
    };
    return { program, summary: { name, days: summaries } };
  }

  server.tool(
    'get_training_programs',
    `List all training programs in the user's library. Returns id, name, cycle count, periodization, and isActive flag for each. Use this to discover available programs before reading a specific one with get_training_program or activating one with activate_program.`,
    {},
    { readOnlyHint: true },
    async () => {
      const programs = await client.getTrainingPrograms();
      const summary = programs.map((p) => ({
        id: p.id,
        name: p.name,
        numCycles: p.numCycles,
        isPeriodized: p.isPeriodized,
        deload: p.deload,
        isActive: p.isActive,
        dayCount: p.days.length,
        workoutDays: p.days.filter((d) => !d.isRestDay).length,
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    'create_training_program',
    `Create a full multi-day, multi-cycle training program in the app's library. Each day can have multiple blocks (a block of one exercise = single, a block of multiple = superset). Each exercise has either explicit \`cycles\` (one entry per cycle, each containing the sets for that cycle) OR a \`sets\` shorthand that gets repeated across all cycles. Sets are TARGETS (rep ranges + RIR), not logged values. The program is automatically added to the user's library tab and can be activated with activate_program. Use this when the user wants a structured multi-week training plan, e.g. "build me a 6-day full-body program with 4 cycles". For a single workout (one day, no cycles) use create_custom_workout instead.`,
    {
      name: z.string().min(1),
      color: z.string().optional(),
      icon: z.string().optional(),
      numCycles: z.number().int().positive().optional(),
      runIndefinitely: z.boolean().optional(),
      isPeriodized: z.boolean().optional(),
      deload: z.enum(['lastCycle', 'none']).optional(),
      gym: z.string().optional(),
      gymId: z.string().optional(),
      days: z.array(programDaySchema).min(1),
    },
    { destructiveHint: false },
    async ({ name, color, icon, numCycles, runIndefinitely, isPeriodized, deload, gym, gymId, days }) => {
      const { program, summary } = await buildProgramFromInput(
        name,
        color,
        icon,
        numCycles ?? null,
        runIndefinitely,
        isPeriodized,
        deload,
        undefined,
        gym,
        gymId,
        days
      );
      const created = await client.createTrainingProgram(program);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ status: 'created', id: created.id, ...summary }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'update_training_program',
    `Replace an existing training program in full. Pass the same shape as create_training_program plus the program id. workoutCycleCompletions are preserved across updates. Use this to revise an existing program's structure (add days, change rep schemes, swap exercises). Do NOT use this to mark a workout as completed — that happens automatically when log_workout runs with workoutSource set.`,
    {
      id: z.string().min(1),
      name: z.string().min(1),
      color: z.string().optional(),
      icon: z.string().optional(),
      numCycles: z.number().int().positive().optional(),
      runIndefinitely: z.boolean().optional(),
      isPeriodized: z.boolean().optional(),
      deload: z.enum(['lastCycle', 'none']).optional(),
      gym: z.string().optional(),
      gymId: z.string().optional(),
      days: z.array(programDaySchema).min(1),
    },
    { destructiveHint: false },
    async ({ id, name, color, icon, numCycles, runIndefinitely, isPeriodized, deload, gym, gymId, days }) => {
      const { program, summary } = await buildProgramFromInput(
        name,
        color,
        icon,
        numCycles ?? null,
        runIndefinitely,
        isPeriodized,
        deload,
        undefined,
        gym,
        gymId,
        days
      );
      const updated = await client.updateTrainingProgram(id, program);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ status: 'updated', id: updated.id, ...summary }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_training_program',
    `Delete a training program. Removes the trainingProgram document, removes id from workoutLibraryIds, and clears activeProgramId if this program is currently active. Idempotent.`,
    { id: z.string().min(1) },
    { destructiveHint: true },
    async ({ id }) => {
      await client.deleteTrainingProgram(id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deleted', id }, null, 2) }] };
    }
  );

  server.tool(
    'activate_program',
    `Make a program the active program. Sets profiles/workout.activeProgramId. The active program is what get_next_workout uses and what the app's home screen highlights. Pass the program id from get_training_programs.`,
    { id: z.string().min(1) },
    { destructiveHint: false },
    async ({ id }) => {
      await client.setActiveProgram(id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'activated', id }, null, 2) }] };
    }
  );

  server.tool(
    'deactivate_program',
    `Clear the active program (sets activeProgramId to null). Use when the user is between programs or wants to log freestyle workouts not tied to a specific program.`,
    {},
    { destructiveHint: false },
    async () => {
      await client.setActiveProgram(null);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deactivated' }, null, 2) }] };
    }
  );
}
