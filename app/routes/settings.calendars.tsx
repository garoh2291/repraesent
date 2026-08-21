import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  RefreshCw,
  Server,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { MicrosoftIcon } from "~/components/icons/MicrosoftIcon";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  connectCaldavAccount,
  disconnectCalendarAccount,
  getCalendarAuthorizeUrl,
  getMicrosoftCalendarAdminConsentUrl,
  getMicrosoftCalendarAuthorizeUrl,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
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

function createCaldavSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("settings.calendars.caldav.required"))
      .max(120, t("settings.calendars.caldav.required")),
    server_url: z
      .string()
      .trim()
      .min(1, t("settings.calendars.caldav.required"))
      // Only the scheme is checked here — the server verifies the URL for
      // real by connecting to it, and its message is more specific.
      .regex(/^https?:\/\//i, t("settings.calendars.caldav.invalidUrl"))
      .max(500, t("settings.calendars.caldav.invalidUrl")),
    username: z
      .string()
      .trim()
      .min(1, t("settings.calendars.caldav.required"))
      .max(200, t("settings.calendars.caldav.required")),
    password: z.string().min(1, t("settings.calendars.caldav.required")),
  });
}

type CaldavFormValues = z.infer<ReturnType<typeof createCaldavSchema>>;

/**
 * Every result an OAuth callback (Google or Microsoft) can bounce back with.
 * The two admin_* outcomes are Microsoft-only: an unverified publisher's app
 * hits the tenant's "Need admin approval" wall, and the admin-consent flow
 * returns through the same callback.
 */
type OAuthOutcome =
  | "connected"
  | "denied"
  | "expired"
  | "error"
  | "failed"
  | "admin_required"
  | "admin_granted";

const OAUTH_OUTCOMES: OAuthOutcome[] = [
  "connected",
  "denied",
  "expired",
  "error",
  "failed",
  "admin_required",
  "admin_granted",
];

