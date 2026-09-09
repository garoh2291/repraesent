import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Radar,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type {
  ReTranslateCurrency,
  ReTranslatePriceCell,
  ReTranslatePriceCellInput,
  ReTranslatePriceKey,
  ReTranslatePricing,
  ReTranslateRegion,
} from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  useRemoveTranslateRegion,
  useSaveTranslatePrices,
  useSaveTranslateRegion,
  useScanTranslatePrices,
  useSetTranslateDefaultRegion,
  useTranslatePricing,
} from "~/lib/hooks/useWorkspaceReTranslatePricing";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import {
  cellId,
  currencyOf,
  flash,
  flashWhile,
  moneyToInput,
  normalizePriceSlug,
  normalizeRegionSlug,
  parseAutoPriceSlug,
  parseMoneyParts,
} from "./constants";
import { cn } from "~/lib/utils";

/**
 * Regions and the prices that follow them.
 *
 * The second axis beside language. Language owns the URL prefix; a region owns
 * nothing in the URL and only decides which number a price renders as. The two
 * are independent, so a visitor can read German pages at Canadian prices.
 *
 * The point of the screen is that a price is typed once, here, and every page
 * quoting it follows. Nobody edits an amount inside a page.
 *
 * ## What this used to look like, and why it does not any more
 *
 * Regions were tabs, and filling prices meant picking Europe, typing 300,
 * picking Canada, typing 450 — one list, shown as two screens. The table is
 * that list: a row per thing you sell, a column per region. Two regions with
 * one currency each is five columns wide, not a sideways scroll.
 *
 * With no rows yet the table asks one question — are the amounts already on
 * the pages, or will they be typed here — and hides the other path until that
 * is answered. Shortcodes stay on the row that owns them, not in the empty
 * state.
 *
 * There is no delivery section under the table any more. It held one switch —
 * whether picking a region repainted the page or reloaded it — and picking a
 * region now always reloads: the server prices the page for the region it was
 * asked for, so a page never carries another region's amounts to swap in.
 */

export function RegionsPanel({ pluginUuid }: { pluginUuid: string }) {
  const { t } = useTranslation();
  const query = useTranslatePricing(pluginUuid);

  if (query.isLoading && !query.data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <InfoNote>
        {extractErrorMessage(query.error) ||
          t(
            "wordpress.reTranslate.pricingUnreachable",
            "Could not read this site's pricing.",
          )}
      </InfoNote>
    );
  }

  if (!query.data.available) {
    return (
      <InfoNote>
        {t(
          "wordpress.reTranslate.pricingUnavailable",
          "This site's re:translate is older than region pricing. Update the plugin and this tab will fill in.",
        )}
      </InfoNote>
    );
  }

  return <RegionsBody pluginUuid={pluginUuid} data={query.data} />;
}

function RegionsBody({
  pluginUuid,
  data,
}: {
  pluginUuid: string;
  data: ReTranslatePricing;
}) {
  return <PricesCard pluginUuid={pluginUuid} data={data} />;
}

/* ── pick a region, then price what the pages already say ────────────────── */

/** What the single region dialog is currently doing. */
type RegionDialogState =
  | { mode: "add" }
  | { mode: "edit"; region: ReTranslateRegion };

/** The dropdown's last entry is a door, not a region. */
const ADD_REGION = "__add-region";

/**
 * How much of one region is priced, drafts included, so the dropdown describes
 * the list as it will look after Save rather than only as it is stored.
 */
function pricedCount(
  region: ReTranslateRegion,
  priceKeys: ReTranslatePriceKey[],
  stored: Map<string, string>,
  cells: Record<string, string>,
): { done: number; total: number } {
  let total = 0;
  let done = 0;

  for (const key of priceKeys) {
    for (const code of region.currencies ?? []) {
      total += 1;
      const id = cellId(key.slug, region.slug, code);
      if ((cells[id] ?? stored.get(id) ?? "").trim() !== "") done += 1;
    }
  }

  return { done, total };
}

/** A region as one line of option text — everything about it fits. */
function regionLabel(
  region: ReTranslateRegion,
  isDefault: boolean,
  count: { done: number; total: number },
  t: (key: string, fallback: string) => string,
): string {
  const bits = [
    (region.currencies ?? []).join(" · ") ||
      t("wordpress.reTranslate.noCurrencies", "no currency"),
  ];

  if (isDefault) {
    bits.push(t("wordpress.reTranslate.defaultRegionLower", "default"));
  }
  if (count.total > 0) {
    bits.push(`${count.done}/${count.total}`);
  }

  return `${region.flag || "🌐"}\u00a0\u00a0${region.label} · ${bits.join(" · ")}`;
}

/**
 * Pick a region, then type what each of your page's prices costs there.
 *
 * The left of every row is the amount your pages already show. The right is one
 * box per currency the chosen region quotes. That is the whole screen.
 *
 * ## What this replaced, and why
 *
 * A column per currency across every region at once. It read well with three
 * currencies and fell apart with ten — the table ran off the side of the screen
 * and every row grew boxes for money you were not thinking about. A region at a
 * time keeps the row as wide as the decision.
 *
 * The rows also used to carry a name box and a shortcode to copy. Neither was
 * the job: the amount on the page is what identifies the row, and a row found
 * on a page names itself after the sentence around it.
 */
