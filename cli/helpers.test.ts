import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogTime } from '../src/lib/api/index';

import { expandSets, parseISO, readInput, resolveWeight, warnIfSuspiciousDate, type SetInput } from './helpers';

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

  it('preserves local hour/minute from offset-aware ISO (timezone-safe)', () => {
    // Bug: wrapping parseISO output in new Date(`...Z`) converts to UTC,
    // then getHours() returns system-local time — wrong for food log h/mi.
    // Fix: construct LogTime directly from parseISO output.
    const iso = '2026-03-21T13:30:00-05:00';
    const parsed = parseISO(iso);
    const logTime: LogTime = { date: parsed.date, hour: parsed.hours, minute: parsed.minutes };

    expect(logTime).toEqual({ date: '2026-03-21', hour: 13, minute: 30 });
  });

  it('preserves local time for positive UTC offsets', () => {
    const parsed = parseISO('2026-03-21T08:15:00+09:00');
    const logTime: LogTime = { date: parsed.date, hour: parsed.hours, minute: parsed.minutes };

    expect(logTime).toEqual({ date: '2026-03-21', hour: 8, minute: 15 });
  });

  it('handles midnight correctly', () => {
    const parsed = parseISO('2026-03-21T00:00:00-05:00');
    const logTime: LogTime = { date: parsed.date, hour: parsed.hours, minute: parsed.minutes };

    expect(logTime).toEqual({ date: '2026-03-21', hour: 0, minute: 0 });
  });

  it('demonstrates the old bug: Date wrapping shifts hours', () => {
    // This test documents the bug that was fixed.
    // Wrapping parsed output back into a UTC Date then calling getHours()
    // gives a DIFFERENT hour depending on system timezone.
    const parsed = parseISO('2026-03-21T13:00:00-05:00');
    const brokenDate = new Date(
      `${parsed.date}T${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00.000Z`
    );
    // brokenDate is 13:00 UTC — getHours() returns system-local, NOT 13
    // In UTC: getHours()=13. In UTC-5: getHours()=8. In UTC+9: getHours()=22.
    // The only reliable approach is to never round-trip through Date.
    const utcHour = brokenDate.getUTCHours(); // always 13 (UTC)
    const localHour = brokenDate.getHours(); // varies by system TZ
    expect(utcHour).toBe(13);
    // localHour !== 13 when system TZ ≠ UTC — that was the bug
    expect(parsed.hours).toBe(13); // parseISO always gives the right answer
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

describe('warnIfSuspiciousDate', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('does not warn for today\'s date', () => {
    const today = new Date().toISOString().slice(0, 10);
    warnIfSuspiciousDate(today, false);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('warns for yesterday with specific message', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(yesterday, false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: logging to yesterday')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--force')
    );
  });

  it('warns for 2-7 days ago with day count', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(fiveDaysAgo, false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: logging to')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('5 days ago')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--force')
    );
  });

  it('warns more strongly for >7 days ago', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(tenDaysAgo, false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: logging to')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('10 days ago')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('This seems unusual')
    );
  });

  it('warns for future dates', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(tomorrow, false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: logging to future date')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--force')
    );
  });

  it('suppresses all warnings when force is true', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(tenDaysAgo, true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('suppresses warnings for future dates when force is true', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    warnIfSuspiciousDate(tomorrow, true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
