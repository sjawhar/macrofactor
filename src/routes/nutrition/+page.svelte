<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { NutritionSummary, Goals } from '$lib/api';
  import { today, daysAgo } from '$lib/date';

  let rangeLabel = $state<'7' | '30' | '90'>('7');
  let entries = $state<NutritionSummary[]>([]);
  let goals = $state<Goals | null>(null);
  let loading = $state(true);

  async function loadData() {
    if (!auth.client) return;
    loading = true;
    const days = parseInt(rangeLabel, 10);
    try {
      const [n, g] = await Promise.all([auth.client.getNutrition(daysAgo(days), today()), auth.client.getGoals()]);
      entries = n;
      goals = g;
    } catch {
      entries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.client) loadData();
  });
  $effect(() => {
    rangeLabel;
    if (auth.client) loadData();
  });

  let sorted = $derived([...entries].reverse());
  let calTarget = $derived(goals ? (goals.calories[goals.calories.length - 1] ?? 0) : 0);

  // Averages
  let avgCal = $derived(entries.length > 0 ? entries.reduce((s, e) => s + (e.calories ?? 0), 0) / entries.length : 0);
  let avgPro = $derived(entries.length > 0 ? entries.reduce((s, e) => s + (e.protein ?? 0), 0) / entries.length : 0);
  let avgCarb = $derived(entries.length > 0 ? entries.reduce((s, e) => s + (e.carbs ?? 0), 0) / entries.length : 0);
  let avgFat = $derived(entries.length > 0 ? entries.reduce((s, e) => s + (e.fat ?? 0), 0) / entries.length : 0);

  // Bar chart
  let maxCal = $derived(
    entries.length > 0 ? Math.max(...entries.map((e) => e.calories ?? 0), calTarget) : calTarget || 2500
  );

  function fmtShort(d: string): string {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="page-header">
  <h1 class="page-title">Nutrition History</h1>
  <div class="range-toggle">
    <button class="pill-btn" class:active={rangeLabel === '7'} onclick={() => (rangeLabel = '7')}>7 days</button>
    <button class="pill-btn" class:active={rangeLabel === '30'} onclick={() => (rangeLabel = '30')}>30 days</button>
    <button class="pill-btn" class:active={rangeLabel === '90'} onclick={() => (rangeLabel = '90')}>90 days</button>
  </div>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Averages -->
  <div class="avg-row">
    <div class="card avg-card">
      <span class="avg-label">Avg Calories</span>
      <span class="avg-value macro-calories">{Math.round(avgCal)}</span>
    </div>
    <div class="card avg-card">
      <span class="avg-label">Avg Protein</span>
      <span class="avg-value macro-protein">{Math.round(avgPro)}g</span>
    </div>
    <div class="card avg-card">
      <span class="avg-label">Avg Carbs</span>
      <span class="avg-value macro-carbs">{Math.round(avgCarb)}g</span>
    </div>
    <div class="card avg-card">
      <span class="avg-label">Avg Fat</span>
      <span class="avg-value macro-fat">{Math.round(avgFat)}g</span>
    </div>
  </div>

  <!-- Bar Chart -->
  {#if entries.length > 0}
    <div class="card chart-card">
      <h2 class="section-title">Daily Calories</h2>
      <div class="bar-chart">
        {#if calTarget > 0}
          <div class="target-line" style="bottom: {(calTarget / maxCal) * 100}%">
            <span class="target-line-label">{Math.round(calTarget)}</span>
          </div>
        {/if}
        <div class="bars">
          {#each entries as entry}
            {@const cal = entry.calories ?? 0}
            {@const pct = maxCal > 0 ? (cal / maxCal) * 100 : 0}
            <div class="bar-col" title="{fmtShort(entry.date)}: {Math.round(cal)} kcal">
              <div class="bar" style="height: {pct}%; background: var(--color-calories);"></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Table -->
  <div class="card table-card">
    <h2 class="section-title">Daily Breakdown</h2>
    {#if sorted.length === 0}
      <div class="empty-state"><p>No nutrition data for this period</p></div>
    {:else}
      <table class="nut-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Calories</th>
            <th>Protein</th>
            <th>Carbs</th>
            <th>Fat</th>
            <th>Fiber</th>
            <th>Sugar</th>
          </tr>
        </thead>
        <tbody>
          {#each sorted as entry (entry.date)}
            <tr>
              <td>{fmtShort(entry.date)}</td>
              <td class="macro-calories">{entry.calories != null ? Math.round(entry.calories) : '—'}</td>
              <td class="macro-protein">{entry.protein != null ? Math.round(entry.protein) + 'g' : '—'}</td>
              <td class="macro-carbs">{entry.carbs != null ? Math.round(entry.carbs) + 'g' : '—'}</td>
              <td class="macro-fat">{entry.fat != null ? Math.round(entry.fat) + 'g' : '—'}</td>
              <td>{entry.fiber != null ? Math.round(entry.fiber) + 'g' : '—'}</td>
              <td>{entry.sugar != null ? Math.round(entry.sugar) + 'g' : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
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

  .range-toggle {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .pill-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    transition: all var(--transition-fast);
  }
  .pill-btn.active {
    background: var(--color-text);
    color: var(--color-bg);
    border-color: var(--color-text);
  }

  .avg-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .avg-card {
    text-align: center;
  }
  .avg-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    margin-bottom: var(--space-2);
  }
  .avg-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-bold);
  }

  .chart-card {
    margin-bottom: var(--space-4);
  }
  .bar-chart {
    position: relative;
    height: 200px;
  }
  .bars {
    display: flex;
    align-items: flex-end;
    height: 100%;
    gap: 2px;
  }
  .bar-col {
    flex: 1;
    display: flex;
    align-items: flex-end;
    height: 100%;
  }
  .bar {
    width: 100%;
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }
  .target-line {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 2px dashed var(--color-text-tertiary);
    z-index: 1;
  }
  .target-line-label {
    position: absolute;
    right: 0;
    top: -18px;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .table-card {
    margin-bottom: var(--space-4);
  }
  .nut-table {
    width: 100%;
    border-collapse: collapse;
  }
  .nut-table th {
    text-align: left;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }
  .nut-table td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
  }
  .nut-table tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.02);
  }
</style>
