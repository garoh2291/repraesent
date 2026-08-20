import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AtSign,
  CheckCircle2,
  CornerDownRight,
  ExternalLink,
  Mail,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  X,
  PenLine,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  addEmailAlias,
  connectSmtpAccount,
  disconnectEmailAccount,
  getGoogleAuthorizeUrl,
  listEmailAccountsForWorkspace,
  setDefaultEmailAccount,
  DEFAULT_PORT,
  type EmailAccount,
  type SmtpConnectionSecurity,
} from "~/lib/api/email-accounts";
import { SignatureEditor } from "~/components/organism/signature-editor";
import { usePilotFeatures } from "~/lib/feature-flags";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: `${i18n.t("settings.emailAccounts.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.emailAccounts.metaDescription"),
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
      {/* Stacked on a phone: side by side, the two connect buttons squeezed the
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
    <svg
      className={className}
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
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

const SECURITY_OPTIONS: SmtpConnectionSecurity[] = [
  "SSL_TLS",
  "STARTTLS",
  "NONE",
];

function createSmtpSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("settings.emailAccounts.required")),
    email: z.string().trim().email(t("settings.emailAccounts.invalidEmail")),
    smtp_server: z.string().trim().min(1, t("settings.emailAccounts.required")),
    smtp_port: z
      .number({ message: t("settings.emailAccounts.invalidPort") })
      .int()
      .min(1, t("settings.emailAccounts.invalidPort"))
      .max(65535, t("settings.emailAccounts.invalidPort")),
    connection_security: z.enum(["SSL_TLS", "STARTTLS", "NONE"]),
    smtp_username: z.string().trim().optional(),
    password: z.string().min(1, t("settings.emailAccounts.required")),
  });
}

type SmtpFormValues = z.infer<ReturnType<typeof createSmtpSchema>>;

function createAliasSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().trim().email(t("settings.emailAccounts.invalidEmail")),
    name: z.string().trim().optional(),
  });
}

type AliasFormValues = z.infer<ReturnType<typeof createAliasSchema>>;

/** Where a user manages their Gmail send-as addresses. */
const GMAIL_SEND_AS_SETTINGS_URL =
  "https://mail.google.com/mail/u/0/#settings/accounts";

/**
 * A mailbox and the send-as aliases that borrow its grant.
 *
 * The API returns one flat list, ordered default-first then oldest-first, which
 * would scatter an alias away from the mailbox it belongs to. Nesting them is
 * what makes "these three addresses are one Google account" legible.
 */
interface AccountGroup {
  parent: EmailAccount;
  aliases: EmailAccount[];
}

function groupAccounts(accounts: EmailAccount[]): AccountGroup[] {
  const aliasesByParent = new Map<string, EmailAccount[]>();
  for (const account of accounts) {
    if (!account.parent_account_id) continue;
    const siblings = aliasesByParent.get(account.parent_account_id) ?? [];
    siblings.push(account);
    aliasesByParent.set(account.parent_account_id, siblings);
  }

  const groups = accounts
    .filter((a) => !a.parent_account_id)
    .map((parent) => ({
      parent,
      // Alphabetical rather than by creation: within one mailbox the order
      // people scan for is the address itself.
      aliases: (aliasesByParent.get(parent.id) ?? []).sort((a, b) =>
        a.email.localeCompare(b.email),
      ),
    }));

  // Disconnecting a mailbox soft-deletes its aliases with it, so an alias whose
  // parent is absent should not exist. If one ever does, show it as its own row
  // rather than dropping it — an address the workspace can still be sending
  // from must not become invisible here.
  const shown = new Set(groups.flatMap((g) => g.aliases.map((a) => a.id)));
  for (const account of accounts) {
    if (account.parent_account_id && !shown.has(account.id)) {
      groups.push({ parent: account, aliases: [] });
    }
  }

  return groups;
}

export default function SettingsEmailAccounts() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.emailAccounts.metaTitle",
    descriptionKey: "settings.emailAccounts.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const canEdit = currentWorkspace?.member_role !== "viewer";

  const [connectOpen, setConnectOpen] = useState(false);
  const [googleStarting, setGoogleStarting] = useState(false);
  const [googleResult, setGoogleResult] = useState<{
    outcome: GoogleOutcome;
    email?: string;
    reason?: string;
  } | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<EmailAccount | null>(null);
  /** The mailbox an alias is being added to; null when the dialog is closed. */
  // Only one signature editor open at a time: two half-edited signatures on
  // screen invites saving the wrong one.
  const [signatureFor, setSignatureFor] = useState<EmailAccount | null>(null);
  const pilot = usePilotFeatures();
  const [aliasParent, setAliasParent] = useState<EmailAccount | null>(null);
  const [aliasAdded, setAliasAdded] = useState<string | null>(null);

  const { data: accounts, isPending } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
  });

  // Four other surfaces read the older ["workspace-email-accounts"] key — the
  // Forms confirmation panel, the Appointments tab, the Email page and the
  // legacy fallback page. Anything that changes an account has to invalidate
  // both or those screens keep showing a stale list.
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["workspace-email-accounts"] }),
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

    // The new mailbox was written server-side, so the cached list is stale.
    if (outcome === "connected") void invalidate();

    const url = new URL(window.location.href);
    for (const key of ["google", "email", "reason"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function handleConnectGoogle() {
    setGoogleStarting(true);
    try {
      // Full-page navigation, not a popup: the consent screen is a multi-step
      // flow and Google discourages framing it.
      window.location.href = await getGoogleAuthorizeUrl();
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setGoogleStarting(false);
    }
    // No `finally` — on success the page is already navigating away, and
    // clearing the flag would flash the button back to idle mid-unload.
  }

  const schema = useMemo(() => createSmtpSchema(t), [t]);
  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      smtp_server: "",
      smtp_port: DEFAULT_PORT.SSL_TLS,
      connection_security: "SSL_TLS",
      smtp_username: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const connectMutation = useMutation({
    mutationFn: connectSmtpAccount,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("settings.emailAccounts.connected"));
      setConnectOpen(false);
      form.reset();
    },
    // The server only rejects after failing to reach the real mail server, so
    // its message is specific and worth showing verbatim.
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultEmailAccount,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("settings.emailAccounts.defaultSet"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectEmailAccount,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("settings.emailAccounts.disconnected"));
      setPendingDisconnect(null);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const aliasSchema = useMemo(() => createAliasSchema(t), [t]);
  const aliasForm = useForm<AliasFormValues>({
    resolver: zodResolver(aliasSchema),
    defaultValues: { email: "", name: "" },
    mode: "onSubmit",
  });

  const aliasMutation = useMutation({
    mutationFn: ({
      parentId,
      values,
    }: {
      parentId: string;
      values: AliasFormValues;
    }) =>
      addEmailAlias(parentId, {
        email: values.email,
        name: values.name?.trim() || undefined,
      }),
    onSuccess: async (created) => {
      await invalidate();
      // A banner, not a toast: the one thing that matters here is checking the
      // From line on the test message, and a notice that fades in four seconds
      // is gone before the mail has arrived.
      setAliasAdded(created.email);
      setAliasParent(null);
      aliasForm.reset();
    },
    // The server only rejects after Google refused the send, so its message is
    // specific and worth showing verbatim.
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const connected = accounts ?? [];
  const groups = useMemo(() => groupAccounts(connected), [connected]);

  // Aliases the pending disconnect would take down with it. Zero when the
  // pending row is itself an alias, which has no children.
  const doomedAliasCount = pendingDisconnect
    ? connected.filter((a) => a.parent_account_id === pendingDisconnect.id)
        .length
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      {googleResult ? (
        <GoogleResultBanner
          result={googleResult}
          onDismiss={() => setGoogleResult(null)}
        />
      ) : null}

      {aliasAdded ? (
        <ResultBanner
          ok
          message={t("settings.emailAccounts.aliasAddedBanner", {
            email: aliasAdded,
          })}
          onDismiss={() => setAliasAdded(null)}
        />
      ) : null}

      <SettingsSection
        label={t("settings.emailAccounts.sectionTitle")}
        description={t("settings.emailAccounts.sectionDescription")}
        action={
          canEdit && connected.length > 0 ? (
            <ConnectActions
              googleStarting={googleStarting}
              onConnectGoogle={handleConnectGoogle}
              onConnectSmtp={() => setConnectOpen(true)}
            />
          ) : undefined
        }
      >
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : connected.length === 0 ? (
          <EmptyState
            canEdit={canEdit}
            googleStarting={googleStarting}
            onConnectGoogle={handleConnectGoogle}
            onConnectSmtp={() => setConnectOpen(true)}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {groups.map(({ parent, aliases }, i) => {
              const busy =
                defaultMutation.isPending || disconnectMutation.isPending;
              // Only a Google mailbox the workspace connected itself can take
              // aliases: SMTP servers decide their own From rules, and an
              // admin-provisioned mailbox is not the member's to extend.
              const canAddAlias =
                canEdit &&
                parent.provider === "google" &&
                parent.source !== "admin";

              return (
                <div key={parent.id}>
                  <AccountRow
                    account={parent}
                    isFirst={i === 0}
                    canEdit={canEdit}
                    busy={busy}
                    onSetDefault={() => defaultMutation.mutate(parent.id)}
                    onDisconnect={() => setPendingDisconnect(parent)}
                    onReconnect={handleConnectGoogle}
                    canEditSignature={pilot.emailSignature}
                    onEditSignature={() => setSignatureFor(parent)}
                  />
                  {signatureFor?.id === parent.id ? (
                    <SignatureEditor
                      accountId={parent.id}
                      accountEmail={parent.email}
                      onClose={() => setSignatureFor(null)}
                    />
                  ) : null}
                  {aliases.map((alias) => (
                    <div key={alias.id}>
                      <AliasRow
                        alias={alias}
                        canEdit={canEdit}
                        busy={busy}
                        onSetDefault={() => defaultMutation.mutate(alias.id)}
                        onRemove={() => setPendingDisconnect(alias)}
                        canEditSignature={pilot.emailSignature}
                        onEditSignature={() => setSignatureFor(alias)}
                      />
                      {signatureFor?.id === alias.id ? (
                        <SignatureEditor
                          accountId={alias.id}
                          accountEmail={alias.email}
                          onClose={() => setSignatureFor(null)}
                        />
                      ) : null}
                    </div>
                  ))}
                  {canAddAlias ? (
                    <AddAliasRow onClick={() => setAliasParent(parent)} />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      <AddAliasDialog
        parent={aliasParent}
        onOpenChange={(open) => {
          if (!open) {
            aliasForm.reset();
            setAliasParent(null);
          }
        }}
        form={aliasForm}
        pending={aliasMutation.isPending}
        onSubmit={(values) => {
          if (aliasParent) {
            aliasMutation.mutate({ parentId: aliasParent.id, values });
          }
        }}
      />

      <ConnectSmtpDialog
        open={connectOpen}
        onOpenChange={(open) => {
          if (!open) form.reset();
          setConnectOpen(open);
        }}
        form={form}
        pending={connectMutation.isPending}
        onSubmit={(values) =>
          connectMutation.mutate({
            ...values,
            smtp_username: values.smtp_username?.trim() || undefined,
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
              {pendingDisconnect?.parent_account_id
                ? t("settings.emailAccounts.removeAliasTitle")
                : t("settings.emailAccounts.disconnectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDisconnect?.parent_account_id
                ? t("settings.emailAccounts.removeAliasBody", {
                    email: pendingDisconnect.email,
                  })
                : t("settings.emailAccounts.disconnectBody", {
                    email: pendingDisconnect?.email ?? "",
                  })}
              {/* Disconnecting a mailbox takes its aliases with it — they send
                  with its grant and cannot outlive it. Saying so here is the
                  only chance the user gets before the rows disappear. */}
              {doomedAliasCount > 0
                ? ` ${t("settings.emailAccounts.disconnectAliasWarning", {
                    count: doomedAliasCount,
                  })}`
                : ""}
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
                : pendingDisconnect?.parent_account_id
                  ? t("settings.emailAccounts.removeAlias")
                  : t("settings.emailAccounts.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * The two ways in. Both are offered side by side rather than behind a
 * "choose a provider" step — there are only two, and naming them outright is
 * what tells a user this is about *their* mailbox, not ours.
 */
function ConnectActions({
  googleStarting,
  onConnectGoogle,
  onConnectSmtp,
  stacked = false,
}: {
  googleStarting: boolean;
  onConnectGoogle: () => void;
  onConnectSmtp: () => void;
  stacked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    // Full-width and stacked on a phone — both labels are long enough that
    // side by side they ran off the screen.
    <div
      className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center ${
        stacked ? "mt-5 sm:justify-center" : "sm:flex-wrap"
      }`}
    >
      <Button
        onClick={onConnectGoogle}
        disabled={googleStarting}
        variant="outline"
        className="h-10 w-full gap-2 px-4 sm:w-auto"
      >
        <GoogleIcon className="h-4 w-4 shrink-0" />
        {googleStarting
          ? t("settings.emailAccounts.googleRedirecting")
          : t("settings.emailAccounts.connectGoogle")}
      </Button>
      <Button
        onClick={onConnectSmtp}
        className="h-10 w-full gap-1.5 bg-foreground px-4 text-background hover:bg-foreground/90 hover:text-background sm:w-auto"
      >
        <AtSign className="h-3.5 w-3.5 shrink-0" />
        {t("settings.emailAccounts.connectSmtp")}
      </Button>
    </div>
  );
}

