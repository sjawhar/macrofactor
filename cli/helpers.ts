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
