<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import type { Goals } from '$lib/api';

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const RING_RADIUS = 76;
  const RING_STROKE = 8;
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  let goals = $state<Goals | null>(null);
  let profile = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let activeTab = $state<'goal' | 'checkin'>('goal');

  $effect(() => {
    if (!auth.client) return;
    loading = true;
    Promise.all([
      auth.client.getGoals(),
      auth.client.getProfile(),
    ]).then(([g, p]) => {
      goals = g;
      profile = p;
    }).catch(() => {}).finally(() => { loading = false; });
  });

  // --- Check-in countdown ---
  let daysUntilCheckin = $derived.by(() => {
    if (!profile) return 7;
    const planner = (profile.planner ?? {}) as Record<string, unknown>;
    const lastCheckin = planner.checkinDismissed ?? planner.timeOfLastTdeeUpdate;
    if (lastCheckin == null || typeof lastCheckin !== 'number') return 7;
    const lastMs = lastCheckin > 1e12 ? lastCheckin : lastCheckin * 1000;
    const daysSince = Math.floor((Date.now() - lastMs) / (1000 * 60 * 60 * 24));
    const remaining = 7 - (daysSince % 7);
    return remaining === 0 ? 7 : remaining;
  });

  let ringProgress = $derived((7 - daysUntilCheckin) / 7);
  let arcLength = $derived(ringProgress * CIRCUMFERENCE);
  let gapLength = $derived(CIRCUMFERENCE - arcLength);
  // Center the gap at the bottom of the ring
  let ringRotation = $derived(90 + ((1 - ringProgress) * 360) / 2);

  // --- Program info ---
  let programName = $derived.by(() => {
    if (!goals) return '';
    if (goals.programStyle) return `${goals.programStyle} Program`;
    if (goals.programType) return `${goals.programType} Program`;
    return 'Program';
  });

  let programDateRange = $derived.by(() => {
    if (!profile) return '';
    const planner = (profile.planner ?? {}) as Record<string, unknown>;
    const created = planner.goalCreated ?? planner.goalStartDate;
    if (created != null && typeof created === 'number') {
      const ms = created > 1e12 ? created : created * 1000;
      const d = new Date(ms);
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      return `${month} ${day} - Now`;
    }
    return 'Active';
  });

  // --- Weekly macro arrays (padded to 7 days) ---
  function padToWeek(arr: number[]): number[] {
    if (arr.length === 0) return Array(7).fill(0) as number[];
    if (arr.length >= 7) return arr.slice(0, 7);
    const last = arr[arr.length - 1];
    return [...arr, ...Array(7 - arr.length).fill(last) as number[]];
  }

  let weekCalories = $derived(goals ? padToWeek(goals.calories) : Array(7).fill(0) as number[]);
  let weekProtein = $derived(goals ? padToWeek(goals.protein) : Array(7).fill(0) as number[]);
  let weekFat = $derived(goals ? padToWeek(goals.fat) : Array(7).fill(0) as number[]);
  let weekCarbs = $derived(goals ? padToWeek(goals.carbs) : Array(7).fill(0) as number[]);

  interface MacroRow {
    values: number[];
    suffix: string;
    cssClass: string;
  }

  let macroRows = $derived<MacroRow[]>([
    { values: weekCalories, suffix: '', cssClass: 'cal' },
    { values: weekProtein, suffix: ' P', cssClass: 'pro' },
    { values: weekFat, suffix: ' F', cssClass: 'fat' },
    { values: weekCarbs, suffix: ' C', cssClass: 'carb' },
  ]);
</script>

<div class="page-header">
  <h1 class="page-title">Strategy</h1>
</div>

