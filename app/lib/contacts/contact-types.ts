export const CONTACT_TYPES = [
  "contact",
  "customer",
  "trade_partner",
  "supplier",
  "internal",
  "other",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  contact: "Contact",
  customer: "Customer",
  trade_partner: "Trade partner",
  supplier: "Supplier",
  internal: "Internal",
  other: "Other",
};

export const CONTACT_TYPE_PILL: Record<ContactType, string> = {
  contact:
    "bg-slate-500/10 text-slate-800 dark:text-slate-200 ring-1 ring-inset ring-slate-500/20",
  customer: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 ring-1 ring-inset ring-emerald-500/20",
  trade_partner:
    "bg-sky-500/10 text-sky-800 dark:text-sky-200 ring-1 ring-inset ring-sky-500/20",
  supplier:
    "bg-amber-500/10 text-amber-900 dark:text-amber-100 ring-1 ring-inset ring-amber-500/25",
  internal:
    "bg-violet-500/10 text-violet-800 dark:text-violet-200 ring-1 ring-inset ring-violet-500/20",
  other:
    "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 ring-1 ring-inset ring-zinc-500/20",
};
