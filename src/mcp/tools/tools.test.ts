import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import { createServer } from '../server.js';
import { describe, expect, it, vi } from 'vitest';
import { searchExercises } from '../../lib/api/exercises.js';
import { syncDayDashboard } from '../../lib/api/sync.js';

vi.mock('../../lib/api/exercises.js', () => ({
  searchExercises: vi.fn(),
}));

vi.mock('../../lib/api/sync.js', () => ({
  syncDayDashboard: vi.fn().mockResolvedValue(undefined),
}));

type MockClient = {
  getProfile: ReturnType<typeof vi.fn>;
  getGoals: ReturnType<typeof vi.fn>;
  getFoodLog: ReturnType<typeof vi.fn>;
  getNutrition: ReturnType<typeof vi.fn>;
  getWeightEntries: ReturnType<typeof vi.fn>;
  getSteps: ReturnType<typeof vi.fn>;
  getGymProfiles: ReturnType<typeof vi.fn>;
  getCustomExercises: ReturnType<typeof vi.fn>;
  getTrainingPrograms: ReturnType<typeof vi.fn>;
  getNextWorkout: ReturnType<typeof vi.fn>;
  getWorkoutHistory: ReturnType<typeof vi.fn>;
  getWorkout: ReturnType<typeof vi.fn>;
  getRawWorkout: ReturnType<typeof vi.fn>;
  searchFoods: ReturnType<typeof vi.fn>;
  logFood: ReturnType<typeof vi.fn>;
  logSearchedFood: ReturnType<typeof vi.fn>;
  logWeight: ReturnType<typeof vi.fn>;
  deleteFoodEntry: ReturnType<typeof vi.fn>;
  hardDeleteFoodEntry: ReturnType<typeof vi.fn>;
  updateFoodEntry: ReturnType<typeof vi.fn>;
  deleteWeightEntry: ReturnType<typeof vi.fn>;
  deleteWorkout: ReturnType<typeof vi.fn>;
  updateRawWorkout: ReturnType<typeof vi.fn>;
  updateWorkout: ReturnType<typeof vi.fn>;
  copyEntries: ReturnType<typeof vi.fn>;
  syncDay: ReturnType<typeof vi.fn>;
};

function createMockClient(overrides: Partial<MockClient> = {}): MockClient {
  const client: MockClient = {
    getProfile: vi.fn().mockResolvedValue({}),
    getGoals: vi.fn().mockResolvedValue({}),
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
  };

  return { ...client, ...overrides };
}

