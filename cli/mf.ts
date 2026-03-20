#!/usr/bin/env npx tsx
// cli/mf.ts
// Usage: npx tsx cli/mf.ts <command> [options]

import { MacroFactorClient } from '../src/lib/api/index';
import { searchExercises, resolveExercise, resolveName } from '../src/lib/api/exercises';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Polyfill env vars if .env exists
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.startsWith('MACROFACTOR_USERNAME=')) process.env.MACROFACTOR_USERNAME = line.substring(21).trim();
    if (line.startsWith('MACROFACTOR_PASSWORD=')) process.env.MACROFACTOR_PASSWORD = line.substring(21).trim();
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
      opts[args[i].substring(2)] = args[i + 1];
      i++;
    } else {
      positional.push(args[i]);
    }
  }
  return { command, opts, positional };
}

// ---------------------------------------------------------------------------
// Parsing helpers for write commands
// ---------------------------------------------------------------------------

const TIMEZONE_OFFSET_HOURS = -6; // MDT = UTC-6

/** Parse amount string like "150g", "2tbsp", "1cup" into { value, unit }. */
function parseAmount(s: string): { value: number; unit: string } {
  const m = s.match(/^([\d.]+)\s*(.+)$/);
  if (!m) throw new Error(`Cannot parse amount: "${s}". Expected e.g. "150g", "2tbsp"`);
  return { value: parseFloat(m[1]), unit: m[2].toLowerCase().trim() };
}

