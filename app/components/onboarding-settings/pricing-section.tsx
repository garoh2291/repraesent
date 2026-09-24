import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, Globe, Loader2, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  applyPricingSync,
  getPricing,
  previewPricingSync,
  pricingKey,
  saveRegion,
  setPricingUrl,
  type PriceRegion,
  type PricingProposal,
  type RegionPrices,
} from "~/lib/api/root-onboarding";
import { formatMoney } from "~/lib/onboarding/helpers";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/** Every editable amount, in display order. Paths match the API's RegionPrices. */
const FIELDS: Array<{ group: "plan" | "setup" | "addons"; path: string; key: string }> = [
  { group: "plan", path: "plan.monthly", key: "planMonthly" },
  { group: "plan", path: "plan.yearly", key: "planYearly" },
  { group: "setup", path: "addons.cmsTransfer", key: "cmsTransfer" },
  { group: "setup", path: "addons.newWebsite", key: "newWebsite" },
  { group: "addons", path: "addons.managedAds.monthly", key: "adsMonthly" },
  { group: "addons", path: "addons.managedAds.setup", key: "adsSetup" },
  { group: "addons", path: "addons.contentUpdates.monthly", key: "contentMonthly" },
  { group: "addons", path: "addons.contentUpdates.yearly", key: "contentYearly" },
  { group: "addons", path: "addons.socialPosts.monthly", key: "socialMonthly" },
  { group: "addons", path: "addons.socialPosts.yearly", key: "socialYearly" },
  { group: "addons", path: "addons.hourly", key: "hourly" },
];

function getAt(p: RegionPrices, path: string): number {
  return path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), p) ?? 0;
}

function setAt(p: RegionPrices, path: string, value: number): RegionPrices {
  const next = structuredClone(p);
  const keys = path.split(".");
  let o: any = next;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]] = value;
  return next;
}

