import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  WORKSPACE_AI_KEY,
  useCanManageWorkspaceAi,
  useWorkspaceAi,
  useWorkspaceAiMutations,
  useWorkspaceAiSpend,
} from "~/lib/hooks/useWorkspaceAi";
import { getIntlLocale } from "~/lib/utils/format";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export function meta() {
  return [
    { title: `${i18n.t("settings.ai.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.ai.metaDescription") },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function SettingsAi() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.ai.metaTitle",
    descriptionKey: "settings.ai.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const canManage = useCanManageWorkspaceAi();
  const status = useWorkspaceAi();

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      <div className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.ai.sectionLabel")}</SectionLabel>
          <p className="text-sm text-muted-foreground">
            {t("settings.ai.sectionDescription")}
          </p>
        </div>

        {status.isPending ? (
          <Skeleton className="h-[220px] w-full rounded-2xl" />
        ) : (
          <KeyCard canManage={canManage} />
        )}

        <SpendCard />

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            {t("settings.ai.adminOnly")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** What OpenRouter's redirect can tell us (?openrouter=… on /settings/ai). */
const OAUTH_OUTCOMES = ["connected", "denied", "expired", "error"] as const;
type OAuthOutcome = (typeof OAUTH_OUTCOMES)[number];

/**
 * The callback is a plain browser redirect, so the result arrives in the
 * query string. Read it once, then strip it so a refresh doesn't replay it.
 */
function useOAuthReturn(): [OAuthOutcome | null, () => void] {
  const location = useLocation();
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<OAuthOutcome | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("openrouter");
    if (!raw) return;
    const next = (OAUTH_OUTCOMES as readonly string[]).includes(raw) ? (raw as OAuthOutcome) : "error";
    setOutcome(next);
    if (next === "connected") void qc.invalidateQueries({ queryKey: WORKSPACE_AI_KEY });
    const url = new URL(window.location.href);
    for (const key of ["openrouter", "reason"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  return [outcome, () => setOutcome(null)];
}

/**
 * The trip the button starts: out to OpenRouter, back here. The middle stop
 * wears the marker — it is the one step that needs the owner.
 */
function RoundTrip() {
  const { t } = useTranslation();
  const stops = [t("settings.ai.oauth.trip1"), t("settings.ai.oauth.trip2"), t("settings.ai.oauth.trip3")];
  return (
    <ol className="relative grid gap-3 sm:grid-cols-3 sm:gap-2" aria-label={t("settings.ai.oauth.tripLabel")}>
      <span
        aria-hidden
        className="absolute left-[7px] top-2 bottom-2 border-l border-dashed border-foreground/25 sm:left-[calc(100%/6)] sm:right-[calc(100%/6)] sm:top-[7px] sm:bottom-auto sm:border-l-0 sm:border-t"
      />
      {stops.map((label, i) => (
        <li key={i} className="relative flex items-start gap-2.5 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
          <span
            aria-hidden
            className={
              i === 1
                ? "relative mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full bg-marker ring-4 ring-card sm:mt-0"
                : "relative mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-foreground bg-card ring-4 ring-card sm:mt-0"
            }
          />
          <span className={i === 1 ? "text-xs font-medium text-foreground" : "text-xs text-muted-foreground"}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OAuthResult({ outcome, onClose, onRetry, retrying }: {
  outcome: OAuthOutcome;
  onClose: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  const ok = outcome === "connected";
  return (
    <div
      role="status"
      className={
        ok
          ? "mb-4 flex items-start gap-3 rounded-xl border border-foreground/15 bg-background px-3.5 py-3"
          : "mb-4 flex flex-col gap-3 rounded-xl border border-marker bg-marker-soft/60 px-3.5 py-3 text-marker-ink sm:flex-row sm:items-center"
      }
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {ok ? (
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p className="text-sm">{t(`settings.ai.oauth.result.${outcome}`)}</p>
      </div>
      {ok ? (
        <button
          type="button"
          onClick={onClose}
          className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={t("common.close", { defaultValue: "Close" })}
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" variant="outline" className="shrink-0" loading={retrying} onClick={onRetry}>
          {t("settings.ai.oauth.tryAgain")}
        </Button>
      )}
    </div>
  );
}

function KeyCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const { data } = useWorkspaceAi();
  const m = useWorkspaceAiMutations();
  const [apiKey, setApiKey] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [oauthOutcome, closeOAuthResult] = useOAuthReturn();

  const isConnected = !!data?.connected;
  const revoked = data?.status === "revoked" || data?.status === "error";
  const viaOAuth = data?.connect_method === "oauth";

  const startOAuth = () =>
    m.startOAuth.mutate(undefined, {
      // On success the browser is already leaving for openrouter.ai.
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const connect = () =>
    m.connect.mutate(apiKey.trim(), {
      onSuccess: (s) => {
        setApiKey("");
        setPasteOpen(false);
        toast.success(
          t("settings.ai.connected", { name: s.key_label ?? "OpenRouter" }),
        );
      },
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const test = () =>
    m.test.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          t("settings.ai.testOk", {
            name: r.key_label ?? "OpenRouter",
            usage: r.usage != null ? `$${r.usage.toFixed(2)}` : "—",
          }),
        ),
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const disconnect = () =>
    m.disconnect.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        toast.success(t("settings.ai.disconnected"));
      },
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const setModel = (id: string) =>
    m.update.mutate(
      { default_chat_model: id },
      {
        onSuccess: () => toast.success(t("settings.ai.modelSaved")),
        onError: (e) => toast.error(extractErrorMessage(e)),
      },
    );

  const pasteForm = (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="workspace-ai-key">
            {isConnected ? t("settings.ai.rotateLabel") : t("settings.ai.keyLabel")}
          </Label>
          <Input
            id="workspace-ai-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled={!canManage}
            placeholder={t("settings.ai.keyPlaceholder")}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && apiKey.trim()) connect();
            }}
          />
        </div>
        <Button
          variant="outline"
          className="h-11 sm:h-9"
          disabled={!canManage || !apiKey.trim()}
          loading={m.connect.isPending}
          onClick={connect}
        >
          {m.connect.isPending ? null : <KeyRound className="mr-1.5 h-4 w-4" />}
          {isConnected ? t("settings.ai.rotate") : t("settings.ai.connect")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("settings.ai.keyHelp")}{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 underline"
        >
          openrouter.ai/keys
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );

  const pasteToggle = (
    <button
      type="button"
      disabled={!canManage}
      aria-expanded={pasteOpen}
      aria-controls="workspace-ai-paste"
      onClick={() => setPasteOpen((o) => !o)}
      className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground underline decoration-foreground/25 underline-offset-4 hover:text-foreground hover:decoration-foreground disabled:pointer-events-none disabled:opacity-50 sm:min-h-0"
    >
      <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${pasteOpen ? "rotate-180" : ""}`} />
      {isConnected ? t("settings.ai.oauth.pasteToggleConnected") : t("settings.ai.oauth.pasteToggle")}
    </button>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {oauthOutcome ? (
        <OAuthResult
          outcome={oauthOutcome}
          onClose={closeOAuthResult}
          onRetry={startOAuth}
          retrying={m.startOAuth.isPending}
        />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t("settings.ai.cardTitle")}
              </h3>
              {isConnected && !revoked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" />
                  {t("settings.ai.statusConnected")}
                </span>
              ) : revoked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.ai.statusRevoked")}
                </span>
              ) : null}
            </div>
            {isConnected ? (
              <>
                <p className="truncate text-xs text-muted-foreground">
                  {data?.key_label ?? "OpenRouter"}
                  {data?.api_key_masked ? ` · ${data.api_key_masked}` : null}
                  {" · "}
                  {viaOAuth ? t("settings.ai.oauth.methodOauth") : t("settings.ai.oauth.methodPasted")}
                </p>
                {data?.openrouter_key_url ? (
                  <a
                    href={data.openrouter_key_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                  >
                    {t("settings.ai.oauth.openKey")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {data?.last_error ? (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("settings.ai.lastError", { error: data.last_error })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.notConnectedHint")}
              </p>
            )}
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage}
              loading={m.test.isPending}
              onClick={test}
            >
              {m.test.isPending ? null : <Send className="mr-1.5 h-4 w-4" />}
              {t("settings.ai.test")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canManage}
              onClick={() => setConfirmDisconnect(true)}
              aria-label={t("settings.ai.disconnect")}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : null}
      </div>

      {isConnected ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {pasteToggle}
            <Button
              variant={revoked ? "default" : "outline"}
              size="sm"
              className="h-11 sm:h-8"
              disabled={!canManage}
              loading={m.startOAuth.isPending}
              onClick={startOAuth}
            >
              {m.startOAuth.isPending ? null : <ArrowUpRight className="mr-1.5 h-4 w-4" />}
              {t("settings.ai.oauth.reconnect")}
            </Button>
          </div>
          {pasteOpen ? (
            <div id="workspace-ai-paste" className="mt-3">
              {pasteForm}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          <RoundTrip />
          <div className="space-y-2.5">
            <Button
              className="h-12 w-full text-[15px] sm:w-auto sm:px-6"
              disabled={!canManage}
              loading={m.startOAuth.isPending}
              onClick={startOAuth}
            >
              {m.startOAuth.isPending ? null : <ArrowUpRight className="mr-2 h-4 w-4" />}
              {t("settings.ai.oauth.connect")}
            </Button>
            <p className="max-w-prose text-xs text-muted-foreground">
              {t("settings.ai.oauth.billing")}
            </p>
          </div>
          <div className="border-t border-dashed border-border pt-3">
            {pasteToggle}
            {pasteOpen ? (
              <div id="workspace-ai-paste" className="mt-3">
                {pasteForm}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isConnected ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_minmax(16rem,20rem)] sm:items-center">
            <div className="space-y-0.5">
              <Label htmlFor="default-chat-model">
                {t("settings.ai.defaultModel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.defaultModelHint")}
              </p>
            </div>
            <Select
              value={data?.default_chat_model}
              disabled={!canManage || m.update.isPending}
              onValueChange={setModel}
            >
              <SelectTrigger id="default-chat-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(data?.models ?? []).map((mo) => (
                  <SelectItem key={mo.id} value={mo.id}>
                    {mo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => !open && setConfirmDisconnect(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.ai.disconnectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.ai.disconnectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {data?.openrouter_key_url ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.ai.oauth.disconnectKeyStays")}{" "}
              <a
                href={data.openrouter_key_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-4"
              >
                {t("settings.ai.oauth.openKey")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.disconnect.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={m.disconnect.isPending}
              onClick={(e) => {
                e.preventDefault();
                disconnect();
              }}
            >
              {t("settings.ai.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ───────────────────────────────────────────────────────── what the key spent

/** Same rate the server converts caps with (workspace-ai/chat-models.ts USD_PER_EUR). */
const USD_PER_EUR = 1.08;

function money(microUsd: number): string {
  const eur = microUsd / 1_000_000 / USD_PER_EUR;
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: eur > 0 && eur < 0.1 ? 3 : 2,
  }).format(eur);
}

/**
 * Everything the key paid for this month, by job — website chat, AI
 * visibility, onboarding… Real OpenRouter charges where they were reported,
 * marked when part of it is our estimate. The exact bill stays OpenRouter's.
 */
function SpendCard() {
  const { t } = useTranslation();
  const { data } = useWorkspaceAiSpend();
  if (!data?.ready) return null;
  const [now, before] = data.months;
  if (!now || (!now.total_micro_usd && !before?.total_micro_usd)) return null;

  const label = (f: string) => t(`settings.ai.spend.feature.${f}`, { defaultValue: f });
  const top = now.features[0]?.cost_micro_usd || 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("settings.ai.spend.title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.ai.spend.subtitle")}</p>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-semibold leading-none text-foreground">{money(now.total_micro_usd)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.ai.spend.thisMonth")}
            {before ? ` · ${t("settings.ai.spend.lastMonth", { amount: money(before.total_micro_usd) })}` : ""}
          </p>
        </div>
      </div>

      {now.features.length ? (
        <ul className="mt-4 space-y-2.5">
          {now.features.map((f) => (
            <li key={f.feature} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">{label(f.feature)}</span>
                <span className="num shrink-0 text-muted-foreground">
                  {money(f.cost_micro_usd)}
                  {f.estimated_micro_usd > 0 ? <span title={t("settings.ai.spend.estimatedTitle")}>*</span> : null}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden>
                <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.max(2, (f.cost_micro_usd / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t("settings.ai.spend.nothingYet")}</p>
      )}

      <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{now.estimated_micro_usd > 0 ? t("settings.ai.spend.estimatedNote") : t("settings.ai.spend.realNote")}</span>
        <a
          href="https://openrouter.ai/activity"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
        >
          {t("settings.ai.spend.exactBill")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