async function connectServer(mockClient: MockClient): Promise<Client> {
  const server = createServer(mockClient as unknown as MacroFactorClient);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

async function callToolAndParse(mockClient: MockClient, name: string, args: Record<string, unknown> = {}) {
  const client = await connectServer(mockClient);
  const result = await client.callTool({ name, arguments: args });
  expect(result.content).toHaveLength(1);
  return JSON.parse((result.content as any)[0].text);
}

describe('MCP tools', () => {
  it('log_food searches food, logs the result, and triggers dashboard sync', async () => {
    vi.mocked(syncDayDashboard).mockResolvedValue(undefined);
    const food = {
      foodId: 'f1',
      name: 'Milk',
      servings: [
        { description: 'cup', gramWeight: 244, amount: 1 },
        { description: 'gram', gramWeight: 1, amount: 1 },
      ],
      caloriesPer100g: 60,
      proteinPer100g: 3.4,
      carbsPer100g: 5,
      fatPer100g: 3,
      nutrientsPer100g: {},
      brand: 'Brand',
      imageId: '',
    };
    const mockClient = createMockClient({
      searchFoods: vi.fn().mockResolvedValue([food]),
      logSearchedFood: vi.fn().mockResolvedValue(undefined),
    });

    await callToolAndParse(mockClient, 'log_food', {
      query: 'milk',
      amount: 2,
      unit: 'cup',
      date: '2026-03-20',
      hour: 9,
      minute: 45,
    });

    expect(mockClient.searchFoods).toHaveBeenCalledWith('milk');
    expect(mockClient.logSearchedFood).toHaveBeenCalledWith(
      { date: '2026-03-20', hour: 9, minute: 45 },
      food,
      food.servings[0],
      2,
      false
    );
    expect(syncDayDashboard).toHaveBeenCalledWith(mockClient, '2026-03-20');
  });

  it('log_manual_food calls client.logFood with LogTime and triggers dashboard sync', async () => {
    vi.mocked(syncDayDashboard).mockResolvedValue(undefined);
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'log_manual_food', {
      name: 'Protein Shake',
      calories: 220,
      protein: 35,
      carbs: 12,
      fat: 4,
      date: '2026-03-20',
      hour: 7,
      minute: 5,
    });

    expect(mockClient.logFood).toHaveBeenCalledWith(
      { date: '2026-03-20', hour: 7, minute: 5 },
      'Protein Shake',
      220,
      35,
      12,
      4
    );
    expect(syncDayDashboard).toHaveBeenCalledWith(mockClient, '2026-03-20');
  });

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

  it('get_goals calls client.getGoals', async () => {
    const mockClient = createMockClient({
      getGoals: vi.fn().mockResolvedValue({ calories: [2000] }),
    });

    const parsed = await callToolAndParse(mockClient, 'get_goals');

    expect(mockClient.getGoals).toHaveBeenCalledTimes(1);
    expect(parsed.calories).toEqual([2000]);
  });

  it('get_gym_profiles calls client.getGymProfiles', async () => {
    const mockClient = createMockClient({
      getGymProfiles: vi.fn().mockResolvedValue([{ id: 'gym-1', name: 'Home Gym' }]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_gym_profiles');

    expect(mockClient.getGymProfiles).toHaveBeenCalledTimes(1);
    expect(parsed[0].id).toBe('gym-1');
  });

  it('get_custom_exercises calls client.getCustomExercises', async () => {
    const mockClient = createMockClient({
      getCustomExercises: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Cable Curl' }]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_custom_exercises');

    expect(mockClient.getCustomExercises).toHaveBeenCalledTimes(1);
    expect(parsed[0].name).toBe('Cable Curl');
  });

  it('search_exercises calls module searchExercises with query', async () => {
    vi.mocked(searchExercises).mockReturnValueOnce([{ id: 'ex1', name: 'Bench Press' } as any]);
    const mockClient = createMockClient();

    const parsed = await callToolAndParse(mockClient, 'search_exercises', { query: 'bench' });

    expect(searchExercises).toHaveBeenCalledWith('bench');
    expect(parsed[0].id).toBe('ex1');
  });

  it('get_context returns composite context and calls all required client methods', async () => {
    const mockClient = createMockClient({
      getGoals: vi.fn().mockResolvedValue({ calories: [2000], protein: [150], carbs: [200], fat: [70] }),
      getFoodLog: vi.fn().mockResolvedValue([
        {
          deleted: false,
          hour: 8,
          minute: 30,
          calories: () => 500,
          protein: () => 40,
          carbs: () => 60,
          fat: () => 10,
        },
      ]),
      getWeightEntries: vi.fn().mockResolvedValue([{ date: '2026-03-20', weight: 80 }]),
      getTrainingPrograms: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Program', isActive: true }]),
      getNextWorkout: vi.fn().mockResolvedValue({ dayName: 'Day 2', cycleIndex: 1 }),
    });

    const parsed = await callToolAndParse(mockClient, 'get_context');

    expect(mockClient.getGoals).toHaveBeenCalledTimes(1);
    expect(mockClient.getFoodLog).toHaveBeenCalledWith(expect.any(String));
    expect(mockClient.getWeightEntries).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(mockClient.getTrainingPrograms).toHaveBeenCalledTimes(1);
    expect(mockClient.getNextWorkout).toHaveBeenCalledTimes(1);
    expect(parsed).toHaveProperty('goals');
    expect(parsed).toHaveProperty('today');
    expect(parsed).toHaveProperty('recentWeight');
    expect(parsed).toHaveProperty('program');
    expect(parsed).toHaveProperty('lastMeal');
  });

  it('get_food_log defaults date and filters deleted entries', async () => {
    const active = {
      entryId: '1',
      deleted: false,
      calories: () => 100,
      protein: () => 10,
      carbs: () => 0,
      fat: () => 0,
    };
    const deleted = {
      entryId: '2',
      deleted: true,
      calories: () => 100,
      protein: () => 10,
      carbs: () => 0,
      fat: () => 0,
    };
    const mockClient = createMockClient({ getFoodLog: vi.fn().mockResolvedValue([active, deleted]) });

    const parsed = await callToolAndParse(mockClient, 'get_food_log');

    expect(mockClient.getFoodLog).toHaveBeenCalledWith(expect.any(String));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].entryId).toBe('1');
  });

  it('search_foods calls client.searchFoods', async () => {
    const mockClient = createMockClient({
      searchFoods: vi.fn().mockResolvedValue([{ foodId: 'f1', name: 'Greek Yogurt' }]),
    });

    const parsed = await callToolAndParse(mockClient, 'search_foods', { query: 'yogurt' });

    expect(mockClient.searchFoods).toHaveBeenCalledWith('yogurt');
    expect(parsed[0].foodId).toBe('f1');
  });

  it('update_food calls client.updateFoodEntry', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'update_food', { date: '2026-03-20', entryId: '123', quantity: 2.5 });

    expect(mockClient.updateFoodEntry).toHaveBeenCalledWith('2026-03-20', '123', 2.5);
  });

  it('delete_food calls client.deleteFoodEntry', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'delete_food', { date: '2026-03-20', entryId: '123' });

    expect(mockClient.deleteFoodEntry).toHaveBeenCalledWith('2026-03-20', '123');
  });

  it('hard_delete_food calls client.hardDeleteFoodEntry', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'hard_delete_food', { date: '2026-03-20', entryId: '123' });

    expect(mockClient.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-20', '123');
  });

  it('copy_food_entries fetches source log and calls client.copyEntries', async () => {
    const entry = { entryId: 'a1', date: '2026-03-20', deleted: false };
    const mockClient = createMockClient({ getFoodLog: vi.fn().mockResolvedValue([entry]) });

    await callToolAndParse(mockClient, 'copy_food_entries', {
      fromDate: '2026-03-20',
      toDate: '2026-03-21',
      entryIds: ['a1'],
    });

    expect(mockClient.getFoodLog).toHaveBeenCalledWith('2026-03-20');
    expect(mockClient.copyEntries).toHaveBeenCalledWith('2026-03-21', [entry]);
  });

  it('get_nutrition calls client.getNutrition with date range', async () => {
    const mockClient = createMockClient({ getNutrition: vi.fn().mockResolvedValue([{ date: '2026-03-20' }]) });

    const parsed = await callToolAndParse(mockClient, 'get_nutrition', {
      startDate: '2026-03-01',
      endDate: '2026-03-20',
    });

    expect(mockClient.getNutrition).toHaveBeenCalledWith('2026-03-01', '2026-03-20');
    expect(parsed[0].date).toBe('2026-03-20');
  });

  it('get_steps calls client.getSteps with date range', async () => {
    const mockClient = createMockClient({
      getSteps: vi.fn().mockResolvedValue([{ date: '2026-03-20', steps: 10000 }]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_steps', {
      startDate: '2026-03-01',
      endDate: '2026-03-20',
    });

    expect(mockClient.getSteps).toHaveBeenCalledWith('2026-03-01', '2026-03-20');
    expect(parsed[0].steps).toBe(10000);
  });

  it('get_weight_entries calls client.getWeightEntries', async () => {
    const mockClient = createMockClient({
      getWeightEntries: vi.fn().mockResolvedValue([{ date: '2026-03-20', weight: 81 }]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_weight_entries', {
      startDate: '2026-03-01',
      endDate: '2026-03-20',
    });

    expect(mockClient.getWeightEntries).toHaveBeenCalledWith('2026-03-01', '2026-03-20');
    expect(parsed[0].weight).toBe(81);
  });

  it('log_weight converts lbs to kg and calls client.logWeight', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'log_weight', { lbs: 220, date: '2026-03-20', bodyFat: 18.2 });

    expect(mockClient.logWeight).toHaveBeenCalledWith('2026-03-20', 220 / 2.2046226218, 18.2);
  });

  it('delete_weight calls client.deleteWeightEntry', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'delete_weight', { date: '2026-03-20' });

    expect(mockClient.deleteWeightEntry).toHaveBeenCalledWith('2026-03-20');
  });

  it('get_workouts calls client.getWorkoutHistory and filters by range', async () => {
    const mockClient = createMockClient({
      getWorkoutHistory: vi.fn().mockResolvedValue([
        { id: 'w1', startTime: '2026-03-01T10:00:00.000Z' },
        { id: 'w2', startTime: '2026-03-15T10:00:00.000Z' },
        { id: 'w3', startTime: '2026-03-25T10:00:00.000Z' },
      ]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_workouts', {
      from: '2026-03-10',
      to: '2026-03-20',
    });

    expect(mockClient.getWorkoutHistory).toHaveBeenCalledTimes(1);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('w2');
  });

  it('get_workout calls client.getWorkout', async () => {
    const mockClient = createMockClient({
      getWorkout: vi.fn().mockResolvedValue({ id: 'w1', name: 'Upper Body' }),
    });

    const parsed = await callToolAndParse(mockClient, 'get_workout', { id: 'w1' });

    expect(mockClient.getWorkout).toHaveBeenCalledWith('w1');
    expect(parsed.name).toBe('Upper Body');
  });

  it('get_training_program returns active program', async () => {
    const mockClient = createMockClient({
      getTrainingPrograms: vi.fn().mockResolvedValue([
        { id: 'p1', isActive: false },
        { id: 'p2', isActive: true, name: 'Active Program' },
      ]),
    });

    const parsed = await callToolAndParse(mockClient, 'get_training_program');

    expect(mockClient.getTrainingPrograms).toHaveBeenCalledTimes(1);
    expect(parsed.id).toBe('p2');
  });

  it('get_next_workout calls client.getNextWorkout', async () => {
    const mockClient = createMockClient({
      getNextWorkout: vi.fn().mockResolvedValue({ dayName: 'Day 3' }),
    });

    const parsed = await callToolAndParse(mockClient, 'get_next_workout');

    expect(mockClient.getNextWorkout).toHaveBeenCalledTimes(1);
    expect(parsed.dayName).toBe('Day 3');
  });

  it('log_workout builds workout blocks and calls client.updateRawWorkout', async () => {
    vi.mocked(searchExercises).mockReturnValueOnce([{ id: 'ex-bench', name: 'Bench Press' } as any]);
    const mockClient = createMockClient({
      getGymProfiles: vi.fn().mockResolvedValue([{ id: 'gym-1', name: 'Home Gym', icon: 'house' }]),
    });

    await callToolAndParse(mockClient, 'log_workout', {
      name: 'Push Day',
      gym: 'Home Gym',
      startTime: '2026-03-20T17:00:00',
      durationMinutes: 60,
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, lbs: 225, sets: 2, rest: 180 }] }],
    });

    expect(searchExercises).toHaveBeenCalledWith('Bench Press');
    expect(mockClient.updateRawWorkout).toHaveBeenCalledTimes(1);

    const [id, workout, fieldPaths] = mockClient.updateRawWorkout.mock.calls[0];
    expect(typeof id).toBe('string');
    expect(workout.name).toBe('Push Day');
    expect(workout.blocks).toHaveLength(1);
    expect(workout.blocks[0].exercises).toHaveLength(1);
    expect(workout.blocks[0].exercises[0].exerciseId).toBe('ex-bench');
    expect(workout.blocks[0].exercises[0].sets).toHaveLength(2);
    expect(fieldPaths).toEqual(
      expect.arrayContaining(['name', 'startTime', 'duration', 'gymId', 'gymName', 'gymIcon', 'blocks'])
    );
  });

  it('log_exercise appends exercises to existing workout blocks', async () => {
    vi.mocked(searchExercises).mockReturnValueOnce([{ id: 'ex-row', name: 'Cable Row' } as any]);
    const mockClient = createMockClient({
      getRawWorkout: vi.fn().mockResolvedValue({ blocks: [{ exercises: [{ exerciseId: 'existing' }] }] }),
    });

    await callToolAndParse(mockClient, 'log_exercise', {
      workoutId: 'w1',
      exercises: [{ name: 'Cable Row', sets: [{ reps: 12, kg: 40 }] }],
    });

    expect(mockClient.getRawWorkout).toHaveBeenCalledWith('w1');
    expect(mockClient.updateRawWorkout).toHaveBeenCalledTimes(1);
    const [, payload, paths] = mockClient.updateRawWorkout.mock.calls[0];
    expect(payload.blocks).toHaveLength(2);
    expect(paths).toEqual(['blocks']);
  });

  it('update_workout forwards fields to client.updateWorkout', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'update_workout', {
      id: 'w1',
      name: 'Renamed Session',
      durationMinutes: 50,
    });

    expect(mockClient.updateWorkout).toHaveBeenCalledWith('w1', {
      name: 'Renamed Session',
      durationMinutes: 50,
    });
  });

  it('delete_workout calls client.deleteWorkout', async () => {
    const mockClient = createMockClient();

    await callToolAndParse(mockClient, 'delete_workout', { id: 'w1' });

    expect(mockClient.deleteWorkout).toHaveBeenCalledWith('w1');
  });

  it('remove_exercise filters blocks and updates workout', async () => {
    const mockClient = createMockClient({
      getRawWorkout: vi.fn().mockResolvedValue({
        blocks: [{ exercises: [{ exerciseId: 'ex1' }] }, { exercises: [{ exerciseId: 'ex2' }] }],
      }),
    });

    await callToolAndParse(mockClient, 'remove_exercise', { workoutId: 'w1', exerciseId: 'ex1' });

    expect(mockClient.getRawWorkout).toHaveBeenCalledWith('w1');
    expect(mockClient.updateRawWorkout).toHaveBeenCalledWith(
      'w1',
      { blocks: [{ exercises: [{ exerciseId: 'ex2' }] }] },
      ['blocks']
    );
  });
});
