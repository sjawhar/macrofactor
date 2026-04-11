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

export type PlanSetInput = {
  reps?: number | string;
  minReps?: number;
  maxReps?: number;
  sets?: number;
  rir?: number;
  rest?: number;
  type?: 'standard' | 'warmUp' | 'failure';
  kg?: number;
  lbs?: number;
};

export type ExpandedPlanSet = {
  setType: 'standard' | 'warmUp' | 'failure';
  minFullReps: number | null;
  maxFullReps: number | null;
  rir: number | null;
  restMicros: number | null;
  weightKg: number | null;
};

/**
 * Parse a plan-set rep target from various input shapes.
 *
 * Accepts:
 *   '6-8'   → { min: 6, max: 8 }
 *   '8'     → { min: 8, max: 8 }
 *   8       → { min: 8, max: 8 }
 *   null/undefined → { min: null, max: null }
 *
 * Throws on malformed strings or when min > max.
 */
export function parseRepsTarget(input: unknown): { min: number | null; max: number | null } {
  if (input == null) return { min: null, max: null };

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error(`Invalid reps target: ${input}`);
    return { min: input, max: input };
  }

  if (typeof input !== 'string') {
    throw new Error(`Invalid reps target type: ${typeof input}`);
  }

  const trimmed = input.trim();
  if (trimmed === '') return { min: null, max: null };

  if (!trimmed.includes('-')) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new Error(`Invalid reps target: "${input}"`);
    return { min: n, max: n };
  }

  const parts = trimmed.split('-').map((p) => p.trim());
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    throw new Error(`Invalid reps range: "${input}" (expected "min-max")`);
  }
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid reps range: "${input}"`);
  }
  if (min > max) {
    throw new Error(`Invalid reps range: "${input}" (min ${min} > max ${max})`);
  }
  return { min, max };
}

/**
 * Expand plan set inputs into individual ExpandedPlanSet objects.
 * Mirrors expandSets() but produces TARGETS (rep ranges, RIR) instead of
 * logged values, for use in custom workout plans.
 *
 * Defaults:
 *   restMicros: null (let the app use its configured default)
 *   weightKg: null (no prescribed weight)
 *   setType: 'standard'
 */
export function expandPlanSets(sets: PlanSetInput[]): ExpandedPlanSet[] {
  return sets.flatMap((entry) => {
    const count = entry.sets ?? 1;
    let min: number | null;
    let max: number | null;
    if (entry.minReps != null || entry.maxReps != null) {
      min = entry.minReps ?? entry.maxReps ?? null;
      max = entry.maxReps ?? entry.minReps ?? null;
      if (min != null && max != null && min > max) {
        throw new Error(`Invalid reps range: minReps ${min} > maxReps ${max}`);
      }
    } else {
      const parsed = parseRepsTarget(entry.reps);
      min = parsed.min;
      max = parsed.max;
    }

    const weightKg = entry.kg != null || entry.lbs != null ? resolveWeight(entry) : null;
    const restMicros = entry.rest != null ? entry.rest * 1_000_000 : null;

    const expanded: ExpandedPlanSet = {
      setType: entry.type ?? 'standard',
      minFullReps: min,
      maxFullReps: max,
      rir: entry.rir ?? null,
      restMicros,
      weightKg,
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
