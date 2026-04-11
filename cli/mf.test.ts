import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readInput: vi.fn(),
  searchExercises: vi.fn(),
  lookupExercise: vi.fn(),
  resolveExercise: vi.fn(),
  login: vi.fn(),
  getFoodById: vi.fn(),
}));

vi.mock('./helpers', async () => {
  const actual = await vi.importActual<typeof import('./helpers')>('./helpers');
  return {
    ...actual,
    readInput: mocks.readInput,
  };
});

vi.mock('../src/lib/api/exercises', () => ({
  searchExercises: mocks.searchExercises,
  lookupExercise: mocks.lookupExercise,
  resolveExercise: mocks.resolveExercise,
}));

vi.mock('../src/lib/api/index', () => ({
  MacroFactorClient: {
    login: mocks.login,
  },
  getFoodById: mocks.getFoodById,
}));

async function loadCliModule(argv: string[] = ['node', 'vitest-runner', 'exercises', 'search', 'bench']) {
  vi.resetModules();
  process.argv = argv;
  mocks.readInput.mockResolvedValue(null);
  mocks.searchExercises.mockReturnValue([]);
  mocks.lookupExercise.mockReturnValue(null);
  mocks.resolveExercise.mockReturnValue(null);
  mocks.login.mockReset();
  return import('./mf.ts');
}

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    getGymProfiles: vi.fn().mockResolvedValue([{ id: 'gym-1', name: 'Home Gym', icon: 'house' }]),
    getCustomExercises: vi.fn().mockResolvedValue([]),
    updateRawWorkout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('cli log-workout exercise resolution', () => {
  const originalArgv = process.argv.slice();
  const originalUsername = process.env.MACROFACTOR_USERNAME;
  const originalPassword = process.env.MACROFACTOR_PASSWORD;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as typeof process.exit);
    process.env.MACROFACTOR_USERNAME = 'user@example.com';
    process.env.MACROFACTOR_PASSWORD = 'secret';
  });

  afterEach(() => {
    process.argv = originalArgv.slice();
    if (originalUsername == null) delete process.env.MACROFACTOR_USERNAME;
    else process.env.MACROFACTOR_USERNAME = originalUsername;
    if (originalPassword == null) delete process.env.MACROFACTOR_PASSWORD;
    else process.env.MACROFACTOR_PASSWORD = originalPassword;
  });

  it('resolves bundled exercise names to bundled IDs', async () => {
    const cli = await loadCliModule();
    const client = createMockClient();
    mocks.searchExercises.mockReturnValueOnce([{ id: 'ex-bench', name: 'Bench Press' }]);

    const buildWorkoutExercise = (cli as any).buildWorkoutExercise;
    expect(buildWorkoutExercise).toBeTypeOf('function');

    const result = await buildWorkoutExercise(client, {
      name: 'Bench Press',
      sets: [{ reps: 8, lbs: 225 }],
    });

    expect(mocks.searchExercises).toHaveBeenCalledWith('Bench Press');
    expect(client.getCustomExercises).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      rawExercise: { exerciseId: 'ex-bench' },
      summary: { name: 'Bench Press', exerciseId: 'ex-bench' },
    });
  });

  it('falls back to custom exercises when bundled search misses', async () => {
    const cli = await loadCliModule();
    const client = createMockClient({
      getCustomExercises: vi.fn().mockResolvedValue([{ id: 'custom-1', name: 'Cable Curl' }]),
    });
    mocks.searchExercises.mockReturnValueOnce([]);

    const buildWorkoutExercise = (cli as any).buildWorkoutExercise;
    expect(buildWorkoutExercise).toBeTypeOf('function');

    const result = await buildWorkoutExercise(client, {
      name: 'Cable Curl',
      sets: [{ reps: 12, kg: 20 }],
    });

    expect(mocks.searchExercises).toHaveBeenCalledWith('Cable Curl');
    expect(client.getCustomExercises).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      rawExercise: { exerciseId: 'custom-1' },
      summary: { name: 'Cable Curl', exerciseId: 'custom-1' },
    });
  });

  it('errors on ambiguous bundled exercise names with candidate list', async () => {
    const cli = await loadCliModule();
    const client = createMockClient();
    mocks.searchExercises.mockReturnValueOnce([
      { id: 'bench-flat', name: 'Flat Bench Press' },
      { id: 'bench-incline', name: 'Incline Bench Press' },
    ]);

    const resolveExerciseByName = (cli as any).resolveExerciseByName;
    expect(resolveExerciseByName).toBeTypeOf('function');

    await expect(resolveExerciseByName('Bench Press', client)).rejects.toThrow(/Flat Bench Press, Incline Bench Press/);
  });

  it('prints unknown exercise errors to stderr and exits non-zero', async () => {
    const cli = await loadCliModule();
    const client = createMockClient();
    mocks.login.mockResolvedValue(client);
    mocks.searchExercises.mockReturnValue([]);
    mocks.readInput.mockResolvedValue({
      name: 'Push Day',
      gymId: 'gym-1',
      exercises: [{ name: 'Mystery Lift', sets: [{ reps: 10, kg: 40 }] }],
    });

    const main = (cli as any).main;
    expect(main).toBeTypeOf('function');

    process.argv = ['node', 'cli/mf.ts', 'log-workout'];
    await main();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Exercise not found: Mystery Lift'));
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(client.updateRawWorkout).not.toHaveBeenCalled();
  });

  it('keeps direct exerciseId input behavior unchanged', async () => {
    const cli = await loadCliModule();
    const client = createMockClient();
    mocks.lookupExercise.mockReturnValueOnce({ id: 'ex-bench', name: 'Bench Press' });

    const buildWorkoutExercise = (cli as any).buildWorkoutExercise;
    expect(buildWorkoutExercise).toBeTypeOf('function');

    const result = await buildWorkoutExercise(client, {
      exerciseId: 'ex-bench',
      sets: [{ reps: 5, kg: 100 }],
    });

    expect(mocks.searchExercises).not.toHaveBeenCalled();
    expect(client.getCustomExercises).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      rawExercise: { exerciseId: 'ex-bench' },
      summary: { name: 'Bench Press', exerciseId: 'ex-bench' },
    });
  });
});

