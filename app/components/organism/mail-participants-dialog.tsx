import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, UserPlus, Check, ArrowUpRight } from "lucide-react";
import {
  attachMessageContact,
  createMessageContactsBulk,
  type BccMessage,
} from "~/lib/api/bcc-logs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LinkContactDialog } from "~/components/organism/link-contact-dialog";
import {
  emailParticipants,
  splitName,
  useMailInvalidate,
} from "~/components/organism/mail-helpers";

const KIND_LABEL: Record<string, string> = {
  to: "To",
  cc: "Cc",
  from: "From",
  bcc: "Bcc",
};

export function MailParticipantsDialog({
  open,
  onOpenChange,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: BccMessage;
}) {
  const { t } = useTranslation();
  const invalidate = useMailInvalidate();
  const parts = useMemo(
    () => emailParticipants(message.participants),
    [message.participants],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const attachMutation = useMutation({
    mutationFn: (vars: { contactId: string; email: string }) =>
      attachMessageContact(message.id, {
        contactId: vars.contactId,
        email: vars.email,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("mail.connectedToast", { defaultValue: "Email linked to contact." }),
      );
    },
    onError: (error) =>
      toast.error(
        t("mail.linkFailed", { defaultValue: "Could not update link." }),
        { description: extractErrorMessage(error) },
      ),
  });

  // Client-side queue: create contacts in small sequential batches with a live
  // progress toast, so a big selection (e.g. 50) never becomes one slow request
  // that times out. Each batch is a small createMessageContactsBulk call.
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const CHUNK = 5;

  const runQueue = async (
    items: { email: string; firstName?: string | null }[],
  ) => {
    if (!items.length || progress) return;
    const total = items.length;
    const withProgress = total > CHUNK;
    const toastId = `mail-bulk-${message.id}`;
    setProgress({ done: 0, total });
    if (withProgress) {
      toast.loading(
        t("mail.bulkProgress", {
          defaultValue: "Creating contacts… {{done}}/{{total}}",
          done: 0,
          total,
        }),
        { id: toastId },
      );
    }

    let created = 0;
    let failed = 0;
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        try {
          const res = await createMessageContactsBulk(message.id, chunk);
          created += res.created;
        } catch {
          failed += chunk.length;
        }
        const done = Math.min(i + CHUNK, total);
        setProgress({ done, total });
        if (withProgress) {
          toast.loading(
            t("mail.bulkProgress", {
              defaultValue: "Creating contacts… {{done}}/{{total}}",
              done,
              total,
            }),
            { id: toastId },
          );
        }
        invalidate(); // progressive refresh — rows flip to "linked" as we go
      }
    } finally {
      setProgress(null);
      setSelected(new Set());
      invalidate();
    }

    const opts = withProgress ? { id: toastId } : undefined;
    if (failed > 0) {
      toast.error(
        t("mail.bulkPartial", {
          defaultValue: "Created {{created}}, {{failed}} failed.",
          created,
          failed,
        }),
        opts,
      );
    } else {
      toast.success(
        t("mail.createdContactsToast", {
          defaultValue: "Created {{count}} contact(s).",
          count: created,
        }),
        opts,
      );
    }
  };

  const busy = attachMutation.isPending || progress !== null;

  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const selectableNew = parts.filter((p) => !p.linked && !p.contact_match);
  const bulkCreate = () => {
    const items = parts
      .filter((p) => p.email && selected.has(p.email.toLowerCase()))
      .map((p) => ({
        email: p.email!,
        firstName: splitName(p.display_name).firstName ?? null,
      }));
    void runQueue(items);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("mail.recipients", { defaultValue: "Recipients" })}
            </DialogTitle>
            <DialogDescription>
              {t("mail.recipientsDescription", {
                defaultValue:
                  "Create a contact for each recipient or connect them to existing ones.",
              })}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {parts.map((p) => {
              const email = p.email!;
              const key = email.toLowerCase();
              const status = p.linked
                ? "linked"
                : p.contact_match
                  ? "existing"
                  : "new";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  {status === "new" ? (
                    <Checkbox
                      checked={selected.has(key)}
                      onCheckedChange={() => toggle(key)}
                      disabled={busy}
                      aria-label={email}
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {KIND_LABEL[p.kind] ?? p.kind}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {p.display_name?.trim() || email}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {email}
                    </p>
                  </div>

                  {status === "linked" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Check className="size-3.5" />
                      {t("mail.statusLinked", { defaultValue: "Linked" })}
                      {p.contact_match && (
                        <Link
                          to={`/contacts/${p.contact_match.id}`}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      )}
                    </span>
                  ) : status === "existing" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 gap-1.5 text-xs"
                      disabled={busy}
                      onClick={() =>
                        attachMutation.mutate({
                          contactId: p.contact_match!.id,
                          email,
                        })
                      }
                    >
                      <Link2 className="size-3.5" />
                      {t("mail.connect", { defaultValue: "Connect" })}
                    </Button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={busy}
                        onClick={() =>
                          void runQueue([
                            {
                              email,
                              firstName:
                                splitName(p.display_name).firstName ?? null,
                            },
                          ])
                        }
                      >
                        <UserPlus className="size-3.5" />
                        {t("mail.create", { defaultValue: "Create" })}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 text-xs text-muted-foreground"
                        disabled={busy}
                        onClick={() => setPickerFor(email)}
                      >
                        {t("mail.linkExistingShort", { defaultValue: "Link" })}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {selectableNew.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setSelected(
                    selected.size === selectableNew.length
                      ? new Set()
                      : new Set(
                          selectableNew.map((p) => p.email!.toLowerCase()),
                        ),
                  )
                }
              >
                {selected.size === selectableNew.length
                  ? t("mail.clearSelection", { defaultValue: "Clear" })
                  : t("mail.selectAllNew", { defaultValue: "Select all new" })}
              </button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy || selected.size === 0}
                onClick={bulkCreate}
              >
                {progress ? (
                  <>
                    <div className="size-3.5 app-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    {t("mail.bulkProgress", {
                      defaultValue: "Creating contacts… {{done}}/{{total}}",
                      done: progress.done,
                      total: progress.total,
                    })}
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    {t("mail.bulkCreate", {
                      defaultValue: "Create {{count}} contacts",
                      count: selected.size,
                    })}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LinkContactDialog
        open={!!pickerFor}
        onOpenChange={(o) => !o && setPickerFor(null)}
        emailToAdd={pickerFor}
        pendingId={
          attachMutation.isPending ? attachMutation.variables?.contactId : null
        }
        onSelect={(cid) =>
          pickerFor &&
          attachMutation.mutate(
            { contactId: cid, email: pickerFor },
            { onSuccess: () => setPickerFor(null) },
          )
        }
      />
    </>
  );
}
