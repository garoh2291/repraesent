import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRing, ExternalLink, Loader2, Mail, RefreshCw, Smartphone } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import { getIntlLocale, formatRelativeTime } from "~/lib/utils/format";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getLowBalanceAlert, getWorkspaceAiBalance, setLowBalanceAlert, type OpenRouterBalance } from "~/lib/api/workspace-ai";
import { usePhoneAlertDevices } from "~/lib/hooks/use-phone-alerts";
import { useAuthContext } from "~/providers/auth-provider";
import { SPRING } from "~/lib/motion";

const usd = (n: number) =>
  new Intl.NumberFormat(getIntlLocale(), { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** What can still be spent: the tighter of account balance and this key's own limit. */
function spendable(b: OpenRouterBalance): number | null {
  const v = [b.balance_usd, b.key_limit_remaining_usd].filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
}

export function useAiBalance(enabled: boolean) {
  const { currentWorkspace } = useAuthContext();
  return useQuery({
    queryKey: ["workspace-ai-balance", currentWorkspace?.id ?? null],
    queryFn: () => getWorkspaceAiBalance(false),
    enabled: enabled && !!currentWorkspace,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * The money left on the OpenRouter account the chat and AI visibility run on.
 * Zero is why answers fail, so it is said plainly with the one fix.
 */
export function BalanceCard({ threshold, problem }: { threshold: number | null; problem: "credits" | "revoked" | null | undefined }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const q = useAiBalance(true);
  const refresh = useMutation({
    mutationFn: () => getWorkspaceAiBalance(true),
    onSuccess: (d) => {
      qc.setQueryData(["workspace-ai-balance", currentWorkspace?.id ?? null], d);
      void qc.invalidateQueries({ queryKey: ["workspace-ai-settings"] });
    },
  });
  const b = q.data?.balance ?? null;
  const left = b ? spendable(b) : null;
  const empty = problem === "credits" || (left != null && left <= 0);
  const low = !empty && left != null && threshold != null && left < threshold;

  return (
    <div className={cn("rounded-2xl border bg-card p-5 sm:p-6", empty ? "border-marker" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("settings.ai.balance.title", "Balance")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.ai.balance.subtitle", "Money left on your OpenRouter account. Chat and AI visibility stop when it runs out.")}</p>
        </div>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="press inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground max-sm:h-11"
        >
          <RefreshCw className={cn("size-3.5", refresh.isPending && "animate-spin motion-reduce:animate-none")} aria-hidden />
          {t("settings.ai.balance.refresh", "Check now")}
        </button>
      </div>

      {q.isPending ? (
        <div className="mt-4 h-10 w-40 animate-pulse rounded-lg bg-muted" />
      ) : !q.data?.ok || !b ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("settings.ai.balance.unknown", "OpenRouter didn't tell us the balance right now. Try “Check now” in a minute.")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className={cn("num text-[34px] font-semibold leading-none tracking-tight", empty ? "text-foreground" : "text-foreground")}>
                {left != null ? <span className={cn(empty || low ? "marker" : undefined)}>{usd(left)}</span> : "—"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {empty
                  ? t("settings.ai.balance.empty", "Nothing left — answers stop until you add credits")
                  : low
                    ? t("settings.ai.balance.low", "Below your alert of {{amount}}", { amount: usd(threshold!) })
                    : t("settings.ai.balance.left", "left to spend")}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {b.key_usage_monthly_usd != null ? (
                <>
                  <dt className="text-muted-foreground">{t("settings.ai.balance.usedMonth", "Used this month")}</dt>
                  <dd className="num text-right font-medium text-foreground">{usd(b.key_usage_monthly_usd)}</dd>
                </>
              ) : null}
              {b.total_usage_usd != null ? (
                <>
                  <dt className="text-muted-foreground">{t("settings.ai.balance.usedAll", "Used in total")}</dt>
                  <dd className="num text-right font-medium text-foreground">{usd(b.total_usage_usd)}</dd>
                </>
              ) : null}
              {b.key_limit_usd != null ? (
                <>
                  <dt className="text-muted-foreground">{t("settings.ai.balance.keyLimit", "This key's limit")}</dt>
                  <dd className="num text-right font-medium text-foreground">{usd(b.key_limit_usd)}</dd>
                </>
              ) : null}
            </dl>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{t("settings.ai.balance.checked", "Checked {{when}}", { when: formatRelativeTime(b.checked_at) })}</span>
            <a
              href="https://openrouter.ai/settings/credits"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "press inline-flex items-center justify-center gap-1.5 rounded-lg font-medium",
                empty || low ? "h-10 bg-foreground px-4 text-[13.5px] text-background" : "text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground",
              )}
            >
              {t("settings.ai.balance.addCredits", "Add credits on OpenRouter")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Tell me when the balance is low". Off by default; on asks for the amount
 * (required) and where to send it — phone and email both ticked by default.
 * Checked once a day, at most one alert a day.
 */
export function LowBalanceAlertCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { currentWorkspace } = useAuthContext();
  const key = ["workspace-ai-low-balance", currentWorkspace?.id ?? null];
  const q = useQuery({ queryKey: key, queryFn: getLowBalanceAlert, enabled: !!currentWorkspace, retry: false });
  const devices = usePhoneAlertDevices();

  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("");
  const [channels, setChannels] = useState<Array<"push" | "email">>(["push", "email"]);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setEnabled(q.data.enabled);
    setAmount(q.data.threshold_usd != null ? String(q.data.threshold_usd) : "");
    setChannels(q.data.channels.length ? q.data.channels : ["push", "email"]);
    setTouched(false);
  }, [q.data]);

  const parsed = amount.trim() === "" ? null : Number(amount.replace(",", "."));
  const amountError =
    enabled && (parsed == null || !Number.isFinite(parsed) || parsed <= 0)
      ? t("settings.ai.alert.amountRequired", "Enter the balance to warn you at, for example 5.")
      : null;
  const channelError = enabled && channels.length === 0 ? t("settings.ai.alert.channelRequired", "Pick phone, email or both.") : null;
  const dirty =
    !!q.data &&
    (enabled !== q.data.enabled ||
      (enabled && parsed !== q.data.threshold_usd) ||
      channels.slice().sort().join() !== q.data.channels.slice().sort().join());

  const save = useMutation({
    mutationFn: (body: { enabled: boolean; threshold_usd: number | null; channels: Array<"push" | "email"> }) => setLowBalanceAlert(body),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      toast.success(d.enabled ? t("settings.ai.alert.savedOn", "Low balance alert is on.") : t("settings.ai.alert.savedOff", "Low balance alert is off."));
    },
    onError: (err) => toast.error(extractErrorMessage(err) || t("settings.ai.alert.saveFailed", "That didn't save. Try again.")),
  });

  const submit = () => {
    setTouched(true);
    if (amountError || channelError) return;
    save.mutate({ enabled, threshold_usd: enabled ? parsed : (parsed ?? null), channels });
  };

  const toggleChannel = (c: "push" | "email") =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  if (q.isError) return null;
  const noPhone = enabled && channels.includes("push") && devices.data && devices.data.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", enabled ? "bg-marker text-foreground" : "bg-muted text-muted-foreground")}>
            <BellRing className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 id="low-balance-title" className="text-sm font-semibold text-foreground">{t("settings.ai.alert.title", "Warn me when the balance is low")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.ai.alert.subtitle", "We check once a day and tell you at most once a day while it's below.")}</p>
          </div>
        </div>
        <label className="-m-2 flex min-h-11 min-w-11 items-center justify-center p-2">
          <Switch
            checked={enabled}
            disabled={!canManage || q.isPending}
            onCheckedChange={(v) => {
              setEnabled(v);
              setTouched(false);
              // Turning it off saves right away; turning it on waits for the amount.
              if (!v && q.data?.enabled) save.mutate({ enabled: false, threshold_usd: parsed, channels: channels.length ? channels : ["push", "email"] });
            }}
            aria-labelledby="low-balance-title"
          />
        </label>
      </div>

      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div
            key="form"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reduce ? { duration: 0.15 } : SPRING}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="space-y-1.5">
                <label htmlFor="low-balance-amount" className="block text-[13px] font-medium text-foreground">
                  {t("settings.ai.alert.amount", "Warn me below")}
                </label>
                <div className={cn("flex h-11 w-40 items-center rounded-lg border bg-background px-3 focus-within:border-foreground/40", touched && amountError ? "border-destructive" : "border-border")}>
                  <span className="text-[15px] text-muted-foreground">$</span>
                  <input
                    id="low-balance-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    disabled={!canManage}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="5"
                    aria-invalid={!!(touched && amountError)}
                    aria-describedby="low-balance-amount-error"
                    className="num ml-1.5 w-full bg-transparent text-[16px] outline-none"
                  />
                </div>
                {touched && amountError ? (
                  <p id="low-balance-amount-error" role="alert" className="text-xs text-destructive">{amountError}</p>
                ) : null}
              </div>

              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-[13px] font-medium text-foreground">{t("settings.ai.alert.how", "How to tell you")}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["push", "email"] as const).map((c) => {
                    const on = channels.includes(c);
                    const Icon = c === "push" ? Smartphone : Mail;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={!canManage}
                        onClick={() => toggleChannel(c)}
                        className={cn(
                          "press inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors max-sm:h-11",
                          on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        {c === "push" ? t("settings.ai.alert.phone", "Phone") : t("settings.ai.alert.email", "Email")}
                      </button>
                    );
                  })}
                </div>
                {touched && channelError ? <p role="alert" className="text-xs text-destructive">{channelError}</p> : null}
                {noPhone ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.ai.alert.noPhone", "None of your phones get alerts yet.")}{" "}
                    <Link to="/settings/phone-alerts" className="font-medium text-foreground underline underline-offset-4">
                      {t("settings.ai.alert.turnOnPhone", "Turn on phone alerts")}
                    </Link>
                  </p>
                ) : null}
              </fieldset>

              {canManage ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={save.isPending || (!dirty && q.data?.enabled === true)}
                    className="press inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background disabled:opacity-40 max-sm:h-11"
                  >
                    {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {q.data?.enabled ? t("settings.ai.alert.save", "Save changes") : t("settings.ai.alert.turnOn", "Turn on the alert")}
                  </button>
                  {q.data?.last_alerted_at ? (
                    <span className="text-xs text-muted-foreground">
                      {t("settings.ai.alert.last", "Last alert {{when}}", { when: formatRelativeTime(q.data.last_alerted_at) })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
