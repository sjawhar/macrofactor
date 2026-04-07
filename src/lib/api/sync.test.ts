import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SYNC_POLL_DELAYS_MS, syncDayDashboard } from './sync';

type MockClient = {
  logFood: ReturnType<typeof vi.fn>;
  getFoodLog: ReturnType<typeof vi.fn>;
  hardDeleteFoodEntry: ReturnType<typeof vi.fn>;
};

function createMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    logFood: vi.fn().mockResolvedValue('sync-1'),
    getFoodLog: vi.fn().mockResolvedValue([]),
    hardDeleteFoodEntry: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('syncDayDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not wait a fixed 15 seconds before the first poll', async () => {
    const client = createMockClient({
      getFoodLog: vi.fn().mockResolvedValue([{ entryId: 'sync-1', name: '_sync', deleted: false }]),
    });

    const syncPromise = syncDayDashboard(client as any, '2026-03-20');

    expect(client.logFood).toHaveBeenCalledWith({ date: '2026-03-20', hour: 0, minute: 0 }, '_sync', 0, 0, 0, 0);
    expect(client.getFoodLog).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(client.getFoodLog).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(client.getFoodLog).toHaveBeenCalledTimes(1);

    await syncPromise;
  });

  it('polls with exponential backoff until the sync entry appears', async () => {
    const client = createMockClient({
      getFoodLog: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ entryId: 'sync-1', name: '_sync', deleted: false }]),
    });

    const syncPromise = syncDayDashboard(client as any, '2026-03-20');

    await vi.advanceTimersByTimeAsync(DEFAULT_SYNC_POLL_DELAYS_MS[0]);
    expect(client.getFoodLog).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DEFAULT_SYNC_POLL_DELAYS_MS[1] - 1);
    expect(client.getFoodLog).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(client.getFoodLog).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(DEFAULT_SYNC_POLL_DELAYS_MS[2] - 1);
    expect(client.getFoodLog).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(client.getFoodLog).toHaveBeenCalledTimes(3);

    await syncPromise;
    expect(client.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-20', 'sync-1');
  });

  it('times out gracefully after the max attempts, warns, and still cleans up', async () => {
    const warn = vi.fn();
    const client = createMockClient();

    const syncPromise = syncDayDashboard(client as any, '2026-03-20', { warn });

    await vi.advanceTimersByTimeAsync(
      DEFAULT_SYNC_POLL_DELAYS_MS.reduce((sum: number, delay: number) => sum + delay, 0)
    );
    await syncPromise;

    expect(client.getFoodLog).toHaveBeenCalledTimes(DEFAULT_SYNC_POLL_DELAYS_MS.length);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('2026-03-20'));
    expect(client.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-20', 'sync-1');
  });

  it('always hard-deletes the sync entry on both success and timeout paths', async () => {
    const successClient = createMockClient({
      logFood: vi.fn().mockResolvedValue('success-sync'),
      getFoodLog: vi.fn().mockResolvedValue([{ entryId: 'success-sync', name: '_sync', deleted: false }]),
    });
    const timeoutClient = createMockClient({
      logFood: vi.fn().mockResolvedValue('timeout-sync'),
    });

    const successPromise = syncDayDashboard(successClient as any, '2026-03-20');
    await vi.advanceTimersByTimeAsync(DEFAULT_SYNC_POLL_DELAYS_MS[0]);
    await successPromise;

    const timeoutPromise = syncDayDashboard(timeoutClient as any, '2026-03-21', { warn: vi.fn() });
    await vi.advanceTimersByTimeAsync(
      DEFAULT_SYNC_POLL_DELAYS_MS.reduce((sum: number, delay: number) => sum + delay, 0)
    );
    await timeoutPromise;

    expect(successClient.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-20', 'success-sync');
    expect(timeoutClient.hardDeleteFoodEntry).toHaveBeenCalledWith('2026-03-21', 'timeout-sync');
  });

  it('cleans up each sync entry when multiple sync calls run concurrently', async () => {
    const client = createMockClient({
      logFood: vi.fn().mockResolvedValueOnce('sync-1').mockResolvedValueOnce('sync-2'),
      getFoodLog: vi.fn().mockImplementation(async () => [
        { entryId: 'sync-1', name: '_sync', deleted: false },
        { entryId: 'sync-2', name: '_sync', deleted: false },
      ]),
    });

    const syncs = Promise.all([
      syncDayDashboard(client as any, '2026-03-20'),
      syncDayDashboard(client as any, '2026-03-20'),
    ]);

    await vi.advanceTimersByTimeAsync(DEFAULT_SYNC_POLL_DELAYS_MS[0]);
    await syncs;

    expect(client.hardDeleteFoodEntry).toHaveBeenCalledTimes(2);
    expect(client.hardDeleteFoodEntry).toHaveBeenNthCalledWith(1, '2026-03-20', 'sync-1');
    expect(client.hardDeleteFoodEntry).toHaveBeenNthCalledWith(2, '2026-03-20', 'sync-2');
  });
});
