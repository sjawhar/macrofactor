<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import type { SearchFoodResult, FoodServing } from '$lib/api';
  import { foodIcon } from '$lib/food-icons';
  import { today } from '$lib/date';

  // ---------------------------------------------------------------------------
  // Staged food types
  // ---------------------------------------------------------------------------

  interface StagedSearchFood {
    kind: 'search';
    food: SearchFoodResult;
    serving: FoodServing;
    quantity: number;
  }

  interface StagedQuickAdd {
    kind: 'quickadd';
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }

  type StagedFood = StagedSearchFood | StagedQuickAdd;

  // ---------------------------------------------------------------------------
  // Search state
  // ---------------------------------------------------------------------------

  let query = $state('');
  let results = $state<SearchFoodResult[]>([]);
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // ---------------------------------------------------------------------------
  // Staging plate
  // ---------------------------------------------------------------------------

  let stagedFoods = $state<StagedFood[]>([]);
  let logging = $state(false);
  let successMsg = $state('');

  // ---------------------------------------------------------------------------
  // Quick add
  // ---------------------------------------------------------------------------

  let quickAdd = $state(false);
  let qaName = $state('');
  let qaCal = $state<number | undefined>(undefined);
  let qaPro = $state<number | undefined>(undefined);
  let qaCarb = $state<number | undefined>(undefined);
  let qaFat = $state<number | undefined>(undefined);

  // ---------------------------------------------------------------------------
  // URL params: date & hour from timeline click
  // ---------------------------------------------------------------------------

  let targetDate = $derived(page.url.searchParams.get('date') ?? today());
  let targetHourStr = $derived(page.url.searchParams.get('hour'));
  let targetHour = $derived(targetHourStr !== null ? parseInt(targetHourStr, 10) : new Date().getHours());
  let hasTimeContext = $derived(page.url.searchParams.has('date') || page.url.searchParams.has('hour'));

  function formatHour(h: number): string {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  function formatContextDate(d: string): string {
    const t = today();
    if (d === t) return 'Today';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ---------------------------------------------------------------------------
  // Derived totals for the staging plate
  // ---------------------------------------------------------------------------

  function itemCalories(item: StagedFood): number {
    if (item.kind === 'quickadd') return item.calories;
    return item.food.caloriesPer100g * item.serving.gramWeight * item.quantity / 100;
  }

  function itemProtein(item: StagedFood): number {
    if (item.kind === 'quickadd') return item.protein;
    return item.food.proteinPer100g * item.serving.gramWeight * item.quantity / 100;
  }

  function itemCarbs(item: StagedFood): number {
    if (item.kind === 'quickadd') return item.carbs;
    return item.food.carbsPer100g * item.serving.gramWeight * item.quantity / 100;
  }

  function itemFat(item: StagedFood): number {
    if (item.kind === 'quickadd') return item.fat;
    return item.food.fatPer100g * item.serving.gramWeight * item.quantity / 100;
  }

  let totalCal = $derived(stagedFoods.reduce((s, f) => s + itemCalories(f), 0));
  let totalPro = $derived(stagedFoods.reduce((s, f) => s + itemProtein(f), 0));
  let totalCarb = $derived(stagedFoods.reduce((s, f) => s + itemCarbs(f), 0));
  let totalFat = $derived(stagedFoods.reduce((s, f) => s + itemFat(f), 0));

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  function debounceSearch() {
    clearTimeout(searchTimer);
    if (!query.trim()) {
      results = [];
      return;
    }
    searchTimer = setTimeout(async () => {
      if (!auth.client || !query.trim()) return;
      searching = true;
      try {
        results = await auth.client.searchFoods(query.trim());
      } catch {
        results = [];
      } finally {
        searching = false;
      }
    }, 300);
  }

  $effect(() => {
    query;
    debounceSearch();
  });

  // ---------------------------------------------------------------------------
  // Stage a searched food
  // ---------------------------------------------------------------------------

  function stageFood(food: SearchFoodResult) {
    const serving = food.defaultServing ?? food.servings[0] ?? { description: '100g', amount: 1, gramWeight: 100 };
    stagedFoods = [...stagedFoods, { kind: 'search', food, serving, quantity: 1 }];
    successMsg = '';
  }

  // ---------------------------------------------------------------------------
  // Stage a quick-add food
  // ---------------------------------------------------------------------------

  function stageQuickAdd() {
    if (!qaName || qaCal === undefined) return;
    stagedFoods = [...stagedFoods, {
      kind: 'quickadd',
      name: qaName,
      calories: qaCal,
      protein: qaPro ?? 0,
      carbs: qaCarb ?? 0,
      fat: qaFat ?? 0,
    }];
    qaName = '';
    qaCal = undefined;
    qaPro = undefined;
    qaCarb = undefined;
    qaFat = undefined;
    successMsg = '';
  }

  // ---------------------------------------------------------------------------
  // Remove from plate
  // ---------------------------------------------------------------------------

  function removeStaged(index: number) {
    stagedFoods = stagedFoods.filter((_, i) => i !== index);
  }

  // ---------------------------------------------------------------------------
  // Update serving for a staged search food
  // ---------------------------------------------------------------------------

  function handleStagedServingChange(index: number, e: Event) {
    const servingIdx = parseInt((e.target as HTMLSelectElement).value, 10);
    const item = stagedFoods[index];
    if (item.kind !== 'search') return;
    const newServing = item.food.servings[servingIdx];
    if (!newServing) return;
    stagedFoods = stagedFoods.map((f, i) =>
      i === index && f.kind === 'search' ? { ...f, serving: newServing } : f
    );
  }

  function handleStagedQtyChange(index: number, e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (isNaN(val) || val <= 0) return;
    stagedFoods = stagedFoods.map((f, i) => {
      if (i !== index) return f;
      if (f.kind === 'search') return { ...f, quantity: val };
      return f;
    });
  }

  // ---------------------------------------------------------------------------
  // Log all staged foods
  // ---------------------------------------------------------------------------

  async function logAllStaged() {
    if (!auth.client || stagedFoods.length === 0) return;
    logging = true;
    try {
      const baseDate = new Date(`${targetDate}T12:00:00`);
      baseDate.setHours(targetHour, 0, 0, 0);
      await Promise.all(stagedFoods.map((staged, i) => {
        // Offset by i milliseconds to ensure unique Firestore entry IDs
        // but same hour/minute grouping so they appear as a single plate
        const d = new Date(baseDate.getTime() + i);
        if (staged.kind === 'search') {
          return auth.client!.logSearchedFood(d, staged.food, staged.serving, staged.quantity);
        } else {
          return auth.client!.logFood(d, staged.name, staged.calories, staged.protein, staged.carbs, staged.fat);
        }
      }));
      const count = stagedFoods.length;
      successMsg = `Logged ${count} item${count === 1 ? '' : 's'}!`;
      stagedFoods = [];
      // If we came from a timeline click, redirect back to food log after a short delay
      if (hasTimeContext) {
        setTimeout(() => goto(`/food-log?date=${targetDate}`), 800);
      }
    } finally {
      logging = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers for staged item display
  // ---------------------------------------------------------------------------

  function stagedIcon(item: StagedFood): string {
    if (item.kind === 'search') return foodIcon(item.food.imageId);
    return '✏️';
  }

  function stagedName(item: StagedFood): string {
    if (item.kind === 'search') return item.food.name;
    return item.name;
  }

  function stagedBrand(item: StagedFood): string | undefined {
    if (item.kind === 'search') return item.food.brand;
    return undefined;
  }
</script>


<div class="page-header">
  <h1 class="page-title">Search Foods</h1>
  {#if hasTimeContext}
    <button class="back-to-log" onclick={() => goto(`/food-log?date=${targetDate}`)}>
      ← Back to Food Log
    </button>
  {/if}
</div>

{#if hasTimeContext}
  <div class="time-context-pill">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    Logging to <strong>{formatContextDate(targetDate)}</strong> at <strong>{formatHour(targetHour)}</strong>
  </div>
{/if}

{#if successMsg}
  <div class="message message-success">{successMsg}</div>
{/if}

<div class="search-layout" class:has-plate={stagedFoods.length > 0}>
  <!-- ===== LEFT: Search + Results ===== -->
  <div class="search-side">
    <!-- Search Input -->
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        class="search-input"
        bind:value={query}
        placeholder="Search foods…"
      />
      {#if searching}
        <div class="spinner" style="width:18px;height:18px;border-width:2px;position:absolute;right:16px;top:50%;margin-top:-9px;"></div>
      {/if}
    </div>

    <!-- Results -->
    {#if results.length > 0}
      <div class="results-list">
        {#each results as food (food.foodId + (food.branded ? 'b' : 'c'))}
          <button class="result-item" onclick={() => stageFood(food)}>
            <div class="result-info">
              <span class="result-icon">{foodIcon(food.imageId)}</span>
              <div class="result-text">
                <span class="result-name">{food.name}</span>
                {#if food.brand}
                  <span class="result-brand">{food.brand}</span>
                {/if}
              </div>
            </div>
            <div class="result-right">
              <div class="result-macros">
                <span class="result-cal">{Math.round(food.caloriesPer100g)} kcal</span>
                <span class="result-macro macro-protein">{Math.round(food.proteinPer100g)}P</span>
                <span class="result-macro macro-fat">{Math.round(food.fatPer100g)}F</span>
                <span class="result-macro macro-carbs">{Math.round(food.carbsPer100g)}C</span>
                <span class="result-per">/ 100g</span>
              </div>
              <span class="result-add-icon">＋</span>
            </div>
          </button>
        {/each}
      </div>
    {:else if query && !searching}
      <div class="empty-state"><p>No results for "{query}"</p></div>
    {/if}

    <!-- Quick Add -->
    <div class="quick-add-section">
      <button class="quick-add-toggle" onclick={() => quickAdd = !quickAdd}>
        {quickAdd ? '▾' : '▸'} Quick Add (manual entry)
      </button>
      {#if quickAdd}
        <div class="card quick-add-form">
          <div class="field">
            <label>Food Name</label>
            <input type="text" bind:value={qaName} placeholder="e.g. Chicken Breast" />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Calories</label>
              <input type="number" bind:value={qaCal} placeholder="kcal" />
            </div>
            <div class="field">
              <label>Protein (g)</label>
              <input type="number" bind:value={qaPro} placeholder="0" />
            </div>
            <div class="field">
              <label>Carbs (g)</label>
              <input type="number" bind:value={qaCarb} placeholder="0" />
            </div>
            <div class="field">
              <label>Fat (g)</label>
              <input type="number" bind:value={qaFat} placeholder="0" />
            </div>
          </div>
          <button class="btn btn-primary" onclick={stageQuickAdd} disabled={!qaName || qaCal === undefined}>
            + Add to Plate
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- ===== RIGHT: Staging Plate ===== -->
  {#if stagedFoods.length > 0}
    <div class="plate-side">
      <div class="card plate-panel">
        <div class="plate-header">
          <h2 class="plate-title">🍽️ Plate</h2>
          <span class="plate-count">{stagedFoods.length} item{stagedFoods.length === 1 ? '' : 's'}</span>
        </div>

        <div class="plate-items">
          {#each stagedFoods as item, i}
            <div class="plate-item">
              <div class="plate-item-header">
                <span class="plate-item-icon">{stagedIcon(item)}</span>
                <div class="plate-item-name-wrap">
                  <span class="plate-item-name">{stagedName(item)}</span>
                  {#if stagedBrand(item)}
                    <span class="plate-item-brand">{stagedBrand(item)}</span>
                  {/if}
                </div>
                <button class="plate-item-remove" onclick={() => removeStaged(i)} title="Remove">✕</button>
              </div>

              {#if item.kind === 'search'}
                <div class="plate-item-controls">
                  <div class="plate-field">
                    <label>Serving</label>
                    <select onchange={(e) => handleStagedServingChange(i, e)}>
                      {#each item.food.servings as serving, si}
                        <option value={si} selected={serving === item.serving}>
                          {serving.description} ({serving.gramWeight}g)
                        </option>
                      {/each}
                    </select>
                  </div>
                  <div class="plate-field plate-field-qty">
                    <label>Qty</label>
                    <input
                      type="number"
                      value={item.quantity}
                      oninput={(e) => handleStagedQtyChange(i, e)}
                      min="0.25"
                      step="0.25"
                    />
                  </div>
                </div>
              {/if}

              <div class="plate-item-macros">
                <span class="macro-calories">{Math.round(itemCalories(item))}</span> kcal
                <span class="macro-sep">·</span>
                <span class="macro-protein">{Math.round(itemProtein(item))}P</span>
                <span class="macro-fat">{Math.round(itemFat(item))}F</span>
                <span class="macro-carbs">{Math.round(itemCarbs(item))}C</span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Plate totals -->
        <div class="plate-totals">
          <div class="plate-total-row">
            <span class="plate-total-label">Total</span>
            <div class="plate-total-values">
              <span class="plate-total-cal macro-calories">{Math.round(totalCal)}</span>
              <span class="plate-total-unit">kcal</span>
            </div>
          </div>
          <div class="plate-total-macros">
            <div class="plate-total-macro">
              <span class="macro-protein">{Math.round(totalPro)}g</span>
              <span class="plate-total-macro-label">Protein</span>
            </div>
            <div class="plate-total-macro">
              <span class="macro-carbs">{Math.round(totalCarb)}g</span>
              <span class="plate-total-macro-label">Carbs</span>
            </div>
            <div class="plate-total-macro">
              <span class="macro-fat">{Math.round(totalFat)}g</span>
              <span class="plate-total-macro-label">Fat</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-lg plate-log-btn" onclick={logAllStaged} disabled={logging}>
          {#if logging}
            <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
            Logging…
          {:else}
            Log {stagedFoods.length} Item{stagedFoods.length === 1 ? '' : 's'}
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ===== Context pill ===== */
  .back-to-log {
    font-size: var(--font-size-sm);
    color: var(--color-primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }
  .back-to-log:hover { text-decoration: underline; }
  .time-context-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
  }
  .time-context-pill svg { color: var(--color-primary); }

  /* ===== Layout ===== */
  .search-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .search-layout.has-plate {
    flex-direction: row;
    align-items: flex-start;
  }

  .search-side {
    flex: 1;
    min-width: 0;
  }

  .plate-side {
    flex: 0 0 380px;
    position: sticky;
    top: var(--space-4);
  }

  /* Stack vertically on narrow screens */
  @media (max-width: 860px) {
    .search-layout.has-plate {
      flex-direction: column;
    }
    .plate-side {
      flex: none;
      width: 100%;
      position: static;
    }
  }

  /* ===== Search box ===== */
  .search-box {
    position: relative;
    margin-bottom: var(--space-6);
  }

  .search-icon {
    position: absolute;
    left: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-tertiary);
  }

  .search-input {
    padding-left: var(--space-10);
    font-size: var(--font-size-lg);
    padding-top: var(--space-4);
    padding-bottom: var(--space-4);
  }

  /* ===== Results list ===== */
  .results-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-6);
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background var(--transition-fast);
    width: 100%;
    gap: var(--space-3);
  }

  .result-item:hover {
    background: var(--color-surface-elevated);
  }

  .result-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .result-icon {
    font-size: var(--font-size-xl);
    flex-shrink: 0;
  }

  .result-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .result-name {
    font-weight: var(--font-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-brand {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .result-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .result-macros {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    white-space: nowrap;
  }

  .result-cal {
    font-weight: var(--font-semibold);
  }

  .result-macro {
    font-size: var(--font-size-xs);
  }

  .result-per {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .result-add-icon {
    font-size: var(--font-size-lg);
    color: var(--color-primary);
    font-weight: var(--font-bold);
    flex-shrink: 0;
  }

  /* ===== Quick add ===== */
  .quick-add-section {
    margin-top: var(--space-6);
  }

  .quick-add-toggle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-3);
    padding: var(--space-2) 0;
  }

  .quick-add-form {
    margin-top: var(--space-3);
    max-width: 600px;
  }

  .field {
    margin-bottom: var(--space-4);
  }

  .field label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }

  .field-row {
    display: flex;
    gap: var(--space-4);
  }

  .field-row .field {
    flex: 1;
  }

  /* ===== Plate panel ===== */
  .plate-panel {
    display: flex;
    flex-direction: column;
  }

  .plate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .plate-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    margin: 0;
  }

  .plate-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* ===== Plate items ===== */
  .plate-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .plate-item {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
  }

  .plate-item-header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .plate-item-icon {
    font-size: var(--font-size-lg);
    flex-shrink: 0;
    line-height: 1;
  }

  .plate-item-name-wrap {
    flex: 1;
    min-width: 0;
  }

  .plate-item-name {
    font-weight: var(--font-semibold);
    font-size: var(--font-size-sm);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plate-item-brand {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    display: block;
  }

  .plate-item-remove {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    border-radius: var(--radius-sm);
    line-height: 1;
  }

  .plate-item-remove:hover {
    color: var(--color-danger);
    background: var(--color-surface-elevated);
  }

  .plate-item-controls {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .plate-field {
    flex: 1;
    min-width: 0;
  }

  .plate-field label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-1);
  }

  .plate-field select,
  .plate-field input {
    width: 100%;
    font-size: var(--font-size-sm);
    padding: var(--space-2);
  }

  .plate-field-qty {
    flex: 0 0 70px;
  }

  .plate-item-macros {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    display: flex;
    gap: var(--space-1);
    align-items: center;
    flex-wrap: wrap;
  }

  .macro-sep {
    color: var(--color-text-tertiary);
  }

  /* ===== Plate totals ===== */
  .plate-totals {
    border-top: 2px solid var(--color-border);
    padding-top: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .plate-total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-3);
  }

  .plate-total-label {
    font-weight: var(--font-bold);
    font-size: var(--font-size-base);
  }

  .plate-total-values {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .plate-total-cal {
    font-size: var(--font-size-xl);
    font-weight: var(--font-bold);
  }

  .plate-total-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .plate-total-macros {
    display: flex;
    gap: var(--space-4);
  }

  .plate-total-macro {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .plate-total-macro span:first-child {
    font-weight: var(--font-semibold);
    font-size: var(--font-size-base);
  }

  .plate-total-macro-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  /* ===== Log button ===== */
  .plate-log-btn {
    width: 100%;
  }

  /* ===== Shared ===== */
  select {
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    width: 100%;
  }
</style>
