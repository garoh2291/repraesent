import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  disconnectCalendarAccount,
  getCalendarAuthorizeUrl,
  listCalendarAccounts,
  refreshAccountCalendars,
  type BaikalConfig,
  type CalendarAccount,
} from "~/lib/api/calendar";
import { Button } from "~/components/ui/button";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: `${i18n.t("settings.calendars.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.calendars.metaDescription"),
    },
  ];
}

/** Matches the eyebrow used by every other settings page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function SettingsSection({
  label,
  description,
  action,
  children,
}: {
  label: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Stacked on a phone: side by side, the connect button squeezed the
          description into a column barely wide enough for one word. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-0.5">
          <SectionLabel>{label}</SectionLabel>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="sm:shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** Google's four-colour mark. Their branding rules require the real logo. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** Every result the OAuth callback can bounce back with. */
type GoogleOutcome = "connected" | "denied" | "expired" | "error" | "failed";

const GOOGLE_OUTCOMES: GoogleOutcome[] = [
  "connected",
  "denied",
  "expired",
  "error",
  "failed",
];

export default function SettingsCalendars() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.calendars.metaTitle",
    descriptionKey: "settings.calendars.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const isAdmin = currentWorkspace?.member_role === "admin";

  const [googleStarting, setGoogleStarting] = useState(false);
  const [googleResult, setGoogleResult] = useState<{
    outcome: GoogleOutcome;
    email?: string;
    reason?: string;
  } | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<CalendarAccount | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
  });

  // The summary key feeds other surfaces (badges, the Calendar page's empty
  // state), so anything that changes an account has to invalidate both.
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-summary"] }),
    ]);
  };

  // Google sends the user back to this page with the result in the query
  // string, because the callback is a plain browser redirect with nowhere else
  // to put it. Read it once into state, then strip it from the address bar so a
  // refresh doesn't resurrect a stale "connected!" the user has moved past.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("google");
    if (!raw) return;

    const outcome = (GOOGLE_OUTCOMES as string[]).includes(raw)
      ? (raw as GoogleOutcome)
      : "error";

    setGoogleResult({
      outcome,
      email: params.get("email") ?? undefined,
      reason: params.get("reason") ?? undefined,
    });

    // The new account was written server-side, so the cached list is stale.
    if (outcome === "connected") void invalidate();

    const url = new URL(window.location.href);
    for (const key of ["google", "email", "reason"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function handleConnect() {
    setGoogleStarting(true);
    try {
      // Full-page navigation, not a popup: the consent screen is a multi-step
      // flow and Google discourages framing it.
      window.location.href = await getCalendarAuthorizeUrl();
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setGoogleStarting(false);
    }
    // No `finally` — on success the page is already navigating away, and
    // clearing the flag would flash the button back to idle mid-unload.
  }

  const refreshMutation = useMutation({
    mutationFn: refreshAccountCalendars,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendarAccount,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("settings.calendars.disconnectSuccess"));
      setPendingDisconnect(null);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const accounts = data?.accounts ?? [];
  const baikalConfigs = data?.baikal_configs ?? [];

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      {googleResult ? (
        <GoogleResultBanner
          result={googleResult}
          onDismiss={() => setGoogleResult(null)}
        />
      ) : null}

      <SettingsSection
        label={t("settings.calendars.googleSection")}
        description={t("settings.calendars.googleSectionDescription")}
        action={
          accounts.length > 0 ? (
            <ConnectButton
              googleStarting={googleStarting}
              onConnect={handleConnect}
            />
          ) : undefined
        }
      >
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : accounts.length === 0 ? (
          <GoogleEmptyState
            googleStarting={googleStarting}
            onConnect={handleConnect}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {accounts.map((account, i) => (
              <AccountRow
                key={account.id}
                account={account}
                isFirst={i === 0}
                canDisconnect={account.is_own || isAdmin}
                busy={disconnectMutation.isPending}
                refreshing={
                  refreshMutation.isPending &&
                  refreshMutation.variables === account.id
                }
                onRefresh={() => refreshMutation.mutate(account.id)}
                onDisconnect={() => setPendingDisconnect(account)}
                onReconnect={handleConnect}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        label={t("settings.calendars.bookingSection")}
        description={t("settings.calendars.bookingSectionDescription")}
      >
        {isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : baikalConfigs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <span
              aria-hidden
              className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
            >
              <CalendarDays className="h-5 w-5" />
            </span>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t("settings.calendars.emptyBooking")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {baikalConfigs.map((config, i) => (
              <BaikalRow key={config.id} config={config} isFirst={i === 0} />
            ))}
          </div>
        )}
      </SettingsSection>

      <AlertDialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => !open && setPendingDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.calendars.disconnectConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.calendars.disconnectConfirmBody", {
                email: pendingDisconnect?.google_email ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDisconnect)
                  disconnectMutation.mutate(pendingDisconnect.id);
              }}
            >
              {disconnectMutation.isPending
                ? t("common.saving")
                : t("settings.calendars.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Every member may connect their own Google calendar — no role gating here. */
function ConnectButton({
  googleStarting,
  onConnect,
  stacked = false,
}: {
  googleStarting: boolean;
  onConnect: () => void;
  stacked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center ${
        stacked ? "mt-5 sm:justify-center" : ""
      }`}
    >
      <Button
        onClick={onConnect}
        disabled={googleStarting}
        variant="outline"
        className="h-10 w-full gap-2 px-4 sm:w-auto"
      >
        <GoogleIcon className="h-4 w-4 shrink-0" />
        {googleStarting
          ? t("settings.calendars.connecting")
          : t("settings.calendars.connectGoogle")}
      </Button>
    </div>
  );
}

