import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Link2, Link2Off, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { patchDealContact } from "~/lib/api/deals";
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
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";
import { AttachContactDialog } from "./attach-contact-dialog";

interface DealContactSectionProps {
  dealId: string;
  contactId: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  canEdit?: boolean;
}

export function DealContactSection({
  dealId,
  contactId,
  contactName,
  contactEmail,
  contactPhone,
  canEdit = false,
}: DealContactSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [attachContactOpen, setAttachContactOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["deal"] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["contact"] });
  };

  const attachMutation = useMutation({
    mutationFn: (newContactId: string) =>
      patchDealContact(dealId, newContactId),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("pipeline.contactAttached", { defaultValue: "Contact attached." }),
      );
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
  });

  const headerActions = canEdit ? (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setAttachContactOpen(true)}
      >
        <Link2 className="h-3.5 w-3.5" />
        {t("pipeline.attachContact", {
          defaultValue: "Attach contact",
        })}
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setCreateContactOpen(true)}
      >
        <UserPlus className="h-3.5 w-3.5" />
        {t("contacts.newContactTitle", { defaultValue: "New contact" })}
      </Button>
    </div>
  ) : null;

  return (
    <>
      <CreateContactDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        onCreated={(newContactId) => {
          attachMutation.mutate(newContactId);
        }}
      />
      <AttachContactDialog
        open={attachContactOpen}
        onOpenChange={setAttachContactOpen}
        dealId={dealId}
        currentContactId={contactId}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        {contactId ? (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("pipeline.linkedContact", { defaultValue: "Contact" })}
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("pipeline.contactPanelSubtitle", {
                    defaultValue: "Open the contact to see full details.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <ul className="divide-y divide-border">
              <ContactRow
                dealId={dealId}
                contactId={contactId}
                contactName={contactName}
                contactEmail={contactEmail}
                contactPhone={contactPhone}
                canEdit={canEdit}
              />
            </ul>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("pipeline.linkedContact", { defaultValue: "Contact" })}
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("pipeline.contactPanelEmptyHint", {
                    defaultValue:
                      "No contact attached yet. Attach one or create a new contact.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("pipeline.noContactAttached", {
                defaultValue: "No contact attached to this deal.",
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}

interface ContactRowProps {
  dealId: string;
  contactId: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  canEdit: boolean;
}

function ContactRow({
  dealId,
  contactId,
  contactName,
  contactEmail,
  contactPhone,
  canEdit,
}: ContactRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const name =
    contactName?.trim() ||
    t("contacts.untitled", { defaultValue: "Untitled contact" });
  const subtitle = contactEmail?.trim() || contactPhone?.trim() || null;

  const detachMutation = useMutation({
    mutationFn: () => patchDealContact(dealId, null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      toast.success(
        t("pipeline.contactDetached", { defaultValue: "Contact detached." }),
      );
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
  });

  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-muted/40">
      <Link
        to={`/contacts/${contactId}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-sm"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </Link>
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setConfirmOpen(true)}
          disabled={detachMutation.isPending}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t("pipeline.detachContact", { defaultValue: "Detach" })}
          title={t("pipeline.detachContact", { defaultValue: "Detach" })}
        >
          <Link2Off className="h-3.5 w-3.5" />
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.detachContactConfirmTitle", {
                defaultValue: "Detach this contact?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.detachContactConfirmDescription", {
                name,
                defaultValue:
                  '"{{name}}" will be unlinked from this deal. The contact itself is not deleted and can be re-attached later.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                detachMutation.mutate();
              }}
            >
              {t("pipeline.detachContact", { defaultValue: "Detach" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
