import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expandSets, parseISO, readInput, resolveWeight, type SetInput } from './helpers';

describe('parseISO', () => {
  it('reads offset-aware date/time directly from string', () => {
    expect(parseISO('2026-03-20T09:00:00-05:00')).toEqual({
      date: '2026-03-20',
      hours: 9,
      minutes: 0,
    });
  });

  it('reads UTC date/time directly from string', () => {
    expect(parseISO('2026-03-20T14:05:00Z')).toEqual({
      date: '2026-03-20',
      hours: 14,
      minutes: 5,
    });
  });

  it('reads string without offset directly from string', () => {
    expect(parseISO('2026-03-20T07:45:00')).toEqual({
      date: '2026-03-20',
      hours: 7,
      minutes: 45,
    });
  });

  it('falls back to Date UTC components for date-only strings', () => {
    expect(parseISO('2026-03-20')).toEqual({
      date: '2026-03-20',
      hours: 0,
      minutes: 0,
    });
  });
});

describe('resolveWeight', () => {
  it('converts pounds to kilograms', () => {
    expect(resolveWeight({ lbs: 220.46226218 })).toBeCloseTo(100);
  });

  it('passes through kilograms when present', () => {
    expect(resolveWeight({ kg: 42.5, lbs: 100 })).toBe(42.5);
  });

  it('returns 0 when no weight is provided', () => {
    expect(resolveWeight({})).toBe(0);
  });
});

describe('expandSets', () => {
  it('expands a single set with defaults', () => {
    expect(expandSets([{ reps: 10, lbs: 135 }])).toEqual([
      {
        fullReps: 10,
        weightKg: 135 / 2.2046226218,
        setType: 'standard',
        rir: null,
        restMicros: 120_000_000,
      },
    ]);
  });

  it('expands based on the sets count', () => {
    expect(expandSets([{ reps: 8, kg: 60, sets: 3 }])).toHaveLength(3);
  });

  it('handles mixed weight inputs and missing weights', () => {
    const input: SetInput[] = [{ reps: 12, kg: 50 }, { reps: 10, lbs: 110 }, { reps: 15 }];

    expect(expandSets(input)).toEqual([
      {
        fullReps: 12,
        weightKg: 50,
        setType: 'standard',
        rir: null,
        restMicros: 120_000_000,
      },
      {
        fullReps: 10,
        weightKg: 110 / 2.2046226218,
        setType: 'standard',
        rir: null,
        restMicros: 120_000_000,
      },
      {
        fullReps: 15,
        weightKg: 0,
        setType: 'standard',
        rir: null,
        restMicros: 120_000_000,
      },
    ]);
  });

  it('preserves type, rir, and rest values', () => {
    expect(expandSets([{ reps: 5, kg: 100, type: 'failure', rir: 1, rest: 90 }])).toEqual([
      {
        fullReps: 5,
        weightKg: 100,
        setType: 'failure',
        rir: 1,
        restMicros: 90_000_000,
      },
    ]);
  });
});

describe('readInput', () => {
  let isTTYDescriptor: PropertyDescriptor | undefined;
  const stdin = (globalThis as any).process.stdin;

  beforeEach(() => {
    isTTYDescriptor = Object.getOwnPropertyDescriptor(stdin, 'isTTY');
    Object.defineProperty(stdin, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    if (isTTYDescriptor) {
      Object.defineProperty(stdin, 'isTTY', isTTYDescriptor);
    }
  });

  it('parses JSON when first positional argument is JSON', async () => {
    await expect(readInput(['{"name":"Session","sets":[{"reps":10}]}'])).resolves.toEqual({
      name: 'Session',
      sets: [{ reps: 10 }],
    });
  });

  it('parses array JSON when first positional argument is JSON array', async () => {
    await expect(readInput(['[{"reps":10}]'])).resolves.toEqual([{ reps: 10 }]);
  });

  it('returns null when positional input is not JSON-like', async () => {
    await expect(readInput(['not-json'])).resolves.toBeNull();
  });

  it('returns parsed JSON from positional args (TTY mode)', async () => {
    // In TTY mode, positional args are checked directly without stdin read
    await expect(readInput(['{"foo":"bar"}'])).resolves.toEqual({ foo: 'bar' });
  });

  it('returns null when positional arg is not JSON (TTY mode)', async () => {
    // In TTY mode, non-JSON positional args return null
    await expect(readInput(['not json'])).resolves.toBeNull();
  });
});
