import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link2, Link2Off, Star, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  attachDealContact,
  detachDealContact,
  setDealPrimaryContact,
  type DealContact,
  type DealDetailResponse,
} from "~/lib/api/deals";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";
import { AttachContactDialog } from "./attach-contact-dialog";

interface DealContactSectionProps {
  dealId: string;
  contacts: DealContact[];
  canEdit?: boolean;
}

export function DealContactSection({
  dealId,
  contacts,
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
      attachDealContact(dealId, newContactId),
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

  const hasContacts = contacts.length > 0;

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
        attachedContactIds={contacts.map((c) => c.id)}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("pipeline.linkedContacts", { defaultValue: "Contacts" })}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {hasContacts
                ? t("pipeline.contactsPanelSubtitle", {
                    defaultValue:
                      "Attach multiple contacts and pick the primary one.",
                  })
                : t("pipeline.contactPanelEmptyHint", {
                    defaultValue:
                      "No contact attached yet. Attach one or create a new contact.",
                  })}
            </p>
          </div>
          {headerActions}
        </header>
        {hasContacts ? (
          <TooltipProvider>
            <ul className="divide-y divide-border">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  dealId={dealId}
                  contact={c}
                  canEdit={canEdit}
                  onChanged={invalidate}
                />
              ))}
            </ul>
          </TooltipProvider>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("pipeline.noContactAttached", {
              defaultValue: "No contact attached to this deal.",
            })}
          </div>
        )}
      </section>
    </>
  );
}

interface ContactRowProps {
  dealId: string;
  contact: DealContact;
  canEdit: boolean;
  onChanged: () => void;
}

function ContactRow({ dealId, contact, canEdit, onChanged }: ContactRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const name =
    contact.full_name?.trim() ||
    t("contacts.untitled", { defaultValue: "Untitled contact" });
  const subtitle =
    contact.primary_email?.trim() || contact.primary_phone?.trim() || null;

  const detachMutation = useMutation({
    mutationFn: () => detachDealContact(dealId, contact.id),
    onSuccess: () => {
      onChanged();
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

  const dealKey = ["deal", dealId] as const;

  const primaryMutation = useMutation({
    mutationFn: () => setDealPrimaryContact(dealId, contact.id),
    // Optimistically flip the primary flag in the cached deal so the badge and
    // star move to this row instantly — no spinner, no waiting on the request.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dealKey });
      const previous =
        queryClient.getQueryData<DealDetailResponse>(dealKey);
      if (previous) {
        const nextContacts = previous.contacts
          .map((c) => ({ ...c, is_primary: c.id === contact.id }))
          .sort((a, b) =>
            a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1,
          );
        queryClient.setQueryData<DealDetailResponse>(dealKey, {
          ...previous,
          contacts: nextContacts,
          deal: { ...previous.deal, contact_id: contact.id },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(dealKey, ctx.previous);
      }
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
    // The success toast fires only once the server confirms the change.
    onSuccess: () => {
      toast.success(
        t("pipeline.primaryContactSet", {
          defaultValue: "Primary contact updated.",
        }),
      );
    },
    // Reconcile every affected view (pipeline card, contact page) with the server.
    onSettled: () => {
      onChanged();
    },
  });

  const busy = detachMutation.isPending;

  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-muted/40">
      <Link
        to={`/contacts/${contact.id}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-sm"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{name}</p>
            {contact.is_primary ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Star className="h-3 w-3 fill-current" />
                {t("pipeline.primary", { defaultValue: "Primary" })}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </Link>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          {!contact.is_primary ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => primaryMutation.mutate()}
                  className={cn(
                    "h-7 w-7 text-muted-foreground hover:text-primary",
                  )}
                  aria-label={t("pipeline.makePrimary", {
                    defaultValue: "Make primary",
                  })}
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center">
                {t("pipeline.makePrimaryHint", {
                  defaultValue: "Set as primary contact",
                })}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            aria-label={t("pipeline.detachContact", { defaultValue: "Detach" })}
            title={t("pipeline.detachContact", { defaultValue: "Detach" })}
          >
            <Link2Off className="h-3.5 w-3.5" />
          </Button>
        </div>
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
