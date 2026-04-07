#!/usr/bin/env npx tsx
// cli/mf.ts
// Usage: npx tsx cli/mf.ts <command> [options]

import {
  MacroFactorClient,
  LogTime,
  getFoodById,
  type FoodEntry,
  type Goals,
  type SetTarget,
  type WorkoutSource,
} from '../src/lib/api/index';
import { syncDayDashboard } from '../src/lib/api/sync';
import { searchExercises, resolveExercise, lookupExercise } from '../src/lib/api/exercises';
import { readInput, parseISO, expandSets, resolveWeight, type SetInput } from './helpers';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { pathToFileURL } from 'url';

// Polyfill env vars if .env exists
try {
  const envContent = readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch (e) {}

const email = process.env.MACROFACTOR_USERNAME;
const password = process.env.MACROFACTOR_PASSWORD;

async function getClient() {
  if (!email || !password) {
    console.error(
      JSON.stringify({ error: 'Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD in .env or environment' })
    );
    process.exit(1);
  }
  return MacroFactorClient.login(email, password);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const next = args[i + 1];
      if (next == null || next.startsWith('--')) {
        opts[key] = 'true';
      } else {
        opts[key] = next;
        i++;
      }
    } else {
      positional.push(args[i]);
    }
  }
  return { command, opts, positional };
}

function isGramServing(serving: { description: string; gramWeight: number; amount: number }) {
  const description = serving.description.toLowerCase();
  return (
    description === 'g' ||
    description === 'gram' ||
    description === 'grams' ||
    (serving.gramWeight === 1 && serving.amount === 1)
  );
}

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysAgoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function warnIfTimezone(value: string, fieldName: string) {
  const tzPattern = /\d{2}:\d{2}(?::.*)?([+-]\d{2}:?\d{2}|Z)$/;
  const match = value.match(tzPattern);
  if (match && match[1] !== 'Z') {
    console.error(
      `Warning: timezone offset "${match[1]}" in "${fieldName}" is ignored — MacroFactor does not store timezones`
    );
  }
}

function parseLogTime(value: unknown, fieldName = 'loggedAt'): LogTime {
  if (value == null) {
    const now = new Date();
    return {
      date: todayDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };
  }
  if (typeof value !== 'string') {
    throw new Error(`"${fieldName}" must be an ISO 8601 string when provided`);
  }
  warnIfTimezone(value, fieldName);
  const parsed = parseISO(value);
  if (parsed.date === '1970-01-01' && parsed.hours === 0 && parsed.minutes === 0) {
    throw new Error(`Invalid "${fieldName}": ${value}`);
  }
  return { date: parsed.date, hour: parsed.hours, minute: parsed.minutes };
}

