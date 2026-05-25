import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import {
  getContacts,
  getContact,
  type ContactDetail,
  type ContactListItem,
} from "~/lib/api/contacts-crm";
import { createDeal, parseDealValue } from "~/lib/api/deals";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "sonner";

const CONTACT_NONE = "__none__";

function labelFromListItem(c: ContactListItem): string {
  const name = c.contact_full_name?.trim();
  if (name) return name;
  const email = c.primary_email?.trim();
  if (email) return email;
  const phone = c.primary_phone?.trim();
  if (phone) return phone;
  return `${c.id.slice(0, 8)}…`;
}

function labelFromContactDetail(detail: ContactDetail): string {
  const c = detail.contact;
  const name =
    (c?.full_name as string | undefined)?.trim() ||
    [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  const primaryEmail =
    detail.emails?.find((e) => e.is_primary === true) ?? detail.emails?.[0];
  const addr = primaryEmail?.address;
  if (addr != null && String(addr).trim()) return String(addr).trim();
  return "—";
}

export interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When truthy, that contact is selected whenever the dialog opens.
   * Omit or pass null/undefined when the field should reset (Pipeline “New deal”).
   */
  prefillContactId?: string | null;
  /**
   * Display name for `prefillContactId` when the list/detail APIs have not returned yet
   * (e.g. open from lead or contact page). Keeps the select showing the right person immediately.
   */
  prefillContactLabel?: string | null;
  canCreate?: boolean;
}

export function CreateDealDialog({
  open,
  onOpenChange,
  prefillContactId,
  prefillContactLabel,
  canCreate = true,
}: CreateDealDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();

  const [newTitle, setNewTitle] = useState("");
  const [newValue, setNewValue] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(CONTACT_NONE);
  const [newAssignee, setNewAssignee] = useState("unassigned");

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });

  const [contactsListRequested, setContactsListRequested] = useState(false);

  useEffect(() => {
    if (open) setContactsListRequested(true);
  }, [open]);

  /** Fetches after first open while mounted; `staleTime` stops refetch on every later open. */
  const contactsQuery = useQuery({
    queryKey: ["contacts", "create-deal-dialog"],
    queryFn: () => getContacts({ page: 1, limit: 500 }),
    enabled: !!currentWorkspace && contactsListRequested,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const apiContacts = contactsQuery.data?.data ?? [];
  const contactsReady = contactsQuery.isSuccess || contactsQuery.isError;

  const prefillNotInWorkspaceList =
    !!prefillContactId &&
    !apiContacts.some((c) => c.id === prefillContactId);

  const { data: prefillContactDetail } = useQuery({
    queryKey: ["contact", prefillContactId, "create-deal-dialog"],
    queryFn: () => getContact(prefillContactId!),
    enabled:
      open &&
      !!prefillContactId &&
      contactsReady &&
      prefillNotInWorkspaceList,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const showPrefillPlaceholderRow =
    open && !!prefillContactId && prefillNotInWorkspaceList;

  const contactSelectRows = useMemo((): { id: string; label: string }[] => {
    const rows = apiContacts.map((c) => ({
      id: c.id,
      label: labelFromListItem(c),
    }));
    if (showPrefillPlaceholderRow && prefillContactId) {
      const labelFromApi = prefillContactDetail
        ? labelFromContactDetail(prefillContactDetail)
        : null;
      const trimmedHint = prefillContactLabel?.trim();
      const label =
        labelFromApi ??
        trimmedHint ??
        t("pipeline.fields.contact", { defaultValue: "Contact" });
      rows.unshift({ id: prefillContactId, label });
    }
    return rows;
  }, [
    apiContacts,
    showPrefillPlaceholderRow,
    prefillContactId,
    prefillContactDetail,
    prefillContactLabel,
    t,
  ]);

  useEffect(() => {
    if (!open) return;
    if (prefillContactId) {
      setSelectedContactId(prefillContactId);
    } else {
      setSelectedContactId(CONTACT_NONE);
    }
  }, [open, prefillContactId]);

  const invalidateDeals = () => {
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["deal"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createDeal({
        title: newTitle.trim(),
        value: parseDealValue(newValue),
        contact_id:
          selectedContactId === CONTACT_NONE ? null : selectedContactId,
        assigned_to: newAssignee === "unassigned" ? null : newAssignee,
        stage: "new",
      }),
    onSuccess: (res) => {
      invalidateDeals();
      onOpenChange(false);
      setNewTitle("");
      setNewValue("");
      setSelectedContactId(CONTACT_NONE);
      setNewAssignee("unassigned");
      navigate(`/pipeline/${res.id}`);
      toast.success(t("pipeline.dealCreated", { defaultValue: "Deal created." }));
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.createFailed", { defaultValue: "Could not create deal." }),
      );
    },
  });

  const titleValid = newTitle.trim().length > 0;
  const parsedNewValue = parseDealValue(newValue);
  const valueNegative = parsedNewValue != null && parsedNewValue < 0;

  const members = workspaceQuery.data?.members ?? [];

  const membersForSelect = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        label:
          [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") ||
          m.user_email,
      })),
    [members],
  );

  const selectedContactResolved =
    selectedContactId === CONTACT_NONE ||
    contactSelectRows.some((r) => r.id === selectedContactId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("pipeline.newDealTitle", { defaultValue: "New deal" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="create-deal-title">
              {t("pipeline.fields.titleRequired", { defaultValue: "Title (required)" })}
            </Label>
            <Input
              id="create-deal-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("pipeline.fields.titlePlaceholder", {
                defaultValue: "Enter deal title",
              })}
              required
              aria-required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("pipeline.fields.value", { defaultValue: "Value (EUR)" })}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="0"
              aria-invalid={valueNegative}
            />
            {valueNegative ? (
              <p className="text-[11px] text-destructive">
                {t("pipeline.errors.valueNegative", {
                  defaultValue: "Value cannot be negative.",
                })}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-deal-contact">
              {t("pipeline.fields.contact", { defaultValue: "Contact (optional)" })}
            </Label>
            <Select
              value={selectedContactId}
              onValueChange={setSelectedContactId}
              disabled={!canCreate}
            >
              <SelectTrigger id="create-deal-contact" className="w-full">
                <SelectValue
                  placeholder={t("pipeline.fields.selectContactPlaceholder", {
                    defaultValue: "Select contact",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CONTACT_NONE}>
                  {t("pipeline.fields.noContact", { defaultValue: "No contact" })}
                </SelectItem>
                {contactSelectRows.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("contacts.assignedTo", { defaultValue: "Assigned to" })}</Label>
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  {t("contacts.unassigned", { defaultValue: "Unassigned" })}
                </SelectItem>
                {membersForSelect.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !canCreate ||
              !titleValid ||
              valueNegative ||
              !selectedContactResolved
            }
          >
            {createMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("pipeline.create", { defaultValue: "Create" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
