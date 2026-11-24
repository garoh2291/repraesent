# repraesent — project rules

Stack conventions: the `dendrite-stack` skill. Product, UX and wording rules: the `repraesent-product`
skill + [../PRODUCT_DIRECTION.md](../PRODUCT_DIRECTION.md) — invoke it for every screen, copy or
navigation change. UI work also uses the `frontend-design` skill. Search inputs: see the root
CLAUDE.md (`useSearchShortcut`).

## Selects — never the native one (owner rule, 2026-11-24)
- **Never use a native `<select>`, `<datalist>` or `NativeSelect`** in new or touched code. They draw
  the browser's arrow, can't search, and inside sheets on phones open the OS wheel or nothing.
- Use **`SearchSelect`** (`app/components/notebook/search-select.tsx`): own chevron, search field,
  44 px rows, opens inline (works inside `BottomSheet`/dialogs on a phone), arrows/Enter/Escape.
  Free-text-plus-suggestions fields (e.g. the analytics filter "Value") = an input + an inline list of
  tappable matches — never `<datalist>`.
- Don't wrap a `SearchSelect` (or any list of buttons) in a `<label>`: a label forwards every click to
  its first control and re-toggles the list. Use a `<div>` + text, or `htmlFor`.
- **Always check** before calling UI done: `grep -rn "<select\b\|<datalist\b" app/components app/routes`
  must show nothing new; open every select you touched, search in it, pick with mouse and keyboard,
  at 375 px inside its sheet. Existing native selects (27 files on 2026-11-24) are replaced when a
  file is touched.

## Must-follow in this app
- **Design for the paper-notebook owner.** Every label passes: "would a barber with an appointment book
  understand this?" Use the skill's wording table (inquiry, new customer, earned, deal stages, team…).
- **Navigation = daily jobs** (Today · Customers · Deals · Results · Website). Setup features go one
  layer down (Settings / Website). Settings labels live in `lib/nav/settings.ts` (`settings.navLabels.*`).
- **Create in place**: use `useQuickCreate().open("task" | "lead" | "contact" | "deal")`
  (`components/notebook/quick-create.tsx`) instead of navigating to `?new=1`.
- **Every inquiry demands an outcome, every deal a next task** (`LeadFlowProvider`, `DealFlowProvider`).
- **Visual language**: paper `--background`, ink `--foreground`, marker `--secondary` (yellow) only for
  "needs you" or the promise; no blue (`--primary` is ink); Lora headings in onboarding; 40 px
  controls, 44 px touch targets; mobile menu = light bottom sheet (`components/notebook/mobile-menu.tsx`).
- **Copy**: all 4 locales (`i18n/locales/{en,de,fr,nl}.json`), new key when meaning changes, native
  German, formal Sie in onboarding; only true claims; errors say what happened + how to fix it; empty
  states say what to do next. Check 375 px.
- **Nav rules are shared** between the desktop sidebar and the phone sheet via `lib/nav/use-nav-model.ts`
  — change who-sees-what there, not in one of them.
- **Scroll containers**: the dashboard `<main>` is `relative` so absolutely positioned children (sr-only
  labels) stay inside it; sticky page headers need a stacking context (`app-fade-in`) so they don't
  cover the section tabs.