/** "1 000,50" / "1,000.50" / "300" → cents; null when it isn't a number. */
function parseMajor(raw: string): number | null {
  const s = raw.replace(/[\s ']/g, "").replace(/[^\d.,]/g, "");
  if (!s) return null;
  const sep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const decimals = sep >= 0 ? s.length - sep - 1 : 0;
  const normalized = sep >= 0 && decimals > 0 && decimals <= 2 ? s.slice(0, sep).replace(/[.,]/g, "") + "." + s.slice(sep + 1) : s.replace(/[.,]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function MoneyInput({
  cents,
  currency,
  onChange,
  label,
  id,
  disabled,
}: {
  cents: number;
  currency: string;
  onChange: (cents: number) => void;
  label: string;
  id: string;
  disabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const [text, setText] = useState(() => String(cents / 100));
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  // Follow outside changes (reset, sync) — but never rewrite what someone is typing.
  useEffect(() => {
    if (!focused) setText(String(cents / 100));
  }, [cents, focused]);
  const symbol = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value;
    } catch {
      return currency;
    }
  }, [currency, i18n.language]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground" aria-hidden>
        {symbol}
      </span>
      <Input
        id={id}
        aria-label={label}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        aria-invalid={invalid}
        className="pl-9 tabular-nums"
        onChange={(e) => {
          setText(e.target.value);
          const v = parseMajor(e.target.value);
          setInvalid(v === null);
          if (v !== null) onChange(v);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (parseMajor(text) === null) {
            setText(String(cents / 100));
            setInvalid(false);
          }
        }}
      />
    </div>
  );
}

function SourceLine({ region, regions }: { region: PriceRegion; regions: PriceRegion[] }) {
  const { t, i18n } = useTranslation();
  const when = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "";
  if (region.source === "fallback") {
    const from = regions.find((r) => r.key === region.fallbackFrom);
    return (
      <p className="flex items-start gap-1.5 text-[13px] text-amber-700">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("settings.onboarding.pricing.source.fallback", { currency: region.currency, region: from?.label ?? region.fallbackFrom ?? "" })}
      </p>
    );
  }
  const text =
    region.source === "website"
      ? t("settings.onboarding.pricing.source.website", { date: when(region.syncedAt) })
      : region.source === "manual"
        ? t("settings.onboarding.pricing.source.manual", { date: when(region.updatedAt) })
        : t("settings.onboarding.pricing.source.seed");
  return <p className="text-[13px] text-muted-foreground">{text}</p>;
}

/**
 * Settings → Onboarding → Prices. The numbers every new customer sees in
 * onboarding, per region and currency. Edit by hand, or "Sync from website":
 * the server reads repraesent.com/pricing per region, shows what would
 * change, and saves only when you press Apply.
 */
export function PricingSection() {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const key = pricingKey(currentWorkspace?.id);
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: getPricing });
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState<PriceRegion | null>(null);
  const [preview, setPreview] = useState<{ proposal: PricingProposal; signature: string } | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState("");

  const regions = data?.regions ?? [];
  const current = regions.find((r) => r.key === active) ?? regions[0] ?? null;

  useEffect(() => {
    if (current && (!draft || draft.key !== current.key || draft.updatedAt !== current.updatedAt || draft.source !== current.source)) {
      setDraft(structuredClone(current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, current?.updatedAt, current?.source]);

  useEffect(() => {
    if (data?.url) setUrlText(data.url);
  }, [data?.url]);

  const setRegions = (regions: PriceRegion[]) => qc.setQueryData(key, (old: typeof data) => (old ? { ...old, regions } : old));

  const save = useMutation({
    mutationFn: (r: PriceRegion) =>
      saveRegion(r.key, { label: r.label, currency: r.currency, countries: r.countries, timezones: r.timezones, prices: r.prices }),
    onSuccess: ({ regions }) => {
      setRegions(regions);
      toast.success(t("settings.onboarding.pricing.saved"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const sync = useMutation({
    mutationFn: previewPricingSync,
    onSuccess: (res) => setPreview(res),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const apply = useMutation({
    mutationFn: () => applyPricingSync(preview!.proposal, preview!.signature),
    onSuccess: ({ regions }) => {
      setRegions(regions);
      setPreview(null);
      toast.success(t("settings.onboarding.pricing.applied"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const saveUrl = useMutation({
    mutationFn: (u: string) => setPricingUrl(u.trim() || null),
    onSuccess: ({ url }) => {
      qc.setQueryData(key, (old: typeof data) => (old ? { ...old, url } : old));
      toast.success(t("settings.onboarding.pricing.urlSaved"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  if (isLoading || !data || !draft || !current) return <Skeleton className="h-96 w-full rounded-xl" />;

  const money = (c: number, cur = draft.currency) => formatMoney(c, cur, i18n.language);
  const dirty = JSON.stringify(draft) !== JSON.stringify(current);
  const p = draft.prices.plan;
  const twelve = p.monthly * 12;
  const freeMonths = p.monthly > 0 ? Math.round((twelve - p.yearly) / p.monthly) : 0;
  const yearlyTooHigh = p.yearly > twelve;
  const patchPrice = (path: string, cents: number) => setDraft((d) => (d ? { ...d, prices: setAt(d.prices, path, cents) } : d));
  const franchise = draft.prices.addons.franchise;
  const setFranchise = (next: number[]) => setDraft((d) => (d ? { ...d, prices: { ...d.prices, addons: { ...d.prices.addons, franchise: next } } } : d));
  const editable = data.editable;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Tag className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{t("settings.onboarding.pricing.title")}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{t("settings.onboarding.pricing.hint")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending} className="active:scale-[0.97]">
          {sync.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <RefreshCw className="mr-1.5 size-4" />}
          {sync.isPending ? t("settings.onboarding.pricing.syncing") : t("settings.onboarding.pricing.sync")}
        </Button>
      </div>

      {!editable ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("settings.onboarding.pricing.notEditable")}
        </p>
      ) : null}

      {/* Region switcher */}
      <div role="tablist" aria-label={t("settings.onboarding.pricing.regions")} className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-background p-1">
        {regions.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={r.key === current.key}
            onClick={() => setActive(r.key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors active:scale-[0.97]",
              r.key === current.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
            <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", r.key === current.key ? "bg-background/15" : "bg-muted")}>
              {r.currency}
            </span>
            {r.source === "fallback" ? <span className="size-1.5 rounded-full bg-amber-500" aria-label={t("settings.onboarding.pricing.fallbackDot")} /> : null}
          </button>
        ))}
      </div>

      <SourceLine region={current} regions={regions} />

      <fieldset disabled={!editable || save.isPending} className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        {/* Plan */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("settings.onboarding.pricing.plan")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === "plan").map((f) => (
              <label key={f.path} className="space-y-1.5" htmlFor={`price-${f.path}`}>
                <span className="text-[13px] font-medium">{t(`settings.onboarding.pricing.fields.${f.key}`)}</span>
                <MoneyInput
                  id={`price-${f.path}`}
                  label={t(`settings.onboarding.pricing.fields.${f.key}`)}
                  cents={getAt(draft.prices, f.path)}
                  currency={draft.currency}
                  onChange={(c) => patchPrice(f.path, c)}
                />
              </label>
            ))}
          </div>
          <p className={cn("mt-3 text-[13px]", yearlyTooHigh ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {yearlyTooHigh
              ? t("settings.onboarding.pricing.yearlyTooHigh", { twelve: money(twelve) })
              : t("settings.onboarding.pricing.planLine", {
                  twelve: money(twelve),
                  yearly: money(p.yearly),
                  months: freeMonths,
                  perDay: formatMoney(Math.round(p.yearly / 365), draft.currency, i18n.language, 2),
                })}
          </p>
        </div>

        {/* Setup & websites */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("settings.onboarding.pricing.setup")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === "setup").map((f) => (
              <label key={f.path} className="space-y-1.5" htmlFor={`price-${f.path}`}>
                <span className="text-[13px] font-medium">{t(`settings.onboarding.pricing.fields.${f.key}`)}</span>
                <MoneyInput
                  id={`price-${f.path}`}
                  label={t(`settings.onboarding.pricing.fields.${f.key}`)}
                  cents={getAt(draft.prices, f.path)}
                  currency={draft.currency}
                  onChange={(c) => patchPrice(f.path, c)}
                />
              </label>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-1.5 text-[13px] font-medium">{t("settings.onboarding.pricing.franchise")}</p>
            <div className="space-y-2">
              {franchise.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-[13px] text-muted-foreground">
                    {t("settings.onboarding.pricing.franchiseTier", { n: i + 1 })}
                  </span>
                  <MoneyInput
                    id={`price-franchise-${i}`}
                    label={t("settings.onboarding.pricing.franchiseTier", { n: i + 1 })}
                    cents={c}
                    currency={draft.currency}
                    onChange={(v) => setFranchise(franchise.map((x, j) => (j === i ? v : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("settings.onboarding.pricing.removeTier")}
                    onClick={() => setFranchise(franchise.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {franchise.length < 10 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFranchise([...franchise, franchise.at(-1) ?? 0])}>
                  <Plus className="mr-1 size-4" /> {t("settings.onboarding.pricing.addTier")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Add-ons */}
        <div className="rounded-xl border border-border p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">{t("settings.onboarding.pricing.addons")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.filter((f) => f.group === "addons").map((f) => (
              <label key={f.path} className="space-y-1.5" htmlFor={`price-${f.path}`}>
                <span className="text-[13px] font-medium">{t(`settings.onboarding.pricing.fields.${f.key}`)}</span>
                <MoneyInput
                  id={`price-${f.path}`}
                  label={t(`settings.onboarding.pricing.fields.${f.key}`)}
                  cents={getAt(draft.prices, f.path)}
                  currency={draft.currency}
                  onChange={(c) => patchPrice(f.path, c)}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Region details */}
        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3 lg:col-span-2">
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium">{t("settings.onboarding.pricing.regionName")}</span>
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium">{t("settings.onboarding.pricing.currency")}</span>
            <Input
              value={draft.currency}
              maxLength={3}
              className="uppercase"
              onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium">{t("settings.onboarding.pricing.countries")}</span>
            <Input
              value={draft.countries.join(", ")}
              disabled={draft.isDefault}
              placeholder={draft.isDefault ? t("settings.onboarding.pricing.everyoneElse") : "CA"}
              onChange={(e) =>
                setDraft({ ...draft, countries: e.target.value.toUpperCase().split(/[\s,;]+/).filter((c) => /^[A-Z]{2}$/.test(c)) })
              }
            />
          </label>
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {dirty && editable ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="mt-4 flex items-center justify-end gap-2"
          >
            <span className="mr-auto text-sm text-muted-foreground">{t("settings.onboarding.pricing.unsaved", { region: current.label })}</span>
            <Button type="button" variant="ghost" onClick={() => setDraft(structuredClone(current))}>
              {t("settings.onboarding.pricing.reset")}
            </Button>
            <Button type="button" onClick={() => save.mutate(draft)} disabled={save.isPending || yearlyTooHigh || draft.currency.length !== 3}>
              {save.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {t("settings.onboarding.pricing.save")}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Advanced: which page the sync reads */}
      <div className="mt-5 border-t border-border pt-4">
        <button type="button" onClick={() => setUrlOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground" aria-expanded={urlOpen}>
          <Globe className="size-3.5" /> {t("settings.onboarding.pricing.urlLabel")}
          <span className="font-normal">· {data.url.replace(/^https?:\/\//, "")}</span>
        </button>
        {urlOpen ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input value={urlText} onChange={(e) => setUrlText(e.target.value)} inputMode="url" aria-label={t("settings.onboarding.pricing.urlLabel")} />
            <Button type="button" variant="outline" onClick={() => saveUrl.mutate(urlText)} disabled={saveUrl.isPending || !editable}>
              {t("settings.onboarding.pricing.urlSave")}
            </Button>
          </div>
        ) : null}
      </div>

      <SyncPreviewDialog
        preview={preview?.proposal ?? null}
        regions={regions}
        editable={editable}
        applying={apply.isPending}
        onApply={() => apply.mutate()}
        onClose={() => setPreview(null)}
      />
    </section>
  );
}

function SyncPreviewDialog({
  preview,
  regions,
  editable,
  applying,
  onApply,
  onClose,
}: {
  preview: PricingProposal | null;
  regions: PriceRegion[];
  editable: boolean;
  applying: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const labelFor = (path: string) => {
    const f = FIELDS.find((x) => x.path === path);
    if (f) return t(`settings.onboarding.pricing.fields.${f.key}`);
    const m = /^addons\.franchise\.(\d+)$/.exec(path);
    return m ? t("settings.onboarding.pricing.franchiseTier", { n: Number(m[1]) + 1 }) : path;
  };
  const byKey = new Map(regions.map((r) => [r.key, r]));
  const readable = preview?.regions.filter((r) => r.outcome !== "unreadable") ?? [];

  return (
    <Dialog open={!!preview} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("settings.onboarding.pricing.previewTitle")}</DialogTitle>
          <DialogDescription>{t("settings.onboarding.pricing.previewSub", { url: preview?.url.replace(/^https?:\/\//, "") ?? "" })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {preview?.regions.map((r) => {
            const was = byKey.get(r.key);
            const money = (c: number | null) => (c === null ? "—" : formatMoney(c, r.currency, i18n.language));
            return (
              <div key={r.key} className="rounded-xl border border-border p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">{r.currency}</span>
                  {r.isNew ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t("settings.onboarding.pricing.newRegion")}</span>
                  ) : null}
                  <span
                    className={cn(
                      "ml-auto text-[12px] font-medium",
                      r.outcome === "priced" && "text-emerald-700",
                      r.outcome === "not_priced_on_site" && "text-amber-700",
                      r.outcome === "unreadable" && "text-destructive",
                    )}
                  >
                    {t(`settings.onboarding.pricing.outcome.${r.outcome}`, { count: r.found.length })}
                  </span>
                </div>
                {r.outcome === "not_priced_on_site" ? (
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {t("settings.onboarding.pricing.fallbackExplain", {
                      currency: r.currency,
                      region: preview.regions.find((x) => x.key === r.fallbackFrom)?.label ?? r.fallbackFrom ?? "",
                    })}
                  </p>
                ) : null}
                {r.currencyChanged && was ? (
                  <p className="mt-1.5 text-[13px] text-amber-700">{t("settings.onboarding.pricing.currencyChanged", { from: was.currency, to: r.currency })}</p>
                ) : null}
                {r.outcome !== "unreadable" ? (
                  r.changes.length ? (
                    <ul className="mt-2 divide-y divide-border text-sm">
                      {r.changes.map((c) => (
                        <li key={c.path} className="flex items-center gap-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">{labelFor(c.path)}</span>
                          <span className="tabular-nums text-muted-foreground line-through">{money(c.from)}</span>
                          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                          <span className="font-medium tabular-nums">{money(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Check className="size-3.5 text-emerald-600" aria-hidden /> {t("settings.onboarding.pricing.noChanges")}
                    </p>
                  )
                ) : (
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{t("settings.onboarding.pricing.unreadableExplain")}</p>
                )}
                {r.rejected.length ? (
                  <p className="mt-1.5 text-[12px] text-muted-foreground">{t("settings.onboarding.pricing.rejected", { count: r.rejected.length })}</p>
                ) : null}
              </div>
            );
          })}
          {preview?.missingOnSite.length ? (
            <p className="text-[13px] text-muted-foreground">
              {t("settings.onboarding.pricing.missingOnSite", {
                regions: preview.missingOnSite.map((k) => byKey.get(k)?.label ?? k).join(", "),
              })}
            </p>
          ) : null}
          {!editable ? <p className="text-[13px] text-amber-800">{t("settings.onboarding.pricing.notEditable")}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("settings.onboarding.pricing.cancel")}
          </Button>
          <Button type="button" onClick={onApply} disabled={!editable || applying || !readable.length}>
            {applying ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {preview?.hasChanges ? t("settings.onboarding.pricing.apply") : t("settings.onboarding.pricing.applyNoChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
