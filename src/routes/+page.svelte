<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { Goals, NutritionSummary, ScaleEntry } from '$lib/api';
  import { localDate, today, daysAgo } from '$lib/date';

  // --- Types ---
  interface DayData {
    date: string;
    dayLabel: string;
    dayName: string;
    dayNum: number;
    isToday: boolean;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    goalCal: number;
    goalPro: number;
    goalFat: number;
    goalCarb: number;
  }

  // --- Constants ---
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
  const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

  const MACROS = [
    { name: 'Calories', color: 'var(--color-calories)', unit: 'kcal', val: (d: DayData) => d.calories, goal: (d: DayData) => d.goalCal },
    { name: 'Protein', color: 'var(--color-protein)', unit: 'g', val: (d: DayData) => d.protein, goal: (d: DayData) => d.goalPro },
    { name: 'Fat', color: 'var(--color-fat)', unit: 'g', val: (d: DayData) => d.fat, goal: (d: DayData) => d.goalFat },
    { name: 'Carbs', color: 'var(--color-carbs)', unit: 'g', val: (d: DayData) => d.carbs, goal: (d: DayData) => d.goalCarb },
  ] as const;

  // --- Week calculation ---
  function getWeekMonday(): Date {
    const now = new Date();
    const dow = now.getDay();
    const off = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + off);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  function goalDayIndex(dateStr: string): number {
    return new Date(dateStr + 'T12:00:00').getDay();
  }

  const todayStr = today();
  const monday = getWeekMonday();
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(localDate(d));
  }
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // --- State ---
  let goals = $state<Goals | null>(null);
  let weekNutrition = $state<NutritionSummary[]>([]);
  let weights = $state<ScaleEntry[]>([]);
  let loading = $state(true);
  let selectedIdx = $state(Math.max(weekDates.indexOf(todayStr), 0));
  let showRemaining = $state(false);

  // --- Data fetching ---
  $effect(() => {
    if (!auth.client) return;
    loading = true;
    Promise.all([
      auth.client.getGoals(),
      auth.client.getNutrition(weekStart, weekEnd),
      auth.client.getWeightEntries(daysAgo(30), todayStr),
    ]).then(([g, n, w]) => {
      goals = g;
      weekNutrition = n;
      weights = w;
    }).catch(() => {}).finally(() => { loading = false; });
  });

  // --- Derived ---
  let days = $derived(weekDates.map((date, i): DayData => {
    const nutr = weekNutrition.find(n => n.date === date);
    const gi = goalDayIndex(date);
    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayName: DAY_FULL[i],
      dayNum: new Date(date + 'T12:00:00').getDate(),
      isToday: date === todayStr,
      calories: nutr?.calories ?? 0,
      protein: nutr?.protein ?? 0,
      fat: nutr?.fat ?? 0,
      carbs: nutr?.carbs ?? 0,
      goalCal: goals?.calories[gi] ?? 0,
      goalPro: goals?.protein[gi] ?? 0,
      goalFat: goals?.fat[gi] ?? 0,
      goalCarb: goals?.carbs[gi] ?? 0,
    };
  }));

  let sel = $derived(days[selectedIdx] ?? days[0]);
  let latestWeight = $derived(weights.length > 0 ? weights[weights.length - 1] : null);

  // --- Helpers ---
  function macroMax(valFn: (d: DayData) => number, goalFn: (d: DayData) => number): number {
    let mx = 1;
    for (const d of days) {
      mx = Math.max(mx, valFn(d), goalFn(d));
    }
    return mx;
  }

  function barH(value: number, max: number): number {
    return max > 0 ? Math.min((value / max) * 100, 100) : 0;
  }

  function targetY(target: number, max: number): number {
    return max > 0 ? Math.min((target / max) * 100, 100) : 0;
  }

  function pct(consumed: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min((consumed / target) * 100, 100);
  }

  function fmt(val: number): string {
    return Math.round(val).toLocaleString();
  }

  function displayVal(consumed: number, target: number): number {
    if (showRemaining) return Math.max(target - consumed, 0);
    return consumed;
  }

  const weekRange = (() => {
    const s = new Date(weekStart + 'T12:00:00');
    const e = new Date(weekEnd + 'T12:00:00');
    const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  })();

  let selDateFormatted = $derived(
    new Date(sel.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  );
</script>

<div class="page-header">
  <div class="header-row">
    <h1 class="page-title">Dashboard</h1>
    <span class="week-range">{weekRange}</span>
  </div>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Day selector strip -->
  <div class="day-strip">
    {#each days as day, i}
      <button
        class="day-btn"
        class:selected={i === selectedIdx}
        class:is-today={day.isToday}
        onclick={() => selectedIdx = i}
      >
        <span class="day-btn-label">{day.dayLabel}</span>
        <span class="day-btn-num">{day.dayNum}</span>
      </button>
    {/each}
  </div>

  <!-- Daily summary -->
  <div class="card daily-card">
    <div class="daily-header">
      <span class="daily-date">{selDateFormatted}</span>
      <button class="toggle-pill" onclick={() => showRemaining = !showRemaining}>
        <span class:active={!showRemaining}>Consumed</span>
        <span class:active={showRemaining}>Remaining</span>
      </button>
    </div>

    <div class="cal-hero">
      <span class="cal-icon">🔥</span>
      <span class="cal-value">{fmt(displayVal(sel.calories, sel.goalCal))}</span>
      <span class="cal-sep">/</span>
      <span class="cal-target">{fmt(sel.goalCal)}</span>
      <span class="cal-unit">kcal</span>
      {#if showRemaining}
        <span class="cal-badge">remaining</span>
      {/if}
    </div>
    <div class="cal-bar-track">
      <div class="cal-bar-fill" style="width:{pct(sel.calories, sel.goalCal)}%"></div>
    </div>

    <div class="daily-macros">
      {#each MACROS.slice(1) as macro}
        {@const consumed = macro.val(sel)}
        {@const target = macro.goal(sel)}
        <div class="daily-macro-row">
          <div class="daily-macro-label">
            <span class="macro-dot" style="background:{macro.color}"></span>
            <span>{macro.name}</span>
          </div>
          <div class="daily-macro-bar-track">
            <div class="daily-macro-bar-fill" style="width:{pct(consumed, target)}%;background:{macro.color}"></div>
          </div>
          <span class="daily-macro-val">
            {fmt(displayVal(consumed, target))}{macro.unit}
            <span class="daily-macro-tgt">/ {fmt(target)}{macro.unit}</span>
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Weekly bar chart -->
  <div class="card weekly-card">
    <h2 class="section-title">This Week</h2>
    <div class="weekly-chart">
      {#each MACROS as macro, mi}
        {@const maxVal = macroMax(macro.val, macro.goal)}
        <div class="chart-row" class:chart-row-cal={mi === 0}>
          <span class="chart-label" style="color:{macro.color}">{macro.name}</span>
          <div class="chart-bars">
            {#each days as day, di}
              {@const consumed = macro.val(day)}
              {@const target = macro.goal(day)}
              <button
                class="bar-cell"
                class:selected={di === selectedIdx}
                onclick={() => selectedIdx = di}
              >
                <div class="bar-slot">
                  {#if consumed > 0}
                    <div
                      class="bar-fill"
                      class:bar-over={consumed > target && target > 0}
                      style="height:{barH(consumed, maxVal)}%;background:{macro.color}"
                    ></div>
                  {/if}
                  {#if target > 0}
                    <div class="bar-target" style="bottom:{targetY(target, maxVal)}%"></div>
                  {/if}
                </div>
                <span class="bar-val">{consumed > 0 ? fmt(consumed) : '–'}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <!-- Day labels row -->
      <div class="chart-row chart-labels-row">
        <span class="chart-label"></span>
        <div class="chart-bars">
          {#each days as day}
            <span class="bar-day-label" class:is-today={day.isToday}>{day.dayLabel}</span>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Insights & Analytics -->
  <h2 class="section-title" style="margin-top:var(--space-2)">Insights & Analytics</h2>
  <div class="insights-row">
    <a href="/expenditure" class="card insight-card">
      <div class="insight-header">
        <span class="insight-title">Expenditure</span>
        <span class="insight-period">Last 7 Days</span>
      </div>
      <div class="insight-sparkline" style="color:var(--color-calories)">
        <svg viewBox="0 0 120 40" preserveAspectRatio="none" width="100%" height="40">
          <polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            points="{days.map((d, i) => `${i * 20},${40 - (d.goalCal > 0 ? d.goalCal / macroMax(m => m.goalCal, m => m.goalCal) * 36 : 20)}`).join(' ')}" />
        </svg>
      </div>
      <div class="insight-footer">
        <span class="insight-value">{goals?.tdee ? fmt(goals.tdee) : '–'}</span>
        <span class="insight-unit">kcal</span>
        <span class="insight-arrow">›</span>
      </div>
    </a>
    <a href="/weight" class="card insight-card">
      <div class="insight-header">
        <span class="insight-title">Weight Trend</span>
        <span class="insight-period">{weights.length > 0 ? `Last ${weights.length} Entries` : 'No data'}</span>
      </div>
      <div class="insight-sparkline" style="color:var(--color-primary)">
        <svg viewBox="0 0 120 40" preserveAspectRatio="none" width="100%" height="40">
          {#if weights.length >= 2}
            {@const minW = Math.min(...weights.slice(-7).map(w => w.weight))}
            {@const maxW = Math.max(...weights.slice(-7).map(w => w.weight))}
            {@const range = maxW - minW || 1}
            <polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              points="{weights.slice(-7).map((w, i, a) => `${i * (120 / Math.max(a.length - 1, 1))},${40 - ((w.weight - minW) / range * 36 + 2)}`).join(' ')}" />
          {/if}
        </svg>
      </div>
      <div class="insight-footer">
        <span class="insight-value">{latestWeight ? latestWeight.weight.toFixed(1) : '–'}</span>
        <span class="insight-unit">{latestWeight ? 'kg' : ''}</span>
        <span class="insight-arrow">›</span>
      </div>
    </a>
  </div>

  <!-- Quick stats -->
  <div class="stats-row">
    {#if goals?.tdee}
      <div class="card stat-card">
        <span class="stat-label">Estimated TDEE</span>
        <span class="stat-value">{fmt(goals.tdee)}<span class="stat-unit"> kcal/day</span></span>
      </div>
    {/if}

    {#if goals?.programType}
      <div class="card stat-card">
        <span class="stat-label">Program</span>
        <span class="stat-value stat-program">{goals.programStyle ?? ''} {goals.programType}</span>
      </div>
    {/if}

    <div class="card stat-card">
      <span class="stat-label">Quick Actions</span>
      <div class="stat-actions">
        <a href="/search" class="btn btn-primary btn-sm">Log Food</a>
        <a href="/weight" class="btn btn-secondary btn-sm">Log Weight</a>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Loading */
  .loading-center { display: flex; justify-content: center; padding: var(--space-12); }

  /* Header */
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .week-range {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
  }

  /* Day selector strip */
  .day-strip {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }
  .day-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .day-btn:hover { background: var(--color-surface-elevated); }
  .day-btn.selected {
    border-color: var(--color-text-secondary);
    background: var(--color-surface-elevated);
  }
  .day-btn-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
    text-transform: uppercase;
  }
  .day-btn-num {
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    font-variant-numeric: tabular-nums;
  }
  .day-btn.is-today .day-btn-num {
    background: var(--color-primary);
    color: #000;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-bold);
  }

  /* Daily summary card */
  .daily-card { margin-bottom: var(--space-6); }
  .daily-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-5);
  }
  .daily-date {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
  }

  /* Segmented toggle */
  .toggle-pill {
    display: flex;
    background: var(--color-surface-elevated);
    border-radius: var(--radius-full);
    padding: 2px;
    cursor: pointer;
  }
  .toggle-pill span {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-tertiary);
    transition: all var(--transition-fast);
    user-select: none;
  }
  .toggle-pill span.active {
    background: var(--color-border);
    color: var(--color-text);
  }

  /* Calorie hero display */
  .cal-hero {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }
  .cal-icon { font-size: var(--font-size-xl); }
  .cal-value {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-bold);
    color: var(--color-calories);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .cal-sep {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-lg);
  }
  .cal-target {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .cal-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .cal-badge {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-style: italic;
  }
  .cal-bar-track {
    height: 6px;
    background: var(--color-surface-elevated);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: var(--space-6);
  }
  .cal-bar-fill {
    height: 100%;
    background: var(--color-calories);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* Daily macro rows */
  .daily-macros {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .daily-macro-row {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }
  .daily-macro-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
  }
  .macro-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .daily-macro-bar-track {
    height: 8px;
    background: var(--color-surface-elevated);
    border-radius: 4px;
    overflow: hidden;
  }
  .daily-macro-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .daily-macro-val {
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    min-width: 110px;
    text-align: right;
  }
  .daily-macro-tgt {
    color: var(--color-text-secondary);
    font-weight: var(--font-normal);
  }

  /* Weekly chart */
  .weekly-card { margin-bottom: var(--space-6); }
  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-5);
  }
  .weekly-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* Chart row */
  .chart-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: end;
    gap: var(--space-3);
  }
  .chart-label {
    font-size: 0.6875rem;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-bottom: var(--space-5);
    white-space: nowrap;
  }
  .chart-bars {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--space-1);
  }

  /* Bar cells */
  .bar-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    padding: var(--space-1) 2px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid transparent;
    transition: all var(--transition-fast);
  }
  .bar-cell:hover { background: rgba(255, 255, 255, 0.03); }
  .bar-cell.selected {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--color-border);
  }

  /* Bar slot (container for the vertical bar) */
  .bar-slot {
    width: 100%;
    height: 72px;
    position: relative;
  }
  .chart-row-cal .bar-slot { height: 96px; }

  /* Bar fill */
  @keyframes grow-up {
    from { transform: scaleY(0); }
    to { transform: scaleY(1); }
  }
  .bar-fill {
    position: absolute;
    bottom: 0;
    left: 8%;
    right: 8%;
    border-radius: 3px 3px 1px 1px;
    transition: height 0.3s ease;
    animation: grow-up 0.4s ease-out;
    transform-origin: bottom;
  }
  .bar-over { filter: brightness(1.2); }

  /* Target marker */
  .bar-target {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 1px;
    pointer-events: none;
  }

  /* Bar value label */
  .bar-val {
    font-size: 0.625rem;
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    line-height: 1;
  }

  /* Day labels row */
  .chart-labels-row { align-items: center; margin-top: var(--space-1); }
  .bar-day-label {
    text-align: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
  }
  .bar-day-label.is-today {
    color: var(--color-text);
    font-weight: var(--font-bold);
  }

  /* Stats row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .stat-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stat-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-bold);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .stat-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-normal);
  }
  .stat-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .stat-empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .stat-program {
    font-size: var(--font-size-lg);
    text-transform: capitalize;
  }
  .stat-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  /* Insights & Analytics */
  .insights-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .insight-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition-fast), border-color var(--transition-fast);
  }
  .insight-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-hover, var(--color-primary));
  }
  .insight-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .insight-title {
    font-weight: var(--font-semibold);
    font-size: var(--font-size-base);
  }
  .insight-period {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .insight-sparkline {
    height: 40px;
    overflow: hidden;
  }
  .insight-footer {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }
  .insight-value {
    font-size: var(--font-size-xl);
    font-weight: var(--font-bold);
  }
  .insight-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .insight-arrow {
    margin-left: auto;
    font-size: var(--font-size-xl);
    color: var(--color-text-tertiary);
  }
</style>