/** Parse time like "7pm", "19:00", "7:30am" into { hours, minutes }. */
function parseTime(s: string): { hours: number; minutes: number } {
  // "19:00" or "7:30"
  const colonMatch = s.match(/^(\d{1,2}):(\d{2})(am|pm)?$/i);
  if (colonMatch) {
    let h = parseInt(colonMatch[1], 10);
    const min = parseInt(colonMatch[2], 10);
    if (colonMatch[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (colonMatch[3]?.toLowerCase() === 'am' && h === 12) h = 0;
    return { hours: h, minutes: min };
  }
  // "7pm", "7am", "12pm"
  const shortMatch = s.match(/^(\d{1,2})(am|pm)$/i);
  if (shortMatch) {
    let h = parseInt(shortMatch[1], 10);
    if (shortMatch[2].toLowerCase() === 'pm' && h < 12) h += 12;
    if (shortMatch[2].toLowerCase() === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }
  throw new Error(`Cannot parse time: "${s}". Expected e.g. "7pm", "19:00", "7:30am"`);
}

/** Build a Date from --date and --at options in the user's local timezone. */
function buildDate(opts: Record<string, string>): Date {
  const dateStr = opts.date || new Date().toISOString().split('T')[0];
  const { hours, minutes } = opts.at
    ? parseTime(opts.at)
    : { hours: new Date().getHours(), minutes: new Date().getMinutes() };
  // Build UTC date from local time
  const utcHours = hours - TIMEZONE_OFFSET_HOURS;
  return new Date(`${dateStr}T${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
}

/** Match a serving by unit alias (e.g., "g" → "gram", "tbsp" → "tbsp"). */
function findServing(servings: { description: string; gramWeight: number; amount: number }[], unit: string) {
  // For gram-based amounts, prefer the 1g serving so qty = grams directly
  if (['g', 'gram', 'grams'].includes(unit.toLowerCase())) {
    return (
      servings.find((s) => s.gramWeight === 1 && s.description.toLowerCase().includes('gram')) ||
      servings.find((s) => s.gramWeight === 1) ||
      servings.find((s) => s.description === '100 g')
    );
  }
  const aliases: Record<string, string[]> = {
    tbsp: ['tbsp', 'tablespoon'],
    tsp: ['tsp', 'teaspoon'],
    cup: ['cup'],
    oz: ['oz'],
    lb: ['lb'],
    ml: ['ml'],
    serving: ['serving'],
  };
  const targets = aliases[unit.toLowerCase()] || [unit.toLowerCase()];
  return servings.find((s) => targets.some((t) => s.description.toLowerCase().includes(t)));
}

/**
 * Parse sets string like "3x10@135lbs", "3x12@25lbs", "2x20".
 * Returns array of { reps, weightKg }.
 */
function parseSets(s: string): { reps: number; weightKg: number | null }[] {
  // "3x10@135lbs" → 3 sets of 10 reps at 135 lbs
  // "3x10@60kg"   → 3 sets of 10 reps at 60 kg
  // "3x10"        → 3 sets of 10 reps, bodyweight
  const m = s.match(/^(\d+)x(\d+)(?:@([\d.]+)(lbs?|kg))?$/i);
  if (!m) throw new Error(`Cannot parse sets: "${s}". Expected e.g. "3x10@135lbs", "3x12@60kg", "2x20"`);

  const setCount = parseInt(m[1], 10);
  const reps = parseInt(m[2], 10);
  let weightKg: number | null = null;

  if (m[3]) {
    const raw = parseFloat(m[3]);
    weightKg = m[4].toLowerCase().startsWith('lb') ? raw / 2.2046226218 : raw;
  }

  return Array.from({ length: setCount }, () => ({ reps, weightKg }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ALL_COMMANDS = [
  'login',
  'workouts',
  'workout',
  'exercises search',
  'exercise',
  'gyms',
  'profile',
  'food-log',
  'search-food',
  'log-food',
  'log-workout',
  'log-exercise',
  'program',
  'next-workout',
];

async function main() {
  const { command, opts, positional } = parseArgs();

  try {
    switch (command) {
      case 'login': {
        const client = await getClient();
        console.log(JSON.stringify({ status: 'success', uid: await client.getUserId() }, null, 2));
        break;
      }

      case 'workouts': {
        const client = await getClient();
        let workouts = await client.getWorkoutHistory();
        if (opts.from) workouts = workouts.filter((w) => w.startTime >= opts.from!);
        if (opts.to) workouts = workouts.filter((w) => w.startTime <= opts.to!);
        console.log(JSON.stringify(workouts, null, 2));
        break;
      }

      case 'workout': {
        const id = positional[0];
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
        if (positional[0] === 'search') {
          const query = positional.slice(1).join(' ');
          if (!query) throw new Error('Usage: mf.ts exercises search <query>');
          const results = searchExercises(query);
          console.log(JSON.stringify(results, null, 2));
        } else {
          throw new Error('Unknown exercises sub-command. Try: search');
        }
        break;
      }

      case 'exercise': {
        const id = positional[0];
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

      case 'food-log': {
        const date = positional[0] || new Date().toISOString().split('T')[0];
        const client = await getClient();
        const log = await client.getFoodLog(date);
        console.log(JSON.stringify(log, null, 2));
        break;
      }

      // -----------------------------------------------------------------------
      // search-food <query>
      // -----------------------------------------------------------------------
      case 'search-food': {
        const query = positional.join(' ');
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
          servings: r.servings.map((s) => `${s.description} (${s.gramWeight}g)`),
        }));
        console.log(JSON.stringify(summary, null, 2));
        break;
      }

      // -----------------------------------------------------------------------
      // log-food <query> <amount> [--at <time>] [--date <YYYY-MM-DD>] [--pick <index>]
      //
      // Examples:
      //   mf.ts log-food "kale raw" 150g --at 7pm
      //   mf.ts log-food "nutritional yeast seasoning" 2tbsp --at 7pm --date 2026-03-19
      //   mf.ts log-food "broccoli raw" 150g --pick 1
      // -----------------------------------------------------------------------
      case 'log-food': {
        if (positional.length < 2) {
          throw new Error(
            'Usage: mf.ts log-food <query> <amount> [--at <time>] [--date <YYYY-MM-DD>] [--pick <index>]'
          );
        }
        const query = positional[0];
        const amountStr = positional[1];
        const pickIndex = parseInt(opts.pick || '0', 10);

        const client = await getClient();
        const results = await client.searchFoods(query);
        if (results.length === 0) throw new Error(`No foods found for "${query}"`);
        if (pickIndex >= results.length)
          throw new Error(`--pick ${pickIndex} out of range (${results.length} results)`);

        const food = results[pickIndex];
        const { value, unit } = parseAmount(amountStr);

        // Find serving that matches the unit
        const serving = findServing(food.servings, unit);
        if (!serving) {
          const available = food.servings.map((s) => s.description).join(', ');
          throw new Error(`No serving matching "${unit}" for ${food.name}. Available: ${available}`);
        }

        // For gram-based units, pass the raw grams.
        // For named units (tbsp, cup), pass the unit count.
        // logSearchedFood uses gramMode to set w/y/q correctly.
        const isGramUnit = ['g', 'gram', 'grams'].includes(unit.toLowerCase());
        const quantity = isGramUnit ? value : value;

        const logTime = buildDate(opts);
        await client.logSearchedFood(logTime, food, serving, quantity, isGramUnit);

        const totalGrams = isGramUnit ? value : serving.gramWeight * quantity;
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
              date: opts.date || new Date().toISOString().split('T')[0],
            },
            null,
            2
          )
        );
        break;
      }

      // -----------------------------------------------------------------------
      // log-workout --name <name> [--gym <name>] [--at <time>] [--date <YYYY-MM-DD>] [--duration <minutes>]
      //
      // Examples:
      //   mf.ts log-workout --name "PM Session" --at 5pm
      //   mf.ts log-workout --name "Morning Workout" --gym "Home" --date 2026-03-19 --duration 45
      // -----------------------------------------------------------------------
      case 'log-workout': {
        if (!opts.name)
          throw new Error(
            'Usage: mf.ts log-workout --name <name> [--gym <name>] [--at <time>] [--date <YYYY-MM-DD>] [--duration <minutes>]'
          );

        const client = await getClient();
        const logTime = buildDate(opts);
        const durationMinutes = parseInt(opts.duration || '45', 10);

        // Resolve gym — use first match by name, or first gym if not specified
        const gyms = await client.getGymProfiles();
        let gym = gyms[0];
        if (opts.gym) {
          const match = gyms.find((g) => g.name.toLowerCase().includes(opts.gym.toLowerCase()));
          if (match) gym = match;
        }

        const workoutId = randomUUID();
        const workout = {
          name: opts.name,
          startTime: logTime.toISOString(),
          duration: durationMinutes * 60 * 1_000_000, // microseconds
          gymId: gym?.id || '',
          gymName: gym?.name || 'Gym',
          gymIcon: gym?.icon || 'house',
          blocks: [],
        };

        await client.updateRawWorkout(workoutId, workout, [
          'name',
          'startTime',
          'duration',
          'gymId',
          'gymName',
          'gymIcon',
          'blocks',
        ]);

        console.log(
          JSON.stringify(
            {
              status: 'created',
              workoutId,
              name: opts.name,
              gym: gym?.name || 'Gym',
              startTime: logTime.toISOString(),
              durationMinutes,
            },
            null,
            2
          )
        );
        break;
      }

      // -----------------------------------------------------------------------
      // log-exercise <workout-id> <exercise-query> <sets> [--rest <seconds>]
      //
      // Sets format: NxR@Wunit  (e.g., "3x10@135lbs", "3x12@60kg", "2x20")
      //
      // Examples:
      //   mf.ts log-exercise abc-123 "bench press" 3x10@135lbs
      //   mf.ts log-exercise abc-123 "cable crunch" 3x15@120lbs --rest 90
      //   mf.ts log-exercise abc-123 "pullup" 3x10
      // -----------------------------------------------------------------------
      case 'log-exercise': {
        if (positional.length < 3) {
          throw new Error('Usage: mf.ts log-exercise <workout-id> <exercise-query> <sets> [--rest <seconds>]');
        }
        const workoutId = positional[0];
        const exerciseQuery = positional[1];
        const setsStr = positional[2];
        const restSeconds = parseInt(opts.rest || '120', 10);

        // Find exercise in local DB
        const matches = searchExercises(exerciseQuery);
        if (matches.length === 0) throw new Error(`No exercise found for "${exerciseQuery}"`);
        const exercise = matches[0];

        // Parse sets
        const sets = parseSets(setsStr);

        // Read existing workout, add a new block with this exercise
        const client = await getClient();
        const raw = await client.getRawWorkout(workoutId);
        const blocks = (raw.blocks as any[]) || [];

        const newExercise = {
          id: randomUUID(),
          exerciseId: exercise.id,
          note: '',
          baseWeight: null,
          sets: sets.map((s) => ({
            setType: 'standard',
            segments: [],
            log: {
              id: randomUUID(),
              runtimeType: 'single',
              target: null,
              value: {
                weight: s.weightKg ?? 0,
                fullReps: s.reps,
                partialReps: null,
                rir: null,
                distance: null,
                durationSeconds: null,
                restTimer: restSeconds * 1_000_000, // microseconds
                isSkipped: false,
              },
            },
          })),
        };

        // Add as a new block (each exercise in its own block)
        blocks.push({ exercises: [newExercise] });
        await client.updateRawWorkout(workoutId, { blocks }, ['blocks']);

        console.log(
          JSON.stringify(
            {
              status: 'added',
              workoutId,
              exercise: exercise.name,
              exerciseId: exercise.id,
              sets: sets.map((s) => ({
                reps: s.reps,
                weightKg: s.weightKg ? Math.round(s.weightKg * 100) / 100 : null,
              })),
              restSeconds,
            },
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
          console.log('No training programs found.');
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
          console.log('No active program found.');
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

main();