function PricesCard({
  pluginUuid,
  data,
}: {
  pluginUuid: string;
  data: ReTranslatePricing;
}) {
  const { t } = useTranslation();

  const savePrices = useSaveTranslatePrices(pluginUuid);
  const saveRegion = useSaveTranslateRegion(pluginUuid);
  const removeRegion = useRemoveTranslateRegion(pluginUuid);
  const setDefault = useSetTranslateDefaultRegion(pluginUuid);
  const scan = useScanTranslatePrices(pluginUuid);

  const [dialog, setDialog] = useState<RegionDialogState | null>(null);
  const [removing, setRemoving] = useState<ReTranslateRegion | null>(null);
  const [selected, setSelected] = useState("");
  const [scanning, setScanning] = useState(0);

  const regions = Array.isArray(data.regions) ? data.regions : [];
  const priceKeys = Array.isArray(data.price_keys) ? data.price_keys : [];
  const priceRows = Array.isArray(data.prices) ? data.prices : [];
  const currencies = Array.isArray(data.currencies) ? data.currencies : [];

  /*
   * The region on screen. Held as a slug rather than an object so it survives a
   * refetch, and resolved through two fallbacks so it survives the region being
   * removed, or not having arrived yet on the first render.
   */
  const active =
    regions.find((region) => region.slug === selected) ??
    regions.find((region) => region.slug === data.default_region) ??
    regions[0] ??
    null;

  const columns = useMemo(
    () =>
      active
        ? (active.currencies ?? []).map((code) => currencyOf(currencies, code))
        : [],
    [active, currencies],
  );

  /** Currencies another region has already claimed, so the form can hide them. */
  function claimedBy(exclude?: string) {
    const out = new Set<string>();

    for (const region of regions) {
      if (region.slug === exclude) continue;
      for (const code of region.currencies ?? []) out.add(code);
    }

    return [...out];
  }

  /** cellId → what the site has. The baseline every draft is diffed against. */
  const stored = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of priceRows) {
      map.set(cellId(cell.key, cell.region, cell.currency), cell.input);
    }
    return map;
  }, [priceRows]);

  const [cells, setCells] = useState<Record<string, string>>({});

  /*
   * What the site currently holds, as one comparable string.
   *
   * The reset below has to key off the *values*, not the object identities.
   * This query refetches on every mount and has no stale window, so a refetch
   * lands a structurally identical payload with brand-new references fairly
   * often — and keying on those would throw away half-typed amounts every time
   * one arrived.
   */
  const signature = useMemo(
    () =>
      [...stored.entries()]
        .map(([id, value]) => `${id}=${value}`)
        .sort()
        .join("&") +
      "|" +
      priceKeys.map((key) => key.slug).join("&"),
    [stored, priceKeys],
  );

  useEffect(() => {
    setCells({});
  }, [signature]);

  const dirtyCells = Object.entries(cells).filter(
    ([id, value]) => value !== (stored.get(id) ?? ""),
  );

  const dirty = dirtyCells.length;
  const busy = savePrices.isPending;
  const regionBusy = setDefault.isPending || removeRegion.isPending;

  const found = data.found;
  const pageCurrency =
    data.pricing.base_currency || found?.summary.currency || "";

  const hasPrices = priceKeys.length > 0;
  const scanned = Boolean(found?.summary.scanned);

  /*
   * The amount the page itself carries, keyed by price. The default region's
   * matching currency is whatever the page already says, so that cell is not
   * typed — and the row can lead with the formatted figure.
   */
  const written = useMemo(() => {
    const map = new Map<string, ReTranslatePriceCell>();

    for (const row of priceRows) {
      if (
        row.region === data.default_region &&
        (!pageCurrency || row.currency === pageCurrency)
      ) {
        map.set(row.key, row);
      }
    }

    return map;
  }, [priceRows, data.default_region, pageCurrency]);

  /*
   * Biggest first, with equal amounts together.
   *
   * The site sends rows in the order it read them — page by page, down each
   * page — which scatters the three places a site quotes €1000 across the
   * grid. Those are exactly the rows somebody is comparing when they price a
   * region, so they belong next to each other. Within one amount the reading
   * order is kept, so a row still sits where its page put it.
   */
  const rows = useMemo(() => {
    const amountOf = (key: ReTranslatePriceKey) =>
      written.get(key.slug)?.amount_minor ??
      parseAutoPriceSlug(key.slug)?.amount_minor ??
      0;

    return priceKeys
      .map((key, index) => ({ key, index }))
      .sort((a, b) => amountOf(b.key) - amountOf(a.key) || a.index - b.index)
      .map((row) => row.key);
  }, [priceKeys, written]);

  /*
   * Which page a row came from, but only when the grid holds more than one.
   * On a site whose prices are all on /pricing it is the same word against
   * every row, and a column of "Pricing ·" is noise in front of the thing that
   * actually tells two rows apart.
   */
  const manyPages =
    new Set(priceKeys.map((key) => key.note.trim()).filter(Boolean)).size > 1;

  /**
   * Write every changed amount, in one request, under one toast.
   *
   * It used to walk the drafts one at a time — a round trip per page amount to
   * mint its row, then the amounts — so a screenful of edits was a queue of
   * requests you watched crawl, with a success toast only at the very end and
   * nothing at all before it. Now the whole grid is one call: the boxes hold
   * what you typed while it is in flight, the toast says so, and it turns into
   * "Saved" in place rather than stacking a second one underneath.
   */
  async function save() {
    const payload: ReTranslatePriceCellInput[] = dirtyCells.map(
      ([id, value]) => {
        const [key, region, currency] = id.split("|");
        const exponent = currencyOf(data.currencies, currency).exponent;

        if (value.trim() === "") {
          return {
            key,
            region,
            currency,
            amount_minor: null,
            display_places: null,
          };
        }

        const parsed = parseMoneyParts(value, exponent);

        return {
          key,
          region,
          currency,
          amount_minor: parsed?.amount ?? null,
          display_places: parsed?.places ?? 0,
        };
      },
    );

    if (payload.length === 0) return;

    /*
     * The site answers a refusal with `ok: false` rather than by throwing, so
     * both shapes are turned into a rejection here — that is the only way the
     * one toast can end as an error instead of quietly claiming success.
     */
    const write = async () => {
      const res = await savePrices.mutateAsync(payload);

      if (!res.ok) {
        throw new Error(res.error ?? t("common.error", "Something went wrong"));
      }

      if (res.result && res.result.errors.length > 0) {
        throw new Error(res.result.errors[0]);
      }
    };

    try {
      await flashWhile(write(), {
        busy: t("wordpress.reTranslate.pricesSaving", "Saving…"),
        done: t("wordpress.reTranslate.pricesSaved", "Saved"),
      });

      setCells({});
    } catch {
      /*
       * Deliberately kept. flashWhile has already said what went wrong, and
       * the drafts stay in the boxes so the edit is not lost to a bad tunnel.
       */
    }
  }

  async function submitRegion(body: {
    slug: string;
    label: string;
    flag: string;
    currencies: string[];
  }) {
    try {
      const res = await saveRegion.mutateAsync(body);
      if (!res.ok) {
        flash(res.error ?? t("common.error", "Something went wrong"), "error");
        return;
      }
      // A region you just added is the one you want to be looking at.
      setSelected(body.slug);
      setDialog(null);
      flash(t("wordpress.reTranslate.regionSaved", "Region saved"));
    } catch (err) {
      flash(extractErrorMessage(err), "error");
    }
  }

  const scanButton = (
    <Button
      size="sm"
      variant="outline"
      disabled={scan.isPending}
      onClick={async () => {
        setScanning(0);
        try {
          const res = await scan.mutateAsync({ onProgress: setScanning });
          if (!res.ok) {
            flash(res.error ?? "", "error");
            return;
          }
          flash(
            t(
              "wordpress.reTranslate.scanDone",
              "Scanned {{pages}} pages and found {{count}} amounts",
              {
                pages: res.found?.summary.pages ?? 0,
                count: res.found?.summary.total ?? 0,
              },
            ),
          );
        } catch (err) {
          flash(extractErrorMessage(err), "error");
        }
      }}
    >
      {scan.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Radar className="size-3.5" />
      )}
      {scan.isPending
        ? t("wordpress.reTranslate.scanning", "Scanning {{count}} pages…", {
            count: scanning,
          })
        : scanned
          ? t("wordpress.reTranslate.scanAgain", "Scan again")
          : t("wordpress.reTranslate.scanSite", "Scan my pages")}
    </Button>
  );

  const colSpan = columns.length + 2;

  /**
   * What the page decides, and therefore what nobody types.
   *
   * Only ever the default region, only ever a row that came off a page, and
   * only ever the currency that page wrote it in — a default region that also
   * quotes CHF still has to be told what the Swiss number is, because no page
   * anywhere states it.
   */
  function pageValue(
    slug: string,
    currency: ReTranslateCurrency,
  ): string | null {
    if (active == null || active.slug !== data.default_region) return null;

    const page = written.get(slug);

    if (!page || page.currency !== currency.code) return null;

    return page.input || page.formatted;
  }

  /**
   * The currency the pages are written in, when no region quotes it.
   *
   * The one arrangement in which this screen is pure retyping: the amounts are
   * all there, they are all in EUR, and every region is asking for something
   * else. Worth offering to fix rather than leaving to be worked out.
   */
  const orphanCurrency = useMemo(() => {
    if (pageCurrency === "") return "";

    const quoted = regions.some((region) =>
      (region.currencies ?? []).includes(pageCurrency),
    );

    return quoted ? "" : pageCurrency;
  }, [pageCurrency, regions]);

  /** How many cells in the current view the page decides. */
  const pageOwned = priceKeys.reduce(
    (total, key) =>
      total +
      columns.filter((currency) => pageValue(key.slug, currency)).length,
    0,
  );

  return (
    <SectionCard className="overflow-visible">
      <CardHeader
        icon={<Tag className="size-3.5" />}
        title={t("wordpress.reTranslate.priceList", "Prices")}
        subtitle={t(
          "wordpress.reTranslate.priceListHint",
          "Your pages set the default region's prices. Add a region for anywhere you quote different numbers.",
        )}
        action={regions.length > 0 ? scanButton : null}
      />

      {regions.length === 0 || active == null ? (
        <FirstRun
          pluginUuid={pluginUuid}
          data={data}
          scanButton={scanButton}
          onChoose={(slug) => setSelected(slug)}
          onSetUpByHand={() => setDialog({ mode: "add" })}
        />
      ) : (
        <>
          {/*
           * The pages speak a currency no region here quotes, so nothing can
           * be read off them and the whole grid is hand-typed. That is the
           * state this screen exists to prevent, so it says so where it is
           * happening rather than waiting to be discovered.
           */}
          {orphanCurrency ? (
            <FirstRun
              pluginUuid={pluginUuid}
              data={data}
              scanButton={scanButton}
              compact
              onChoose={(slug) => setSelected(slug)}
              onSetUpByHand={() => setDialog({ mode: "add" })}
            />
          ) : null}

          {/* ── the region you are pricing ─────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/20 px-5 py-3 sm:px-6">
            <Label
              htmlFor="rt-region-picker"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("wordpress.reTranslate.regionPicker", "Region")}
            </Label>

            <NativeSelect
              id="rt-region-picker"
              value={active.slug}
              className="h-10 min-w-72 bg-card font-medium"
              onChange={(event) => {
                if (event.target.value === ADD_REGION) {
                  setDialog({ mode: "add" });
                  return;
                }
                setSelected(event.target.value);
              }}
            >
              {regions.map((region) => (
                <NativeSelectOption key={region.slug} value={region.slug}>
                  {regionLabel(
                    region,
                    region.slug === data.default_region,
                    pricedCount(region, priceKeys, stored, cells),
                    t,
                  )}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={ADD_REGION}>
                {t("wordpress.reTranslate.addRegionItem", "＋  Add a region…")}
              </NativeSelectOption>
            </NativeSelect>

            <div className="ml-auto flex items-center gap-2">
              {active.slug !== data.default_region ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={regionBusy}
                  onClick={async () => {
                    try {
                      const res = await setDefault.mutateAsync(active.slug);
                      if (!res.ok) {
                        flash(res.error ?? "", "error");
                        return;
                      }
                      flash(
                        t(
                          "wordpress.reTranslate.defaultRegionSet",
                          "{{name}} is now the default",
                          { name: active.label },
                        ),
                      );
                    } catch (err) {
                      flash(extractErrorMessage(err), "error");
                    }
                  }}
                >
                  <MapPin className="size-3.5" />
                  {t("wordpress.reTranslate.makeDefault", "Make default")}
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog({ mode: "edit", region: active })}
              >
                <Pencil className="size-3.5" />
                {t("wordpress.reTranslate.editRegion", "Edit region")}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-destructive"
                disabled={regionBusy}
                onClick={() => setRemoving(active)}
                aria-label={t(
                  "wordpress.reTranslate.removeRegion",
                  "Remove region",
                )}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {pageOwned > 0 ? (
            <p className="border-b bg-muted/10 px-5 py-2 text-[11px] leading-relaxed text-muted-foreground sm:px-6">
              {t(
                "wordpress.reTranslate.defaultRegionNote",
                "This is the default region, so the prices your pages already state are read from them rather than typed here. Add another region for anywhere you quote different numbers.",
              )}
            </p>
          ) : active.slug === data.default_region && hasPrices ? (
            /*
             * The default region quotes a currency no page is written in, so
             * nothing can be read off them. Worth saying, because it is the one
             * arrangement where the default region is as much work as any other
             * and somebody will otherwise wonder why.
             */
            <p className="border-b bg-muted/10 px-5 py-2 text-[11px] leading-relaxed text-muted-foreground sm:px-6">
              {t(
                "wordpress.reTranslate.defaultRegionNoPageNote",
                "Your pages are not written in {{code}}, so nothing here can be read off them — every amount has to be typed.",
                { code: active.currencies[0] ?? "" },
              )}
            </p>
          ) : null}

          {columns.length === 0 ? (
            <div className="p-5 sm:p-6">
              <InfoNote>
                {t(
                  "wordpress.reTranslate.regionNoCurrency",
                  "This region has no currency yet, so there is nothing to price in. Edit it to choose one.",
                )}
              </InfoNote>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 z-10 min-w-56 border-b bg-card px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6"
                      >
                        {t("wordpress.reTranslate.onYourPage", "On your page")}
                      </th>

                      {columns.map((currency) => (
                        <th
                          key={currency.code}
                          scope="col"
                          className="border-b bg-card px-2 py-3 text-left"
                        >
                          <span className="block text-sm font-semibold">
                            {currency.code}
                          </span>
                          <span className="block truncate text-[11px] font-normal text-muted-foreground">
                            {currency.name}
                          </span>
                        </th>
                      ))}

                      <th
                        scope="col"
                        className="w-24 border-b bg-card px-2 py-3"
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((key) => (
                      <PriceRow
                        key={key.slug}
                        priceKey={key}
                        region={active}
                        columns={columns}
                        page={manyPages ? key.note.trim() : ""}
                        origin={written.get(key.slug)}
                        valueFor={(currency) => {
                          const id = cellId(
                            key.slug,
                            active.slug,
                            currency.code,
                          );
                          return cells[id] ?? stored.get(id) ?? "";
                        }}
                        changedFor={(currency) => {
                          const id = cellId(
                            key.slug,
                            active.slug,
                            currency.code,
                          );
                          return (
                            (cells[id] ?? stored.get(id) ?? "") !==
                            (stored.get(id) ?? "")
                          );
                        }}
                        onValue={(currency, next) =>
                          setCells({
                            ...cells,
                            [cellId(key.slug, active.slug, currency.code)]:
                              next,
                          })
                        }
                        fromPage={(currency) => pageValue(key.slug, currency)}
                      />
                    ))}

                    {!hasPrices ? (
                      <tr>
                        <td
                          colSpan={colSpan}
                          className="border-b px-5 py-8 text-center text-xs text-muted-foreground sm:px-6"
                        >
                          {scanned
                            ? t(
                                "wordpress.reTranslate.foundNothing",
                                "Nothing found. An amount needs its currency beside it — “€300”, not “300” — so a year or a phone number is never read as a price.",
                              )
                            : t(
                                "wordpress.reTranslate.scanPagesFirst",
                                "Scan your pages and every price on them becomes a row here.",
                              )}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Follows you down a long list, so saving is never a scroll away. */}
          {dirty > 0 ? (
            <div className="sticky bottom-4 z-20 mx-5 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-lg sm:mx-6 sm:mb-6">
              <Button size="sm" disabled={busy} onClick={save}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t("wordpress.reTranslate.saveCount", "Save {{count}}", {
                  count: dirty,
                })}
              </Button>
              <span className="min-w-0 text-xs text-muted-foreground">
                {t("wordpress.reTranslate.unsavedHere", "not saved yet")}
              </span>
              <button
                type="button"
                onClick={() => setCells({})}
                className="ml-auto text-xs underline-offset-2 hover:underline"
              >
                {t("common.discard", "Discard")}
              </button>
            </div>
          ) : null}
        </>
      )}

      {dialog ? (
        <RegionDialog
          key={dialog.mode === "edit" ? dialog.region.slug : "add"}
          region={dialog.mode === "edit" ? dialog.region : undefined}
          currencies={data.currencies}
          claimed={claimedBy(
            dialog.mode === "edit" ? dialog.region.slug : undefined,
          )}
          saving={saveRegion.isPending}
          onSubmit={submitRegion}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <RemoveRegionDialog
        region={removing}
        busy={removeRegion.isPending}
        onClose={() => setRemoving(null)}
        onRemove={async (region, purge) => {
          try {
            const res = await removeRegion.mutateAsync({
              slug: region.slug,
              purge,
            });
            if (!res.ok) {
              flash(res.error ?? "", "error");
              return;
            }
            setRemoving(null);
            setSelected("");
            flash(t("wordpress.reTranslate.regionRemoved", "Region removed"));
          } catch (err) {
            flash(extractErrorMessage(err), "error");
          }
        }}
      />
    </SectionCard>
  );
}

/**
 * A first guess at what to call the region a currency belongs to.
 *
 * Only a guess, and editable in the box next to it — but "Europe" for EUR is
 * right often enough that making everyone type it would be the kind of small
 * tax this screen exists to remove. Anything not listed falls back to the code
 * itself, which is at least never wrong.
 */
const HOME_REGION: Record<string, { label: string; flag: string }> = {
  AUD: { label: "Australia", flag: "🇦🇺" },
  CAD: { label: "Canada", flag: "🇨🇦" },
  CHF: { label: "Switzerland", flag: "🇨🇭" },
  DKK: { label: "Denmark", flag: "🇩🇰" },
  EUR: { label: "Europe", flag: "🇪🇺" },
  GBP: { label: "United Kingdom", flag: "🇬🇧" },
  JPY: { label: "Japan", flag: "🇯🇵" },
  NOK: { label: "Norway", flag: "🇳🇴" },
  NZD: { label: "New Zealand", flag: "🇳🇿" },
  PLN: { label: "Poland", flag: "🇵🇱" },
  SEK: { label: "Sweden", flag: "🇸🇪" },
  USD: { label: "United States", flag: "🇺🇸" },
};

/**
 * The one thing to decide before this screen means anything: which region the
 * site's own prices belong to.
 *
 * A site's pages are already written in a currency, and until something says
 * which region that is, every number on them is unattributed — which is why
 * adding Canada on its own used to show nothing at all. So the first question
 * is not "add a region", it is "your pages quote EUR; what do you call the
 * place they quote it for".
 *
 * Answering it also fills the grid. Every amount the scan found is adopted into
 * the region on the way in, at the value the page already states, because
 * typing €300 into a box on a page that says €300 is work nobody should be
 * asked to do. From then on the only prices anyone types are the ones that
 * genuinely differ.
 */
function FirstRun({
  pluginUuid,
  data,
  scanButton,
  compact = false,
  onChoose,
  onSetUpByHand,
}: {
  pluginUuid: string;
  data: ReTranslatePricing;
  scanButton: React.ReactNode;
  /** Sat above an existing grid rather than standing in for one. */
  compact?: boolean;
  onChoose: (slug: string) => void;
  onSetUpByHand: () => void;
}) {
  const { t, i18n } = useTranslation();

  const saveRegion = useSaveTranslateRegion(pluginUuid);
  const setDefault = useSetTranslateDefaultRegion(pluginUuid);
  const savePrices = useSaveTranslatePrices(pluginUuid);

  const found = data.found;
  const scanned = Boolean(found?.summary.scanned);

  /*
   * The currency the site's pages are written in. The scan records it; without
   * the old occurrence list there is nothing to tally.
   */
  const guess = useMemo(() => {
    const currency =
      data.pricing.base_currency || found?.summary.currency || "";
    const count = found?.summary.total || data.price_keys.length;

    return { currency, count };
  }, [
    data.pricing.base_currency,
    data.price_keys.length,
    found?.summary.currency,
    found?.summary.total,
  ]);

  const [label, setLabel] = useState("");
  const [flag, setFlag] = useState("");
  const [touched, setTouched] = useState(false);

  /*
   * The guess only arrives once the pricing query has, so the fields are seeded
   * when it does — and never again, or typing over the suggestion would fight
   * with every refetch.
   */
  useEffect(() => {
    if (touched || guess.currency === "") return;

    const home = HOME_REGION[guess.currency];

    setLabel(
      home
        ? t(`wordpress.reTranslate.homeRegion.${guess.currency}`, home.label)
        : guess.currency,
    );
    setFlag(home?.flag ?? "");
  }, [guess.currency, touched, t, i18n.language]);

  const slug = normalizeRegionSlug(label);
  const busy =
    saveRegion.isPending || setDefault.isPending || savePrices.isPending;
  const ready = guess.currency !== "" && slug !== "";

  async function create() {
    const currency = guess.currency;

    const run = async () => {
      const made = await saveRegion.mutateAsync({
        slug,
        label: label.trim() || slug.toUpperCase(),
        flag: flag.trim(),
        currencies: [currency],
      });

      if (!made.ok) {
        throw new Error(
          made.error ?? t("common.error", "Something went wrong"),
        );
      }

      /*
       * On a site that already had regions the new one is not the default by
       * default — and the whole promise of this card is that it becomes one,
       * because only the default region's prices are read off the pages.
       */
      await setDefault.mutateAsync(slug);

      /*
       * File the page amounts under the new default. The scan already named
       * each row after the figure (`amount-eur-30000`); without the old
       * occurrence list that slug is how we know what to write.
       */
      const cells: ReTranslatePriceCellInput[] = [];

      for (const key of data.price_keys) {
        const parsed = parseAutoPriceSlug(key.slug);
        if (!parsed || parsed.currency !== currency) continue;
        cells.push({
          key: key.slug,
          region: slug,
          currency,
          amount_minor: parsed.amount_minor,
          display_places: 0,
        });
      }

      if (cells.length > 0) {
        const written = await savePrices.mutateAsync(cells);

        if (!written.ok) {
          throw new Error(
            written.error ?? t("common.error", "Something went wrong"),
          );
        }
      }
    };

    try {
      await flashWhile(run(), {
        busy: t("wordpress.reTranslate.settingUp", "Setting up…"),
        done: t("wordpress.reTranslate.setUpDone", "Ready"),
      });

      onChoose(slug);
    } catch {
      /* flashWhile has already said what went wrong. */
    }
  }

  /* Nothing read yet: there is no currency to propose, so ask for the read. */
  if (!scanned || guess.currency === "") {
    if (compact) return null;

    return (
      <div className="p-5 sm:p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-dashed px-5 py-8 text-center">
          <p className="text-sm font-medium">
            {scanned
              ? t(
                  "wordpress.reTranslate.firstRunNothingFound",
                  "No prices found on your pages",
                )
              : t(
                  "wordpress.reTranslate.firstRunUnread",
                  "Let’s find the prices you already publish",
                )}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            {scanned
              ? t(
                  "wordpress.reTranslate.firstRunNothingFoundHint",
                  "An amount written as a plain number with no currency symbol is not recognised — on purpose, because a bare number is as likely to be a year as a price. Set a region up by hand instead.",
                )
              : t(
                  "wordpress.reTranslate.firstRunUnreadHint",
                  "Scanning them tells us which currency your site quotes in, and fills this list in for you. Your pages are never edited.",
                )}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {scanned ? null : scanButton}
            <button
              type="button"
              onClick={onSetUpByHand}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t(
                "wordpress.reTranslate.firstRunByHand",
                "Set a region up myself",
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currency = currencyOf(data.currencies, guess.currency);

  return (
    <div className={compact ? "border-b p-5 sm:p-6" : "p-5 sm:p-6"}>
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border px-5 py-6">
        <div>
          <p className="text-sm font-medium">
            {t(
              "wordpress.reTranslate.firstRunTitle",
              "Your pages price in {{code}}",
              { code: currency.code },
            )}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {compact
              ? t(
                  "wordpress.reTranslate.firstRunOrphanHint",
                  "{{count}} amounts found, and no region here quotes {{code}} — so every price below has to be typed by hand. Name the region your pages are written for and they fill themselves in instead.",
                  { count: guess.count, code: currency.code },
                )
              : t(
                  "wordpress.reTranslate.firstRunHint",
                  "{{count}} amounts found. Name the region they belong to and they fill themselves in — you will only ever type prices for regions you add after this one.",
                  { count: guess.count },
                )}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !busy) void create();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_80px]">
            <Field>
              <Label htmlFor="rt-first-label">
                {t("wordpress.reTranslate.regionName", "Name")}
              </Label>
              <Input
                id="rt-first-label"
                value={label}
                autoFocus
                placeholder={t(
                  "wordpress.reTranslate.firstRunNamePlaceholder",
                  "Europe",
                )}
                onChange={(event) => {
                  setTouched(true);
                  setLabel(event.target.value);
                }}
              />
            </Field>
            <Field>
              <Label htmlFor="rt-first-flag">
                {t("wordpress.reTranslate.regionFlag", "Flag")}
              </Label>
              <Input
                id="rt-first-flag"
                value={flag}
                maxLength={8}
                className="text-center text-lg"
                onChange={(event) => {
                  setTouched(true);
                  setFlag(event.target.value);
                }}
              />
            </Field>
          </div>

          <InfoNote>
            {t(
              "wordpress.reTranslate.firstRunDefaultNote",
              "This becomes the default region: its prices are whatever your pages say, so there is nothing to type for it.",
            )}
          </InfoNote>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={!ready || busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t(
                "wordpress.reTranslate.firstRunConfirm",
                "Use {{code}} as my default region",
                { code: currency.code },
              )}
            </Button>
            <button
              type="button"
              onClick={onSetUpByHand}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t(
                "wordpress.reTranslate.firstRunByHand",
                "Set a region up myself",
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Characters the scanner keeps in front of an amount when it records the
 * sentence around it — `Extract\HTML_Fragment::context_around()`. Read here to
 * know where in that sentence this row's own amount is; if the plugin ever
 * changes it, the fallback below still lands on something sensible.
 */
const CONTEXT_LEAD = 48;

/**
 * A sentence off the page with this row's own amount picked out of it.
 *
 * Which occurrence to bold is a real question, because a line can quote the
 * same figure twice — "€250 setup, then €250 a month" is two rows sharing one
 * sentence. The sentence is a window cut around this row's amount, so the
 * amount sits at CONTEXT_LEAD unless the window ran into the start of the
 * block; that position is the answer when it is available, and the occurrence
 * nearest the middle is the guess when it is not. Both beat taking the first,
 * which is wrong for the second of any such pair.
 *
 * Rendered as text nodes, never as markup — this string is page content, and
 * the one thing it must not be able to do is bring its own HTML.
 */
function PriceSentence({ text, amount }: { text: string; amount: string }) {
  const needle = amount.trim();

  if (needle === "") return <>{text}</>;

  const hits: number[] = [];

  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
    hits.push(at);
  }

  if (hits.length === 0) return <>{text}</>;

  const middle = (text.length - needle.length) / 2;
  const start = hits.includes(CONTEXT_LEAD)
    ? CONTEXT_LEAD
    : hits.reduce((best, at) =>
        Math.abs(at - middle) < Math.abs(best - middle) ? at : best,
      );

  return (
    <>
      {text.slice(0, start)}
      <strong className="font-semibold text-foreground">{needle}</strong>
      {text.slice(start + needle.length)}
    </>
  );
}

/**
 * One row: what the page says on the left, what it costs here on the right.
 *
 * No name box and no shortcode on the row. The amount the page shows is what
 * you recognise it by; the line under it is the sentence and the page it sits
 * on — never the key name as a second figure.
 */
function PriceRow({
  priceKey,
  region,
  columns,
  page,
  origin,
  valueFor,
  changedFor,
  onValue,
  fromPage,
}: {
  priceKey: ReTranslatePriceKey;
  region: ReTranslateRegion;
  columns: ReTranslateCurrency[];
  /** The page this amount sits on, when the grid spans more than one. */
  page: string;
  origin?: ReTranslatePriceCell;
  valueFor: (currency: ReTranslateCurrency) => string;
  changedFor: (currency: ReTranslateCurrency) => boolean;
  onValue: (currency: ReTranslateCurrency, next: string) => void;
  /** What the page itself says here, when the page is what decides it. */
  fromPage: (currency: ReTranslateCurrency) => string | null;
}) {
  const { t } = useTranslation();
  const fromScan = parseAutoPriceSlug(priceKey.slug) != null;
  const sentence = (priceKey.context ?? "").trim();

  return (
    <tr className="group">
      <th
        scope="row"
        className="sticky left-0 z-10 border-b bg-card px-5 py-3 text-left font-normal group-hover:bg-muted/30 sm:px-6"
      >
        <span className="block font-mono text-sm font-semibold tabular-nums">
          {origin ? origin.formatted : priceKey.label}
        </span>

        {/*
         * Where the amount comes from, in the page's own words, with this
         * row's figure bolded inside it.
         *
         * The bold is the point rather than decoration. "€750 2nd site · €500
         * 3rd · €250 each additional" is one line and three rows, and without
         * it every one of them reads identically — the reader has the row's
         * own amount at the top and no way to see which figure in the sentence
         * it is. The page name goes in front only when the grid spans several.
         */}
        <span
          className="mt-0.5 block truncate text-[11px] text-muted-foreground"
          title={sentence ? [page, sentence].filter(Boolean).join(" · ") : undefined}
        >
          {sentence ? (
            <>
              {page ? <span className="opacity-70">{page} · </span> : null}
              <PriceSentence text={sentence} amount={priceKey.literal ?? ""} />
            </>
          ) : origin ? (
            [page, priceKey.label].filter(Boolean).join(" · ")
          ) : fromScan ? (
            t("wordpress.reTranslate.onPage", "on your pages")
          ) : (
            t("wordpress.reTranslate.typedByHand", "added by hand")
          )}
        </span>
      </th>

      {columns.map((currency) => {
        const page = fromPage(currency);

        return (
          <td
            key={currency.code}
            className="border-b px-2 py-3 group-hover:bg-muted/30"
          >
            {page === null ? (
              <MoneyInput
                value={valueFor(currency)}
                currency={currency}
                changed={changedFor(currency)}
                onChange={(next) => onValue(currency, next)}
                className="h-9 w-full min-w-28"
              />
            ) : (
              /*
               * No box, on purpose. This is the currency the page is written
               * in, in the region the page belongs to — the number is already
               * on the page and typing it here again would be copying it from
               * one place to another and hoping the two never drift.
               */
              <span
                className="flex h-9 min-w-28 items-center justify-end px-3 font-mono text-sm tabular-nums text-muted-foreground"
                title={t(
                  "wordpress.reTranslate.fromYourPageHint",
                  "Taken from your page. Edit the page to change it.",
                )}
              >
                {page}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/**
 * Add or edit a region.
 *
 * One currency, in a select. The old picker made the ordinary case — one region
 * quoting one currency — pay for the rare one: chips to click in, a click on
 * the code to promote it, an × to drop it. A second currency is still possible,
 * one link away, but it no longer sets the shape of the form.
 */
function RegionDialog({
  region,
  currencies,
  claimed,
  saving,
  onSubmit,
  onClose,
}: {
  region?: ReTranslateRegion;
  currencies: ReTranslateCurrency[];
  /** Codes another region already quotes — one currency, one region, one box. */
  claimed: string[];
  saving: boolean;
  onSubmit: (body: {
    slug: string;
    label: string;
    flag: string;
    currencies: string[];
  }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(region);

  const [label, setLabel] = useState(region?.label ?? "");
  const [flag, setFlag] = useState(region?.flag ?? "");
  const [picked, setPicked] = useState<string[]>(
    region && (region.currencies ?? []).length > 0 ? region.currencies : [""],
  );
  const slug = region ? region.slug : normalizeRegionSlug(label);
  const chosen = picked.filter((code) => code !== "");
  const valid = slug !== "" && chosen.length > 0;

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("wordpress.reTranslate.editRegionNamed", "Edit {{name}}", {
                  name: region?.label ?? "",
                })
              : t("wordpress.reTranslate.addRegion", "Add region")}
          </DialogTitle>
        </DialogHeader>

        <form
          id="rt-region-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || saving) return;
            /*
             * No `countries` key, rather than an empty one. The update
             * endpoint only touches a field it was sent, so leaving it out
             * keeps whatever a region already had — a form that stopped
             * showing something must not also delete it.
             */
            onSubmit({
              slug,
              label: label.trim() || slug.toUpperCase(),
              flag: flag.trim(),
              currencies: chosen,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_80px]">
            <Field>
              <Label htmlFor="rt-region-label">
                {t("wordpress.reTranslate.regionName", "Name")}
              </Label>
              <Input
                id="rt-region-label"
                value={label}
                autoFocus
                placeholder={t(
                  "wordpress.reTranslate.regionNamePlaceholder",
                  "Canada",
                )}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="rt-region-flag">
                {t("wordpress.reTranslate.regionFlag", "Flag")}
              </Label>
              <Input
                id="rt-region-flag"
                value={flag}
                maxLength={8}
                className="text-center text-lg"
                onChange={(event) => setFlag(event.target.value)}
              />
            </Field>
          </div>

          <Field>
            <Label htmlFor="rt-region-currency">
              {t("wordpress.reTranslate.regionCurrency", "Currency")}
            </Label>

            {picked.map((code, index) => (
              <div key={index} className="flex items-center gap-2">
                <NativeSelect
                  id={index === 0 ? "rt-region-currency" : undefined}
                  className="flex-1"
                  value={code}
                  aria-label={
                    index === 0
                      ? t("wordpress.reTranslate.regionCurrency", "Currency")
                      : t(
                          "wordpress.reTranslate.regionCurrencyExtra",
                          "Additional currency",
                        )
                  }
                  onChange={(event) =>
                    setPicked(
                      picked.map((entry, at) =>
                        at === index ? event.target.value : entry,
                      ),
                    )
                  }
                >
                  <NativeSelectOption value="">
                    {t(
                      "wordpress.reTranslate.currencyChoose",
                      "Choose a currency…",
                    )}
                  </NativeSelectOption>
                  {currencies
                    .filter(
                      (currency) =>
                        currency.code === code ||
                        (!picked.includes(currency.code) &&
                          !claimed.includes(currency.code)),
                    )
                    .map((currency) => (
                      <NativeSelectOption
                        key={currency.code}
                        value={currency.code}
                      >
                        {currency.symbol} {currency.code} — {currency.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>

                {index > 0 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t(
                      "wordpress.reTranslate.currencyRemove",
                      "Remove {{code}}",
                      { code: code || "—" },
                    )}
                    onClick={() =>
                      setPicked(picked.filter((_, at) => at !== index))
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}

            {picked.length > 1 ? (
              <FieldHint>
                {t(
                  "wordpress.reTranslate.regionCurrencyOrder",
                  "The first one is what this region shows. Each extra is another amount to type per price.",
                )}
              </FieldHint>
            ) : null}

            {claimed.length > 0 ? (
              <FieldHint>
                {t(
                  "wordpress.reTranslate.currencyClaimed",
                  "{{codes}} are not listed — another region already quotes them, and a currency gets one box, not two.",
                  { codes: claimed.join(", ") },
                )}
              </FieldHint>
            ) : null}

            {chosen.length === picked.length &&
            picked.length < currencies.length - claimed.length ? (
              <button
                type="button"
                onClick={() => setPicked([...picked, ""])}
                className="self-start text-xs font-medium underline-offset-2 hover:underline"
              >
                {t(
                  "wordpress.reTranslate.currencyAddAnother",
                  "+ another currency",
                )}
              </button>
            ) : null}
          </Field>

          {slug !== "" ? (
            <FieldHint>
              {editing
                ? t(
                    "wordpress.reTranslate.regionSlugFixed",
                    "Stored as {{slug}} — fixed, the amounts are filed under it.",
                    { slug },
                  )
                : t(
                    "wordpress.reTranslate.regionSlugHint",
                    "Stored as {{slug}} — fixed once created.",
                    { slug },
                  )}
            </FieldHint>
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            form="rt-region-form"
            disabled={!valid || saving}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {editing
              ? t("wordpress.reTranslate.saveRegion", "Save region")
              : t("wordpress.reTranslate.addRegion", "Add region")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirm removing a region.
 *
 * Two buttons and a checkbox, where there used to be three buttons. Keeping the
 * amounts is the safe answer and therefore the default one; deleting them is a
 * thing you opt into, not a third door of equal weight.
 */
function RemoveRegionDialog({
  region,
  busy,
  onClose,
  onRemove,
}: {
  region: ReTranslateRegion | null;
  busy: boolean;
  onClose: () => void;
  onRemove: (region: ReTranslateRegion, purge: boolean) => void;
}) {
  const { t } = useTranslation();
  const [purge, setPurge] = useState(false);

  return (
    <AlertDialog
      open={region != null}
      onOpenChange={(next) => {
        if (!next) {
          setPurge(false);
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("wordpress.reTranslate.removeRegionTitle", "Remove {{name}}?", {
              name: region?.label ?? "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "wordpress.reTranslate.removeRegionBody",
              "Your pages stop offering it straight away.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <PurgeCheck
          id="rt-purge-region"
          checked={purge}
          onChange={setPurge}
          label={t(
            "wordpress.reTranslate.alsoDeleteRegionAmounts",
            "Also delete the amounts saved for it",
          )}
          hint={t(
            "wordpress.reTranslate.alsoDeleteRegionAmountsHint",
            "Left unticked they are kept, so adding the region back restores them.",
          )}
        />

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy || region == null}
            onClick={() => region && onRemove(region, purge)}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("wordpress.reTranslate.removeRegion", "Remove region")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The one opt-in shared by both removal dialogs. */
function PurgeCheck({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
      <Checkbox
        id={id}
        checked={checked}
        className="mt-0.5"
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <FieldHint className="mt-0.5">{hint}</FieldHint>
      </div>
    </div>
  );
}

function MoneyInput({
  value,
  currency,
  changed,
  onChange,
  disabled,
  className,
}: {
  value: string;
  currency: ReTranslateCurrency;
  changed: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground"
      >
        {currency.symbol || currency.code}
      </span>
      <Input
        value={value}
        inputMode="decimal"
        placeholder="—"
        disabled={disabled}
        aria-label={currency.code}
        onChange={(event) => onChange(event.target.value)}
        /*
         * Tidy on the way out, so "19" stays "19" and "10.0" stays "10.0".
         */
        onBlur={() => {
          if (value.trim() === "") return;
          const parsed = parseMoneyParts(value, currency.exponent);
          if (parsed !== null) {
            onChange(
              moneyToInput(parsed.amount, currency.exponent, parsed.places),
            );
          }
        }}
        className={cn(
          "h-8 pl-8 text-right tabular-nums",
          changed && "border-primary bg-primary/5",
          className,
        )}
      />
    </div>
  );
}