/**
 * A dismissible outcome notice.
 *
 * A banner rather than a toast wherever the result is something the user has to
 * act on — after a Google round trip they have just been bounced through two
 * page loads on another site, and after adding an alias the thing to check has
 * not even arrived in their inbox yet. Four seconds is not long enough for
 * either.
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
        aria-label={t("common.dismiss", "Dismiss")}
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
    ? t("settings.emailAccounts.googleConnected", { email: result.email ?? "" })
    : result.outcome === "failed" && result.reason
      ? // The server's reason is already a user-facing sentence — it explains
        // things a generic message cannot, like an unticked send permission.
        result.reason
      : t(`settings.emailAccounts.google_${result.outcome}`);

  return <ResultBanner ok={ok} message={message} onDismiss={onDismiss} />;
}

function EmptyState({
  canEdit,
  googleStarting,
  onConnectGoogle,
  onConnectSmtp,
}: {
  canEdit: boolean;
  googleStarting: boolean;
  onConnectGoogle: () => void;
  onConnectSmtp: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
      >
        <Mail className="h-5 w-5" />
      </span>
      <p className="font-medium">{t("settings.emailAccounts.emptyTitle")}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {t("settings.emailAccounts.emptyHint")}
      </p>
      {canEdit ? (
        <ConnectActions
          stacked
          googleStarting={googleStarting}
          onConnectGoogle={onConnectGoogle}
          onConnectSmtp={onConnectSmtp}
        />
      ) : null}
    </div>
  );
}

function AccountRow({
  account,
  isFirst,
  canEdit,
  busy,
  onSetDefault,
  onDisconnect,
  onReconnect,
  canEditSignature,
  onEditSignature,
}: {
  account: EmailAccount;
  isFirst: boolean;
  canEdit: boolean;
  busy: boolean;
  onSetDefault: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  canEditSignature: boolean;
  onEditSignature: () => void;
}) {
  const { t } = useTranslation();
  // Admin-provisioned accounts are managed by Repraesent; a member disconnecting
  // one from here would be deleting something they cannot recreate.
  const isManaged = account.source === "admin";

  return (
    // Two rows on a phone (identity, then actions), one row from `sm`. When
    // everything shared a single wrapping flex line the actions won the space
    // and addresses collapsed to "garnik@de…".
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
          {account.provider === "google" ? (
            <GoogleIcon className="h-4 w-4" />
          ) : (
            <AtSign className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {account.email}
            </span>
            {account.is_default ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                {t("settings.emailAccounts.default")}
              </span>
            ) : null}
            {isManaged ? (
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t("settings.emailAccounts.managed")}
              </span>
            ) : null}
            {account.auth_failed_at ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <TriangleAlert className="h-3 w-3" />
                {t("settings.emailAccounts.needsReconnect")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {account.name}
            {" · "}
            {account.provider === "google"
              ? "Google"
              : (account.smtp_server ?? "SMTP")}
          </p>
        </div>
      </div>

      {canEdit ? (
        // Full card width on mobile — indenting these to line up under the
        // address cost the ~44px that lets Reconnect, Make default and
        // Disconnect share one line instead of orphaning the bin icon.
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* A dead Google grant is only fixable by consenting again, so put
              that action on the row that is broken rather than making the user
              work out that "Connect with Google" is also the repair. */}
          {account.auth_failed_at && account.provider === "google" ? (
            <button
              type="button"
              onClick={onReconnect}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-400/20 disabled:opacity-50 dark:text-amber-200"
            >
              <GoogleIcon className="h-3.5 w-3.5" />
              {t("settings.emailAccounts.reconnect")}
            </button>
          ) : null}
          {!account.is_default ? (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={busy}
              title={t("settings.emailAccounts.makeDefault")}
              aria-label={t("settings.emailAccounts.makeDefault")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5" />
              {t("settings.emailAccounts.makeDefault")}
            </button>
          ) : null}
          {canEditSignature ? (
            <button
              type="button"
              onClick={onEditSignature}
              disabled={busy}
              title={t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
              aria-label={t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
                account.has_signature
                  ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              {t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
            </button>
          ) : null}
          {!isManaged ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              title={t("settings.emailAccounts.disconnect")}
              aria-label={t("settings.emailAccounts.disconnect")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A Gmail send-as alias, nested under the mailbox it sends through.
 *
 * Indented to sit under the parent's text rather than its icon, so the visual
 * line is "these addresses belong to that account" — the alias has no
 * credentials of its own and disappears if the mailbox is disconnected.
 *
 * No Reconnect button: a dead grant belongs to the mailbox, and the parent row
 * directly above already offers the one action that fixes it. The badge still
 * shows here because `auth_failed_at` is inherited, and an alias that cannot
 * send needs to say so.
 */
function AliasRow({
  alias,
  canEdit,
  busy,
  onSetDefault,
  onRemove,
  canEditSignature,
  onEditSignature,
}: {
  alias: EmailAccount;
  canEdit: boolean;
  busy: boolean;
  onSetDefault: () => void;
  onRemove: () => void;
  canEditSignature: boolean;
  onEditSignature: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:px-5 sm:pl-14">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CornerDownRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{alias.email}</span>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("settings.emailAccounts.aliasLabel")}
            </span>
            {alias.is_default ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                {t("settings.emailAccounts.default")}
              </span>
            ) : null}
            {alias.auth_failed_at ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <TriangleAlert className="h-3 w-3" />
                {t("settings.emailAccounts.needsReconnect")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {alias.name}
          </p>
        </div>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {!alias.is_default ? (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={busy}
              title={t("settings.emailAccounts.makeDefault")}
              aria-label={t("settings.emailAccounts.makeDefault")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5" />
              {t("settings.emailAccounts.makeDefault")}
            </button>
          ) : null}
          {canEditSignature ? (
            <button
              type="button"
              onClick={onEditSignature}
              disabled={busy}
              title={t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
              aria-label={t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
                alias.has_signature
                  ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              {t("settings.emailAccounts.signature", {
                defaultValue: "Signature",
              })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title={t("settings.emailAccounts.removeAlias")}
            aria-label={t("settings.emailAccounts.removeAlias")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The add affordance, as the last child of a mailbox's alias list.
 *
 * Deliberately not another button in the parent row's action cluster: that
 * already carries up to three and wraps onto a second line on a phone. Sitting
 * here it also lands in the same place whether the mailbox has aliases or not.
 */
function AddAliasRow({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:px-5 sm:pl-14"
    >
      <Plus aria-hidden className="h-4 w-4 shrink-0" />
      {t("settings.emailAccounts.addAlias")}
    </button>
  );
}

/**
 * Add a send-as alias to a Google mailbox.
 *
 * The address is typed rather than picked from a list because reading an
 * account's send-as addresses out of Gmail needs a restricted OAuth scope. The
 * hint below therefore carries real weight: if the address is not already set
 * up in Gmail, nothing here can make it work.
 */
function AddAliasDialog({
  parent,
  onOpenChange,
  form,
  pending,
  onSubmit,
}: {
  parent: EmailAccount | null;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<AliasFormValues>;
  pending: boolean;
  onSubmit: (values: AliasFormValues) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={parent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerDownRight className="h-4 w-4" />
            {t("settings.emailAccounts.addAliasTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.emailAccounts.addAliasDescription", {
              email: parent?.email ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>{t("settings.emailAccounts.aliasGmailHint")}</p>
          <a
            href={GMAIL_SEND_AS_SETTINGS_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
          >
            {t("settings.emailAccounts.aliasGmailLink")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="add-alias-form"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings.emailAccounts.aliasEmailLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="sales@yourbrand.com"
                      autoComplete="off"
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings.emailAccounts.aliasNameLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={parent?.name ?? ""}
                      autoComplete="off"
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          <Button
            type="submit"
            form="add-alias-form"
            disabled={pending}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {pending
              ? t("settings.emailAccounts.aliasSending")
              : t("settings.emailAccounts.addAliasSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectSmtpDialog({
  open,
  onOpenChange,
  form,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<SmtpFormValues>;
  pending: boolean;
  onSubmit: (values: SmtpFormValues) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Seven fields overflow a phone screen, and the footer would sit below
          the fold with no way to reach Connect. Cap the height and scroll. */}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AtSign className="h-4 w-4" />
            {t("settings.emailAccounts.connectSmtp")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.emailAccounts.connectSmtpHint")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="connect-smtp-form"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.emailAccounts.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Sales"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.emailAccounts.email")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="sales@company.com"
                        autoComplete="off"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="smtp_server"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.emailAccounts.server")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="smtp.company.com"
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
                name="connection_security"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings.emailAccounts.security")}
                    </FormLabel>
                    <Select
                      value={field.value}
                      disabled={pending}
                      onValueChange={(v) => {
                        const next = v as SmtpConnectionSecurity;
                        field.onChange(next);
                        // Move the port to the new mode's default, so switching
                        // encryption doesn't silently leave a mismatched port.
                        form.setValue("smtp_port", DEFAULT_PORT[next]);
                      }}
                    >
                      <FormControl>
                        {/* The base trigger is `w-fit`, which left this select
                            visibly narrower than every other field. */}
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SECURITY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`settings.emailAccounts.security${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="smtp_port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.emailAccounts.port")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        inputMode="numeric"
                        disabled={pending}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? Number.NaN
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="smtp_username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings.emailAccounts.username")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t(
                          "settings.emailAccounts.usernamePlaceholder",
                        )}
                        autoComplete="off"
                        disabled={pending}
                      />
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
                      {t("settings.emailAccounts.password")}
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
          <Button
            type="submit"
            form="connect-smtp-form"
            disabled={pending}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {pending
              ? t("settings.emailAccounts.verifying")
              : t("settings.emailAccounts.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