type OAuthCalendarProvider = "google" | "microsoft";

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
  const [microsoftStarting, setMicrosoftStarting] = useState(false);
  const [oauthResult, setOauthResult] = useState<{
    provider: OAuthCalendarProvider;
    outcome: OAuthOutcome;
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

  // The OAuth callback sends the user back to this page with the result in
  // the query string (?google= or ?microsoft=), because it is a plain browser
  // redirect with nowhere else to put it. Read it once into state, then strip
  // it from the address bar so a refresh doesn't resurrect a stale
  // "connected!" the user has moved past.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const provider: OAuthCalendarProvider | null = params.get("google")
      ? "google"
      : params.get("microsoft")
        ? "microsoft"
        : null;
    if (!provider) return;
    const raw = params.get(provider)!;

    const outcome = (OAUTH_OUTCOMES as string[]).includes(raw)
      ? (raw as OAuthOutcome)
      : "error";

    setOauthResult({
      provider,
      outcome,
      email: params.get("email") ?? undefined,
      reason: params.get("reason") ?? undefined,
    });

    // The new account was written server-side, so the cached list is stale.
    if (outcome === "connected") void invalidate();

    const url = new URL(window.location.href);
    for (const key of ["google", "microsoft", "email", "reason"]) {
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

  async function handleConnectMicrosoft() {
    setMicrosoftStarting(true);
    try {
      // Same full-page navigation stance as Google.
      window.location.href = await getMicrosoftCalendarAuthorizeUrl();
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setMicrosoftStarting(false);
    }
  }

  /**
   * The escape hatch for the "Need admin approval" wall: hand the user a link
   * their IT admin can open to approve the app for the whole tenant.
   */
  async function handleCopyAdminLink() {
    try {
      await navigator.clipboard.writeText(
        await getMicrosoftCalendarAdminConsentUrl(),
      );
      toast.success(t("settings.calendars.adminLinkCopied"));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  }

  const refreshMutation = useMutation({
    mutationFn: refreshAccountCalendars,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const [caldavOpen, setCaldavOpen] = useState(false);
  const caldavSchema = useMemo(() => createCaldavSchema(t), [t]);
  const caldavForm = useForm<CaldavFormValues>({
    resolver: zodResolver(caldavSchema),
    defaultValues: { name: "", server_url: "", username: "", password: "" },
    mode: "onSubmit",
  });

  const caldavMutation = useMutation({
    mutationFn: connectCaldavAccount,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("settings.calendars.caldav.connected"));
      setCaldavOpen(false);
      caldavForm.reset();
    },
    // The server only rejects after failing to reach the CalDAV server, so
    // its message is specific and worth showing verbatim.
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  /**
   * Open the connect dialog, optionally seeded from an existing account —
   * reconnecting after a password change should not mean retyping the server
   * and username. The password is never prefilled; it is not stored readably.
   */
  function openCaldavDialog(prefill?: CalendarAccount) {
    caldavForm.reset(
      prefill
        ? {
            name: prefill.display_name,
            server_url: prefill.caldav_server_url ?? "",
            // For caldav rows google_email carries the username.
            username: prefill.google_email,
            password: "",
          }
        : { name: "", server_url: "", username: "", password: "" },
    );
    setCaldavOpen(true);
  }

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
  const googleAccounts = accounts.filter((a) => a.provider === "google");
  const microsoftAccounts = accounts.filter((a) => a.provider === "microsoft");
  const caldavAccounts = accounts.filter((a) => a.provider === "caldav");
  const baikalConfigs = data?.baikal_configs ?? [];

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      {oauthResult ? (
        <OAuthResultBanner
          result={oauthResult}
          onDismiss={() => setOauthResult(null)}
          action={
            // Best-effort classification: a blocked tenant sometimes comes
            // back as a plain denial, so the admin link rides on both.
            oauthResult.provider === "microsoft" &&
            (oauthResult.outcome === "admin_required" ||
              oauthResult.outcome === "denied") ? (
              <button
                type="button"
                onClick={handleCopyAdminLink}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("settings.calendars.copyAdminLink")}
              </button>
            ) : undefined
          }
        />
      ) : null}

      <SettingsSection
        label={t("settings.calendars.googleSection")}
        description={t("settings.calendars.googleSectionDescription")}
        action={
          googleAccounts.length > 0 ? (
            <ConnectButton
              starting={googleStarting}
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
        ) : googleAccounts.length === 0 ? (
          <OAuthEmptyState starting={googleStarting} onConnect={handleConnect} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {googleAccounts.map((account, i) => (
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
        label={t("settings.calendars.microsoftSection")}
        description={t("settings.calendars.microsoftSectionDescription")}
        action={
          microsoftAccounts.length > 0 ? (
            <ConnectButton
              provider="microsoft"
              starting={microsoftStarting}
              onConnect={handleConnectMicrosoft}
            />
          ) : undefined
        }
      >
        {isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : microsoftAccounts.length === 0 ? (
          <OAuthEmptyState
            provider="microsoft"
            starting={microsoftStarting}
            onConnect={handleConnectMicrosoft}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {microsoftAccounts.map((account, i) => (
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
                onReconnect={handleConnectMicrosoft}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        label={t("settings.calendars.caldav.section")}
        description={t("settings.calendars.caldav.sectionHint")}
        action={
          caldavAccounts.length > 0 ? (
            <Button
              onClick={() => openCaldavDialog()}
              variant="outline"
              className="h-10 w-full gap-2 px-4 sm:w-auto"
            >
              <Server className="h-4 w-4 shrink-0" />
              {t("settings.calendars.caldav.connect")}
            </Button>
          ) : undefined
        }
      >
        {isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : caldavAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <span
              aria-hidden
              className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
            >
              <Server className="h-5 w-5" />
            </span>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t("settings.calendars.caldav.empty")}
            </p>
            <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
              <Button
                onClick={() => openCaldavDialog()}
                variant="outline"
                className="h-10 w-full gap-2 px-4 sm:w-auto"
              >
                <Server className="h-4 w-4 shrink-0" />
                {t("settings.calendars.caldav.connect")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {caldavAccounts.map((account, i) => (
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
                // Reconnecting Basic auth means re-entering the password, not
                // an OAuth round trip — reopen the dialog with the rest seeded.
                onReconnect={() => openCaldavDialog(account)}
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

      <ConnectCaldavDialog
        open={caldavOpen}
        onOpenChange={(open) => {
          setCaldavOpen(open);
          if (!open) caldavForm.reset();
        }}
        form={caldavForm}
        pending={caldavMutation.isPending}
        onSubmit={(values) =>
          caldavMutation.mutate({
            name: values.name,
            server_url: values.server_url,
            username: values.username,
            password: values.password,
          })
        }
      />

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

/** Every member may connect their own calendar account — no role gating here. */
function ConnectButton({
  provider = "google",
  starting,
  onConnect,
  stacked = false,
}: {
  provider?: OAuthCalendarProvider;
  starting: boolean;
  onConnect: () => void;
  stacked?: boolean;
}) {
  const { t } = useTranslation();
  const isMicrosoft = provider === "microsoft";
  return (
    <div
      className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center ${
        stacked ? "mt-5 sm:justify-center" : ""
      }`}
    >
      <Button
        onClick={onConnect}
        disabled={starting}
        variant="outline"
        className="h-10 w-full gap-2 px-4 sm:w-auto"
      >
        {isMicrosoft ? (
          <MicrosoftIcon className="h-4 w-4 shrink-0" />
        ) : (
          <GoogleIcon className="h-4 w-4 shrink-0" />
        )}
        {starting
          ? t(
              isMicrosoft
                ? "settings.calendars.connectingMicrosoft"
                : "settings.calendars.connecting",
            )
          : t(
              isMicrosoft
                ? "settings.calendars.connectMicrosoft"
                : "settings.calendars.connectGoogle",
            )}
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
  action,
}: {
  ok: boolean;
  message: string;
  onDismiss: () => void;
  action?: React.ReactNode;
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
      <div className="min-w-0 flex-1">
        <p className="text-sm">{message}</p>
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
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

/** The outcome of an OAuth round trip (Google or Microsoft). */
function OAuthResultBanner({
  result,
  onDismiss,
  action,
}: {
  result: {
    provider: OAuthCalendarProvider;
    outcome: OAuthOutcome;
    email?: string;
    reason?: string;
  };
  onDismiss: () => void;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  // admin_granted is good news too: the tenant is unblocked, connect can now
  // succeed.
  const ok =
    result.outcome === "connected" || result.outcome === "admin_granted";
  const base = `settings.calendars.${result.provider}`;

  const message =
    result.outcome === "connected"
      ? t(`${base}.connected`, { email: result.email ?? "" })
      : result.outcome === "failed" && result.reason
        ? t(`${base}.failed`, { reason: result.reason })
        : t(
            `${base}.${result.outcome === "failed" ? "error" : result.outcome}`,
          );

  return (
    <ResultBanner
      ok={ok}
      message={message}
      onDismiss={onDismiss}
      action={action}
    />
  );
}

function OAuthEmptyState({
  provider = "google",
  starting,
  onConnect,
}: {
  provider?: OAuthCalendarProvider;
  starting: boolean;
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
        {t(
          provider === "microsoft"
            ? "settings.calendars.emptyMicrosoft"
            : "settings.calendars.emptyGoogle",
        )}
      </p>
      <ConnectButton
        stacked
        provider={provider}
        starting={starting}
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
  const isCaldav = account.provider === "caldav";
  const isMicrosoft = account.provider === "microsoft";

  return (
    <div className={isFirst ? "" : "border-t border-border"}>
      {/* Two rows on a phone (identity, then actions), one row from `sm`. */}
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            {isCaldav ? (
              <Server className="h-4 w-4" />
            ) : isMicrosoft ? (
              <MicrosoftIcon className="h-4 w-4" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* A CalDAV username is rarely self-explanatory the way a Google
                  address is, so lead with the name the user gave the account. */}
              <span className="truncate text-sm font-medium">
                {isCaldav ? account.display_name : account.google_email}
              </span>
              {account.auth_failed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.calendars.needsReconnect")}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {/* For caldav rows google_email carries the username. */}
              {isCaldav ? account.google_email : account.display_name}
              {" · "}
              {account.is_own ? t("settings.calendars.you") : account.user_name}
            </p>
            {isCaldav && account.caldav_server_url ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {account.caldav_server_url}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* A dead grant is only fixable by consenting again (Google) or
              re-entering the password (CalDAV), so put that action on the row
              that is broken rather than making the user work out that the
              section's connect button is also the repair. */}
          {account.auth_failed ? (
            <button
              type="button"
              onClick={onReconnect}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-400/20 disabled:opacity-50 dark:text-amber-200"
            >
              {isCaldav ? (
                <Server className="h-3.5 w-3.5" />
              ) : isMicrosoft ? (
                <MicrosoftIcon className="h-3.5 w-3.5" />
              ) : (
                <GoogleIcon className="h-3.5 w-3.5" />
              )}
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
/**
 * Server URL + Basic auth for any CalDAV server (Nextcloud, Baikal, Fastmail).
 * The page owns the form and mutation (same split as the SMTP dialog on the
 * email accounts page) so the reconnect flow can seed the fields.
 */
function ConnectCaldavDialog({
  open,
  onOpenChange,
  form,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CaldavFormValues>;
  pending: boolean;
  onSubmit: (values: CaldavFormValues) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            {t("settings.calendars.caldav.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.calendars.caldav.dialogHint")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="connect-caldav-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.calendars.caldav.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nextcloud" disabled={pending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="server_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings.calendars.caldav.serverUrl")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://dav.example.com/dav.php"
                      autoComplete="off"
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings.calendars.caldav.username")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" disabled={pending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings.calendars.caldav.password")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="connect-caldav-form" disabled={pending}>
            {pending
              ? t("settings.calendars.caldav.verifying")
              : t("settings.calendars.caldav.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
