/**
 * Client-side helpers for product forms: country presets, totals, and the
 * snapshot a bundle line keeps of its Stripe price. Nothing here is mirrored;
 * the contract types live in schema.ts.
 */

import type { CatalogPrice, CatalogProduct } from "~/lib/api/stripe-catalog";
import {
  COMMERCE_COUNTRY_PRESETS,
  type FormCommerce,
  type FormCommerceItem,
  type FormLocale,
  fillTemplate,
  getFormContent,
  type FormDefinition,
} from "./schema";

export type CountryPreset = "worldwide" | "eu" | "dach" | "custom";

export function detectPreset(codes: string[]): CountryPreset {
  if (codes.length === 0) return "worldwide";
  const same = (list: readonly string[]) =>
    list.length === codes.length && list.every((c) => codes.includes(c));
  if (same(COMMERCE_COUNTRY_PRESETS.eu)) return "eu";
  if (same(COMMERCE_COUNTRY_PRESETS.dach)) return "dach";
  return "custom";
}

export function presetCountries(preset: CountryPreset): string[] {
  if (preset === "eu") return [...COMMERCE_COUNTRY_PRESETS.eu];
  if (preset === "dach") return [...COMMERCE_COUNTRY_PRESETS.dach];
  return [];
}

/** All ISO-3166 alpha-2 codes the browser knows a name for, sorted by that name. */
export function allCountries(
  locale: string,
): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const out: Array<{ code: string; name: string }> = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        name = undefined;
      }
      // DisplayNames echoes unknown codes back; skip those.
      if (name && name !== code) out.push({ code, name });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, locale));
}

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Snapshot a catalogue price for the bundle. */
export function snapshotFrom(
  product: CatalogProduct,
  price: CatalogPrice,
): FormCommerceItem {
  const recurring = price.type === "recurring";
  return {
    priceId: price.id,
    productId: product.id,
    quantity: { adjustable: false, min: 1, max: 1, default: 1 },
    preselected: false,
    snapshot: {
      name: product.name,
      image: product.images[0] ?? null,
      unitAmount: price.unit_amount ?? 0,
      currency: price.currency.toLowerCase(),
      type: recurring ? "recurring" : "one_time",
      interval: recurring
        ? ((price.interval as FormCommerceItem["snapshot"]["interval"]) ??
          "month")
        : null,
      intervalCount: recurring ? (price.interval_count ?? 1) : null,
    },
  };
}

/** True when the live catalogue disagrees with what the bundle remembers. */
export function isSnapshotStale(
  item: FormCommerceItem,
  products: CatalogProduct[] | undefined,
): "archived" | "changed" | null {
  if (!products) return null;
  const product = products.find((p) => p.id === item.productId);
  const price = product?.prices.find((p) => p.id === item.priceId);
  if (!product || !price) return "archived";
  if (!product.active || !price.active) return "archived";
  if (
    product.name !== item.snapshot.name ||
    (price.unit_amount ?? 0) !== item.snapshot.unitAmount ||
    price.currency.toLowerCase() !== item.snapshot.currency ||
    (product.images[0] ?? null) !== item.snapshot.image
  ) {
    return "changed";
  }
  return null;
}

export interface CommerceTotals {
  currency: string;
  /** Charged at checkout: every line at its quantity (a subscription's first period included). */
  today: number;
  /** Recurring part, or null when nothing recurs. */
  recurring: { amount: number; interval: string; intervalCount: number } | null;
  lines: Array<{
    item: FormCommerceItem;
    quantity: number;
    total: number;
    selected: boolean;
  }>;
}

export function computeTotals(
  commerce: FormCommerce,
  quantities: Record<string, number>,
  /** Ticked price ids. Absent = every line counts (builder preview of a fixed list). */
  selection?: ReadonlySet<string>,
): CommerceTotals {
  const lines = commerce.items.map((item) => {
    const q =
      item.snapshot.type === "recurring" ? 1 : quantityFor(item, quantities);
    return {
      item,
      quantity: q,
      total: item.snapshot.unitAmount * q,
      selected: selection ? selection.has(item.priceId) : true,
    };
  });
  const chosen = lines.filter((l) => l.selected);
  const today = chosen.reduce((sum, l) => sum + l.total, 0);
  const rec = chosen.filter((l) => l.item.snapshot.type === "recurring");
  const recurring = rec.length
    ? {
        amount: rec.reduce((sum, l) => sum + l.total, 0),
        interval: rec[0].item.snapshot.interval ?? "month",
        intervalCount: rec[0].item.snapshot.intervalCount ?? 1,
      }
    : null;
  return {
    currency: commerce.items[0]?.snapshot.currency ?? "eur",
    today,
    recurring,
    lines,
  };
}

export function quantityFor(
  item: FormCommerceItem,
  quantities: Record<string, number>,
): number {
  const raw = quantities[item.priceId];
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.floor(raw)
      : item.quantity.default;
  return Math.min(item.quantity.max, Math.max(item.quantity.min, n));
}

/** The lines ticked when the form loads. */
export function defaultSelection(
  commerce: FormCommerce | undefined,
): Set<string> {
  return new Set(
    (commerce?.items ?? []).filter((i) => i.preselected).map((i) => i.priceId),
  );
}

export function defaultQuantities(
  commerce: FormCommerce | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of commerce?.items ?? [])
    out[item.priceId] = item.quantity.default;
  return out;
}

/** "per month" / "every 3 months", from the form's own content. */
export function intervalLabel(
  definition: Pick<FormDefinition, "content">,
  locale: FormLocale,
  fallback: FormLocale,
  interval: string | null,
  intervalCount: number | null,
): string {
  if (!interval) return "";
  const count = intervalCount ?? 1;
  const t = (key: string) => getFormContent(definition, locale, key, fallback);
  if (count === 1) return t(`commerce.per.${interval}`);
  return fillTemplate(t("commerce.every"), {
    n: count,
    unit: t(`commerce.unit.${interval}`),
  });
}
