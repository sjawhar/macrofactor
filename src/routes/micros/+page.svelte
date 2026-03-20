<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { NutritionSummary } from '$lib/api';
  import { today, daysAgo } from '$lib/date';

  let rangeLabel = $state<'1' | '7' | '30' | '90' | '365'>('7');
  let entries = $state<NutritionSummary[]>([]);
  let loading = $state(true);

  async function loadData() {
    if (!auth.client) return;
    loading = true;
    const days = parseInt(rangeLabel, 10);
    try {
      entries = await auth.client.getNutrition(daysAgo(days === 1 ? 0 : days), today());
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

  function avg(key: keyof NutritionSummary): number {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((s, e) => s + (Number(e[key]) || 0), 0);
    return sum / entries.length;
  }

  const micros = $derived([
    { label: 'Fiber', val: avg('fiber'), unit: 'g', target: null },
    { label: 'Sugar', val: avg('sugar'), unit: 'g', target: null },
  ]);
</script>

<div class="page-header">
  <h1 class="page-title">Micronutrients</h1>
  <div class="range-toggle">
    <button class="pill-btn" class:active={rangeLabel === '1'} onclick={() => (rangeLabel = '1')}>Today</button>
    <button class="pill-btn" class:active={rangeLabel === '7'} onclick={() => (rangeLabel = '7')}>1 Week</button>
    <button class="pill-btn" class:active={rangeLabel === '30'} onclick={() => (rangeLabel = '30')}>1 Month</button>
    <button class="pill-btn" class:active={rangeLabel === '90'} onclick={() => (rangeLabel = '90')}>3 Months</button>
  </div>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <div class="card micro-card">
    <h2 class="section-title">Overview</h2>
    {#if entries.length === 0}
      <div class="empty-state"><p>No data for this period</p></div>
    {:else}
      <div class="micro-list">
        {#each micros as m}
          <div class="micro-item">
            <div class="micro-header">
              <span class="micro-label">{m.label}</span>
              <div class="micro-values">
                <span class="micro-val">{m.val.toFixed(1)} {m.unit}</span>
                {#if m.target}
                  <span class="micro-target">Target: {m.target}</span>
                {/if}
              </div>
            </div>
            <div class="micro-bar-track">
              <div
                class="micro-bar-fill"
                style="width: {m.target ? Math.min((m.val / m.target) * 100, 100) : 0}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
      <p class="note">
        Note: MacroFactor API currently only exposes Sugar and Fiber in the nutrition summary endpoint.
      </p>
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

  .micro-card {
    margin-bottom: var(--space-4);
  }
  .micro-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .micro-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .micro-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .micro-label {
    font-size: var(--font-size-base);
    font-weight: var(--font-medium);
  }
  .micro-values {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
  }
  .micro-val {
    font-weight: var(--font-bold);
  }
  .micro-target {
    color: var(--color-text-secondary);
  }

  .micro-bar-track {
    height: 8px;
    background: var(--color-surface-elevated);
    border-radius: 4px;
    overflow: hidden;
  }
  .micro-bar-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .note {
    margin-top: var(--space-6);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-align: center;
  }
</style>
