import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLead, updateLeadStatus } from "~/lib/api/leads";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LeadStatusSelect } from "~/components/molecule/lead-status-select";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { desktopAutoFocus } from "~/lib/utils/touch";

export interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
}: CreateLeadDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { entry } = useLeadStages();
  // The backend creates leads in the workspace's entry stage; an empty status
  // state means "keep that default" and only an explicit pick issues the
  // follow-up status update.
  const defaultStatus = entry?.key ?? "new_lead";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const effectiveStatus = status || defaultStatus;

  useEffect(() => {
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setStatus("");
    }
  }, [open]);

  const invalidate = async (id?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-column"] }),
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["contacts-options"] }),
      ...(id
        ? [queryClient.invalidateQueries({ queryKey: ["lead", id] })]
        : []),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await createLead({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company_name: company.trim() || null,
      });
      if (effectiveStatus !== defaultStatus) {
        await updateLeadStatus(res.id, effectiveStatus);
      }
      return res;
    },
    onSuccess: async (res) => {
      await invalidate(res.id);
      onOpenChange(false);
      toast.success(t("leads.created", { defaultValue: "Lead created." }));
    },
    onError: () => {
      toast.error(
        t("leads.errors.createFailed", {
          defaultValue: "Could not create lead.",
        }),
      );
    },
  });

  const hasIdentity =
    firstName.trim().length > 0 ||
    lastName.trim().length > 0 ||
    company.trim().length > 0 ||
    email.trim().length > 0 ||
    phone.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t("leads.newInquiryTitle", "New inquiry")}
          </DialogTitle>
        </DialogHeader>
        {/* `contents`: the form adds no box, so the dialog layout is unchanged.
            Enter / Go submits the same handler as the Save button. */}
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (createMutation.isPending || !hasIdentity) return;
            createMutation.mutate();
          }}
        >
        {/* Phones: the sheet itself scrolls (one scroller, sticky footer). */}
        <div className="space-y-4 py-1 flex-1 overflow-y-auto px-2 max-sm:flex-none max-sm:overflow-visible max-sm:px-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-lead-first-name">
                {t("leads.fields.firstName", { defaultValue: "First name" })}
              </Label>
              <Input
                id="create-lead-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus={desktopAutoFocus()}
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-lead-last-name">
                {t("leads.fields.lastName", { defaultValue: "Last name" })}
              </Label>
              <Input
                id="create-lead-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-lead-company">
              {t("leads.fields.company", { defaultValue: "Company" })}
            </Label>
            <Input
              id="create-lead-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
              autoCapitalize="words"
              enterKeyHint="next"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("leads.fields.status", { defaultValue: "Status" })}
            </Label>
            <LeadStatusSelect value={effectiveStatus} onValueChange={setStatus} className="max-sm:w-full" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-lead-email">
              {t("leads.fields.email", { defaultValue: "Email" })}
            </Label>
            <Input
              id="create-lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              enterKeyHint="done"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-lead-phone">
              {t("leads.fields.phone", { defaultValue: "Phone" })}
            </Label>
            <PhoneNumberInput
              value={phone}
              onChange={setPhone}
              placeholder={t("leads.fields.phone", { defaultValue: "Phone" })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || !hasIdentity}
          >
            {createMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("leads.saveInquiry", "Save inquiry")}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
