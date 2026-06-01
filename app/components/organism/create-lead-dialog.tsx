import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLead, updateLeadStatus } from "~/lib/api/leads";
import { LEAD_STATUSES, type LeadStatus } from "~/lib/leads/constants";
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

export interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_STATUS: LeadStatus = "new_lead";

export function CreateLeadDialog({
  open,
  onOpenChange,
}: CreateLeadDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<LeadStatus>(DEFAULT_STATUS);

  useEffect(() => {
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setStatus(DEFAULT_STATUS);
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
      });
      if (status !== DEFAULT_STATUS) {
        await updateLeadStatus(res.id, status);
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
    email.trim().length > 0 ||
    phone.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t("leads.newLeadTitle", { defaultValue: "New lead" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 flex-1 overflow-y-auto px-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-lead-first-name">
                {t("leads.fields.firstName", { defaultValue: "First name" })}
              </Label>
              <Input
                id="create-lead-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
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
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("leads.fields.status", { defaultValue: "Status" })}
            </Label>
            <LeadStatusSelect value={status} onValueChange={setStatus} />
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
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !hasIdentity}
          >
            {createMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("leads.create", { defaultValue: "Create lead" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
