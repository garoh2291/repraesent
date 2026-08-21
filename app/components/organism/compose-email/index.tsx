import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import {
  AlertTriangle,
  ChevronDown,
  CornerDownRight,
  Loader2,
  PenLine,
  Send,
  Settings2,
} from "lucide-react";
import { getBccAddress } from "~/lib/api/bcc-logs";
import {
  getEmailAccountSignature,
  listEmailAccountsForWorkspace,
  sortAccountsWithAliases,
  type EmailAccount,
} from "~/lib/api/email-accounts";
import { sendOutboundEmail } from "~/lib/api/outbound-mail";
import { extractErrorMessage } from "~/lib/api/axios-instance";
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
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePilotFeatures } from "~/lib/feature-flags";
import { cn } from "~/lib/utils";
import { RichTextEditor, RichTextToolbar } from "./rich-text-editor";
import { RecipientField, type Recipient } from "./recipient-field";
import type { ComposeRequest } from "./use-compose-email";

const LAST_ACCOUNT_KEY = "repraesent.compose.lastAccountId";

export function ComposeEmailDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ComposeRequest;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pilot = usePilotFeatures();

  const [to, setTo] = useState<Recipient[]>(request.to ?? []);
  const [cc, setCc] = useState<Recipient[]>(request.cc ?? []);
  const [extraBcc, setExtraBcc] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState(request.subject ?? "");
  const [html, setHtml] = useState(request.html ?? "");
  const [accountId, setAccountId] = useState<string | undefined>();
  const [showCc, setShowCc] = useState((request.cc?.length ?? 0) > 0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirtyRef = useRef(false);

  // Read-only here. This key is shared with the Settings pages and the Forms
  // panel, so the composer must never invalidate or write it.
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
    enabled: open,
  });

  const { data: bccAddress } = useQuery({
    queryKey: ["bcc-address"],
    queryFn: getBccAddress,
    enabled: open,
  });

  // Its own key, per account. The signature must never travel on
  // ["workspace-email-accounts"], which seven surfaces share and which two
  // different endpoints populate with two different shapes.
  const { data: signature } = useQuery({
    queryKey: ["email-account-signature", accountId],
    queryFn: () => getEmailAccountSignature(accountId!),
    enabled: open && !!accountId && pilot.emailSignature,
  });

  const sendable = useMemo(
    () => (accounts ?? []).filter((a) => !a.auth_failed_at),
    [accounts],
  );

  // Default: last mailbox used in this workspace, else the workspace default,
  // else whatever can actually send.
  useEffect(() => {
    if (!accounts || accountId) return;
    const remembered =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LAST_ACCOUNT_KEY)
        : null;
    const pick =
      sendable.find((a) => a.id === remembered) ??
      sendable.find((a) => a.is_default) ??
      sendable[0];
    if (pick) setAccountId(pick.id);
  }, [accounts, accountId, sendable]);

  const bccChips: Recipient[] = useMemo(
    () =>
      bccAddress?.address
        ? [{ email: bccAddress.address, locked: true }, ...extraBcc]
        : extraBcc,
    [bccAddress?.address, extraBcc],
  );

  const bodyIsEmpty = useMemo(
    () => (editor ? editor.getText().trim().length === 0 : !html.trim()),
    [editor, html],
  );

  const canSend =
    to.length > 0 && subject.trim().length > 0 && !bodyIsEmpty && !!accountId;

  dirtyRef.current =
    !bodyIsEmpty ||
    subject.trim() !== (request.subject ?? "").trim() ||
    to.length !== (request.to?.length ?? 0);

  const mutation = useMutation({
    mutationFn: () =>
      sendOutboundEmail({
        emailAccountId: accountId,
        to: to.map((r) => r.email),
        cc: cc.map((r) => r.email),
        bcc: extraBcc.map((r) => r.email),
        subject: subject.trim(),
        html: editor?.getHTML() ?? html,
        dealId: request.dealId,
        contactId: request.contactId,
        replyToMessageId: request.replyTo?.id,
      }),
    onSuccess: () => {
      if (accountId && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
      }
      for (const key of request.invalidateKeys ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(t("compose.sentToast", { defaultValue: "Email sent" }), {
        description: t("compose.sentToastDescription", {
          defaultValue:
            "It appears in this list in full once the copy is processed — usually a few minutes.",
        }),
      });
      dirtyRef.current = false;
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        t("compose.sendFailed", { defaultValue: "The email was not sent" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const requestClose = useCallback(() => {
    if (mutation.isPending) return;
    if (dirtyRef.current) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  }, [mutation.isPending, onOpenChange]);

  const noAccount = !accountsLoading && sendable.length === 0;
  // A workspace with mailboxes that all need reconnecting is a different
  // problem from one with none at all, and telling someone to "connect a
  // mailbox" they already connected sends them the wrong way.
  const allNeedReconnect = noAccount && (accounts?.length ?? 0) > 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "gap-0 overflow-hidden p-0 sm:max-w-2xl",
            // Full-bleed on phones: a mail composer is the whole task, and a
            // 220px editor inside a floating card is unusable with a keyboard up.
            "h-[100svh] max-w-none rounded-none sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:rounded-2xl",
            "flex flex-col",
          )}
        >
          <DialogHeader className="border-b border-border px-4 py-3 text-left sm:px-6">
            <DialogTitle className="text-sm font-semibold tracking-tight">
              {request.replyTo
                ? t("compose.titleReply", { defaultValue: "Reply" })
                : t("compose.title", { defaultValue: "New email" })}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {request.contextLabel ??
                t("compose.subtitle", {
                  defaultValue: "Sent from your connected mailbox",
                })}
            </DialogDescription>
          </DialogHeader>

          {noAccount ? (
            <NoAccountState needsReconnect={allNeedReconnect} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
              <FromRow
                accounts={accounts ?? []}
                value={accountId}
                onChange={setAccountId}
                loading={accountsLoading}
              />

              <div className="relative">
                <RecipientField
                  label={t("compose.to", { defaultValue: "To" })}
                  value={to}
                  onChange={setTo}
                  autoFocus
                  disabled={mutation.isPending}
                />
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="absolute top-2.5 right-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("compose.cc", { defaultValue: "Cc" })}
                  </button>
                )}
              </div>

              {showCc && (
                <RecipientField
                  label={t("compose.cc", { defaultValue: "Cc" })}
                  value={cc}
                  onChange={setCc}
                  disabled={mutation.isPending}
                />
              )}

              {/* Always visible, because it always has content: the locked
                  logging address is what puts this email on the contact and
                  the deal afterwards. */}
              <RecipientField
                label={t("compose.bcc", { defaultValue: "Bcc" })}
                value={bccChips}
                onChange={(next) => setExtraBcc(next.filter((r) => !r.locked))}
                lockedHint={t("compose.bccLockedHint", {
                  defaultValue:
                    "Always blind-copied so this email is logged in Repraesent and shows up on the contact and deal.",
                })}
                disabled={mutation.isPending}
              />

              <div className="border-b border-border/70 px-1 py-1.5">
                <label htmlFor="compose-subject" className="sr-only">
                  {t("compose.subject", { defaultValue: "Subject" })}
                </label>
                <input
                  id="compose-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={mutation.isPending}
                  placeholder={t("compose.subject", {
                    defaultValue: "Subject",
                  })}
                  className="h-9 w-full bg-transparent px-1 text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              <div className="py-2">
                <RichTextEditor
                  value={html}
                  onChange={setHtml}
                  onSubmit={() => canSend && mutation.mutate()}
                  disabled={mutation.isPending}
                  toolbarRef={setEditor}
                />
              </div>

              {pilot.emailSignature && signature?.signature_html ? (
                <SignatureNotice
                  html={signature.signature_html}
                  fromEmail={
                    accounts?.find((a) => a.id === accountId)?.email ?? ""
                  }
                />
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 sm:px-6">
            {noAccount ? (
              <span />
            ) : (
              <RichTextToolbar editor={editor} className="min-w-0" />
            )}

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs sm:h-8"
                onClick={requestClose}
                disabled={mutation.isPending}
              >
                {t("compose.discard", { defaultValue: "Discard" })}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 text-xs sm:h-8"
                onClick={() => mutation.mutate()}
                disabled={!canSend || mutation.isPending || noAccount}
                // Cmd/Ctrl+Enter also sends; surfaced here so it is findable.
                title={t("compose.sendShortcut", {
                  defaultValue: "Send (⌘/Ctrl + Enter)",
                })}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("compose.sending", { defaultValue: "Sending…" })}
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    {t("compose.send", { defaultValue: "Send" })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("compose.discardTitle", {
                defaultValue: "Discard this email?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("compose.discardDescription", {
                defaultValue: "What you have written will be lost.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("compose.keepEditing", { defaultValue: "Keep editing" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                dirtyRef.current = false;
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              {t("compose.discard", { defaultValue: "Discard" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The signature is appended server-side, so it is not in the editor above — but
 * sending something you have not seen is worse than a little extra chrome.
 * Collapsed by default; one click shows exactly what will be attached.
 */
function SignatureNotice({
  html,
  fromEmail,
}: {
  html: string;
  fromEmail: string;
}) {
  const { t } = useTranslation();
  return (
    <details className="group mb-2 rounded-xl border border-dashed border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground">
        <PenLine aria-hidden className="size-3" />
        {t("compose.signatureNotice", {
          defaultValue: "Signature from {{email}} will be added",
          email: fromEmail,
        })}
        <ChevronDown
          aria-hidden
          className="ml-auto size-3.5 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border/70 px-3 py-2.5">
        {/* Authored by a workspace member and sanitized server-side on save. */}
        <div
          className="compose-prose text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </details>
  );
}

/** From picker: connected mailboxes grouped the way Settings presents them. */
function FromRow({
  accounts,
  value,
  onChange,
  loading,
}: {
  accounts: EmailAccount[];
  value: string | undefined;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  // Same ordering the Settings list and the other account pickers use: each
  // send-as alias sits directly under the mailbox it sends through. Listed flat
  // in creation order, an alias is indistinguishable from a real mailbox and
  // ends up buried at the bottom.
  const mine = sortAccountsWithAliases(
    accounts.filter((a) => a.source === "user"),
  );
  const provided = accounts.filter((a) => a.source !== "user");

  const renderItem = (a: EmailAccount) => (
    <SelectItem key={a.id} value={a.id} disabled={!!a.auth_failed_at}>
      <span className="flex items-center gap-2">
        {a.parent_account_id && (
          <CornerDownRight
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
        )}
        <span className="truncate">{a.email}</span>
        {a.parent_account_id && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t("compose.alias", { defaultValue: "Alias" })}
          </span>
        )}
        {a.auth_failed_at && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3" />
            {t("compose.needsReconnect", {
              defaultValue: "Needs reconnecting",
            })}
          </span>
        )}
      </span>
    </SelectItem>
  );

  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-1 py-1.5">
      <label
        htmlFor="compose-from"
        className="shrink-0 pl-1 text-xs font-medium text-muted-foreground"
      >
        {t("compose.from", { defaultValue: "From" })}
      </label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger
          id="compose-from"
          size="sm"
          className="w-full border-0 bg-transparent shadow-none focus-visible:ring-0"
        >
          <SelectValue
            placeholder={t("compose.fromPlaceholder", {
              defaultValue: "Choose a mailbox",
            })}
          />
        </SelectTrigger>
        <SelectContent>
          {mine.length > 0 && (
            <SelectGroup>
              <SelectLabel>
                {t("compose.yourAccounts", { defaultValue: "Your accounts" })}
              </SelectLabel>
              {mine.map(renderItem)}
            </SelectGroup>
          )}
          {provided.length > 0 && (
            <SelectGroup>
              <SelectLabel>
                {t("compose.providedAccounts", {
                  defaultValue: "Provided by Repraesent",
                })}
              </SelectLabel>
              {provided.map(renderItem)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function NoAccountState({ needsReconnect }: { needsReconnect: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
      <span
        className={
          needsReconnect
            ? "flex size-11 items-center justify-center rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300"
            : "flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
        }
      >
        {needsReconnect ? (
          <AlertTriangle className="size-5" />
        ) : (
          <Settings2 className="size-5" />
        )}
      </span>
      <p className="text-sm font-medium text-foreground">
        {needsReconnect
          ? t("compose.reconnectTitle", {
              defaultValue: "Your mailbox needs reconnecting",
            })
          : t("compose.noAccountTitle", {
              defaultValue: "No mailbox connected yet",
            })}
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        {needsReconnect
          ? t("compose.reconnectDescription", {
              defaultValue:
                "Its access expired, so nothing can be sent until it is reconnected.",
            })
          : t("compose.noAccountDescription", {
              defaultValue:
                "Connect the mailbox you want to send from, then come back here.",
            })}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
        <Link to="/settings/email-accounts">
          {needsReconnect
            ? t("compose.reconnectCta", { defaultValue: "Reconnect it" })
            : t("compose.noAccountCta", { defaultValue: "Connect a mailbox" })}
        </Link>
      </Button>
    </div>
  );
}
