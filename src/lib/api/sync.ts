import type { LogTime } from './client';

export const DEFAULT_SYNC_POLL_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const;

type DashboardSyncEntry = {
  entryId: string;
  name?: string;
  deleted?: boolean;
};

type DashboardSyncClient = {
  logFood: (
    loggedAt: LogTime,
    name: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number
  ) => Promise<string>;
  getFoodLog: (date: string) => Promise<DashboardSyncEntry[]>;
  hardDeleteFoodEntry: (date: string, entryId: string) => Promise<void>;
};

type SyncDayDashboardOptions = {
  delaysMs?: readonly number[];
  warn?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncDayDashboard(
  client: DashboardSyncClient,
  date: string,
  options: SyncDayDashboardOptions = {}
): Promise<void> {
  const logTime: LogTime = { date, hour: 0, minute: 0 };
  const delaysMs = options.delaysMs ?? DEFAULT_SYNC_POLL_DELAYS_MS;
  const warn = options.warn ?? console.error;
  const sleep = options.sleep ?? defaultSleep;
  const entryId = await client.logFood(logTime, '_sync', 0, 0, 0, 0);

  try {
    for (const delayMs of delaysMs) {
      await sleep(delayMs);
      const entries = await client.getFoodLog(date);
      const processed = entries.some((entry) => entry.entryId === entryId && entry.name === '_sync' && !entry.deleted);
      if (processed) {
        return;
      }
    }

    warn(`Warning: dashboard sync timed out for ${date}; cleaned up _sync entry and continued.`);
  } finally {
    await client.hardDeleteFoodEntry(date, entryId);
  }
}