function parseWorkoutStartTime(value: unknown): string {
  if (value == null) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${todayDate()}T${h}:${m}:${s}.000Z`;
  }
  if (typeof value !== 'string') {
    throw new Error('"startTime" must be an ISO 8601 string when provided');
  }
  warnIfTimezone(value, 'startTime');
  const parsed = parseISO(value);
  if (parsed.date === '1970-01-01' && parsed.hours === 0 && parsed.minutes === 0) {
    throw new Error(`Invalid "startTime": ${value}`);
  }
  return `${parsed.date}T${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00.000Z`;
}

function weekdayIndex(date: string): number {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const jsDay = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return (jsDay + 6) % 7;
}

function goalForDate(values: number[], date: string): number {
  return values[weekdayIndex(date)] ?? values[values.length - 1] ?? 0;
}

function parseRange(input: Record<string, unknown> | null, opts: Record<string, string>, fallbackDays: number) {
  const to = typeof input?.to === 'string' ? input.to : opts.to || todayDate();
  const from = typeof input?.from === 'string' ? input.from : opts.from || daysAgoDate(fallbackDays);
  return { from, to };
}

function parseDurationMinutes(value: unknown, fallbackMinutes = 45): number {
  if (value == null) return fallbackMinutes;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('"duration" must be a positive number of minutes');
  }
  return minutes;
}

function normalizeSetInputs(exerciseId: string, setsValue: unknown) {
  if (!Array.isArray(setsValue)) {
    throw new Error(`Exercise "${exerciseId}" requires "sets" (array)`);
  }
  for (const setInput of setsValue) {
    if (
      !setInput ||
      typeof setInput !== 'object' ||
      !Number.isFinite(Number((setInput as Record<string, unknown>).reps))
    ) {
      throw new Error(`Each set for "${exerciseId}" requires numeric "reps"`);
    }
    const record = setInput as Record<string, unknown>;
    if (record.type != null && !['standard', 'warmUp', 'failure'].includes(String(record.type))) {
      throw new Error(`Invalid set type for "${exerciseId}": ${String(record.type)}`);
    }
    if (record.lbs != null && record.kg != null) {
      throw new Error(`Set for "${exerciseId}" cannot include both "lbs" and "kg"`);
    }
  }
  const normalizedSets: SetInput[] = setsValue.map((setInput) => {
    const record = setInput as Record<string, unknown>;
    return {
      reps: Number(record.reps),
      kg:
        record.kg != null || record.lbs != null
          ? resolveWeight({
              kg: record.kg != null ? Number(record.kg) : undefined,
              lbs: record.lbs != null ? Number(record.lbs) : undefined,
            })
          : undefined,
      sets: record.sets != null ? Number(record.sets) : undefined,
      type:
        record.type === 'standard' || record.type === 'warmUp' || record.type === 'failure' ? record.type : undefined,
      rir: record.rir != null ? Number(record.rir) : undefined,
      rest: record.rest != null ? Number(record.rest) : undefined,
    };
  });
  return expandSets(normalizedSets);
}

export async function resolveExerciseByName(
  exerciseName: string,
  client: Pick<MacroFactorClient, 'getCustomExercises'>
) {
  const matches = searchExercises(exerciseName);
  if (matches.length === 1) {
    return { exerciseId: matches[0].id, exerciseName: matches[0].name };
  }

  if (matches.length > 1) {
    const exactMatch = matches.find((match) => match.name.toLowerCase() === exerciseName.toLowerCase());
    if (exactMatch) {
      return { exerciseId: exactMatch.id, exerciseName: exactMatch.name };
    }

    throw new Error(
      `Exercise name is ambiguous: ${exerciseName}. Candidates: ${matches.map((match) => match.name).join(', ')}`
    );
  }

  const customExercises = await client.getCustomExercises();
  const customMatch = customExercises.find((exercise) => exercise.name.toLowerCase() === exerciseName.toLowerCase());
  if (customMatch) {
    return { exerciseId: customMatch.id, exerciseName: customMatch.name };
  }

  throw new Error(`Exercise not found: ${exerciseName}`);
}

export async function buildWorkoutExercise(
  client: Pick<MacroFactorClient, 'getCustomExercises'>,
  exerciseInput: Record<string, unknown>,
  setTargets?: SetTarget[]
) {
  const providedExerciseId = typeof exerciseInput.exerciseId === 'string' ? exerciseInput.exerciseId.trim() : '';
  const providedName = typeof exerciseInput.name === 'string' ? exerciseInput.name.trim() : '';

  let resolvedId: string;
  let exerciseName: string | null;

  if (providedExerciseId) {
    const exercise = lookupExercise(providedExerciseId);
    exerciseName = (exercise?.name ?? providedName) || null;
    if (!exerciseName) {
      throw new Error(`Exercise "${providedExerciseId}" not found and no "name" provided for custom exercise`);
    }
    resolvedId = exercise?.id ?? providedExerciseId;
  } else {
    if (!providedName) {
      throw new Error('Each exercise requires "exerciseId" or "name" (string)');
    }

    const resolved = await resolveExerciseByName(providedName, client);
    resolvedId = resolved.exerciseId;
    exerciseName = resolved.exerciseName;
  }

  const expanded = normalizeSetInputs(resolvedId, exerciseInput.sets);
  const rawExercise = {
    id: randomUUID(),
    exerciseId: resolvedId,
    note: typeof exerciseInput.note === 'string' ? exerciseInput.note : '',
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
  };
  const summary = {
    name: exerciseName,
    exerciseId: resolvedId,
    sets: expanded.map((set) => ({
      reps: set.fullReps,
      kg: Math.round(set.weightKg * 1000) / 1000,
      type: set.setType,
    })),
  };
  return { rawExercise, summary };
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

async function getProgramDayTargets(client: MacroFactorClient, workoutSource?: WorkoutSource) {
  const result: { byExerciseId: Map<string, SetTarget[]>; byPosition: SetTarget[][] } = {
    byExerciseId: new Map(),
    byPosition: [],
  };
  if (!workoutSource?.dayId || workoutSource.cycleIndex == null) {
    return result;
  }

  const programs = await client.getTrainingPrograms();
  const program =
    programs.find((candidate) => candidate.id === workoutSource.programId) ||
    programs.find((candidate) => candidate.isActive) ||
    programs[0];
  if (!program) return result;

  const day = program.days.find((candidate) => candidate.id === workoutSource.dayId);
  if (!day) return result;

  const cycleTargetsIndex = workoutSource.cycleIndex;
  for (const exercise of day.exercises) {
    const programSets = exercise.periodizedTargets?.values?.[cycleTargetsIndex]?.sets ?? [];
    const targets = programSets.map((programSet) => ({ ...programSet.log }));
    result.byPosition.push(targets);
    if (targets.length > 0) {
      result.byExerciseId.set(exercise.exerciseId, targets);
    }
  }

  return result;
}

function summarizeLastMeal(entries: FoodEntry[]) {
  const active = entries.filter((entry) => !entry.deleted && entry.hour != null && entry.minute != null);
  if (active.length === 0) return null;
  const mealTimes = active
    .map((entry) => `${String(entry.hour).padStart(2, '0')}:${String(entry.minute).padStart(2, '0')}`)
    .sort();
  const latestTime = mealTimes[mealTimes.length - 1];
  if (!latestTime) return null;
  const mealEntries = active.filter(
    (entry) => `${String(entry.hour).padStart(2, '0')}:${String(entry.minute).padStart(2, '0')}` === latestTime
  );
  return {
    time: latestTime,
    items: mealEntries.length,
    calories: Math.round(mealEntries.reduce((sum, entry) => sum + entry.calories(), 0)),
  };
}

function buildTodayContext(goals: Goals, entries: FoodEntry[], date: string) {
  const active = entries.filter((entry) => !entry.deleted);
  const calories = Math.round(active.reduce((sum, entry) => sum + entry.calories(), 0));
  const protein = Math.round(active.reduce((sum, entry) => sum + entry.protein(), 0) * 10) / 10;
  const carbs = Math.round(active.reduce((sum, entry) => sum + entry.carbs(), 0) * 10) / 10;
  const fat = Math.round(active.reduce((sum, entry) => sum + entry.fat(), 0) * 10) / 10;
  const uniqueMeals = new Set(
    active
      .filter((entry) => entry.hour != null && entry.minute != null)
      .map((entry) => `${String(entry.hour).padStart(2, '0')}:${String(entry.minute).padStart(2, '0')}`)
  );
  const calorieTarget = goalForDate(goals.calories, date);
  const proteinTarget = goalForDate(goals.protein, date);
  const carbTarget = goalForDate(goals.carbs, date);
  const fatTarget = goalForDate(goals.fat, date);
  return {
    logged: calories,
    protein,
    carbs,
    fat,
    meals: uniqueMeals.size,
    targets: {
      calories: calorieTarget,
      protein: proteinTarget,
      carbs: carbTarget,
      fat: fatTarget,
    },
    remaining: calorieTarget - calories,
  };
}

function buildRecentWeight(entries: Awaited<ReturnType<MacroFactorClient['getWeightEntries']>>) {
  if (entries.length === 0) {
    return { latest: null, trend7d: null };
  }
  const latest = entries[entries.length - 1];
  const start = daysAgoDate(7);
  const window = entries.filter((entry) => entry.date >= start);
  const baseline = window[0] ?? latest;
  return {
    latest: latest.weight,
    trend7d: Math.round((latest.weight - baseline.weight) * 1000) / 1000,
  };
}

type CliTrainingProgram = Awaited<ReturnType<MacroFactorClient['getTrainingPrograms']>>[number];
type CliTrainingDay = CliTrainingProgram['days'][number];

function workoutDays(program: CliTrainingProgram): CliTrainingDay[] {
  return program.days.filter((day) => !day.isRestDay);
}

function configuredCycleCount(program: CliTrainingProgram): number {
  const maxFromTargets = Math.max(
    0,
    ...program.days.flatMap((day) => day.exercises.map((exercise) => exercise.periodizedTargets?.values?.length ?? 0))
  );
  return Math.max(program.numCycles || 0, maxFromTargets);
}

function completedDayIdsForCycle(program: CliTrainingProgram, cycleIndex: number): Set<string> {
  const cycle = program.workoutCycleCompletions?.[String(cycleIndex)];
  const completionById = cycle?.completionById ?? {};
  return new Set(Object.keys(completionById));
}

function inferActiveCycleIndex(
  program: CliTrainingProgram,
  cycleHint: number | null,
  totalCycles: number
): { cycleIndex: number; allCyclesComplete: boolean } {
  if (totalCycles <= 0) {
    return { cycleIndex: Math.max(0, cycleHint ?? 0), allCyclesComplete: false };
  }

  const days = workoutDays(program);
  if (days.length === 0) {
    return { cycleIndex: Math.max(0, cycleHint ?? 0), allCyclesComplete: false };
  }

  const hasCompletions = Object.keys(program.workoutCycleCompletions ?? {}).length > 0;
  if (!hasCompletions) {
    const hinted = Math.max(0, cycleHint ?? 0);
    return { cycleIndex: hinted, allCyclesComplete: hinted >= totalCycles };
  }

  for (let cycleIndex = 0; cycleIndex < totalCycles; cycleIndex++) {
    const completed = completedDayIdsForCycle(program, cycleIndex);
    const isComplete = days.every((day) => completed.has(day.id));
    if (!isComplete) {
      return { cycleIndex, allCyclesComplete: false };
    }
  }

  return { cycleIndex: totalCycles, allCyclesComplete: true };
}

function targetSetsForCycle(
  exercise: CliTrainingDay['exercises'][number],
  cycleIndex: number,
  deloadStrategy?: string
): SetTarget[] {
  const targets = exercise.periodizedTargets;
  if (!targets) return [];
  if (cycleIndex < targets.values.length) {
    return targets.values[cycleIndex]?.sets?.map((set) => set.log) ?? [];
  }
  // Deload: check periodizedTargets.deload first, then fall back based on strategy
  if (targets.deload?.sets?.length) {
    return targets.deload.sets.map((set) => set.log);
  }
  // Strategy: 'lastCycle' = use last cycle targets, 'firstCycle' = use first
  if (deloadStrategy === 'firstCycle' && targets.values.length > 0) {
    return targets.values[0]?.sets?.map((set) => set.log) ?? [];
  }
  if (targets.values.length > 0) {
    return targets.values[targets.values.length - 1]?.sets?.map((set) => set.log) ?? [];
  }
  return [];
}

function parseOutputFormat(opts: Record<string, string>): 'json' | 'text' {
  const requested = opts.format?.toLowerCase();
  if (requested && requested !== 'json' && requested !== 'text') {
    throw new Error('Invalid --format value. Use "text" or "json".');
  }
  if (requested === 'json') return 'json';
  if (requested === 'text') return 'text';
  if (Object.prototype.hasOwnProperty.call(opts, 'json')) return 'json';
  return 'text';
}

export function formatWorkoutPlanText(payload: {
  programName: string;
  dayName: string;
  phaseLabel: string;
  exercises: {
    name: string;
    sets: { set: number; minReps: number | null; maxReps: number | null; rir: number | null }[];
  }[];
}): string {
  const lines: string[] = [`${payload.programName} — ${payload.dayName} (${payload.phaseLabel})`, ''];
  if (payload.exercises.length === 0) {
    lines.push('No exercises for this day.');
    return lines.join('\n');
  }

  for (const [exerciseIndex, exercise] of payload.exercises.entries()) {
    lines.push(`${exerciseIndex + 1}. ${exercise.name}`);
    if (exercise.sets.length === 0) {
      lines.push('   No targets available for this phase.');
      lines.push('');
      continue;
    }
    for (const set of exercise.sets) {
      const reps =
        set.minReps == null && set.maxReps == null
          ? '? reps'
          : set.minReps === set.maxReps
            ? `${set.minReps ?? set.maxReps} reps`
            : `${set.minReps ?? '?'}-${set.maxReps ?? '?'} reps`;
      const rir = set.rir == null ? 'RIR ?' : `RIR ${set.rir}`;
      lines.push(`   Set ${set.set}: ${reps} @ ${rir}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ALL_COMMANDS = [
  'context',
  'copy-food',
  'custom-exercises',
  'create-exercise',
  'delete-weight',
  'hard-delete-food',
  'login',
  'goals',
  'workouts',
  'workout',
  'exercises search',
  'exercise',
  'gyms',
  'delete-workout',
  'remove-exercise',
  'update-workout',
  'profile',
  'food-log',
  'search-food',
  'log-food',
  'log-manual-food',
  'log-weight',
  'delete-food',
  'update-food',
  'log-workout',
  'log-exercise',
  'nutrition',
  'program',
  'next-workout',
  'workout-plan',
  'steps',
  'weight-history',
];

export async function main() {
  const { command, opts, positional } = parseArgs();

  try {
    switch (command) {
      case 'login': {
        const client = await getClient();
        console.log(JSON.stringify({ status: 'success', uid: await client.getUserId() }, null, 2));
        break;
      }

      case 'goals': {
        const client = await getClient();
        console.log(JSON.stringify(await client.getGoals(), null, 2));
        break;
      }

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

      case 'workout': {
        const input = await readInput(positional);
        const id = input?.id || positional[0];
        if (!id) throw new Error('Usage: mf.ts workout <uuid>');
        const client = await getClient();
        const detail = await client.getWorkout(id);
        console.log(JSON.stringify(detail, null, 2));
        break;
      }

      case 'gyms': {
        const client = await getClient();
        const gyms = await client.getGymProfiles();
        console.log(JSON.stringify(gyms, null, 2));
        break;
      }

      case 'exercises': {
        const subcommand = positional[0];
        const subcommandArgs = positional.slice(1);
        const input = await readInput(subcommandArgs);
        if (subcommand === 'search') {
          const query = input?.query || subcommandArgs.join(' ');
          if (!query) throw new Error('Usage: mf.ts exercises search <query>');
          const results = searchExercises(query);
          console.log(JSON.stringify(results, null, 2));
        } else {
          throw new Error('Unknown exercises sub-command. Try: search');
        }
        break;
      }

      case 'exercise': {
        const input = await readInput(positional);
        const id = input?.id || positional[0];
        if (!id) throw new Error('Usage: mf.ts exercise <hex-id>');
        const resolved = resolveExercise(id);
        if (!resolved) throw new Error(`Exercise ${id} not found`);
        console.log(JSON.stringify(resolved, null, 2));
        break;
      }

      case 'profile': {
        const client = await getClient();
        const profile = await client.getProfile();
        console.log(JSON.stringify(profile, null, 2));
        break;
      }

      case 'nutrition': {
        const input = await readInput(positional);
        const { from, to } = parseRange(input, opts, 30);
        const client = await getClient();
        console.log(JSON.stringify(await client.getNutrition(from, to), null, 2));
        break;
      }

      case 'weight-history': {
        const input = await readInput(positional);
        const { from, to } = parseRange(input, opts, 30);
        const client = await getClient();
        console.log(JSON.stringify(await client.getWeightEntries(from, to), null, 2));
        break;
      }

      case 'steps': {
        const input = await readInput(positional);
        const { from, to } = parseRange(input, opts, 30);
        const client = await getClient();
        console.log(JSON.stringify(await client.getSteps(from, to), null, 2));
        break;
      }

      case 'custom-exercises': {
        const client = await getClient();
        console.log(JSON.stringify(await client.getCustomExercises(), null, 2));
        break;
      }

      case 'create-exercise': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts create-exercise <json> or pipe JSON via stdin');
        }
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (!name) {
          throw new Error('create-exercise requires "name"');
        }

        const exerciseDef: Record<string, any> = {
          name,
          archived: false,
          bodyweight: Number(input.bodyweight) || 0,
          exerciseType: input.exerciseType ?? null,
          primaryMuscle: input.primaryMuscle ?? [],
          secondaryMuscle: input.secondaryMuscle ?? [],
          primaryFeatureMuscle: input.primaryFeatureMuscle ?? [],
          secondaryFeatureMuscle: input.secondaryFeatureMuscle ?? [],
          emphasizedAgonist: input.emphasizedAgonist ?? [],
          deemphasizedAgonist: input.deemphasizedAgonist ?? [],
          primaryJointAction: input.primaryJointAction ?? [],
          secondaryJointAction: input.secondaryJointAction ?? [],
          regionTrained: input.regionTrained ?? null,
          laterality: input.laterality ?? [],
          movementPattern: input.movementPattern ?? [],
          exerciseGroup: input.exerciseGroup ?? [],
          exclusionGroupings: input.exclusionGroupings ?? [],
          exerciseMetrics: input.exerciseMetrics ?? [],
          resistanceEquipmentGroups: input.resistanceEquipmentGroups ?? [],
          supportEquipmentGroups: input.supportEquipmentGroups ?? [],
          preconditions: input.preconditions ?? [],
          recommendationLevelStrength: input.recommendationLevelStrength ?? null,
          recommendationLevelHypertrophy: input.recommendationLevelHypertrophy ?? null,
          exerciseClassificationStrength: input.exerciseClassificationStrength ?? null,
          exerciseClassificationHypertrophy: input.exerciseClassificationHypertrophy ?? null,
          rom: input.rom ?? null,
          stability: input.stability ?? null,
          alternativeNames: input.alternativeNames ?? [],
        };

        const client = await getClient();
        const created = await client.createCustomExercise(exerciseDef as any);
        console.log(JSON.stringify({ status: 'created', id: created.id, name: created.name }, null, 2));
        break;
      }

      case 'food-log': {
        const input = await readInput(positional);
        const date = input?.date || positional[0] || todayDate();
        const client = await getClient();
        const log = await client.getFoodLog(date);
        console.log(JSON.stringify(log, null, 2));
        break;
      }

      // -----------------------------------------------------------------------
      // search-food <query>
      // -----------------------------------------------------------------------
      case 'search-food': {
        const input = await readInput(positional);
        const query = input?.query || positional.join(' ');
        if (!query) throw new Error('Usage: mf.ts search-food <query>');
        const client = await getClient();
        const results = await client.searchFoods(query);
        const summary = results.map((r, i) => ({
          index: i,
          foodId: r.foodId,
          name: r.name,
          brand: r.brand || null,
          caloriesPer100g: r.caloriesPer100g,
          proteinPer100g: r.proteinPer100g,
          servings: r.servings.map((s, servingIndex) => ({
            index: servingIndex,
            description: s.description,
            amount: s.amount,
            gramWeight: s.gramWeight,
          })),
        }));
        console.log(JSON.stringify(summary, null, 2));
        break;
      }

      case 'log-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts log-food <json> or pipe JSON via stdin');
        }

        const foodId = typeof input.foodId === 'string' ? input.foodId.trim() : '';
        if (!foodId) {
          throw new Error('log-food requires "foodId"');
        }

        const hasGrams = input.grams != null;
        const hasAmount = input.amount != null;
        let servingIndex: number;
        let quantity: number;

        if (hasGrams) {
          // grams mode: find the 100g (or gram) serving automatically
          const gramsValue = Number(input.grams);
          if (!Number.isFinite(gramsValue) || gramsValue <= 0) {
            throw new Error('log-food "grams" must be a positive number');
          }
          const food2 = await getFoodById(foodId);
          if (!food2) throw new Error(`Food "${foodId}" not found`);
          const hundredGIdx = food2.servings.findIndex((s) => s.gramWeight === 100 && /100\s*g/i.test(s.description));
          const anyGramIdx = food2.servings.findIndex((s) => isGramServing(s));
          const gramIdx = hundredGIdx >= 0 ? hundredGIdx : anyGramIdx;
          if (gramIdx < 0) {
            throw new Error(`Food "${foodId}" has no gram-based serving; use servingIndex + quantity instead`);
          }
          servingIndex = gramIdx;
          quantity = gramsValue / food2.servings[gramIdx].gramWeight;
        } else if (hasAmount) {
          // amount + unit mode: find matching serving by unit name
          const amountValue = Number(input.amount);
          if (!Number.isFinite(amountValue) || amountValue <= 0) {
            throw new Error('log-food "amount" must be a positive number');
          }
          const unit = typeof input.unit === 'string' ? input.unit.trim() : 'serving';
          const food2 = await getFoodById(foodId);
          if (!food2) throw new Error(`Food "${foodId}" not found`);
          const aliases: Record<string, string[]> = {
            tbsp: ['tbsp', 'tablespoon'],
            tsp: ['tsp', 'teaspoon'],
            cup: ['cup'],
            oz: ['oz'],
            lb: ['lb'],
            ml: ['ml'],
            serving: ['serving'],
            piece: ['piece', 'each'],
            slice: ['slice'],
            medium: ['medium'],
            large: ['large'],
            small: ['small'],
          };
          const targets = aliases[unit.toLowerCase()] || [unit.toLowerCase()];
          const matchIdx = food2.servings.findIndex((s) =>
            targets.some((t) => s.description.toLowerCase().includes(t))
          );
          if (matchIdx < 0) {
            const available = food2.servings.map((s) => s.description).join(', ');
            throw new Error(`No serving matching "${unit}" for "${foodId}". Available: ${available}`);
          }
          servingIndex = matchIdx;
          quantity = amountValue;
        } else {
          servingIndex = Number(input.servingIndex);
          if (!Number.isInteger(servingIndex) || servingIndex < 0) {
            throw new Error('log-food requires "servingIndex", "grams", or "amount"+"unit"');
          }
          quantity = Number(input.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('log-food requires positive numeric "quantity"');
          }
        }

        const client = await getClient();
        const food = await getFoodById(foodId);
        if (!food) {
          throw new Error(`Food "${foodId}" not found`);
        }
        const serving = food.servings[servingIndex];
        if (!serving) {
          throw new Error(`"servingIndex" ${servingIndex} out of range (${food.servings.length} servings)`);
        }

        const logTime = parseLogTime(input.loggedAt);
        const gramMode = isGramServing(serving);
        await client.logSearchedFood(logTime, food, serving, quantity, gramMode);

        const totalGrams = serving.gramWeight * quantity;
        const totalCal = Math.round((food.caloriesPer100g * totalGrams) / 100);
        const totalProt = Math.round(((food.proteinPer100g * totalGrams) / 100) * 10) / 10;

        console.log(
          JSON.stringify(
            {
              status: 'logged',
              food: food.name,
              foodId: food.foodId,
              serving: serving.description,
              quantity,
              totalGrams: Math.round(totalGrams),
              totalCalories: totalCal,
              totalProtein: totalProt,
              date: logTime.date,
            },
            null,
            2
          )
        );
        await syncDayDashboard(client, logTime.date);
        break;
      }

      case 'log-manual-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts log-manual-food <json> or pipe JSON via stdin');
        }
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (!name) {
          throw new Error('log-manual-food requires "name"');
        }
        const calories = Number(input.calories);
        const protein = Number(input.protein);
        const carbs = Number(input.carbs);
        const fat = Number(input.fat);
        if (![calories, protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0)) {
          throw new Error('log-manual-food requires non-negative numeric calories/protein/carbs/fat');
        }
        const logTime = parseLogTime(input.loggedAt);
        const client = await getClient();
        await client.logFood(logTime, name, calories, protein, carbs, fat);
        console.log(JSON.stringify({ status: 'logged', name, date: logTime.date }, null, 2));
        await syncDayDashboard(client, logTime.date);
        break;
      }

      case 'log-weight': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts log-weight <json> or pipe JSON via stdin');
        }

        const date =
          input.date == null
            ? todayDate()
            : typeof input.date === 'string' && input.date.trim() !== ''
              ? input.date.trim()
              : null;
        if (!date) {
          throw new Error('"date" must be a non-empty YYYY-MM-DD string when provided');
        }

        const hasKg = input.kg != null;
        const hasLbs = input.lbs != null;
        if (hasKg === hasLbs) {
          throw new Error('log-weight requires exactly one of "kg" or "lbs"');
        }

        const weightKg = hasKg ? Number(input.kg) : resolveWeight({ lbs: Number(input.lbs) });
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          throw new Error('Weight must be a positive number');
        }

        const bodyFat = input.bodyFat == null ? undefined : Number(input.bodyFat);
        if (bodyFat != null && !Number.isFinite(bodyFat)) {
          throw new Error('"bodyFat" must be a number when provided');
        }

        const client = await getClient();
        await client.logWeight(date, weightKg, bodyFat);

        console.log(
          JSON.stringify(
            {
              status: 'logged',
              date,
              kg: Math.round(weightKg * 1000) / 1000,
              bodyFat,
            },
            null,
            2
          )
        );
        break;
      }

      case 'delete-weight': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts delete-weight <json> or pipe JSON via stdin');
        }
        const date = typeof input.date === 'string' ? input.date.trim() : '';
        if (!date) {
          throw new Error('delete-weight requires "date"');
        }
        const client = await getClient();
        await client.deleteWeightEntry(date);
        console.log(JSON.stringify({ status: 'deleted', date }, null, 2));
        break;
      }

      case 'delete-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts delete-food <json> or pipe JSON via stdin');
        }

        const date = typeof input.date === 'string' ? input.date.trim() : '';
        const entryId = typeof input.entryId === 'string' ? input.entryId.trim() : '';
        if (!date || !entryId) {
          throw new Error('delete-food requires "date" and "entryId"');
        }

        const client = await getClient();
        await client.deleteFoodEntry(date, entryId);

        console.log(JSON.stringify({ status: 'deleted', date, entryId }, null, 2));
        break;
      }

      case 'hard-delete-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts hard-delete-food <json> or pipe JSON via stdin');
        }
        const date = typeof input.date === 'string' ? input.date.trim() : '';
        const entryId = typeof input.entryId === 'string' ? input.entryId.trim() : '';
        if (!date || !entryId) {
          throw new Error('hard-delete-food requires "date" and "entryId"');
        }
        const client = await getClient();
        await client.hardDeleteFoodEntry(date, entryId);
        console.log(JSON.stringify({ status: 'hard-deleted', date, entryId }, null, 2));
        break;
      }

      case 'update-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts update-food <json> or pipe JSON via stdin');
        }

        const date = typeof input.date === 'string' ? input.date.trim() : '';
        const entryId = typeof input.entryId === 'string' ? input.entryId.trim() : '';
        const quantity = Number(input.quantity);
        if (!date || !entryId || !Number.isFinite(quantity)) {
          throw new Error('update-food requires "date", "entryId", and numeric "quantity"');
        }

        const client = await getClient();
        await client.updateFoodEntry(date, entryId, quantity);

        console.log(JSON.stringify({ status: 'updated', date, entryId, quantity }, null, 2));
        break;
      }

      case 'copy-food': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts copy-food <json> or pipe JSON via stdin');
        }
        const sourceDate = typeof input.sourceDate === 'string' ? input.sourceDate.trim() : '';
        const targetDate = typeof input.targetDate === 'string' ? input.targetDate.trim() : '';
        const entryIds = Array.isArray(input.entryIds)
          ? input.entryIds.filter((value): value is string => typeof value === 'string')
          : [];
        if (!sourceDate || !targetDate || entryIds.length === 0) {
          throw new Error('copy-food requires "sourceDate", "targetDate", and non-empty string "entryIds" array');
        }
        const client = await getClient();
        const log = await client.getFoodLog(sourceDate);
        const entries = log.filter((entry) => entryIds.includes(entry.entryId));
        if (entries.length === 0) {
          throw new Error('copy-food found no matching source entries');
        }
        await client.copyEntries(targetDate, entries);
        console.log(JSON.stringify({ status: 'copied', sourceDate, targetDate, count: entries.length }, null, 2));
        break;
      }

      case 'log-workout': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts log-workout <json> or pipe JSON via stdin');
        }

        if (typeof input.name !== 'string' || input.name.trim() === '') {
          throw new Error('log-workout requires "name" (string)');
        }

        const durationMinutes = parseDurationMinutes(input.duration);

        const client = await getClient();
        const gyms = await client.getGymProfiles();
        const workoutSource = coerceWorkoutSource(input.workoutSource);
        const programTargets = await getProgramDayTargets(client, workoutSource);

        // Clamp cycleIndex to 999 for post-program (deload) workouts
        // The app uses 999 as sentinel for 'beyond defined cycles'
        if (workoutSource?.cycleIndex != null && workoutSource.programId) {
          const programs = await client.getTrainingPrograms();
          const prog = programs.find((p) => p.id === workoutSource.programId);
          if (prog && workoutSource.cycleIndex >= (prog as any).numCycles) {
            workoutSource.cycleIndex = 999;
          }
        }
        const gymId = typeof input.gymId === 'string' ? input.gymId.trim() : '';
        if (!gymId) {
          throw new Error('log-workout requires "gymId" (string)');
        }
        const gym = gyms.find((candidate) => candidate.id === gymId);
        if (!gym) {
          throw new Error(`Gym "${gymId}" not found`);
        }
        const startTime = parseWorkoutStartTime(input.startTime);

        // Support two input formats:
        // 1. "exercises": [...] — each exercise gets its own block (no supersets)
        // 2. "blocks": [[ex1, ex2], [ex3]] — exercises grouped into superset blocks
        const blocksInput = input.blocks;
        const exercisesInput = input.exercises;

        if (blocksInput != null && exercisesInput != null) {
          throw new Error('Provide either "exercises" (flat) or "blocks" (grouped), not both');
        }

        const blocks: any[] = [];
        const exerciseSummary: any[] = [];

        let exerciseIndex = 0;
        if (Array.isArray(blocksInput)) {
          for (const blockGroup of blocksInput) {
            if (!Array.isArray(blockGroup)) {
              throw new Error('Each element of "blocks" must be an array of exercises');
            }
            const blockExercises: any[] = [];
            const blockSummaries: any[] = [];
            for (const exerciseInput of blockGroup) {
              if (!exerciseInput || typeof exerciseInput !== 'object') {
                throw new Error('Each exercise must be an object');
              }
              const inputExercise = exerciseInput as Record<string, unknown>;
              const exerciseId = typeof inputExercise.exerciseId === 'string' ? inputExercise.exerciseId.trim() : '';
              const setTargets =
                programTargets.byExerciseId.get(exerciseId) ?? programTargets.byPosition[exerciseIndex];
              const { rawExercise, summary } = await buildWorkoutExercise(client, inputExercise, setTargets);
              blockExercises.push(rawExercise);
              blockSummaries.push(summary);
              exerciseIndex++;
            }
            blocks.push({ exercises: blockExercises });
            exerciseSummary.push(blockSummaries);
          }
        } else {
          const exArray = exercisesInput == null ? [] : exercisesInput;
          if (!Array.isArray(exArray)) {
            throw new Error('"exercises" must be an array when provided');
          }
          for (const exerciseInput of exArray) {
            if (!exerciseInput || typeof exerciseInput !== 'object') {
              throw new Error('Each exercise must be an object');
            }
            const inputExercise = exerciseInput as Record<string, unknown>;
            const exerciseId = typeof inputExercise.exerciseId === 'string' ? inputExercise.exerciseId.trim() : '';
            const setTargets = programTargets.byExerciseId.get(exerciseId) ?? programTargets.byPosition[exerciseIndex];
            const { rawExercise, summary } = await buildWorkoutExercise(client, inputExercise, setTargets);
            blocks.push({ exercises: [rawExercise] });
            exerciseSummary.push(summary);
            exerciseIndex++;
          }
        }

        const workoutId = randomUUID();
        const workout = {
          id: workoutId,
          name: input.name,
          startTime,
          duration: durationMinutes * 60 * 1_000_000, // microseconds
          gymId: gym?.id || '',
          gymName: gym?.name || 'Gym',
          gymIcon: gym?.icon || 'house',
          ...(workoutSource ? { workoutSource } : {}),
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
          ...(workoutSource ? ['workoutSource'] : []),
          'blocks',
        ]);

        // Mark program day as completed so it shows checked in the app
        if (workoutSource?.programId && workoutSource.dayId && workoutSource.cycleIndex != null) {
          await client.markProgramDayCompleted(
            workoutSource.programId,
            workoutSource.cycleIndex,
            workoutSource.dayId,
            workoutId
          );
        }

        console.log(
          JSON.stringify(
            {
              status: 'created',
              workoutId,
              name: input.name,
              gym: gym?.name || 'Gym',
              gymId: gym?.id || '',
              startTime,
              durationMinutes,
              exercises: exerciseSummary,
            },
            null,
            2
          )
        );
        break;
      }

      case 'log-exercise': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts log-exercise <json> or pipe JSON via stdin');
        }

        if (typeof input.workoutId !== 'string' || input.workoutId.trim() === '') {
          throw new Error('log-exercise requires "workoutId" (string)');
        }
        if (!Array.isArray(input.exercises)) {
          throw new Error('log-exercise requires "exercises" (array)');
        }

        const workoutId = input.workoutId;
        const client = await getClient();
        const raw = await client.getRawWorkout(workoutId);
        const blocks = (raw.blocks as any[]) || [];
        const exerciseSummary: any[] = [];

        for (const exerciseInput of input.exercises) {
          if (!exerciseInput || typeof exerciseInput !== 'object') {
            throw new Error('Each exercise must be an object');
          }
          const { rawExercise, summary } = await buildWorkoutExercise(client, exerciseInput as Record<string, unknown>);
          blocks.push({ exercises: [rawExercise] });
          exerciseSummary.push(summary);
        }

        await client.updateRawWorkout(workoutId, { blocks }, ['blocks']);

        console.log(
          JSON.stringify(
            {
              status: 'added',
              workoutId,
              exercises: exerciseSummary,
            },
            null,
            2
          )
        );
        break;
      }

      case 'update-workout': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts update-workout <json> or pipe JSON via stdin');
        }
        const workoutId = typeof input.id === 'string' ? input.id.trim() : '';
        if (!workoutId) {
          throw new Error('update-workout requires "id" (string)');
        }
        const fields = { ...input } as Record<string, unknown>;
        delete fields.id;
        if (Object.keys(fields).length === 0) {
          throw new Error('update-workout requires at least one field to update');
        }
        const client = await getClient();
        await client.updateWorkout(workoutId, fields);
        console.log(JSON.stringify({ status: 'updated', id: workoutId, fields: Object.keys(fields) }, null, 2));
        break;
      }

      case 'delete-workout': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts delete-workout <json> or pipe JSON via stdin');
        }
        const workoutId = typeof input.id === 'string' ? input.id.trim() : '';
        if (!workoutId) {
          throw new Error('delete-workout requires "id" (string)');
        }
        const client = await getClient();
        await client.deleteWorkout(workoutId);
        console.log(JSON.stringify({ status: 'deleted', id: workoutId }, null, 2));
        break;
      }

      case 'remove-exercise': {
        const input = await readInput(positional);
        if (!input || typeof input !== 'object') {
          throw new Error('Usage: mf.ts remove-exercise <json> or pipe JSON via stdin');
        }
        const workoutId = typeof input.workoutId === 'string' ? input.workoutId.trim() : '';
        const exerciseId = typeof input.exerciseId === 'string' ? input.exerciseId.trim() : '';
        if (!workoutId || !exerciseId) {
          throw new Error('remove-exercise requires "workoutId" and "exerciseId"');
        }
        const client = await getClient();
        const raw = await client.getRawWorkout(workoutId);
        const blocks = (raw.blocks as any[]) || [];
        const newBlocks = blocks.filter((block: any) => {
          const exs = (block.exercises as any[]) || [];
          return !exs.some((e: any) => e.exerciseId === exerciseId);
        });
        if (newBlocks.length === blocks.length) {
          throw new Error(`Exercise "${exerciseId}" not found in workout "${workoutId}"`);
        }
        await client.updateRawWorkout(workoutId, { blocks: newBlocks }, ['blocks']);
        console.log(
          JSON.stringify(
            { status: 'removed', workoutId, exerciseId, blocksRemoved: blocks.length - newBlocks.length },
            null,
            2
          )
        );
        break;
      }

      // -----------------------------------------------------------------------
      // program — Show active training program with all days and exercises
      // -----------------------------------------------------------------------
      case 'program': {
        const client = await getClient();
        const programs = await client.getTrainingPrograms();
        const active = programs.find((p) => p.isActive) || programs[0];
        if (!active) {
          console.log(JSON.stringify({ status: 'empty', program: null }, null, 2));
          break;
        }

        console.log(
          JSON.stringify(
            {
              name: active.name,
              id: active.id,
              numCycles: active.numCycles,
              runIndefinitely: active.runIndefinitely,
              isPeriodized: active.isPeriodized,
              deload: active.deload,
              days: active.days.map((d, i) => ({
                day: i + 1,
                name: d.name,
                isRestDay: d.isRestDay,
                exercises: d.isRestDay
                  ? []
                  : d.exercises.map((e) => {
                      const info = resolveExercise(e.exerciseId);
                      return { name: info?.name || e.exerciseId, exerciseId: e.exerciseId };
                    }),
              })),
            },
            null,
            2
          )
        );
        break;
      }

      // -----------------------------------------------------------------------
      // next-workout — Show what's next in the training cycle
      // -----------------------------------------------------------------------
      case 'next-workout': {
        const client = await getClient();
        const next = await client.getNextWorkout();
        if (!next) {
          console.log(JSON.stringify({ status: 'empty', nextWorkout: null }, null, 2));
          break;
        }

        const exercises = next.exercises.map((e) => {
          const info = resolveExercise(e.exerciseId);
          return { name: info?.name || e.exerciseId, exerciseId: e.exerciseId };
        });

        console.log(
          JSON.stringify(
            {
              program: next.program.name,
              day: next.dayName,
              dayIndex: next.dayIndex + 1,
              totalDays: next.program.days.length,
              cycle: next.cycleIndex + 1,
              totalCycles: next.totalCycles,
              isRestDay: next.isRestDay,
              exercises: next.isRestDay ? [] : exercises,
            },
            null,
            2
          )
        );
        break;
      }

      // -----------------------------------------------------------------------
      // workout-plan — Show next workout with set targets for current cycle
      // -----------------------------------------------------------------------
      case 'workout-plan': {
        const dayName = positional[0] || null;
        const outputFormat = parseOutputFormat(opts);
        const client = await getClient();
        const programs = await client.getTrainingPrograms();
        const active = programs.find((p) => p.isActive) || programs[0];
        if (!active) {
          console.log(JSON.stringify({ status: 'empty', workout: null }, null, 2));
          break;
        }
        if (active.days.length === 0) {
          console.log(JSON.stringify({ status: 'empty', workout: null }, null, 2));
          break;
        }

        const next = await client.getNextWorkout();
        const totalCycles = configuredCycleCount(active);
        const inferred = inferActiveCycleIndex(active, next?.cycleIndex ?? null, totalCycles);

        let targetDay: CliTrainingDay;
        let cycleIndex = inferred.cycleIndex;
        let allCyclesComplete = inferred.allCyclesComplete;

        if (dayName) {
          const resolvedDay =
            active.days.find((d) => d.name === dayName) ||
            active.days.find((d) => d.name.toLowerCase() === dayName.toLowerCase());
          if (!resolvedDay) {
            throw new Error(`Day "${dayName}" not found in program "${active.name}"`);
          }
          targetDay = resolvedDay;
        } else {
          if (!next) {
            console.log(JSON.stringify({ status: 'empty', workout: null }, null, 2));
            break;
          }
          const fallbackDay = active.days[0];
          const nextDay = active.days[next.dayIndex];
          if (!fallbackDay) {
            console.log(JSON.stringify({ status: 'empty', workout: null }, null, 2));
            break;
          }
          targetDay = nextDay ?? fallbackDay;
          cycleIndex = next.cycleIndex;
          allCyclesComplete = cycleIndex >= totalCycles;

          if (next.isRestDay || allCyclesComplete) {
            const completions = active.workoutCycleCompletions?.[String(cycleIndex)]?.completionById || {};
            const nextIncomplete = workoutDays(active).find((d) => !completions[d.id]);
            targetDay = nextIncomplete ?? workoutDays(active)[0] ?? targetDay;
            if (allCyclesComplete) cycleIndex = totalCycles;
          }
        }

        // Build exercise list with targets
        const customExercises = await client.getCustomExercises();
        const customNameMap = new Map(customExercises.map((e) => [e.id, e.name]));

        const exercises = targetDay.exercises.map((ex) => {
          const targets = targetSetsForCycle(ex, cycleIndex, active.deload);
          const bundledName = resolveExercise(ex.exerciseId)?.name;
          const name = bundledName || customNameMap.get(ex.exerciseId) || ex.exerciseId;

          return {
            name,
            exerciseId: ex.exerciseId,
            sets: targets.map((target, setIndex) => ({
              set: setIndex + 1,
              minReps: target.minFullReps ?? null,
              maxReps: target.maxFullReps ?? null,
              rir: target.rir ?? null,
            })),
          };
        });

        const usingDeloadTargets = allCyclesComplete || cycleIndex >= totalCycles;
        const payload = {
          name: targetDay.name,
          dayId: targetDay.id,
          cycleIndex,
          cycle: cycleIndex + 1,
          totalCycles,
          phase: usingDeloadTargets ? 'deload' : 'cycle',
          programName: active.name,
          programId: active.id,
          exercises,
        };

        if (outputFormat === 'json') {
          console.log(JSON.stringify(payload, null, 2));
        } else {
          console.log(
            formatWorkoutPlanText({
              programName: active.name,
              dayName: targetDay.name,
              phaseLabel: usingDeloadTargets ? 'Deload' : `Cycle ${cycleIndex + 1}`,
              exercises,
            })
          );
        }
        break;
      }

      case 'context': {
        const client = await getClient();
        const date = todayDate();
        const [goals, foodLog, weightEntries, programs, nextWorkout] = await Promise.all([
          client.getGoals(),
          client.getFoodLog(date),
          client.getWeightEntries(daysAgoDate(30), date),
          client.getTrainingPrograms(),
          client.getNextWorkout(),
        ]);
        const activeProgram = programs.find((program) => program.isActive) || programs[0] || null;
        console.log(
          JSON.stringify(
            {
              goals,
              today: buildTodayContext(goals, foodLog, date),
              recentWeight: buildRecentWeight(weightEntries),
              program: activeProgram
                ? {
                    name: activeProgram.name,
                    nextDay: nextWorkout?.dayName ?? null,
                    cycle: nextWorkout ? nextWorkout.cycleIndex + 1 : null,
                  }
                : null,
              lastMeal: summarizeLastMeal(foodLog),
            },
            null,
            2
          )
        );
        break;
      }

      default:
        console.error(
          JSON.stringify(
            {
              error: `Unknown command: ${command}`,
              commands: ALL_COMMANDS,
            },
            null,
            2
          )
        );
        process.exit(1);
    }
  } catch (err: any) {
    console.error(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}

const isVitestRuntime =
  Boolean(process.env.VITEST) ||
  Boolean(process.env.VITEST_WORKER_ID) ||
  process.argv.some((arg) => arg.includes('vitest'));

if (!isVitestRuntime && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
