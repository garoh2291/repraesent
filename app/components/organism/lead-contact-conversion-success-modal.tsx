"use client";

import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface LeadContactConversionSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeContactId: string | null;
  onViewContact: (routeContactId: string) => void;
  onCreateDeal?: (routeContactId: string) => void;
}

/** After manual lead → contact conversion */
export function LeadContactConversionSuccessModal({
  open,
  onOpenChange,
  routeContactId,
  onViewContact,
  onCreateDeal,
}: LeadContactConversionSuccessModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center gap-1">
          <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden />
          </div>
          <DialogTitle className="text-lg font-semibold">
            {t("leads.detail.contactConversionModalTitle", {
              defaultValue: "Contact created",
            })}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {t("leads.detail.contactConversionModalDescription", {
              defaultValue:
                "This lead is now linked to a contact. Open the contact record to add deals or follow up.",
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={!routeContactId}
            onClick={() => {
              if (routeContactId) onViewContact(routeContactId);
            }}
          >
            {t("leads.detail.viewContact", { defaultValue: "View contact" })}
          </Button>
          {onCreateDeal ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!routeContactId}
              onClick={() => {
                if (routeContactId) onCreateDeal(routeContactId);
              }}
            >
              {t("leads.detail.createDeal", { defaultValue: "Create deal" })}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("leads.detail.contactConversionModalClose", {
              defaultValue: "Close",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
