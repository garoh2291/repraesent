import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Check, Globe, Loader2 } from "lucide-react";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";
import { SPRING } from "~/lib/motion";
import { desktopAutoFocus } from "~/lib/utils/touch";
import {
  SEVERITIES,
  createHelpTicket,
  getHelpWebsites,
  helpKeys,
  type Severity,
  type TicketDetail,
} from "~/lib/api/support-tickets";
import { ScreenshotPicker, useScreenshots } from "./composer";
import { SEVERITY_ICON, TicketStub, useSeverityLabel } from "./ticket-bits";

/**
 * Help & changes, customer side (SUPPORT_TICKETS_PLAN.md). Who may see it:
 * every customer workspace — not the root (that is re:praesent itself), not a
 * live demo, not a DoorBoost brand. Hidden until the server has the tables.
 */
export function useHelpAvailable() {
  const { currentWorkspace } = useAuthContext();
  const eligible =
    !!currentWorkspace &&
    currentWorkspace.is_root !== true &&
    currentWorkspace.is_demo !== true &&
    currentWorkspace.type !== "doorboost_brand";
  const q = useQuery({
    queryKey: helpKeys.websites(currentWorkspace?.id),
    queryFn: getHelpWebsites,
    enabled: eligible,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return {
    available: eligible && q.data?.ready === true,
    websites: q.data?.websites ?? [],
    /** Reports where we wait for the customer: the marker count. */
    waiting: q.data?.waiting ?? 0,
  };
}

interface HelpApi {
  /** Open "Report a problem or ask for a change" over the current page. */
  openNew: () => void;
}
const HelpContext = createContext<HelpApi | null>(null);

export function useHelp(): HelpApi {
  return useContext(HelpContext) ?? { openNew: () => {} };
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { available } = useHelpAvailable();
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  // `?new=1` on /help (links in emails, bookmarks) opens it once.
  useEffect(() => {
    if (available && params.get("new") === "1" && pathname.startsWith("/help")) {
      setOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [available, params, setParams, pathname]);
  const api = useMemo(() => ({ openNew: () => setOpen(true) }), []);
  return (
    <HelpContext.Provider value={api}>
      {children}
      {available ? <NewReportSheet open={open} onOpenChange={setOpen} /> : null}
    </HelpContext.Provider>
  );
}

function NewReportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const [done, setDone] = useState<TicketDetail | null>(null);
  // A fresh form every time it opens.
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) {
      setDone(null);
      setKey((k) => k + 1);
    }
  }, [open]);
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={done ? t("help.new.sentTitle", "Got it") : t("help.new.title", "Report a problem or ask for a change")}
      description={done ? undefined : t("help.new.subtitle", "We answer right here, and you get an email when we do.")}
      className="sm:max-w-[560px]"
    >
      {done ? <Sent ticket={done} onClose={() => onOpenChange(false)} /> : <NewReportForm key={key} onSent={setDone} />}
    </BottomSheet>
  );
}

