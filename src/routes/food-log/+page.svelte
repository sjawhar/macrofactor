<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { FoodEntry, type Goals } from '$lib/api';
  import { localDate, today } from '$lib/date';
  import { page } from '$app/state';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let selectedDate = $state(page.url.searchParams.get('date') ?? today());
  let entries = $state<FoodEntry[]>([]);
  let goals = $state<Goals | null>(null);
  let loading = $state(true);
  let deletingId = $state<string | null>(null);
  let editingEntry = $state<FoodEntry | null>(null);
  let editQty = $state(1);
  let saving = $state(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadEntries() {
    if (!auth.client) return;
    loading = true;
    try {
      const [raw, g] = await Promise.all([
        auth.client.getFoodLog(selectedDate),
        auth.client.getGoals(),
      ]);
      entries = raw
        .filter((e) => !e.deleted)
        .sort((a, b) => {
          const aMin = parseInt(a.hour ?? '0', 10) * 60 + parseInt(a.minute ?? '0', 10);
          const bMin = parseInt(b.hour ?? '0', 10) * 60 + parseInt(b.minute ?? '0', 10);
          return aMin - bMin;
        });
      goals = g;
    } catch {
      entries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.client && selectedDate) {
      loadEntries();
    }
  });

  // ---------------------------------------------------------------------------
  // Derived totals & targets
  // ---------------------------------------------------------------------------
  let totalCal = $derived(entries.reduce((s, e) => s + e.calories(), 0));
  let totalPro = $derived(entries.reduce((s, e) => s + e.protein(), 0));
  let totalCarb = $derived(entries.reduce((s, e) => s + e.carbs(), 0));
  let totalFat = $derived(entries.reduce((s, e) => s + e.fat(), 0));

  let calTarget = $derived(goals ? goals.calories[goals.calories.length - 1] ?? 0 : 0);
  let proTarget = $derived(goals ? goals.protein[goals.protein.length - 1] ?? 0 : 0);
  let carbTarget = $derived(goals ? goals.carbs[goals.carbs.length - 1] ?? 0 : 0);
  let fatTarget = $derived(goals ? goals.fat[goals.fat.length - 1] ?? 0 : 0);

  // ---------------------------------------------------------------------------
  // Timeline grouping — group entries into "plates" by hour:minute
  // ---------------------------------------------------------------------------
  interface Plate {
    hour: number;
    minute: number;
    timeLabel: string;
    entries: FoodEntry[];
    totalCal: number;
    totalPro: number;
    totalFat: number;
    totalCarb: number;
  }

  let plates = $derived.by(() => {
    const map = new Map<string, FoodEntry[]>();
    for (const e of entries) {
      const key = `${e.hour ?? '0'}:${e.minute ?? '0'}`;
      const arr = map.get(key);
      if (arr) {
        arr.push(e);
      } else {
        map.set(key, [e]);
      }
    }
    const result: Plate[] = [];
    for (const [key, items] of map) {
      const [h, m] = key.split(':');
      const hour = parseInt(h, 10);
      const minute = parseInt(m, 10);
      result.push({
        hour,
        minute,
        timeLabel: formatTime12(hour, minute),
        entries: items,
        totalCal: items.reduce((s, e) => s + e.calories(), 0),
        totalPro: items.reduce((s, e) => s + e.protein(), 0),
        totalFat: items.reduce((s, e) => s + e.fat(), 0),
        totalCarb: items.reduce((s, e) => s + e.carbs(), 0),
      });
    }
    return result.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  });

  // Build the full 24h timeline with hour markers
  let timelineHours = $derived.by(() => {
    // Determine visible range from entries, default 6AM-9PM
    let minH = 6;
    let maxH = 21;
    for (const p of plates) {
      if (p.hour < minH) minH = p.hour;
      if (p.hour > maxH) maxH = p.hour;
    }
    // Clamp to sensible range
    minH = Math.max(0, minH - 1);
    maxH = Math.min(23, maxH + 1);

    const hours: number[] = [];
    for (let h = minH; h <= maxH; h++) {
      hours.push(h);
    }
    return hours;
  });

  // Map each plate to which timeline hour it sits in
  function platesForHour(hour: number): Plate[] {
    return plates.filter((p) => p.hour === hour);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatTime12(hour: number, minute: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const mm = String(minute).padStart(2, '0');
    return `${h12}:${mm} ${ampm}`;
  }

  function formatHourLabel(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }

  function progressPct(consumed: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min((consumed / target) * 100, 100);
  }

  function servingDisplay(entry: FoodEntry): string {
    const qty = entry.userQty ?? entry.quantity ?? 1;
    const unit = entry.servingUnit ?? 'serving';
    const grams = entry.weightGrams();
    const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
    if (grams > 0) {
      return `${qtyStr} ${unit} · ${Math.round(grams)}g`;
    }
    return `${qtyStr} ${unit}`;
  }

  // Food emoji map — maps common food keywords to emojis
  function foodEmoji(entry: FoodEntry): string {
    const name = (entry.name ?? '').toLowerCase();
    // Specific food matches
    if (name.includes('chicken') || name.includes('poultry')) return '🍗';
    if (name.includes('banana')) return '🍌';
    if (name.includes('apple')) return '🍎';
    if (name.includes('avocado')) return '🥑';
    if (name.includes('egg')) return '🥚';
    if (name.includes('salmon') || name.includes('fish') || name.includes('tuna')) return '🐟';
    if (name.includes('rice')) return '🍚';
    if (name.includes('bread') || name.includes('toast')) return '🍞';
    if (name.includes('bagel')) return '🥯';
    if (name.includes('milk') || name.includes('yogurt') || name.includes('yoghurt')) return '🥛';
    if (name.includes('cheese')) return '🧀';
    if (name.includes('beef') || name.includes('steak')) return '🥩';
    if (name.includes('pork') || name.includes('bacon') || name.includes('ham')) return '🥓';
    if (name.includes('shrimp') || name.includes('prawn')) return '🦐';
    if (name.includes('tomato')) return '🍅';
    if (name.includes('potato') || name.includes('fries')) return '🥔';
    if (name.includes('carrot')) return '🥕';
    if (name.includes('broccoli')) return '🥦';
    if (name.includes('spinach') || name.includes('lettuce') || name.includes('salad') || name.includes('kale')) return '🥗';
    if (name.includes('corn')) return '🌽';
    if (name.includes('pepper')) return '🌶️';
    if (name.includes('onion') || name.includes('garlic')) return '🧅';
    if (name.includes('mushroom')) return '🍄';
    if (name.includes('berry') || name.includes('blueberr') || name.includes('strawberr') || name.includes('raspberry') || name.includes('blackberr')) return '🫐';
    if (name.includes('orange') || name.includes('tangerine') || name.includes('clementine')) return '🍊';
    if (name.includes('lemon') || name.includes('lime')) return '🍋';
    if (name.includes('grape')) return '🍇';
    if (name.includes('watermelon') || name.includes('melon')) return '🍉';
    if (name.includes('peach') || name.includes('nectarine')) return '🍑';
    if (name.includes('pear')) return '🍐';
    if (name.includes('cherry') || name.includes('cherries')) return '🍒';
    if (name.includes('mango')) return '🥭';
    if (name.includes('pineapple')) return '🍍';
    if (name.includes('coconut')) return '🥥';
    if (name.includes('pomegranate')) return '🫐';
    if (name.includes('nut') || name.includes('almond') || name.includes('peanut') || name.includes('cashew') || name.includes('walnut')) return '🥜';
    if (name.includes('oat') || name.includes('cereal') || name.includes('granola')) return '🥣';
    if (name.includes('pasta') || name.includes('noodle') || name.includes('spaghetti')) return '🍝';
    if (name.includes('pizza')) return '🍕';
    if (name.includes('burger') || name.includes('hamburger')) return '🍔';
    if (name.includes('sandwich') || name.includes('wrap')) return '🥪';
    if (name.includes('taco') || name.includes('burrito')) return '🌮';
    if (name.includes('sushi')) return '🍣';
    if (name.includes('soup') || name.includes('broth') || name.includes('chili')) return '🍲';
    if (name.includes('cookie') || name.includes('biscuit')) return '🍪';
    if (name.includes('cake') || name.includes('brownie') || name.includes('muffin')) return '🍰';
    if (name.includes('chocolate') || name.includes('candy')) return '🍫';
    if (name.includes('ice cream') || name.includes('gelato')) return '🍦';
    if (name.includes('honey')) return '🍯';
    if (name.includes('sugar')) return '🍬';
    if (name.includes('coffee') || name.includes('espresso') || name.includes('latte') || name.includes('cappuccino')) return '☕';
    if (name.includes('tea')) return '🍵';
    if (name.includes('juice') || name.includes('smoothie')) return '🧃';
    if (name.includes('beer') || name.includes('ale')) return '🍺';
    if (name.includes('wine')) return '🍷';
    if (name.includes('water') || name.includes('seltzer') || name.includes('sparkling')) return '💧';
    if (name.includes('soda') || name.includes('cola') || name.includes('pop')) return '🥤';
    if (name.includes('protein') && (name.includes('shake') || name.includes('powder') || name.includes('bar'))) return '💪';
    if (name.includes('butter') || name.includes('oil') || name.includes('margarine')) return '🧈';
    if (name.includes('cream')) return '🍦';
    if (name.includes('salt')) return '🧂';
    if (name.includes('sauce') || name.includes('ketchup') || name.includes('mayo') || name.includes('mustard') || name.includes('dressing')) return '🫗';
    if (name.includes('pancake') || name.includes('waffle') || name.includes('crepe')) return '🥞';
    if (name.includes('croissant') || name.includes('pastry') || name.includes('donut') || name.includes('doughnut')) return '🥐';
    if (name.includes('turkey')) return '🦃';
    if (name.includes('lamb')) return '🍖';
    if (name.includes('bean') || name.includes('lentil') || name.includes('chickpea') || name.includes('hummus')) return '🫘';
    if (name.includes('tofu') || name.includes('tempeh') || name.includes('seitan')) return '🧊';
    if (name.includes('cucumber') || name.includes('pickle') || name.includes('zucchini')) return '🥒';
    if (name.includes('pea') || name.includes('edamame')) return '🫛';
    return '🍽️';
  }

  // ---------------------------------------------------------------------------
  // Date navigation
  // ---------------------------------------------------------------------------
  function prevDay() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    selectedDate = localDate(d);
  }

  function nextDay() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    selectedDate = localDate(d);
  }

  let isToday = $derived(selectedDate === today());

  let displayDate = $derived(
    isToday
      ? 'Today'
      : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function deleteEntry(entryId: string) {
    if (!auth.client || !confirm('Delete this entry?')) return;
    deletingId = entryId;
    try {
      await auth.client.deleteFoodEntry(selectedDate, entryId);
      entries = entries.filter((e) => e.entryId !== entryId);
    } finally {
      deletingId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Copy Plate
  // ---------------------------------------------------------------------------
  let copyingPlate = $state<Plate | null>(null);
  let copyTargetDate = $state(today());
  let copyInProgress = $state(false);
  let copySuccess = $state(false);

  function openCopyModal(plate: Plate) {
    copyingPlate = plate;
    copyTargetDate = today();
    copySuccess = false;
  }

  function closeCopyModal() {
    copyingPlate = null;
    copySuccess = false;
  }

  async function confirmCopyPlate() {
    if (!auth.client || !copyingPlate) return;
    copyInProgress = true;
    try {
      await auth.client.copyEntries(copyTargetDate, copyingPlate.entries);
      copySuccess = true;
      // If copying to current date, reload to show new entries
      if (copyTargetDate === selectedDate) {
        await loadEntries();
      }
      // Auto-close after brief delay
      setTimeout(closeCopyModal, 1200);
    } catch (err) {
      alert('Failed to copy plate: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      copyInProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Copy / Move single entry
  // ---------------------------------------------------------------------------
  let entryAction = $state<'copy' | 'move' | null>(null);
  let actionEntry = $state<FoodEntry | null>(null);
  let entryTargetDate = $state(today());
  let entryTargetHour = $state(12);
  let entryActionInProgress = $state(false);
  let entryActionSuccess = $state(false);

  function openEntryAction(entry: FoodEntry, action: 'copy' | 'move') {
    actionEntry = entry;
    entryAction = action;
    entryTargetDate = action === 'move' ? today() : selectedDate;
    entryTargetHour = parseInt(entry.hour ?? '12', 10);
    entryActionSuccess = false;
  }

  function closeEntryAction() {
    actionEntry = null;
    entryAction = null;
    entryActionSuccess = false;
  }

  async function confirmEntryAction() {
    if (!auth.client || !actionEntry || !entryAction) return;
    entryActionInProgress = true;
    try {
      // Build a modified entry with the chosen hour
      const modified = new FoodEntry({
        ...actionEntry,
        hour: String(entryTargetHour),
        minute: '0',
      });
      await auth.client.copyEntries(entryTargetDate, [modified]);

      if (entryAction === 'move') {
        await auth.client.deleteFoodEntry(selectedDate, actionEntry.entryId);
      }

      entryActionSuccess = true;
      await loadEntries();
      setTimeout(closeEntryAction, 1200);
    } catch (err) {
      alert(`Failed to ${entryAction} entry: ` + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      entryActionInProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Details modal
  // ---------------------------------------------------------------------------
  function openDetails(entry: FoodEntry) {
    editingEntry = entry;
    editQty = entry.userQty ?? entry.quantity ?? 1;
  }

  function closeDetails() {
    editingEntry = null;
    saving = false;
  }

  /** Multiplier for the preview quantity — mirrors FoodEntry.multiplier() logic. */
  function previewMultiplier(entry: FoodEntry, qty: number): number {
    const sg = entry.servingGrams;
    if (!sg || sg === 0) return 1;
    const uw = entry.unitWeight ?? sg;
    return (qty * uw) / sg;
  }

  let previewCal = $derived(editingEntry ? (editingEntry.caloriesRaw ?? 0) * previewMultiplier(editingEntry, editQty) : 0);
  let previewPro = $derived(editingEntry ? (editingEntry.proteinRaw ?? 0) * previewMultiplier(editingEntry, editQty) : 0);
  let previewCarb = $derived(editingEntry ? (editingEntry.carbsRaw ?? 0) * previewMultiplier(editingEntry, editQty) : 0);
  let previewFat = $derived(editingEntry ? (editingEntry.fatRaw ?? 0) * previewMultiplier(editingEntry, editQty) : 0);

  async function saveDetails() {
    if (!auth.client || !editingEntry) return;
    saving = true;
    try {
      await auth.client.updateFoodEntry(editingEntry.date, editingEntry.entryId, editQty);
      // Update the local entry so the list reflects the change
      editingEntry.userQty = editQty;
      editingEntry.quantity = editQty;
      // Force reactivity by replacing entries array
      entries = [...entries];
      closeDetails();
    } catch {
      saving = false;
    }
  }

  let duplicating = $state(false);

  // Macro calorie percentages for the modal
  let proCal = $derived(previewPro * 4);
  let fatCal = $derived(previewFat * 9);
  let carbCal = $derived(previewCarb * 4);
  let macroCal = $derived(proCal + fatCal + carbCal);
  let proPct = $derived(macroCal > 0 ? Math.round((proCal / macroCal) * 100) : 0);
  let fatPct = $derived(macroCal > 0 ? Math.round((fatCal / macroCal) * 100) : 0);
  let carbPct = $derived(macroCal > 0 ? Math.round((carbCal / macroCal) * 100) : 0);

  // Impact on targets
  let impactCalPct = $derived(calTarget > 0 ? Math.min(Math.round((previewCal / calTarget) * 100), 999) : 0);
  let impactProPct = $derived(proTarget > 0 ? Math.min(Math.round((previewPro / proTarget) * 100), 999) : 0);
  let impactFatPct = $derived(fatTarget > 0 ? Math.min(Math.round((previewFat / fatTarget) * 100), 999) : 0);
  let impactCarbPct = $derived(carbTarget > 0 ? Math.min(Math.round((previewCarb / carbTarget) * 100), 999) : 0);

  /** Ring chart constants */
  const RING_R = 18;
  const RING_C = 2 * Math.PI * RING_R;

  function ringOffset(pct: number): number {
    return RING_C * (1 - Math.min(pct, 100) / 100);
  }

  async function deleteFromModal() {
    if (!editingEntry || !auth.client) return;
    if (!confirm('Delete this entry?')) return;
    const id = editingEntry.entryId;
    deletingId = id;
    try {
      await auth.client.deleteFoodEntry(selectedDate, id);
      entries = entries.filter((e) => e.entryId !== id);
      closeDetails();
    } finally {
      deletingId = null;
    }
  }

  async function duplicateEntry() {
    if (!editingEntry || !auth.client) return;
    duplicating = true;
    try {
      await auth.client.copyEntries(editingEntry.date, [editingEntry]);
      await loadEntries();
      closeDetails();
    } catch (err) {
      alert('Failed to duplicate: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      duplicating = false;
    }
  }
</script>

<!-- ======================================================================= -->
<!-- DATE NAV -->
<!-- ======================================================================= -->
<header class="date-header">
  <button class="nav-arrow" onclick={prevDay} aria-label="Previous day">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>

  <div class="date-picker-wrapper">
    <input type="date" bind:value={selectedDate} class="date-input-hidden" />
    <span class="date-label-text">{displayDate}</span>
    <svg class="date-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </div>

  <button class="nav-arrow" onclick={nextDay} aria-label="Next day">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  </button>
</header>

<!-- ======================================================================= -->
<!-- MACRO PROGRESS BANNER -->
<!-- ======================================================================= -->
<div class="macro-banner">
  <div class="macro-slot">
    <div class="macro-values">
      <span class="macro-icon">🔥</span>
      <span class="macro-consumed">{Math.round(totalCal)}</span>
      {#if calTarget > 0}<span class="macro-separator">/</span><span class="macro-target">{Math.round(calTarget)}</span>{/if}
    </div>
    <div class="macro-bar-track">
      <div class="macro-bar-fill cal-fill" style="width:{progressPct(totalCal, calTarget)}%"></div>
    </div>
  </div>

  <div class="macro-slot">
    <div class="macro-values">
      <span class="macro-label-letter" style="color:var(--color-protein)">P</span>
      <span class="macro-consumed">{Math.round(totalPro)}</span>
      {#if proTarget > 0}<span class="macro-separator">/</span><span class="macro-target">{Math.round(proTarget)}</span>{/if}
    </div>
    <div class="macro-bar-track">
      <div class="macro-bar-fill pro-fill" style="width:{progressPct(totalPro, proTarget)}%"></div>
    </div>
  </div>

  <div class="macro-slot">
    <div class="macro-values">
      <span class="macro-label-letter" style="color:var(--color-fat)">F</span>
      <span class="macro-consumed">{Math.round(totalFat)}</span>
      {#if fatTarget > 0}<span class="macro-separator">/</span><span class="macro-target">{Math.round(fatTarget)}</span>{/if}
    </div>
    <div class="macro-bar-track">
      <div class="macro-bar-fill fat-fill" style="width:{progressPct(totalFat, fatTarget)}%"></div>
    </div>
  </div>

  <div class="macro-slot">
    <div class="macro-values">
      <span class="macro-label-letter" style="color:var(--color-carbs)">C</span>
      <span class="macro-consumed">{Math.round(totalCarb)}</span>
      {#if carbTarget > 0}<span class="macro-separator">/</span><span class="macro-target">{Math.round(carbTarget)}</span>{/if}
    </div>
    <div class="macro-bar-track">
      <div class="macro-bar-fill carb-fill" style="width:{progressPct(totalCarb, carbTarget)}%"></div>
    </div>
  </div>
</div>

<!-- ======================================================================= -->
<!-- CONTENT -->
<!-- ======================================================================= -->
{#if loading}
  <div class="loading-center"><div class="spinner spinner-lg"></div></div>
{:else if entries.length === 0}
  <div class="empty-state">
    <div class="empty-icon">🍽️</div>
    <p>No food logged for {displayDate}</p>
    <a href="/search" class="btn btn-primary" style="margin-top: var(--space-4)">Log Food</a>
  </div>
{:else}
  <!-- ===================================================================== -->
  <!-- TIMELINE VIEW -->
  <!-- ===================================================================== -->
  <div class="timeline">
    {#each timelineHours as hour (hour)}
      {@const hourPlates = platesForHour(hour)}
      <div class="timeline-row" class:has-entries={hourPlates.length > 0}>
        <!-- Hour label -->
        <div class="timeline-hour">
          <span class="hour-text">{formatHourLabel(hour)}</span>
        </div>
        <!-- Content area -->
        <div class="timeline-content" role="button" tabindex="0" onclick={() => goto(`/search?date=${selectedDate}&hour=${hour}`)} onkeydown={(e) => e.key === 'Enter' && goto(`/search?date=${selectedDate}&hour=${hour}`)}>
          {#if hourPlates.length > 0}
            <div class="track-line-extended"></div>
            {#each hourPlates as plate (plate.timeLabel)}
              <div class="plate">
                <div class="plate-header">
                  <div class="plate-header-macros">
                    <span class="plate-macro cal">🔥 {Math.round(plate.totalCal)} kcal</span>
                    <span class="plate-macro-sep">|</span>
                    <span class="plate-macro pro">P {Math.round(plate.totalPro)}g</span>
                    <span class="plate-macro-sep">|</span>
                    <span class="plate-macro fat">F {Math.round(plate.totalFat)}g</span>
                    <span class="plate-macro-sep">|</span>
                    <span class="plate-macro carb">C {Math.round(plate.totalCarb)}g</span>
                    {#if plate.entries.length > 1}
                      <span class="plate-count">· {plate.entries.length} items</span>
                    {/if}
                  </div>
                  <button class="plate-copy-btn" onclick={() => openCopyModal(plate)} aria-label="Copy plate">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                  </button>
                </div>

                {#each plate.entries as entry (entry.entryId)}
                  <div class="food-card" class:deleting={deletingId === entry.entryId}>
                    <!-- Icon -->
                    <div class="food-icon">{foodEmoji(entry)}</div>

                    <!-- Info -->
                    <div class="food-info">
                      <div class="food-name-row">
                        <span class="food-name">{entry.name ?? 'Unknown Food'}</span>
                      </div>
                      {#if entry.brand}
                        <span class="food-brand">{entry.brand}</span>
                      {/if}
                      <div class="food-macros-row">
                        <span class="fm cal">🔥{Math.round(entry.calories())}</span>
                        <span class="fm pro">P{Math.round(entry.protein())}</span>
                        <span class="fm fat">F{Math.round(entry.fat())}</span>
                        <span class="fm carb">C{Math.round(entry.carbs())}</span>
                      </div>
                      <div class="food-actions">
                        <button class="action-link details-link" onclick={() => openDetails(entry)} aria-label="View details">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          Details
                        </button>
                        <button class="action-link copy-link" onclick={() => openEntryAction(entry, 'copy')} aria-label="Copy entry">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Copy
                        </button>
                        <button class="action-link move-link" onclick={() => openEntryAction(entry, 'move')} aria-label="Move entry">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          Move
                        </button>
                        <button
                          class="action-link remove-link"
                          onclick={() => deleteEntry(entry.entryId)}
                          disabled={deletingId === entry.entryId}
                          aria-label="Remove entry"
                        >
                          {#if deletingId === entry.entryId}
                            <div class="spinner" style="width:12px;height:12px;border-width:1.5px;"></div>
                          {:else}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          {/if}
                          Remove
                        </button>
                      </div>
                    </div>

                    <!-- Serving pill -->
                    <div class="serving-pill">
                      <span class="serving-qty">{entry.userQty ?? entry.quantity ?? 1}</span>
                      <span class="serving-unit">{entry.servingUnit ?? 'serving'}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/each}
          {:else}
            <div class="add-at-time-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add food at {formatHourLabel(hour)}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- ======================================================================= -->
<!-- FOOD DETAILS MODAL -->
<!-- ======================================================================= -->
{#if editingEntry}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onkeydown={(e) => e.key === 'Escape' && closeDetails()} onclick={closeDetails}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-panel" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <div class="modal-title-group">
          <span class="modal-emoji">{foodEmoji(editingEntry)}</span>
          <div>
            <h2 class="modal-food-name">{editingEntry.name ?? 'Unknown Food'}</h2>
            {#if editingEntry.brand}
              <p class="modal-food-brand">{editingEntry.brand}</p>
            {/if}
          </div>
        </div>
        <button class="modal-close" onclick={closeDetails} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      <!-- Macro breakdown with percentages -->
      <div class="modal-macros">
        <div class="modal-macro-item cal">
          <span class="modal-macro-value">{Math.round(previewCal)}</span>
          <span class="modal-macro-label">kcal</span>
        </div>
        <div class="modal-macro-item pro">
          <span class="modal-macro-value">{Math.round(previewPro)}g</span>
          <span class="modal-macro-label">Protein · {proPct}%</span>
        </div>
        <div class="modal-macro-item carb">
          <span class="modal-macro-value">{Math.round(previewCarb)}g</span>
          <span class="modal-macro-label">Carbs · {carbPct}%</span>
        </div>
        <div class="modal-macro-item fat">
          <span class="modal-macro-value">{Math.round(previewFat)}g</span>
          <span class="modal-macro-label">Fat · {fatPct}%</span>
        </div>
      </div>

      <!-- Impact on Targets -->
      <div class="modal-section">
        <h3 class="modal-section-title">Impact on Targets</h3>
        <div class="impact-targets">
          <div class="impact-ring-item">
            <svg viewBox="0 0 48 48" width="52" height="52">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-surface-elevated)" stroke-width="4"/>
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-calories)" stroke-width="4" stroke-dasharray="{RING_C} {RING_C}" stroke-dashoffset={ringOffset(impactCalPct)} stroke-linecap="round" transform="rotate(-90 24 24)"/>
              <text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="var(--color-text)" font-size="10" font-weight="700">{impactCalPct}%</text>
            </svg>
            <span class="impact-label">Calories</span>
          </div>
          <div class="impact-ring-item">
            <svg viewBox="0 0 48 48" width="52" height="52">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-surface-elevated)" stroke-width="4"/>
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-protein)" stroke-width="4" stroke-dasharray="{RING_C} {RING_C}" stroke-dashoffset={ringOffset(impactProPct)} stroke-linecap="round" transform="rotate(-90 24 24)"/>
              <text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="var(--color-text)" font-size="10" font-weight="700">{impactProPct}%</text>
            </svg>
            <span class="impact-label">Protein</span>
          </div>
          <div class="impact-ring-item">
            <svg viewBox="0 0 48 48" width="52" height="52">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-surface-elevated)" stroke-width="4"/>
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-fat)" stroke-width="4" stroke-dasharray="{RING_C} {RING_C}" stroke-dashoffset={ringOffset(impactFatPct)} stroke-linecap="round" transform="rotate(-90 24 24)"/>
              <text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="var(--color-text)" font-size="10" font-weight="700">{impactFatPct}%</text>
            </svg>
            <span class="impact-label">Fat</span>
          </div>
          <div class="impact-ring-item">
            <svg viewBox="0 0 48 48" width="52" height="52">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-surface-elevated)" stroke-width="4"/>
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--color-carbs)" stroke-width="4" stroke-dasharray="{RING_C} {RING_C}" stroke-dashoffset={ringOffset(impactCarbPct)} stroke-linecap="round" transform="rotate(-90 24 24)"/>
              <text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="var(--color-text)" font-size="10" font-weight="700">{impactCarbPct}%</text>
            </svg>
            <span class="impact-label">Carbs</span>
          </div>
        </div>
      </div>

      <!-- Food Actions -->
      <div class="modal-food-actions">
        <button class="modal-action-btn delete-action" onclick={deleteFromModal} disabled={deletingId === editingEntry.entryId}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
        <button class="modal-action-btn" onclick={duplicateEntry} disabled={duplicating}>
          {#if duplicating}
            <div class="spinner" style="width:14px;height:14px;border-width:1.5px;"></div>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          {/if}
          Duplicate
        </button>
      </div>

      <!-- Nutrition Breakdown -->
      <div class="modal-section">
        <h3 class="modal-section-title">Nutrition</h3>
        <div class="nutrition-breakdown">
          <div class="nutrient-group">
            <div class="nutrient-group-title">General</div>
            <div class="nutrient-row"><span>Calories</span><span>{Math.round(previewCal)} kcal</span></div>
            <div class="nutrient-row"><span>Alcohol</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Caffeine</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Water</span><span class="nutrient-na">--</span></div>
          </div>
          <div class="nutrient-group">
            <div class="nutrient-group-title">Carbohydrates</div>
            <div class="nutrient-row"><span>Total Carbs</span><span>{previewCarb.toFixed(1)} g</span></div>
            <div class="nutrient-row"><span>Fiber</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Starch</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Sugars</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Net Carbs</span><span class="nutrient-na">--</span></div>
          </div>
          <div class="nutrient-group">
            <div class="nutrient-group-title">Protein</div>
            <div class="nutrient-row"><span>Total Protein</span><span>{previewPro.toFixed(1)} g</span></div>
          </div>
          <div class="nutrient-group">
            <div class="nutrient-group-title">Fat</div>
            <div class="nutrient-row"><span>Total Fat</span><span>{previewFat.toFixed(1)} g</span></div>
            <div class="nutrient-row"><span>Monounsaturated</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Polyunsaturated</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Omega-3</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Saturated</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Trans</span><span class="nutrient-na">--</span></div>
          </div>
          <div class="nutrient-group">
            <div class="nutrient-group-title">Minerals</div>
            <div class="nutrient-row"><span>Calcium</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Iron</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Magnesium</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Potassium</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Sodium</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Zinc</span><span class="nutrient-na">--</span></div>
          </div>
          <div class="nutrient-group">
            <div class="nutrient-group-title">Vitamins</div>
            <div class="nutrient-row"><span>Vitamin A</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Vitamin C</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Vitamin D</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Vitamin E</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>Vitamin K</span><span class="nutrient-na">--</span></div>
            <div class="nutrient-row"><span>B12</span><span class="nutrient-na">--</span></div>
          </div>
        </div>
      </div>

      <!-- Quantity editor -->
      <div class="modal-qty-section">
        <label class="modal-qty-label" for="edit-qty">Quantity</label>
        <div class="modal-qty-row">
          <input
            id="edit-qty"
            type="number"
            class="modal-qty-input"
            min="0.1"
            step="0.1"
            bind:value={editQty}
          />
          <span class="modal-qty-unit">{editingEntry.servingUnit ?? 'serving'}</span>
        </div>
      </div>

      <!-- Serving info -->
      <p class="modal-serving-info">{servingDisplay(editingEntry)}</p>

      <!-- Save -->
      <button class="btn btn-primary modal-save" onclick={saveDetails} disabled={saving}>
        {#if saving}
          <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
        {:else}
          Save
        {/if}
      </button>
    </div>
  </div>
{/if}

<!-- ======================================================================= -->
<!-- COPY PLATE MODAL -->
<!-- ======================================================================= -->
{#if copyingPlate}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onkeydown={(e) => e.key === 'Escape' && closeCopyModal()} onclick={closeCopyModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-panel copy-modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 class="modal-title">Copy Plate</h2>
        <button class="modal-close" onclick={closeCopyModal} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      <div class="copy-modal-body">
        <div class="copy-plate-summary">
          <span class="copy-time">{copyingPlate.timeLabel}</span>
          <span class="copy-macro">🔥 {Math.round(copyingPlate.totalCal)} kcal</span>
          <span class="copy-macro-sep">|</span>
          <span class="copy-macro">P {Math.round(copyingPlate.totalPro)}g</span>
          <span class="copy-macro-sep">|</span>
          <span class="copy-macro">F {Math.round(copyingPlate.totalFat)}g</span>
          <span class="copy-macro-sep">|</span>
          <span class="copy-macro">C {Math.round(copyingPlate.totalCarb)}g</span>
        </div>

        <div class="copy-items-list">
          {#each copyingPlate.entries as entry (entry.entryId)}
            <div class="copy-item">{foodEmoji(entry)} {entry.name ?? 'Unknown Food'}</div>
          {/each}
        </div>

        <label class="copy-date-label">
          Copy to date
          <input type="date" bind:value={copyTargetDate} class="copy-date-input" />
        </label>

        {#if copySuccess}
          <div class="copy-success">✅ Copied!</div>
        {:else}
          <button
            class="btn btn-primary copy-confirm-btn"
            onclick={confirmCopyPlate}
            disabled={copyInProgress}
          >
            {#if copyInProgress}
              <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
              Copying…
            {:else}
              Copy {copyingPlate.entries.length} item{copyingPlate.entries.length > 1 ? 's' : ''}
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ======================================================================= -->
<!-- COPY / MOVE ENTRY MODAL -->
<!-- ======================================================================= -->
{#if actionEntry && entryAction}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onkeydown={(e) => e.key === 'Escape' && closeEntryAction()} onclick={closeEntryAction}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-panel copy-modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 class="modal-title">{entryAction === 'copy' ? 'Copy' : 'Move'} Entry</h2>
        <button class="modal-close" onclick={closeEntryAction} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      <div class="copy-modal-body">
        <div class="copy-plate-summary">
          <span class="copy-entry-emoji">{foodEmoji(actionEntry)}</span>
          <span class="copy-entry-name">{actionEntry.name ?? 'Unknown Food'}</span>
          <span class="copy-macro">🔥 {Math.round(actionEntry.calories())} kcal</span>
        </div>

        <label class="copy-date-label">
          {entryAction === 'copy' ? 'Copy' : 'Move'} to date
          <input type="date" bind:value={entryTargetDate} class="copy-date-input" />
        </label>

        <label class="copy-date-label">
          Hour
          <select bind:value={entryTargetHour} class="copy-date-input">
            {#each Array.from({length: 24}, (_, i) => i) as h}
              <option value={h}>{formatHourLabel(h)}</option>
            {/each}
          </select>
        </label>

        {#if entryActionSuccess}
          <div class="copy-success">✅ {entryAction === 'copy' ? 'Copied' : 'Moved'}!</div>
        {:else}
          <button
            class="btn btn-primary copy-confirm-btn"
            onclick={confirmEntryAction}
            disabled={entryActionInProgress}
          >
            {#if entryActionInProgress}
              <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
              {entryAction === 'copy' ? 'Copying' : 'Moving'}…
            {:else}
              {entryAction === 'copy' ? 'Copy' : 'Move'} to {entryTargetDate === today() ? 'Today' : entryTargetDate}
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- FAB -->
<a href="/search" class="fab" aria-label="Add food">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</a>

<!-- ======================================================================= -->
<!-- STYLES -->
<!-- ======================================================================= -->
<style>
  /* ===== DATE HEADER ===== */
  .date-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) 0 var(--space-4);
  }

  .nav-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--color-text);
    transition: background var(--transition-fast);
  }
  .nav-arrow:hover {
    background: var(--color-surface);
  }

  .date-picker-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    cursor: pointer;
    user-select: none;
  }

  .date-input-hidden {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
  }

  .date-label-text {
    font-size: var(--font-size-base);
    font-weight: var(--font-semibold);
    letter-spacing: -0.01em;
  }

  .date-caret {
    opacity: 0.5;
  }

  /* ===== MACRO PROGRESS BANNER ===== */
  .macro-banner {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    margin-bottom: var(--space-6);
  }

  .macro-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
  }

  .macro-values {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-size: var(--font-size-sm);
    white-space: nowrap;
  }

  .macro-icon {
    font-size: 0.75rem;
    margin-right: 1px;
  }

  .macro-label-letter {
    font-weight: var(--font-bold);
    font-size: var(--font-size-sm);
    margin-right: 2px;
  }

  .macro-consumed {
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .macro-separator {
    color: var(--color-text-tertiary);
    margin: 0 1px;
    font-size: var(--font-size-xs);
  }

  .macro-target {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }

  .macro-bar-track {
    height: 3px;
    background: var(--color-surface-elevated);
    border-radius: 2px;
    overflow: hidden;
  }

  .macro-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .cal-fill  { background: var(--color-calories); }
  .pro-fill  { background: var(--color-protein); }
  .fat-fill  { background: var(--color-fat); }
  .carb-fill { background: var(--color-carbs); }

  /* ===== LOADING / EMPTY ===== */
  .loading-center {
    display: flex;
    justify-content: center;
    padding: var(--space-12);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-16) var(--space-8);
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-4);
    opacity: 0.4;
  }

  /* ===== TIMELINE ===== */
  .timeline {
    position: relative;
    padding-bottom: var(--space-16);
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 56px 24px 1fr;
    min-height: 32px;
    align-items: start;
  }

  .timeline-row.has-entries {
    min-height: auto;
    padding-bottom: var(--space-2);
  }

  /* Hour label */
  .timeline-hour {
    text-align: right;
    padding-right: var(--space-3);
    padding-top: 2px;
  }

  .hour-text {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .timeline-row.has-entries .hour-text {
    color: var(--color-text-secondary);
    font-weight: var(--font-semibold);
  }

  /* Track (vertical line + dot) */
  .timeline-track {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .timeline-row.has-entries .track-line-extended {
    position: absolute;
    left: 67px; /* 56px + 12px (half of 24) - 1px */
    top: 16px;
    bottom: 0;
    width: 2px;
    background: var(--color-surface-elevated);
    z-index: 0;
  }
  .timeline-content {
    position: relative;
    padding-bottom: var(--space-4);
    padding-top: 8px;
  }
  .timeline-row:not(.has-entries) .timeline-content {
    min-height: 48px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .timeline-row:not(.has-entries):hover .timeline-content {
    background: rgba(255,255,255,0.02);
    border-radius: var(--radius-sm);
  }
  .add-at-time-btn {
    opacity: 0;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }
  .timeline-row:not(.has-entries):hover .add-at-time-btn {
    opacity: 1;
  }

  .track-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--color-border);
  }

  /* First and last rows get half-lines */
  .timeline-row:first-child .track-line {
    top: 50%;
  }
  .timeline-row:last-child .track-line {
    bottom: 50%;
  }

  .track-dot {
    position: relative;
    top: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-secondary);
    z-index: 1;
    flex-shrink: 0;
  }

  /* Content area */
  .timeline-content {
    padding-left: var(--space-3);
    padding-right: var(--space-2);
  }

  /* ===== PLATE ===== */
  .plate {
    margin-bottom: var(--space-2);
  }

  .plate-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    margin-bottom: var(--space-1);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-sm);
  }

  .plate-header-macros {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    min-width: 0;
  }

  .plate-macro {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
    white-space: nowrap;
  }

  .plate-macro.cal { color: var(--color-text-secondary); }
  .plate-macro.pro { color: var(--color-protein); }
  .plate-macro.fat { color: var(--color-fat); }
  .plate-macro.carb { color: var(--color-carbs); }

  .plate-macro-sep {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    opacity: 0.5;
  }

  .plate-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
  }

  .plate-copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast), background var(--transition-fast);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .plate-copy-btn:hover {
    color: var(--color-primary);
    background: var(--color-surface);
  }

  /* ===== FOOD CARD ===== */
  .food-card {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .food-card:hover {
    border-color: var(--color-surface-elevated);
  }

  .food-card.deleting {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Icon */
  .food-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    background: var(--color-surface-elevated);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  /* Info */
  .food-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .food-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .food-name {
    font-weight: var(--font-semibold);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .food-brand {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .food-macros-row {
    display: flex;
    gap: var(--space-2);
    margin-top: 2px;
  }

  .fm {
    font-size: var(--font-size-xs);
    font-weight: var(--font-medium);
  }

  .fm.cal  { color: var(--color-text-secondary); }
  .fm.pro  { color: var(--color-protein); }
  .fm.fat  { color: var(--color-fat); }
  .fm.carb { color: var(--color-carbs); }

  .food-actions {
    display: flex;
    gap: var(--space-4);
    margin-top: var(--space-1);
  }

  .action-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    transition: color var(--transition-fast);
    padding: 2px 0;
  }

  .action-link:hover {
    color: var(--color-text-secondary);
  }

  .remove-link:hover {
    color: var(--color-error);
  }

  .action-link:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Serving pill */
  .serving-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-sm);
    min-width: 52px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .serving-qty {
    font-size: var(--font-size-base);
    font-weight: var(--font-bold);
    line-height: 1.1;
  }

  .serving-unit {
    font-size: 0.65rem;
    color: var(--color-text-secondary);
    text-align: center;
    line-height: 1.2;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ===== FAB ===== */
  .fab {
    position: fixed;
    bottom: var(--space-8);
    right: var(--space-8);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    transition: transform var(--transition-fast);
    text-decoration: none;
    z-index: 10;
  }

  .fab:hover {
    transform: scale(1.1);
    text-decoration: none;
  }

  /* ===== FOOD DETAILS MODAL ===== */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .modal-panel {
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    padding: var(--space-6);
    animation: slideUp 0.2s ease;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .modal-title-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .modal-emoji {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .modal-food-name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    margin: 0;
    line-height: 1.2;
  }

  .modal-food-brand {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin: 2px 0 0;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .modal-close:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .modal-macros {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .modal-macro-item {
    text-align: center;
    padding: var(--space-3) var(--space-2);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }

  .modal-macro-value {
    display: block;
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    line-height: 1.2;
  }

  .modal-macro-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: 2px;
  }

  .modal-macro-item.cal .modal-macro-value { color: var(--color-text); }
  .modal-macro-item.pro .modal-macro-value { color: var(--color-protein); }
  .modal-macro-item.carb .modal-macro-value { color: var(--color-carbs); }
  .modal-macro-item.fat .modal-macro-value { color: var(--color-fat); }

  .modal-qty-section {
    margin-bottom: var(--space-4);
  }

  .modal-qty-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }

  .modal-qty-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .modal-qty-input {
    width: 100px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-weight: var(--font-bold);
    text-align: center;
  }

  .modal-qty-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
  }

  .modal-qty-unit {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .modal-serving-info {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-6);
  }

  .modal-save {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    font-size: var(--font-size-base);
    font-weight: var(--font-semibold);
  }

  .modal-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ===== COPY PLATE MODAL ===== */
  .copy-modal {
    max-width: 400px;
  }

  .modal-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .copy-modal-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .copy-plate-summary {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-sm);
  }

  .copy-time {
    font-weight: var(--font-bold);
    color: var(--color-text);
    margin-right: var(--space-1);
  }

  .copy-macro {
    white-space: nowrap;
  }

  .copy-macro-sep {
    color: var(--color-text-tertiary);
    opacity: 0.5;
  }

  .copy-items-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    padding-left: var(--space-2);
  }

  .copy-item {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .copy-date-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .copy-date-input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-size-base);
  }

  .copy-date-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 59, 130, 246), 0.15);
  }

  .copy-confirm-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    font-size: var(--font-size-base);
    font-weight: var(--font-semibold);
  }

  .copy-confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .copy-success {
    text-align: center;
    font-size: var(--font-size-base);
    font-weight: var(--font-medium);
    color: var(--color-text);
    padding: var(--space-3);
  }

  /* ===== COPY/MOVE ENTRY MODAL extras ===== */
  .copy-entry-emoji {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .copy-entry-name {
    font-weight: var(--font-semibold);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: auto;
  }

  .copy-link:hover {
    color: var(--color-primary);
  }

  .move-link:hover {
    color: var(--color-warning, #f59e0b);
  }

  /* ===== IMPACT ON TARGETS ===== */
  .modal-section {
    margin-bottom: var(--space-5);
  }

  .modal-section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .impact-targets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
    text-align: center;
  }

  .impact-ring-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .impact-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
  }

  /* ===== FOOD ACTIONS (MODAL) ===== */
  .modal-food-actions {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }

  .modal-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
    cursor: pointer;
  }

  .modal-action-btn:hover {
    color: var(--color-text);
    border-color: var(--color-text-tertiary);
  }

  .modal-action-btn.delete-action:hover {
    color: var(--color-error);
    border-color: var(--color-error);
  }

  .modal-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== NUTRITION BREAKDOWN ===== */
  .nutrition-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .nutrient-group-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-1);
  }

  .nutrient-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) 0;
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .nutrient-row + .nutrient-row {
    border-top: 1px solid var(--color-surface-elevated);
  }

  .nutrient-na {
    color: var(--color-text-tertiary);
  }

</style>
