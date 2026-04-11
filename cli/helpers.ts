export type SetInput = {
  reps: number;
  lbs?: number;
  kg?: number;
  sets?: number;
  type?: 'standard' | 'warmUp' | 'failure';
  rir?: number;
  rest?: number;
};

export type ExpandedSet = {
  fullReps: number;
  weightKg: number;
  setType: string;
  rir: number | null;
  restMicros: number;
};

export function parseISO(iso: string): { date: string; hours: number; minutes: number } {
  const match = iso.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return {
      date: match[1],
      hours: Number.parseInt(match[2], 10),
      minutes: Number.parseInt(match[3], 10),
    };
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '1970-01-01', hours: 0, minutes: 0 };
  }

  return {
    date: parsed.toISOString().slice(0, 10),
    hours: parsed.getUTCHours(),
    minutes: parsed.getUTCMinutes(),
  };
}

export function resolveWeight(s: { lbs?: number; kg?: number }): number {
  if (s.kg != null) return s.kg;
  if (s.lbs != null) return s.lbs / 2.2046226218;
  return 0;
}

export function expandSets(sets: SetInput[]): ExpandedSet[] {
  return sets.flatMap((entry) => {
    const count = entry.sets ?? 1;
    const expanded: ExpandedSet = {
      fullReps: entry.reps,
      weightKg: resolveWeight(entry),
      setType: entry.type ?? 'standard',
      rir: entry.rir ?? null,
      restMicros: (entry.rest ?? 120) * 1_000_000,
    };

    return Array.from({ length: count }, () => ({ ...expanded }));
  });
}

async function readStdinText(): Promise<string> {
  const stdin = (globalThis as any).process.stdin as AsyncIterable<unknown>;
  let input = '';
  for await (const chunk of stdin) {
    input += String(chunk);
  }
  return input;
}

export async function readInput(positional: string[]): Promise<Record<string, any> | null> {
  const stdin = (globalThis as any).process.stdin as { isTTY?: boolean };

  if (!stdin.isTTY) {
    const input = (await readStdinText()).trim();
    if (input) return JSON.parse(input) as Record<string, any>;
    // Empty stdin in non-TTY env — fall through to positional args
  }

  const first = positional[0];
  if (first && (first.startsWith('{') || first.startsWith('['))) {
    return JSON.parse(first) as Record<string, any>;
  }

  return null;
}

export function warnIfSuspiciousDate(date: string, force: boolean): void {
  if (force) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (date === todayStr) return;

  const dateObj = new Date(date);
  const todayObj = new Date(todayStr);
  const diffMs = todayObj.getTime() - dateObj.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 0) {
    // Future date
    console.error(`Warning: logging to future date ${date}. Use --force to suppress.`);
  } else if (diffDays === 1) {
    // Yesterday
    console.error(`Warning: logging to yesterday (${date}). Use --force to suppress.`);
  } else if (diffDays > 1 && diffDays <= 7) {
    // 2-7 days ago
    console.error(`Warning: logging to ${date} (${diffDays} days ago). Use --force to suppress.`);
  } else if (diffDays > 7) {
    // >7 days ago
    console.error(`Warning: logging to ${date} (${diffDays} days ago). This seems unusual. Use --force to suppress.`);
  }
}