{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Action buttons -->
  <div class="action-row">
    <button class="action-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Check In Early
    </button>
    <button class="action-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Goal
    </button>
    <button class="action-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      </svg>
      Edit Goal
    </button>
  </div>

  <!-- Check-in countdown ring -->
  <div class="ring-container">
    <svg class="ring-svg" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="ring-grad" gradientUnits="userSpaceOnUse" x1="20" y1="180" x2="180" y2="20">
          <stop offset="0%" stop-color="rgba(255,255,255,0.85)" />
          <stop offset="55%" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="100%" stop-color="var(--color-success)" />
        </linearGradient>
      </defs>
      <!-- Track -->
      <circle
        cx="100" cy="100" r={RING_RADIUS}
        fill="none"
        stroke="var(--color-surface-elevated)"
        stroke-width={RING_STROKE}
      />
      <!-- Progress arc -->
      {#if arcLength > 0}
        <circle
          cx="100" cy="100" r={RING_RADIUS}
          fill="none"
          stroke="url(#ring-grad)"
          stroke-width={RING_STROKE}
          stroke-dasharray="{arcLength} {gapLength}"
          stroke-linecap="round"
          transform="rotate({ringRotation} 100 100)"
        />
      {/if}
    </svg>
    <div class="ring-text">
      <span class="ring-days">{daysUntilCheckin} day{daysUntilCheckin !== 1 ? 's' : ''}</span>
      <span class="ring-label">until check-in</span>
    </div>
  </div>

  <!-- Goal / Check-In toggle -->
  <div class="tab-row">
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'goal'}
      onclick={() => { activeTab = 'goal'; }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
      Goal
    </button>
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'checkin'}
      onclick={() => { activeTab = 'checkin'; }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      Check-In
    </button>
  </div>

  {#if activeTab === 'goal'}
    <!-- In Progress section -->
    <div class="section-block">
      <h2 class="section-heading">In Progress</h2>

      <div class="card program-card">
        <div class="program-header">
          <span class="program-name">{programName}</span>
          <span class="program-dates">{programDateRange}</span>
        </div>

        <!-- Day labels -->
        <div class="macro-grid day-labels-row">
          {#each DAY_LABELS as day}
            <span class="day-label">{day}</span>
          {/each}
        </div>

        <!-- Macro rows -->
        {#each macroRows as row}
          <div class="macro-grid">
            {#each row.values as val, i}
              <div class="macro-cell {row.cssClass}-cell">
                {Math.round(val)}{row.suffix}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>

    <!-- TDEE info -->
    {#if goals?.tdee}
      <div class="card info-card">
        <div class="info-row-inline">
          <span class="info-label">Estimated TDEE</span>
          <span class="info-value">{Math.round(goals.tdee)} <span class="info-unit">kcal/day</span></span>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Check-In tab placeholder -->
    <div class="empty-state">
      <p>Check-in details will appear here on your next check-in day.</p>
    </div>
  {/if}

  <!-- Profile info -->
  {#if profile}
    <div class="card profile-card">
      <h2 class="section-title">Profile</h2>
      <div class="profile-grid">
        {#if profile.height}
          <div class="profile-item">
            <span class="profile-label">Height</span>
            <span class="profile-val">{profile.height} {profile.heightUnits ?? 'cm'}</span>
          </div>
        {/if}
        {#if profile.weightUnits}
          <div class="profile-item">
            <span class="profile-label">Weight Units</span>
            <span class="profile-val">{profile.weightUnits}</span>
          </div>
        {/if}
        {#if profile.calorieUnits}
          <div class="profile-item">
            <span class="profile-label">Calorie Units</span>
            <span class="profile-val">{profile.calorieUnits}</span>
          </div>
        {/if}
        {#if profile.email}
          <div class="profile-item">
            <span class="profile-label">Email</span>
            <span class="profile-val">{profile.email}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Layout */
  .loading-center { display: flex; justify-content: center; padding: var(--space-12); }

  /* Action buttons row */
  .action-row {
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-6);
    scrollbar-width: none;
  }
  .action-row::-webkit-scrollbar { display: none; }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text);
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    white-space: nowrap;
    transition: background var(--transition-fast), border-color var(--transition-fast);
    cursor: pointer;
  }
  .action-btn:hover {
    background: var(--color-surface);
    border-color: var(--color-text-secondary);
  }

  /* Check-in ring */
  .ring-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: var(--space-4) auto var(--space-6);
    width: 200px;
    height: 200px;
  }

  .ring-svg {
    width: 100%;
    height: 100%;
  }

  .ring-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .ring-days {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    line-height: 1.1;
  }

  .ring-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-1);
  }

  /* Goal / Check-In tabs */
  .tab-row {
    display: flex;
    justify-content: center;
    gap: var(--space-6);
    margin-bottom: var(--space-8);
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: none;
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    font-weight: var(--font-medium);
    border: none;
    cursor: pointer;
    transition: color var(--transition-fast);
    border-radius: var(--radius-sm);
  }

  .tab-btn:hover {
    color: var(--color-text);
  }

  .tab-active {
    color: var(--color-text);
  }

  /* Section heading */
  .section-block {
    margin-bottom: var(--space-6);
  }

  .section-heading {
    font-size: var(--font-size-xl);
    font-weight: var(--font-bold);
    margin-bottom: var(--space-4);
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  /* Program card */
  .program-card {
    padding: var(--space-5);
  }

  .program-header {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--space-4);
  }

  .program-name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
  }

  .program-dates {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-1);
  }

  /* Macro grid */
  .macro-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-labels-row {
    margin-bottom: 2px;
  }

  .day-label {
    text-align: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
    padding: var(--space-1) 0;
  }

  .macro-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-1);
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: var(--font-semibold);
    color: #fff;
    white-space: nowrap;
    min-height: 34px;
  }

  .cal-cell  { background: rgba(90, 156, 236, 0.7); }
  .pro-cell  { background: rgba(239, 108, 94, 0.7); }
  .fat-cell  { background: rgba(240, 192, 64, 0.7); }
  .carb-cell { background: rgba(52, 199, 89, 0.7); }

  /* Info card (TDEE) */
  .info-card {
    margin-bottom: var(--space-4);
  }

  .info-row-inline {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .info-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .info-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
  }

  .info-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-normal);
  }

  /* Profile card */
  .profile-card {
    margin-top: var(--space-4);
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }

  .profile-item {
    display: flex;
    flex-direction: column;
  }

  .profile-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .profile-val {
    font-size: var(--font-size-base);
    font-weight: var(--font-medium);
    margin-top: var(--space-1);
  }
</style>
