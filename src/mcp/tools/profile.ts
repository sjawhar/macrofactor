import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import { searchExercises } from '../../lib/api/exercises.js';
import { z } from 'zod';

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysAgoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekdayIndex(date: string): number {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const jsDay = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return (jsDay + 6) % 7;
}

function goalForDate(values: number[] | undefined, date: string): number {
  const source = values ?? [];
  return source[weekdayIndex(date)] ?? source[source.length - 1] ?? 0;
}

function summarizeLastMeal(entries: any[]) {
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

function buildTodayContext(goals: any, entries: any[], date: string) {
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

  const calorieTarget = goalForDate(goals?.calories, date);
  const proteinTarget = goalForDate(goals?.protein, date);
  const carbTarget = goalForDate(goals?.carbs, date);
  const fatTarget = goalForDate(goals?.fat, date);

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

function buildRecentWeight(entries: Array<{ date: string; weight: number }>) {
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

  server.tool(
    'get_goals',
    `Retrieve the user's current macro and calorie targets as configured in MacroFactor. Use this when you need the target values for calories, protein, carbs, and fat before analyzing intake or planning actions. Do not use this to inspect user account preferences or gym settings, because those belong to get_profile and get_gym_profiles. If you need to compare targets against today's logged intake, call get_context right after this for a combined view.`,
    {},
    { readOnlyHint: true },
    async () => {
      const goals = await client.getGoals();
      return { content: [{ type: 'text' as const, text: JSON.stringify(goals, null, 2) }] };
    }
  );

  server.tool(
    'get_gym_profiles',
    `List all gym profiles available to the user, including IDs, names, and equipment preferences used by workout logging. Use this before log_workout when you need to select a specific gym by ID or confirm available gym metadata. Do not use this to inspect training day sequencing or next sessions, because those come from get_training_program and get_next_workout. If you only need user diet/profile settings, use get_profile instead.`,
    {},
    { readOnlyHint: true },
    async () => {
      const gyms = await client.getGymProfiles();
      return { content: [{ type: 'text' as const, text: JSON.stringify(gyms, null, 2) }] };
    }
  );

  server.tool(
    'get_custom_exercises',
    `Return the user's custom exercise definitions that have been created in MacroFactor. Use this when you need to discover user-authored exercises that are not part of the bundled global exercise database. Do not use this for fuzzy name search across the global exercise catalog; use search_exercises for that purpose. If you need to add these exercises to a workout, call log_workout or log_exercise after selecting the right exercise IDs.`,
    {},
    { readOnlyHint: true },
    async () => {
      const customExercises = await client.getCustomExercises();
      return { content: [{ type: 'text' as const, text: JSON.stringify(customExercises, null, 2) }] };
    }
  );

  server.tool(
    'search_exercises',
    `Search the bundled MacroFactor exercise database by a text query and return matching exercise records as JSON. Use this when a user provides a natural-language exercise name and you need the canonical exercise ID for workout logging tools. Do not use this to fetch user-specific custom exercises or workout history, because those belong to get_custom_exercises and get_workouts. If no result is returned, ask for a more specific query or inspect custom exercises as a fallback.`,
    { query: z.string().min(1) },
    { readOnlyHint: true },
    async ({ query }) => {
      const matches = searchExercises(query);
      return { content: [{ type: 'text' as const, text: JSON.stringify(matches, null, 2) }] };
    }
  );

  server.tool(
    'get_context',
    `Build a high-signal daily context snapshot combining goals, today's food log, recent weight trend, and upcoming training context. Use this when you want a single response that summarizes adherence and the current training state without calling five separate tools manually. Do not use this when you need raw historical detail over longer ranges, because dedicated tools like get_food_log, get_weight_entries, and get_training_program are better for deep dives. This tool has no prerequisites, but related tools can be used afterward to drill into specific fields returned here.`,
    {},
    { readOnlyHint: true },
    async () => {
      const date = todayDate();
      const [goals, foodLog, weightEntries, programs, nextWorkout] = await Promise.all([
        client.getGoals(),
        client.getFoodLog(date),
        client.getWeightEntries(daysAgoDate(30), date),
        client.getTrainingPrograms(),
        client.getNextWorkout(),
      ]);

      const activeProgram = programs.find((program) => program.isActive) || programs[0] || null;
      const context = {
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
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(context, null, 2) }] };
    }
  );
}
