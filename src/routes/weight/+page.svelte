<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { ScaleEntry } from '$lib/api';
  import { today, daysAgo } from '$lib/date';

  // ---------------------------------------------------------------------------
  // Form state (existing)
  // ---------------------------------------------------------------------------
  let weightInput = $state<number | undefined>(undefined);
  let bodyFatInput = $state<number | undefined>(undefined);
  let dateInput = $state(today());
  let saving = $state(false);
  let successMsg = $state('');

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  let allEntries = $state<ScaleEntry[]>([]);
  let loading = $state(true);

  async function loadEntries() {
    if (!auth.client) return;
    loading = true;
    try {
      allEntries = await auth.client.getWeightEntries(daysAgo(1095), today());
    } catch {
      allEntries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.client) loadEntries();
  });

  // ---------------------------------------------------------------------------
  // Time range
  // ---------------------------------------------------------------------------
  type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';
  const ranges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'All'];
  let selectedRange = $state<TimeRange>('1M');

  const rangeDays: Record<TimeRange, number> = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    All: 1095,
  };

  let entries = $derived.by(() => {
    if (selectedRange === 'All') return allEntries;
    const cutoff = daysAgo(rangeDays[selectedRange]);
    return allEntries.filter((e) => e.date >= cutoff);
  });

  // ---------------------------------------------------------------------------
  // Toggle visibility
  // ---------------------------------------------------------------------------
  let showScaleWeight = $state(true);
  let showTrendWeight = $state(true);

  // ---------------------------------------------------------------------------
  // EMA trend
  // ---------------------------------------------------------------------------
  let trendWeights = $derived.by(() => {
    if (entries.length === 0) return [];
    const alpha = 2 / (7 + 1); // span = 7
    const trend: number[] = [entries[0].weight];
    for (let i = 1; i < entries.length; i++) {
      trend.push(alpha * entries[i].weight + (1 - alpha) * trend[i - 1]);
    }
    return trend;
  });

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------
  let avgWeight = $derived(entries.length > 0 ? entries.reduce((s, e) => s + e.weight, 0) / entries.length : 0);

  let weightDiff = $derived(entries.length >= 2 ? entries[entries.length - 1].weight - entries[0].weight : 0);

  let dateRangeStr = $derived.by(() => {
    if (entries.length === 0) return '';
    const s = entries[0].date;
    const e = entries[entries.length - 1].date;
    return formatDateRange(s, e);
  });

  // ---------------------------------------------------------------------------
  // Chart dimensions
  // ---------------------------------------------------------------------------
  const CW = 700;
  const CH = 280;
  const PT = 30;
  const PR = 20;
  const PB = 45;
  const PL = 55;
  const PW = CW - PL - PR;
  const PH = CH - PT - PB;

  // ---------------------------------------------------------------------------
  // Chart scales
  // ---------------------------------------------------------------------------
  let chartMin = $derived.by(() => {
    if (entries.length === 0) return 0;
    const vals = [...entries.map((e) => e.weight), ...trendWeights];
    return Math.floor(Math.min(...vals) * 2) / 2 - 0.5;
  });

  let chartMax = $derived.by(() => {
    if (entries.length === 0) return 1;
    const vals = [...entries.map((e) => e.weight), ...trendWeights];
    return Math.ceil(Math.max(...vals) * 2) / 2 + 0.5;
  });

  let yRange = $derived(chartMax - chartMin || 1);

  let yTicks = $derived.by(() => {
    const ticks: number[] = [];
    const step = yRange > 10 ? 2 : yRange > 5 ? 1 : 0.5;
    let v = Math.ceil(chartMin / step) * step;
    while (v <= chartMax) {
      ticks.push(Math.round(v * 10) / 10);
      v += step;
    }
    return ticks;
  });

  let xTickIndices = $derived.by(() => {
    if (entries.length < 2) return [];
    const count = Math.min(entries.length, 7);
    const step = Math.max(1, Math.floor((entries.length - 1) / (count - 1)));
    const ticks: number[] = [];
    for (let i = 0; i < entries.length; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== entries.length - 1) ticks.push(entries.length - 1);
    return ticks;
  });

  // ---------------------------------------------------------------------------
  // Coordinate helpers (read reactive values — safe in $derived contexts)
  // ---------------------------------------------------------------------------
  function xAt(i: number): number {
    return PL + (i / Math.max(entries.length - 1, 1)) * PW;
  }

  function yAt(w: number): number {
    return PT + (1 - (w - chartMin) / yRange) * PH;
  }

  // ---------------------------------------------------------------------------
  // SVG paths
  // ---------------------------------------------------------------------------
  let scalePath = $derived.by(() => {
    if (entries.length < 2) return '';
    return entries.map((e, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(e.weight).toFixed(1)}`).join(' ');
  });

  let trendPath = $derived.by(() => {
    if (trendWeights.length < 2) return '';
    return trendWeights.map((w, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(w).toFixed(1)}`).join(' ');
  });

  // ---------------------------------------------------------------------------
  // Hover
  // ---------------------------------------------------------------------------
  let hoveredIndex = $state<number | null>(null);

  function handleChartHover(evt: MouseEvent) {
    const svg = evt.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const mouseX = (evt.clientX - rect.left) * scaleX;

    if (mouseX < PL || mouseX > CW - PR || entries.length === 0) {
      hoveredIndex = null;
      return;
    }

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const dist = Math.abs(xAt(i) - mouseX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    hoveredIndex = bestIdx;
  }

  function handleChartLeave() {
    hoveredIndex = null;
  }

  // ---------------------------------------------------------------------------
  // Insights
  // ---------------------------------------------------------------------------
  function dateDiffDays(a: string, b: string): number {
    const da = new Date(a + 'T12:00:00');
    const db = new Date(b + 'T12:00:00');
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  interface WeightChange {
    label: string;
    days: number;
    change: number;
    direction: 'Increase' | 'Decrease' | 'No Change';
    rate: number;
  }

  let insights = $derived.by((): WeightChange[] => {
    if (allEntries.length < 2) return [];
    const periods = [
      { label: '3-day', days: 3 },
      { label: '7-day', days: 7 },
      { label: '14-day', days: 14 },
      { label: '30-day', days: 30 },
    ];
    const latest = allEntries[allEntries.length - 1];
    const results: WeightChange[] = [];

    for (const p of periods) {
      const cutoffDate = daysAgo(p.days);
      let closest: ScaleEntry | undefined;
      let closestDiff = Infinity;
      for (const e of allEntries) {
        const diff = Math.abs(dateDiffDays(e.date, cutoffDate));
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = e;
        }
      }
      if (!closest || closestDiff > p.days / 2) continue;
      if (closest.date === latest.date) continue;

      const change = latest.weight - closest.weight;
      const actualDays = dateDiffDays(closest.date, latest.date);
      const rate = actualDays > 0 ? change / (actualDays / 7) : 0;
      const direction: 'Increase' | 'Decrease' | 'No Change' =
        change > 0.05 ? 'Increase' : change < -0.05 ? 'Decrease' : 'No Change';

      results.push({ label: p.label, days: p.days, change, direction, rate });
    }
    return results;
  });

  // ---------------------------------------------------------------------------
  // Existing actions
  // ---------------------------------------------------------------------------
  async function logWeight() {
    if (!auth.client || !weightInput) return;
    saving = true;
    successMsg = '';
    try {
      await auth.client.logWeight(dateInput, weightInput, bodyFatInput);
      successMsg = `Logged ${weightInput} kg`;
      weightInput = undefined;
      bodyFatInput = undefined;
      await loadEntries();
    } finally {
      saving = false;
    }
  }

  async function deleteEntry(date: string) {
    if (!auth.client || !confirm(`Delete weight entry for ${date}?`)) return;
    await auth.client.deleteWeightEntry(date);
    allEntries = allEntries.filter((e) => e.date !== date);
  }

  let sorted = $derived([...allEntries].reverse());

  // ---------------------------------------------------------------------------
  // Formatters
  // ---------------------------------------------------------------------------
  function fmtShortDate(d: string): string {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDateRange(start: string, end: string): string {
    const sd = new Date(start + 'T12:00:00');
    const ed = new Date(end + 'T12:00:00');
    if (sd.getFullYear() === ed.getFullYear()) {
      const s = sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${s} – ${e}`;
    }
    const s = sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const e = ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
  }

  function signedNum(n: number): string {
    return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
  }
</script>

<div class="page-header">
  <h1 class="page-title">Weight Trend</h1>
</div>

{#if successMsg}
  <div class="message message-success">{successMsg}</div>
{/if}

<!-- Log Weight -->
<div class="card log-card">
  <h2 class="section-title">Log Weight</h2>
  <div class="log-row">
    <div class="field">
      <label>Weight (kg)</label>
      <input type="number" bind:value={weightInput} step="0.1" placeholder="75.0" />
    </div>
    <div class="field">
      <label>Body Fat % (optional)</label>
      <input type="number" bind:value={bodyFatInput} step="0.1" placeholder="15.0" />
    </div>
    <div class="field">
      <label>Date</label>
      <input type="date" bind:value={dateInput} />
    </div>
    <button class="btn btn-primary log-btn" onclick={logWeight} disabled={saving || !weightInput}>
      {saving ? 'Saving…' : 'Log Weight'}
    </button>
  </div>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Statistics header -->
  {#if entries.length > 0}
    <div class="card stats-card">
      <div class="stats-row">
        <div class="stat-block">
          <div class="stat-label">Average</div>
          <div class="stat-value">{avgWeight.toFixed(1)} <span class="stat-unit">kg</span></div>
        </div>
        <div class="stat-block">
          <div class="stat-label">Difference</div>
          <div class="stat-value" class:stat-positive={weightDiff > 0.05} class:stat-negative={weightDiff < -0.05}>
            {signedNum(weightDiff)} <span class="stat-unit">kg</span>
          </div>
        </div>
      </div>
      <div class="date-range">{dateRangeStr}</div>
    </div>
  {/if}

  <!-- Chart -->
  {#if entries.length > 1}
    <div class="card chart-card">
      <div class="chart-controls">
        <div class="chart-toggles">
          <button
            class="toggle-btn"
            class:toggle-active={showScaleWeight}
            onclick={() => (showScaleWeight = !showScaleWeight)}
          >
            <span class="toggle-dot toggle-dot-scale"></span>
            Scale Weight
          </button>
          <button
            class="toggle-btn"
            class:toggle-active={showTrendWeight}
            onclick={() => (showTrendWeight = !showTrendWeight)}
          >
            <span class="toggle-dot toggle-dot-trend"></span>
            Trend Weight
          </button>
        </div>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg viewBox="0 0 {CW} {CH}" class="weight-chart" onmousemove={handleChartHover} onmouseleave={handleChartLeave}>
        <!-- Grid lines -->
        {#each yTicks as tick}
          {@const y = yAt(tick)}
          <line x1={PL} y1={y} x2={CW - PR} y2={y} class="grid-line" />
          <text x={PL - 8} y={y + 4} class="axis-label axis-label-y">{tick.toFixed(1)}</text>
        {/each}

        <!-- X axis labels -->
        {#each xTickIndices as idx}
          {@const x = xAt(idx)}
          <text {x} y={PT + PH + 20} class="axis-label axis-label-x">{fmtShortDate(entries[idx].date)}</text>
        {/each}

        <!-- Trend weight line (drawn first, behind scale) -->
        {#if showTrendWeight && trendPath}
          <path d={trendPath} class="trend-line" />
        {/if}

        <!-- Scale weight line + dots -->
        {#if showScaleWeight && scalePath}
          <path d={scalePath} class="scale-line" />
          {#each entries as entry, i}
            <circle cx={xAt(i)} cy={yAt(entry.weight)} r="3" class="scale-dot" />
          {/each}
        {/if}

        <!-- Hover overlay (invisible rect to capture mouse events) -->
        <rect x={PL} y={PT} width={PW} height={PH} fill="transparent" />

        <!-- Hover elements -->
        {#if hoveredIndex !== null}
          {@const idx = hoveredIndex}
          {@const e = entries[idx]}
          {@const tw = trendWeights[idx]}
          {@const cx = xAt(idx)}
          {@const tooltipW = 132}
          {@const tooltipH = 54}
          {@const tooltipX = cx > CW / 2 ? cx - tooltipW - 10 : cx + 10}
          {@const tooltipY = Math.max(PT, Math.min(yAt(e.weight) - 30, CH - PB - tooltipH))}

          <!-- Vertical line -->
          <line x1={cx} y1={PT} x2={cx} y2={PT + PH} class="hover-line" />

          <!-- Highlighted dots -->
          {#if showScaleWeight}
            <circle {cx} cy={yAt(e.weight)} r="5" class="scale-dot-highlight" />
          {/if}
          {#if showTrendWeight}
            <circle {cx} cy={yAt(tw)} r="5" class="trend-dot-highlight" />
          {/if}

          <!-- Tooltip -->
          <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="6" class="tooltip-bg" />
          <text x={tooltipX + 10} y={tooltipY + 16} class="tooltip-date">{fmtShortDate(e.date)}</text>
          <circle cx={tooltipX + 14} cy={tooltipY + 29} r="3.5" class="scale-dot" />
          <text x={tooltipX + 24} y={tooltipY + 33} class="tooltip-scale">{e.weight.toFixed(1)} kg</text>
          <circle cx={tooltipX + 14} cy={tooltipY + 45} r="3.5" class="trend-dot-inline" />
          <text x={tooltipX + 24} y={tooltipY + 49} class="tooltip-trend">{tw.toFixed(1)} kg</text>
        {/if}
      </svg>

      <!-- Range selector -->
      <div class="range-selector">
        {#each ranges as r}
          <button class="range-btn" class:range-active={selectedRange === r} onclick={() => (selectedRange = r)}>
            {r}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Insights & Data -->
  {#if insights.length > 0}
    <div class="card insights-card">
      <h2 class="section-title">Insights & Data</h2>
      <h3 class="subsection-title">Weight Changes</h3>
      <div class="insights-grid">
        {#each insights as ins}
          <div class="insight-item">
            <div class="insight-label">{ins.label}</div>
            <div
              class="insight-value"
              class:direction-increase={ins.direction === 'Increase'}
              class:direction-decrease={ins.direction === 'Decrease'}
            >
              {signedNum(ins.change)} kg
            </div>
            <div
              class="insight-direction"
              class:direction-increase={ins.direction === 'Increase'}
              class:direction-decrease={ins.direction === 'Decrease'}
              class:direction-neutral={ins.direction === 'No Change'}
            >
              {ins.direction}
            </div>
            <div class="insight-rate">{signedNum(ins.rate)} kg/week</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- History -->
  <div class="card history-card">
    <h2 class="section-title">History</h2>
    {#if sorted.length === 0}
      <p class="empty-state">No weight entries yet</p>
    {:else}
      <table class="weight-table">
        <thead>
          <tr><th>Date</th><th>Weight</th><th>Body Fat</th><th></th></tr>
        </thead>
        <tbody>
          {#each sorted as entry (entry.date)}
            <tr>
              <td>{fmtShortDate(entry.date)}</td>
              <td class="weight-cell">{entry.weight.toFixed(1)} kg</td>
              <td>{entry.bodyFat != null ? entry.bodyFat.toFixed(1) + '%' : '—'}</td>
              <td>
                <button class="delete-btn-sm" onclick={() => deleteEntry(entry.date)} title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    /></svg
                  >
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  /* Layout */
  .loading-center {
    display: flex;
    justify-content: center;
    padding: var(--space-12);
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  .subsection-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
  }

  /* Log card (existing) */
  .log-card {
    margin-bottom: var(--space-4);
  }
  .log-row {
    display: flex;
    gap: var(--space-4);
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .log-row .field {
    flex: 1;
    min-width: 140px;
  }
  .log-row .field label {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }
  .log-btn {
    align-self: flex-end;
    margin-bottom: 0;
    height: 44px;
  }

  /* Stats card */
  .stats-card {
    margin-bottom: var(--space-4);
  }

  .stats-row {
    display: flex;
    gap: var(--space-8);
    margin-bottom: var(--space-2);
  }

  .stat-block {
    display: flex;
    flex-direction: column;
  }

  .stat-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-1);
  }

  .stat-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-bold);
    line-height: 1.2;
  }

  .stat-unit {
    font-size: var(--font-size-sm);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
  }

  .stat-positive {
    color: var(--color-protein);
  }
  .stat-negative {
    color: var(--color-calories);
  }

  .date-range {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  /* Chart card */
  .chart-card {
    margin-bottom: var(--space-4);
  }

  .chart-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }

  .chart-toggles {
    display: flex;
    gap: var(--space-3);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    background: var(--color-surface-elevated);
    color: var(--color-text-secondary);
    transition: opacity var(--transition-fast);
    opacity: 0.4;
  }

  .toggle-btn.toggle-active {
    opacity: 1;
  }

  .toggle-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .toggle-dot-scale {
    background: var(--color-carbs);
  }
  .toggle-dot-trend {
    background: var(--color-calories);
  }

  /* SVG chart */
  .weight-chart {
    width: 100%;
    height: auto;
    display: block;
    cursor: crosshair;
  }

  .weight-chart .grid-line {
    stroke: var(--color-border);
    stroke-width: 0.5;
    stroke-dasharray: 4, 4;
  }

  .weight-chart .axis-label {
    font-size: 11px;
    fill: var(--color-text-tertiary);
    font-family: inherit;
  }

  .weight-chart .axis-label-y {
    text-anchor: end;
  }
  .weight-chart .axis-label-x {
    text-anchor: middle;
  }

  .weight-chart .scale-line {
    fill: none;
    stroke: var(--color-carbs);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .weight-chart .scale-dot {
    fill: var(--color-carbs);
  }
  .weight-chart .scale-dot-highlight {
    fill: var(--color-carbs);
    stroke: var(--color-surface);
    stroke-width: 2;
  }

  .weight-chart .trend-line {
    fill: none;
    stroke: var(--color-calories);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .weight-chart .trend-dot-inline {
    fill: var(--color-calories);
  }
  .weight-chart .trend-dot-highlight {
    fill: var(--color-calories);
    stroke: var(--color-surface);
    stroke-width: 2;
  }

  .weight-chart .hover-line {
    stroke: var(--color-text-tertiary);
    stroke-width: 1;
    stroke-dasharray: 4, 4;
  }

  .weight-chart .tooltip-bg {
    fill: var(--color-surface-elevated);
    stroke: var(--color-border);
    stroke-width: 1;
  }

  .weight-chart .tooltip-date {
    font-size: 11px;
    font-weight: 600;
    fill: var(--color-text);
    font-family: inherit;
  }

  .weight-chart .tooltip-scale {
    font-size: 11px;
    fill: var(--color-carbs);
    font-family: inherit;
  }

  .weight-chart .tooltip-trend {
    font-size: 11px;
    fill: var(--color-calories);
    font-family: inherit;
  }

  /* Range selector */
  .range-selector {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    margin-top: var(--space-4);
  }

  .range-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    background: transparent;
    color: var(--color-text-tertiary);
    transition: all var(--transition-fast);
  }

  .range-btn:hover {
    color: var(--color-text-secondary);
  }

  .range-btn.range-active {
    background: var(--color-surface-elevated);
    color: var(--color-text);
  }

  /* Insights */
  .insights-card {
    margin-bottom: var(--space-4);
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--space-4);
  }

  .insight-item {
    text-align: center;
    padding: var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-sm);
  }

  .insight-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: var(--space-2);
  }

  .insight-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    margin-bottom: var(--space-1);
  }

  .insight-direction {
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    margin-bottom: var(--space-1);
  }

  .insight-rate {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .direction-increase {
    color: var(--color-protein);
  }
  .direction-decrease {
    color: var(--color-calories);
  }
  .direction-neutral {
    color: var(--color-text-secondary);
  }

  /* History (existing) */
  .history-card {
    margin-bottom: var(--space-4);
  }
  .weight-table {
    width: 100%;
    border-collapse: collapse;
  }
  .weight-table th {
    text-align: left;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }
  .weight-table td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
  }
  .weight-table tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.02);
  }
  .weight-cell {
    font-weight: var(--font-semibold);
  }
  .delete-btn-sm {
    padding: var(--space-1);
    color: var(--color-text-tertiary);
    border-radius: var(--radius-sm);
  }
  .delete-btn-sm:hover {
    color: var(--color-error);
    background: rgba(255, 59, 48, 0.1);
  }
</style>