function NewReportForm({ onSent }: { onSent: (t: TicketDetail) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { currentWorkspace } = useAuthContext();
  const { websites } = useHelpAvailable();
  const severityLabel = useSeverityLabel("client");
  const [urlId, setUrlId] = useState<string | null>(websites[0]?.id ?? null);
  const [severity, setSeverity] = useState<Severity>("normal");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [showPage, setShowPage] = useState(false);
  const shots = useScreenshots();
  const site = websites.find((w) => w.id === urlId) ?? null;
  const tooShort = description.trim().length < 5;

  const create = useMutation({
    mutationFn: () =>
      createHelpTicket({ url_id: urlId, severity, description: description.trim(), page_url: page.trim() || null, files: shots.files }),
    onSuccess: (ticket) => {
      void qc.invalidateQueries({ queryKey: helpKeys.all(currentWorkspace?.id) });
      onSent(ticket);
    },
  });

  const hints: Record<Severity, string> = {
    urgent: t("help.severityHint.urgent", "Nobody can reach the site, or a key page or form fails."),
    normal: t("help.severityHint.normal", "A page looks wrong, a button or form misbehaves."),
    low: t("help.severityHint.low", "New text or photos, opening hours, a quick question."),
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort && !create.isPending) create.mutate();
      }}
      onPaste={shots.onPaste}
      className="space-y-5 pb-1"
    >
      {/* 1 · Which website: a chip when there's one, a choice when there are more. */}
      {websites.length === 1 ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[13px] text-foreground/80">
          <Globe className="size-3.5" aria-hidden />
          {t("help.new.about", "About {{host}}", { host: websites[0].host })}
        </p>
      ) : websites.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-semibold text-foreground">{t("help.new.whichSite", "Which website?")}</legend>
          <div className="flex flex-wrap gap-2">
            {[...websites.map((w) => ({ id: w.id as string | null, label: w.host })), { id: null, label: t("help.new.noSite", "Something else") }].map((o) => {
              const on = urlId === o.id;
              return (
                <button
                  key={o.id ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setUrlId(o.id)}
                  className={cn(
                    "press h-10 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors max-sm:h-11",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {/* 2 · How bad is it? */}
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-foreground">{t("help.new.howBad", "How bad is it?")}</legend>
        <div role="radiogroup" className="grid gap-2">
          {SEVERITIES.map((s) => {
            const Icon = SEVERITY_ICON[s];
            const on = severity === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSeverity(s)}
                className={cn(
                  "press relative flex min-h-[56px] items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  on ? "border-foreground bg-background" : "border-border bg-card hover:border-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    on ? (s === "urgent" ? "bg-destructive text-white" : "bg-foreground text-background") : "bg-muted text-foreground/70",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold leading-snug text-foreground">{severityLabel(s)}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{hints[s]}</span>
                </span>
                {on ? (
                  <motion.span
                    layoutId="sev-check"
                    transition={reduce ? { duration: 0 } : SPRING}
                    className="ml-auto mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <Check className="size-3" aria-hidden />
                  </motion.span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 3 · What's going on? */}
      <div className="space-y-2">
        <label htmlFor="help-desc" className="block text-[13px] font-semibold text-foreground">
          {t("help.new.what", "What's going on?")}
        </label>
        <textarea
          id="help-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus={desktopAutoFocus()}
          rows={4}
          maxLength={5000}
          placeholder={t("help.new.whatPlaceholder", "e.g. The contact form doesn't send. I tried on my phone this morning, the button just spins.")}
          className="block w-full resize-y rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--foreground)_6%,transparent)] max-sm:text-[16px]"
        />
      </div>

      {/* 4 · Optional: page + screenshot. */}
      <div className="space-y-3">
        {!showPage ? (
          <button
            type="button"
            onClick={() => {
              setShowPage(true);
              setPage(site ? `${site.host}/` : "");
            }}
            className="press block min-h-10 text-[13.5px] font-medium text-foreground/75 underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
          >
            {t("help.new.addPage", "+ Which page? (optional)")}
          </button>
        ) : null}
        {showPage ? (
          <div className="space-y-1.5">
            <label htmlFor="help-page" className="block text-[13px] font-semibold text-foreground">
              {t("help.new.page", "Which page?")} <span className="font-normal text-muted-foreground">{t("help.new.optional", "(optional)")}</span>
            </label>
            <input
              id="help-page"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              inputMode="url"
              autoComplete="url"
              placeholder={t("help.new.pagePlaceholder", "Paste the address from your browser")}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-[15px] outline-none focus:border-foreground/40 max-sm:h-11 max-sm:text-[16px]"
            />
          </div>
        ) : null}
        <ScreenshotPicker shots={shots} label={t("help.new.addScreenshot", "Add a screenshot (optional)")} />
        <p className="text-[12px] text-muted-foreground">{t("help.new.pasteHint", "Tip: you can paste a screenshot straight in.")}</p>
      </div>

      {create.isError ? (
        <p role="alert" className="rounded-lg bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
          {extractErrorMessage(create.error) || t("help.new.failed", "The report didn't go through. Check your connection and send it again.")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={tooShort || create.isPending}
        className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[15px] font-semibold text-background transition-opacity disabled:opacity-40"
      >
        {create.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("help.new.send", "Send to re:praesent")}
      </button>
    </form>
  );
}

function Sent({ ticket, onClose }: { ticket: TicketDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.15 } : SPRING}
      className="space-y-5 pb-2"
    >
      <div className="flex items-center gap-3">
        <TicketStub number={ticket.number} size="lg" />
        <span className="flex size-7 items-center justify-center rounded-full bg-marker">
          <Check className="size-4 text-foreground" aria-hidden />
        </span>
      </div>
      <p className="text-[15px] leading-relaxed text-foreground">
        {user?.email
          ? t("help.new.sentBody", "We'll answer here and email you at {{email}} when we do.", { email: user.email })
          : t("help.new.sentBodyNoEmail", "We'll answer here and email you when we do.")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(`/help/${ticket.id}`);
          }}
          className="press h-11 flex-1 rounded-xl bg-foreground px-4 text-[15px] font-semibold text-background"
        >
          {t("help.new.seeIt", "See the report")}
        </button>
        <button type="button" onClick={onClose} className="press h-11 flex-1 rounded-xl border border-border px-4 text-[15px] font-medium">
          {t("common.close", "Close")}
        </button>
      </div>
    </motion.div>
  );
}
