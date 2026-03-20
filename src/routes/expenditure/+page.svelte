<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { NutritionSummary, ScaleEntry } from '$lib/api';
  import { today, daysAgo } from '$lib/date';

  type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';
  const RANGE_DAYS: Record<RangeKey, number> = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    'All': 730,
  };
  const RANGE_KEYS: RangeKey[] = ['1W', '1M', '3M', '6M', '1Y', 'All'];

  let rangeKey = $state<RangeKey>('3M');
  let nutritionEntries = $state<NutritionSummary[]>([]);
  let weightEntries = $state<ScaleEntry[]>([]);
  let loading = $state(true);

  async function loadData() {
    if (!auth.client) return;
    loading = true;
    const days = RANGE_DAYS[rangeKey];
    const start = daysAgo(days);
    const end = today();
    try {
      const [n, w] = await Promise.all([
        auth.client.getNutrition(start, end),
        auth.client.getWeightEntries(start, end),
      ]);
      nutritionEntries = n;
      weightEntries = w;
    } catch {
      nutritionEntries = [];
      weightEntries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => { if (auth.client) loadData(); });
  $effect(() => { rangeKey; if (auth.client) loadData(); });

  // ---- TDEE computation ----

  interface ExpenditurePoint {
    date: string;
    expenditure: number;
    intake: number;
  }

  const FLUX_BAND = 200; // ±200 kcal
  const CHART_W = 800;
  const CHART_H = 280;
  const PAD = { top: 20, right: 20, bottom: 36, left: 54 };

  // Weight lookup for regression
  let sortedWeights = $derived(
    [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  );

  // Raw TDEE per nutrition day
  let rawExpenditure = $derived.by(() => {
    if (nutritionEntries.length === 0) return [] as ExpenditurePoint[];

    const sorted = [...nutritionEntries].sort((a, b) => a.date.localeCompare(b.date));
    const points: ExpenditurePoint[] = [];

    for (const entry of sorted) {
      const intake = entry.calories ?? 0;
      if (intake === 0) continue;

      const rate = weightChangeRate(entry.date);
      // TDEE = intake - (kg/day × 7700 kcal/kg)
      const expenditure =
        rate !== null
          ? Math.max(500, Math.min(8000, intake - rate * 7700))
          : intake;

      points.push({ date: entry.date, expenditure, intake });
    }
    return points;
  });

  function weightChangeRate(targetDate: string): number | null {
    if (sortedWeights.length < 2) return null;
    const targetMs = new Date(targetDate + 'T12:00:00').getTime();
    const windowMs = 7 * 86_400_000;

    const nearby = sortedWeights.filter((w) => {
      const t = new Date(w.date + 'T12:00:00').getTime();
      return Math.abs(t - targetMs) <= windowMs;
    });
    if (nearby.length < 2) return null;

    // Linear regression: slope = kg per day
    const n = nearby.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const w of nearby) {
      const x = (new Date(w.date + 'T12:00:00').getTime() - targetMs) / 86_400_000;
      sx += x;
      sy += w.weight;
      sxy += x * w.weight;
      sxx += x * x;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-6) return null;
    return (n * sxy - sx * sy) / denom;
  }

  // Smoothed with EMA
  let smoothedData = $derived.by(() => {
    const raw = rawExpenditure;
    if (raw.length === 0) return [] as ExpenditurePoint[];

    const alpha = 0.15;
    let ema = raw[0].expenditure;
    const result: ExpenditurePoint[] = [];

    for (const p of raw) {
      ema = alpha * p.expenditure + (1 - alpha) * ema;
      result.push({ ...p, expenditure: ema });
    }
    return result;
  });

  // Statistics
  let avgExpenditure = $derived(
    smoothedData.length > 0
      ? smoothedData.reduce((s, p) => s + p.expenditure, 0) / smoothedData.length
      : 0
  );

  let avgIntake = $derived(
    smoothedData.length > 0
      ? smoothedData.reduce((s, p) => s + p.intake, 0) / smoothedData.length
      : 0
  );

  let difference = $derived(Math.round(avgExpenditure - avgIntake));

  // Date range label
  let dateRange = $derived.by(() => {
    if (smoothedData.length === 0) return '';
    const first = smoothedData[0].date;
    const last = smoothedData[smoothedData.length - 1].date;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const f = new Date(first + 'T12:00:00').toLocaleDateString('en-US', opts);
    const l = new Date(last + 'T12:00:00').toLocaleDateString('en-US', opts);
    return `${f} – ${l}`;
  });

  // Status: Updating vs Holding
  let expenditureStatus = $derived.by(() => {
    if (smoothedData.length < 7) return 'Updating';
    const recent = smoothedData.slice(-7);
    const avg = recent.reduce((s, p) => s + p.expenditure, 0) / recent.length;
    const maxDev = Math.max(...recent.map((p) => Math.abs(p.expenditure - avg)));
    return maxDev < 50 ? 'Holding' : 'Updating';
  });

  // ---- Chart scales ----

  let chartMinY = $derived.by(() => {
    if (smoothedData.length === 0) return 1500;
    const min = Math.min(...smoothedData.map((p) => p.expenditure));
    return Math.max(0, Math.floor((min - FLUX_BAND - 100) / 100) * 100);
  });

  let chartMaxY = $derived.by(() => {
    if (smoothedData.length === 0) return 3000;
    const max = Math.max(...smoothedData.map((p) => p.expenditure));
    return Math.ceil((max + FLUX_BAND + 100) / 100) * 100;
  });

  function xPos(i: number, total: number): number {
    if (total <= 1) return PAD.left;
    return PAD.left + (i / (total - 1)) * (CHART_W - PAD.left - PAD.right);
  }

  function yPos(val: number): number {
    const range = chartMaxY - chartMinY || 1;
    return PAD.top + (1 - (val - chartMinY) / range) * (CHART_H - PAD.top - PAD.bottom);
  }

  // SVG paths
  let expenditurePath = $derived.by(() => {
    if (smoothedData.length === 0) return '';
    return smoothedData
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(i, smoothedData.length)},${yPos(p.expenditure)}`)
      .join(' ');
  });

  let fluxAreaPath = $derived.by(() => {
    if (smoothedData.length === 0) return '';
    const n = smoothedData.length;
    const upper = smoothedData
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(i, n)},${yPos(p.expenditure + FLUX_BAND)}`)
      .join(' ');
    const lower = [...smoothedData]
      .reverse()
      .map((p, i) => `L${xPos(n - 1 - i, n)},${yPos(p.expenditure - FLUX_BAND)}`)
      .join(' ');
    return `${upper} ${lower} Z`;
  });

  // Y-axis ticks
  let yTicks = $derived.by(() => {
    const range = chartMaxY - chartMinY;
    const step = range > 2000 ? 500 : range > 1000 ? 250 : 100;
    const ticks: number[] = [];
    const start = Math.ceil(chartMinY / step) * step;
    for (let v = start; v <= chartMaxY; v += step) ticks.push(v);
    return ticks;
  });

  // X-axis ticks
  let xTicks = $derived.by(() => {
    if (smoothedData.length === 0) return [] as { i: number; label: string }[];
    const maxTicks = 6;
    const step = Math.max(1, Math.floor(smoothedData.length / maxTicks));
    const ticks: { i: number; label: string }[] = [];
    for (let i = 0; i < smoothedData.length; i += step) {
      const d = new Date(smoothedData[i].date + 'T12:00:00');
      ticks.push({ i, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    return ticks;
  });
</script>

<div class="page-header">
  <h1 class="page-title">Expenditure</h1>
  <p class="date-range">{dateRange}</p>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Legend -->
  <div class="legend">
    <span class="legend-item">
      <span class="legend-swatch flux-swatch"></span>
      Flux Range
    </span>
    <span class="legend-item">
      <span class="legend-swatch line-swatch"></span>
      Expenditure
      <span class="status-pill" class:holding={expenditureStatus === 'Holding'}>
        {expenditureStatus}
      </span>
    </span>
  </div>

  <!-- Stats row -->
  <div class="stats-row">
    <div class="stat-block">
      <span class="stat-label">Average</span>
      <span class="stat-value">{Math.round(avgExpenditure)} <span class="stat-unit">kcal</span></span>
    </div>
    <div class="stat-block">
      <span class="stat-label">Difference</span>
      <span class="stat-value" class:positive={difference > 0} class:negative={difference < 0}>
        {difference > 0 ? '+' : ''}{difference} <span class="stat-unit">kcal</span>
      </span>
    </div>
  </div>

  <!-- SVG Chart -->
  {#if smoothedData.length > 1}
    <div class="card chart-card">
      <svg viewBox="0 0 {CHART_W} {CHART_H}" preserveAspectRatio="xMidYMid meet" class="expenditure-chart">
        <!-- Grid lines -->
        {#each yTicks as tick}
          <line
            x1={PAD.left}
            y1={yPos(tick)}
            x2={CHART_W - PAD.right}
            y2={yPos(tick)}
            class="grid-line"
          />
          <text x={PAD.left - 8} y={yPos(tick) + 4} class="axis-label y-label">{tick}</text>
        {/each}

        <!-- X-axis labels -->
        {#each xTicks as tick}
          <text
            x={xPos(tick.i, smoothedData.length)}
            y={CHART_H - PAD.bottom + 20}
            class="axis-label x-label"
          >{tick.label}</text>
        {/each}

        <!-- Flux range shaded area -->
        <path d={fluxAreaPath} class="flux-area" />

        <!-- Expenditure line -->
        <path d={expenditurePath} class="expenditure-line" />

        <!-- Data points (only show for small datasets) -->
        {#if smoothedData.length <= 30}
          {#each smoothedData as point, i}
            <circle
              cx={xPos(i, smoothedData.length)}
              cy={yPos(point.expenditure)}
              r="3"
              class="data-dot"
            />
          {/each}
        {/if}
      </svg>
    </div>
  {:else if smoothedData.length === 0}
    <div class="card">
      <div class="empty-state">
        <p>No expenditure data for this period.</p>
        <p>Log food and weight to see your TDEE estimate.</p>
      </div>
    </div>
  {/if}

  <!-- Time range toggles -->
  <div class="range-toggle">
    {#each RANGE_KEYS as key}
      <button
        class="range-btn"
        class:active={rangeKey === key}
        onclick={() => rangeKey = key}
      >{key}</button>
    {/each}
  </div>
{/if}

<style>
  .loading-center {
    display: flex;
    justify-content: center;
    padding: var(--space-12);
  }

  .date-range {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-top: var(--space-1);
  }

  /* Legend */
  .legend {
    display: flex;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .legend-swatch {
    display: inline-block;
    width: 16px;
    height: 10px;
    border-radius: 2px;
  }

  .flux-swatch {
    background: rgba(90, 156, 236, 0.25);
    border: 1px solid rgba(90, 156, 236, 0.4);
  }

  .line-swatch {
    height: 3px;
    background: var(--color-calories);
  }

  .status-pill {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    background: rgba(90, 156, 236, 0.15);
    color: var(--color-calories);
  }

  .status-pill.holding {
    background: rgba(52, 199, 89, 0.15);
    color: var(--color-success);
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: var(--space-8);
    margin-bottom: var(--space-6);
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-bold);
    line-height: 1;
    color: var(--color-text);
  }

  .stat-unit {
    font-size: var(--font-size-lg);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .stat-value.positive {
    color: var(--color-success);
  }

  .stat-value.negative {
    color: var(--color-error);
  }

  /* Chart */
  .chart-card {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
  }

  .expenditure-chart {
    width: 100%;
    height: auto;
    display: block;
  }

  .expenditure-chart :global(.grid-line) {
    stroke: var(--color-border);
    stroke-width: 0.5;
    stroke-dasharray: 4 4;
  }

  .expenditure-chart :global(.axis-label) {
    font-size: 11px;
    fill: var(--color-text-tertiary);
    font-family: var(--font-family);
  }

  .expenditure-chart :global(.y-label) {
    text-anchor: end;
  }

  .expenditure-chart :global(.x-label) {
    text-anchor: middle;
  }

  .expenditure-chart :global(.flux-area) {
    fill: rgba(90, 156, 236, 0.12);
  }

  .expenditure-chart :global(.expenditure-line) {
    fill: none;
    stroke: var(--color-calories);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .expenditure-chart :global(.data-dot) {
    fill: var(--color-calories);
    stroke: var(--color-surface);
    stroke-width: 1.5;
  }

  /* Range toggle */
  .range-toggle {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }

  .range-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    transition: all var(--transition-fast);
    min-width: 48px;
  }

  .range-btn.active {
    background: var(--color-text);
    color: var(--color-bg);
    border-color: var(--color-text);
  }

  .range-btn:hover:not(.active) {
    background: var(--color-surface-elevated);
    color: var(--color-text);
  }
</style>
