import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import type { SetTarget, WorkoutSource } from '../../lib/api/workout-types.js';
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
}
