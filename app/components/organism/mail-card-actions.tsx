import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Users } from "lucide-react";
import { detachMessageContact, type BccMessage } from "~/lib/api/bcc-logs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
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
import { MailParticipantsDialog } from "~/components/organism/mail-participants-dialog";
import {
  emailParticipants,
  useMailInvalidate,
} from "~/components/organism/mail-helpers";

export function MailCardActions({ message }: { message: BccMessage }) {
  const { t } = useTranslation();
  const invalidate = useMailInvalidate();
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [confirmDetach, setConfirmDetach] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const contacts = message.contacts ?? [];
  const recipients = emailParticipants(message.participants);
  const unlinkedCount = recipients.filter((p) => !p.linked).length;

  const detachMutation = useMutation({
    mutationFn: (contactId: string) =>
      detachMessageContact(message.id, contactId),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("mail.unlinkedToast", { defaultValue: "Contact unlinked." }),
      );
    },
    onError: (error) =>
      toast.error(
        t("mail.linkFailed", { defaultValue: "Could not update link." }),
        { description: extractErrorMessage(error) },
      ),
  });

  return (
    <>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {/* Linked-contact chips */}
        {contacts.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
          >
            <Link
              to={`/contacts/${c.id}`}
              className="max-w-[160px] truncate font-medium text-foreground hover:text-primary"
            >
              {c.full_name?.trim() ||
                c.primary_email ||
                t("mail.theContact", { defaultValue: "contact" })}
            </Link>
            <button
              type="button"
              onClick={() =>
                setConfirmDetach({
                  id: c.id,
                  name:
                    c.full_name?.trim() ||
                    c.primary_email ||
                    t("mail.theContact", { defaultValue: "contact" }),
                })
              }
              disabled={detachMutation.isPending}
              aria-label={t("mail.unlink", { defaultValue: "Unlink" })}
              className="ml-0.5 flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        {/* Unlinked-recipients pill — opens the manage dialog */}
        {unlinkedCount > 0 && (
          <button
            type="button"
            onClick={() => setParticipantsOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/50 bg-amber-500/5 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
          >
            <Users className="size-3" />
            {t("mail.unlinkedCount", {
              defaultValue: "{{count}} unlinked",
              count: unlinkedCount,
            })}
          </button>
        )}
      </div>

      <MailParticipantsDialog
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        message={message}
      />

      {/* Unlink confirmation */}
      <AlertDialog
        open={!!confirmDetach}
        onOpenChange={(o) => !o && setConfirmDetach(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("mail.unlinkConfirmTitle", {
                defaultValue: "Unlink this contact?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("mail.unlinkConfirmBody", {
                defaultValue:
                  "Remove the link between this email and {{name}}? The contact itself is not deleted.",
                name: confirmDetach?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDetach) detachMutation.mutate(confirmDetach.id);
                setConfirmDetach(null);
              }}
            >
              {t("mail.unlink", { defaultValue: "Unlink" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