import { formatWorkoutPlanText } from './mf';

describe('formatWorkoutPlanText', () => {
  it('outputs human-readable text with program name, day name, and phase', () => {
    const result = formatWorkoutPlanText({
      programName: 'Push/Pull/Legs',
      dayName: 'Push Day',
      phaseLabel: 'Cycle 1',
      exercises: [
        {
          name: 'Bench Press',
          sets: [
            { set: 1, minReps: 8, maxReps: 10, rir: 2 },
            { set: 2, minReps: 8, maxReps: 10, rir: 2 },
          ],
        },
      ],
    });

    // Should NOT be JSON (not starting with { or [)
    expect(result).not.toMatch(/^\s*[\{\[]/);

    // Should contain program info
    expect(result).toContain('Push/Pull/Legs');
    expect(result).toContain('Push Day');
    expect(result).toContain('Cycle 1');

    // Should contain exercise info
    expect(result).toContain('Bench Press');
  });

  it('includes set numbers, rep ranges, and RIR values in text output', () => {
    const result = formatWorkoutPlanText({
      programName: 'Test Program',
      dayName: 'Test Day',
      phaseLabel: 'Cycle 1',
      exercises: [
        {
          name: 'Squat',
          sets: [
            { set: 1, minReps: 5, maxReps: 8, rir: 3 },
            { set: 2, minReps: 5, maxReps: 8, rir: 3 },
            { set: 3, minReps: 5, maxReps: 8, rir: 3 },
          ],
        },
      ],
    });

    // Should contain set information
    expect(result).toContain('Set 1');
    expect(result).toContain('Set 2');
    expect(result).toContain('Set 3');

    // Should contain rep ranges
    expect(result).toContain('5-8 reps');

    // Should contain RIR values
    expect(result).toContain('RIR 3');
  });

  it('handles exercises with no targets gracefully', () => {
    const result = formatWorkoutPlanText({
      programName: 'Test Program',
      dayName: 'Test Day',
      phaseLabel: 'Cycle 1',
      exercises: [
        {
          name: 'Exercise With No Targets',
          sets: [],
        },
      ],
    });

    expect(result).toContain('Exercise With No Targets');
    expect(result).toContain('No targets available');
  });

  it('handles empty exercise list', () => {
    const result = formatWorkoutPlanText({
      programName: 'Test Program',
      dayName: 'Test Day',
      phaseLabel: 'Cycle 1',
      exercises: [],
    });

    expect(result).toContain('No exercises for this day');
  });

  it('handles null/undefined rep and RIR values', () => {
    const result = formatWorkoutPlanText({
      programName: 'Test Program',
      dayName: 'Test Day',
      phaseLabel: 'Cycle 1',
      exercises: [
        {
          name: 'Exercise',
          sets: [{ set: 1, minReps: null, maxReps: null, rir: null }],
        },
      ],
    });

    expect(result).toContain('? reps');
    expect(result).toContain('RIR ?');
  });

  it('handles single rep value (minReps === maxReps)', () => {
    const result = formatWorkoutPlanText({
      programName: 'Test Program',
      dayName: 'Test Day',
      phaseLabel: 'Cycle 1',
      exercises: [
        {
          name: 'Exercise',
          sets: [{ set: 1, minReps: 10, maxReps: 10, rir: 2 }],
        },
      ],
    });

    expect(result).toContain('10 reps');
    expect(result).not.toContain('10-10');
  });
});
