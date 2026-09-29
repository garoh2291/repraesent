# repraesent — project rules

Stack conventions: the `dendrite-stack` skill. Product, UX and wording rules: the `repraesent-product`
skill + [../PRODUCT_DIRECTION.md](../PRODUCT_DIRECTION.md) — invoke it for every screen, copy or
navigation change. UI work also uses the `frontend-design` skill. Search inputs: see the root
CLAUDE.md (`useSearchShortcut`).

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
