import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import { createServer } from '../server.js';
import { describe, expect, it, vi } from 'vitest';

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

describe('MCP tools', () => {
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
