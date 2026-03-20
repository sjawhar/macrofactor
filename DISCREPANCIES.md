# MacroFactor Web App — Feature Discrepancies

## Source: Play Store screenshots, design-reference images, onboarding screenshot, user feedback

### Priority 1 — BROKEN (user reported)

- [x] Food log time sorting — 6 AM entries appearing after 4 PM (FIXED)
- [x] Serving dropdown broken — Typesense uses `weights`/`dfSrv`/`msreDesc` not `servings`/`description` (FIXED)
- [x] Search only shows calories — should show P/F/C macros per 100g (FIXED)
- [x] Dashboard shows zeros — timezone bug with toISOString() (FIXED)
- [x] 404 console errors — timezone + non-existent nutrition collection (FIXED)

### Priority 2 — Missing Core Food Logger Features

- [ ] **Food entry icons** — each food has an `imageId` in Typesense data. MF app shows food emoji/icons (e.g., 🍗 for chicken, 🍌 for banana). Need to map imageId to icons or use a food icon set.
- [ ] **Food log timeline view** — MF app has a vertical timeline with hourly markers (8 AM, 9 AM...) showing food entries at their logged times. Our web app just has a flat list.
- [ ] **Plate concept** — MF groups foods logged at the same time into "plates". Each plate shows combined macros. Users can add multiple foods to a plate before logging.
- [ ] **Multi-add from search** — In MF, you can add multiple foods to a plate before logging. Our search only adds one food at a time.
- [ ] **Food details view** — MF has a "Details" button on each food tile showing full nutrient breakdown, serving options, etc.
- [ ] **Copy/Move food entries** — MF lets you copy food entries to another date/time or move them.
- [ ] **Group operations** — select multiple entries for batch copy/move/delete.
- [ ] **Food entry serving display** — Show serving info (e.g., "1 tbsp", "1 cup") next to food name, not just grams.

### Priority 3 — Missing Dashboard Features

- [ ] **Weekly macro bars** — MF dashboard shows 7 daily bars per macro (Cal/Pro/Fat/Carbs) with targets. We have a calorie ring + macro progress bars for just today.
- [ ] **Consumed/Remaining toggle** — MF has a toggle to show consumed vs remaining macros.
- [ ] **Expenditure mini-chart** — MF dashboard shows a mini expenditure trend chart.
- [ ] **Weight Trend mini-chart** — MF dashboard shows a mini weight trend chart.
- [ ] **"See All" navigation** — MF dashboard cards link to detailed views.

### Priority 4 — Missing Strategy Features

- [ ] **Check-in countdown ring** — MF strategy page shows a ring counting days until next check-in.
- [ ] **Check In Early / New Goal / Edit Goal buttons** — Action buttons on strategy page.
- [ ] **Weekly macro grid** — MF shows a 7-day grid of all macro targets with color coding (blue=cal, orange=protein, yellow=fat, green=carbs).
- [ ] **Program history** — MF shows "In Progress" section with current program details.

### Priority 5 — Missing Analytics/Expenditure Features

- [ ] **Expenditure page** — MF has a full expenditure tracking page with average TDEE, difference from target, line charts with flux range.
- [ ] **Time range controls** — 1W/1M/3M/6M/1Y/All range selector with Day/aggregate toggle.
- [ ] **Insights & Data section** — Shows 3-day, 7-day, 14-day, 28-day trends for expenditure and weight changes.
- [ ] **Scale Weight vs Trend Weight** — MF weight page differentiates between raw scale readings and smoothed trend.

### Priority 6 — Missing Nutrition Detail Features

- [ ] **Micronutrient tracking** — MF has a full "Nutrition Overview" page showing Fat Breakdown (Monounsaturated, Polyunsaturated, Omega-3, etc.), plus other micronutrients with progress bars and targets.
- [ ] **Today/1 Week/1 Month/3 Months/1 Year** range for micronutrient overview.

### Priority 7 — Missing Food Logger Entry Modes

- [ ] **Barcode scanning** — Not possible on desktop (no camera), so skip or use manual barcode entry.
- [ ] **AI food description** — MF has an AI mode where you can describe food in text or take a photo. We could implement the text description mode.
- [ ] **List/History mode** — Quick access to recently logged or favorite foods.

### Priority 8 — UI/UX Polish

- [ ] **Navigation** — MF bottom nav: Dashboard, Food Log, +, Strategy, More. We have sidebar with 6 items. The "+" FAB to add food is central to the mobile experience.
- [ ] **Date navigation** — MF food log has "Today ▾" dropdown that shows calendar. We have prev/next buttons and a date picker.
- [ ] **Macro bar in food logger** — MF shows macro progress bars at the top of the food log (kcal consumed/target, P consumed/target, etc.).
- [ ] **Food log header** — Shows profile icon, title, kebab menu (⋮), and + button.
- [ ] **Dark mode colors** — User reported "blue and purple" issue. Verified our colors match screenshots but may need fine-tuning.

### Not Applicable for Desktop

- Barcode scanning (no camera)
- Photo-based AI food recognition (no camera)
- Haptic feedback
- Push notifications
