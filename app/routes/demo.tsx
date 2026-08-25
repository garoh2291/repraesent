import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import i18n from "~/i18n";
import { normalizeLocale } from "~/i18n/locales";
import { CLIENT_TYPES, type ClientType } from "~/lib/client-types";
import { createDemo } from "~/lib/api/demo";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { cn } from "~/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { LegalFooter } from "~/components/molecule/legal-footer";

export function meta() {
  return [
    { title: i18n.t("demo.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("demo.metaDescription") },
  ];
}

const FEATURE_KEYS = [
  "demo.feature1",
  "demo.feature2",
  "demo.feature3",
] as const;

const LOADING_STEP_KEYS = [
  "demo.loading.step1",
  "demo.loading.step2",
  "demo.loading.step3",
  "demo.loading.step4",
  "demo.loading.step5",
  "demo.loading.step6",
] as const;

/**
 * /demo-only presentation: plumber ranks second, and partner_house reads
 * "Kitchen partner house" (demo.industryOverrides.*) — the global
 * clientTypes.* wording stays untouched everywhere else.
 */
const DEMO_INDUSTRY_ORDER: ClientType[] = [
  "partner_house",
  "plumber",
  ...CLIENT_TYPES.filter(
    (type) => type !== "partner_house" && type !== "plumber",
  ),
];

/** One staged step every ~2.8s → ~17s show before the redirect. */
const STEP_MS = 2800;
const TOTAL_MS = STEP_MS * LOADING_STEP_KEYS.length;
const TICK_MS = 200;

/**
 * Public "Try a live demo" page (linked from /login and /register): pick an
 * industry in a searchable combobox, then a staged ~17s "building your demo"
 * show runs while the backend seeds the workspace; the one-time magic link
 * redirect fires once both the show and the API call are finished.
 */
export default function Demo() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "demo.metaTitle",
    descriptionKey: "demo.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const [industry, setIndustry] = useState<ClientType>("partner_house");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Honeypot — hidden from real visitors, bots fill it.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const redirectUrlRef = useRef<string | null>(null);
  const pickerContentRef = useRef<HTMLDivElement | null>(null);

  // The show's clock: advances steps + progress, and performs the redirect
  // once the full sequence has played AND the API has returned a URL.
  useEffect(() => {
    if (!building) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const now = Date.now() - startedAt;
      setElapsed(now);
      if (now >= TOTAL_MS && redirectUrlRef.current) {
        clearInterval(interval);
        // Full page load — /auth/callback consumes the one-time token.
        window.location.assign(redirectUrlRef.current);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [building]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setElapsed(0);
    redirectUrlRef.current = null;
    setBuilding(true);
    try {
      const { redirect_url } = await createDemo(
        industry,
        normalizeLocale(i18n.language),
        website
      );
      redirectUrlRef.current = redirect_url;
    } catch (err) {
      setBuilding(false);
      const status = err instanceof AxiosError ? err.response?.status : null;
      setError(status === 429 ? t("demo.rateLimited") : t("demo.error"));
    }
  };

  const industryLabel = (type: ClientType): string =>
    type === "partner_house"
      ? t("demo.industryOverrides.partner_house")
      : t(`clientTypes.${type}_one`);

  const currentStep = Math.min(
    Math.floor(elapsed / STEP_MS),
    LOADING_STEP_KEYS.length - 1
  );
  const progress = Math.min((elapsed / TOTAL_MS) * 100, 100);
  const waitingForApi = elapsed >= TOTAL_MS && !redirectUrlRef.current;

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[400px] flex-col justify-between bg-[#111113] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 grayscale"
          style={{ backgroundImage: "url(/auth-bg.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
        <div className="relative p-10 app-fade-down">
          <Link to="/login">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-8 w-auto brightness-0 invert"
            />
          </Link>
        </div>
        <div className="relative p-10 space-y-6 app-fade-up">
          <h2
            className="text-3xl leading-snug"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {t("demo.brandLine1")}
            <br />
            {t("demo.brandLine2")}
          </h2>
          <ul className="space-y-3">
            {FEATURE_KEYS.map((key) => (
              <li
                key={key}
                className="flex items-center gap-3 text-sm text-white/70"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-white/15">
            © {new Date().getFullYear()} Repraesent
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-stone-50 relative">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          {building ? (
            <BuildingShow
              currentStep={currentStep}
              progress={progress}
              waitingForApi={waitingForApi}
            />
          ) : (
            <div className="w-full max-w-sm space-y-8 app-fade-up">
              {/* Mobile logo */}
              <div className="lg:hidden flex items-center">
                <img
                  src={logoUrl}
                  alt="Repraesent"
                  className="h-7 w-auto max-w-[120px]"
                />
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  {t("demo.title")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("demo.subtitle")}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5 app-fade-up app-fade-up-d1"
              >
                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="demo-industry"
                    className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {t("demo.industryLabel")}
                  </label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger
                      id="demo-industry"
                      type="button"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      className="capitalize flex h-11 w-full items-center justify-between rounded-md border border-stone-200 bg-white px-3 text-sm text-foreground shadow-xs transition-shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25"
                    >
                      <span className="truncate">{industryLabel(industry)}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent
                      ref={pickerContentRef}
                      align="start"
                      className="p-0 w-(--radix-popover-trigger-width)"
                      onOpenAutoFocus={(e) => {
                        // cmdk's CommandInput doesn't autofocus inside a Radix
                        // Popover — focus it explicitly so typing filters
                        // immediately (same workaround as phone-number-input).
                        e.preventDefault();
                        requestAnimationFrame(() => {
                          pickerContentRef.current
                            ?.querySelector<HTMLInputElement>(
                              '[data-slot="command-input"]'
                            )
                            ?.focus();
                        });
                      }}
                    >
                      <Command>
                        <CommandInput placeholder={t("demo.industrySearch")} />
                        <CommandList className="max-h-72 overscroll-contain">
                          <CommandEmpty>{t("demo.industryEmpty")}</CommandEmpty>
                          <CommandGroup>
                            {DEMO_INDUSTRY_ORDER.map((type) => {
                              const label = industryLabel(type);
                              return (
                                <CommandItem
                                  key={type}
                                  value={`${label} ${type}`}
                                  onSelect={() => {
                                    setIndustry(type);
                                    setPickerOpen(false);
                                  }}
                                  className="flex items-center gap-2 cursor-pointer capitalize"
                                >
                                  <span className="flex-1 truncate">
                                    {label}
                                  </span>
                                  {industry === type ? (
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  ) : null}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Honeypot — real visitors never see or fill this. */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] top-auto h-px w-px opacity-0"
                />

                <button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {t("demo.submitButton")}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("demo.haveAccount")}{" "}
                  <Link
                    to="/login"
                    className="text-primary font-medium hover:underline"
                  >
                    {t("demo.signIn")}
                  </Link>
                </p>
              </form>
            </div>
          )}
        </div>

        {/* Legal links */}
        <LegalFooter />
      </div>
    </div>
  );
}

/** Order in which the 3×3 puzzle tiles pop in (not simply row by row). */
const TILE_ORDER = [4, 0, 8, 2, 6, 1, 5, 3, 7];

function BuildingShow({
  currentStep,
  progress,
  waitingForApi,
}: {
  currentStep: number;
  progress: number;
  waitingForApi: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-sm space-y-8 app-fade-up" aria-live="polite">
      {/* Puzzle assembly — DOM order is the grid position; the pop order
          comes from each position's rank in TILE_ORDER. */}
      <div className="mx-auto grid w-28 grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, pos) => (
          <div
            key={pos}
            className={cn(
              "app-puzzle-tile aspect-square rounded-md",
              pos % 2 === 0 ? "bg-foreground/85" : "bg-amber-400"
            )}
            style={{ animationDelay: `${TILE_ORDER.indexOf(pos) * 0.32}s` }}
          />
        ))}
      </div>

      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("demo.loading.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("demo.loading.hint")}
        </p>
      </div>

      {/* Staged checklist */}
      <ul className="space-y-2.5">
        {LOADING_STEP_KEYS.map((key, i) => {
          const done = i < currentStep || (!waitingForApi && progress >= 100);
          const active = i === currentStep && !done;
          return (
            <li
              key={key}
              className={cn(
                "flex items-center gap-2.5 text-sm transition-colors duration-300",
                done
                  ? "text-foreground"
                  : active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/50"
              )}
            >
              <span className="inline-grid h-5 w-5 shrink-0 place-items-center">
                {done ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 app-spin text-amber-500" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              {t(key)}
            </li>
          );
        })}
      </ul>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