/**
 * A dismissible outcome notice. A banner rather than a toast: after a Google
 * round trip the user has just been bounced through two page loads on another
 * site, and four seconds is not long enough to catch the result.
 */
function ResultBanner({
  ok,
  message,
  onDismiss,
}: {
  ok: boolean;
  message: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-amber-400/40 bg-amber-400/10 text-amber-900 dark:text-amber-200"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("settings.calendars.dismiss")}
        className="-m-1 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** The outcome of a Google round trip. */
function GoogleResultBanner({
  result,
  onDismiss,
}: {
  result: { outcome: GoogleOutcome; email?: string; reason?: string };
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const ok = result.outcome === "connected";

  const message = ok
    ? t("settings.calendars.google.connected", { email: result.email ?? "" })
    : result.outcome === "failed" && result.reason
      ? t("settings.calendars.google.failed", { reason: result.reason })
      : t(
          `settings.calendars.google.${
            result.outcome === "failed" ? "error" : result.outcome
          }`,
        );

  return <ResultBanner ok={ok} message={message} onDismiss={onDismiss} />;
}

function GoogleEmptyState({
  googleStarting,
  onConnect,
}: {
  googleStarting: boolean;
  onConnect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
      >
        <CalendarDays className="h-5 w-5" />
      </span>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        {t("settings.calendars.emptyGoogle")}
      </p>
      <ConnectButton
        stacked
        googleStarting={googleStarting}
        onConnect={onConnect}
      />
    </div>
  );
}

/** The dot that carries a calendar's colour, as Google shows it. */
function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}

function AccountRow({
  account,
  isFirst,
  canDisconnect,
  busy,
  refreshing,
  onRefresh,
  onDisconnect,
  onReconnect,
}: {
  account: CalendarAccount;
  isFirst: boolean;
  canDisconnect: boolean;
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={isFirst ? "" : "border-t border-border"}>
      {/* Two rows on a phone (identity, then actions), one row from `sm`. */}
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <GoogleIcon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">
                {account.google_email}
              </span>
              {account.auth_failed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.calendars.needsReconnect")}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {account.display_name}
              {" · "}
              {account.is_own ? t("settings.calendars.you") : account.user_name}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* A dead grant is only fixable by consenting again, so put that
              action on the row that is broken rather than making the user work
              out that "Connect Google calendar" is also the repair. */}
          {account.auth_failed ? (
            <button
              type="button"
              onClick={onReconnect}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-400/20 disabled:opacity-50 dark:text-amber-200"
            >
              <GoogleIcon className="h-3.5 w-3.5" />
              {t("settings.calendars.reconnect")}
            </button>
          ) : null}
          {/* Refreshing needs the account's grant, which only its owner holds. */}
          {account.is_own ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy || refreshing}
              title={t("settings.calendars.refreshCalendars")}
              aria-label={t("settings.calendars.refreshCalendars")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          ) : null}
          {canDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              title={t("settings.calendars.disconnect")}
              aria-label={t("settings.calendars.disconnect")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* The account's calendars, indented under its text rather than its
          icon, so the visual line is "these calendars belong to that account". */}
      {account.calendars.length === 0 ? (
        <p className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-5 sm:pl-14">
          {t("settings.calendars.calendarsEmpty")}
        </p>
      ) : (
        <ul className="border-t border-border bg-muted/20 px-4 py-2 sm:px-5 sm:pl-14">
          {account.calendars.map((calendar) => (
            <li
              key={calendar.id}
              className="flex items-center gap-2.5 py-1.5 text-sm"
            >
              <ColorDot color={calendar.backgroundColor} />
              <span className="min-w-0 truncate">{calendar.summary}</span>
              {calendar.primary ? (
                <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {t("settings.calendars.primary")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * An admin-provisioned Baikal booking calendar. Deliberately action-free: these
 * are created and maintained by Repraesent, and a member deleting one from here
 * would be removing something they cannot recreate.
 */
function BaikalRow({
  config,
  isFirst,
}: {
  config: BaikalConfig;
  isFirst: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5 ${
        isFirst ? "" : "border-t border-border"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <CalendarDays className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ColorDot color={config.company_color} />
            <span className="truncate text-sm font-medium">
              {config.provider_name ??
                config.provider_email ??
                config.user_name}
            </span>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("settings.calendars.managedByAdmin")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {config.provider_email ? `${config.provider_email} · ` : ""}
            {config.user_name}
            {" · "}
            {config.timezone}
          </p>
        </div>
      </div>
    </div>
  );
}
