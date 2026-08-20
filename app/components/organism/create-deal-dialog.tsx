import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import {
  getContacts,
  getContact,
  type ContactDetail,
  type ContactListItem,
} from "~/lib/api/contacts-crm";
import {
  createDeal,
  parseDealValue,
  formatDealValueInput,
} from "~/lib/api/deals";
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
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
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
   * (e.g. open from lead or contact page). Keeps the field showing the right person immediately.
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
  const [selectedContactLabel, setSelectedContactLabel] = useState<
    string | null
  >(null);
  const [newAssignee, setNewAssignee] = useState("unassigned");

  // Searchable contact picker state.
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const debouncedContactSearch = useDebounce(contactSearch.trim(), 300);
  const contactListScrollRef = useRef<HTMLDivElement>(null);
  const contactInputWrapperRef = useRef<HTMLDivElement>(null);

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });

  // Manual wheel handler: Dialog's RemoveScroll blocks wheel events on portaled
  // content. We scroll manually and consume the event so it works over the list.
  const handleContactListWheel = (e: React.WheelEvent) => {
    const el = contactListScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop += e.deltaY;
    }
  };

  /** Server-side contact search; only runs once the picker has been opened. */
  const contactsQuery = useQuery({
    queryKey: ["contacts", "create-deal-dialog", debouncedContactSearch],
    queryFn: () =>
      getContacts({
        page: 1,
        limit: 50,
        search: debouncedContactSearch || undefined,
      }),
    enabled: !!currentWorkspace && open && contactPickerOpen,
    staleTime: 30 * 1000,
  });

  const apiContacts = contactsQuery.data?.data ?? [];

  const contactRows = useMemo(
    () =>
      apiContacts.map((c) => ({
        id: c.id,
        label: labelFromListItem(c),
        subtitle: c.primary_email?.trim() || c.primary_phone?.trim() || null,
      })),
    [apiContacts],
  );

  // Resolve a display label for a prefilled contact that isn't in the search
  // results yet (e.g. opened from a lead or contact page).
  const needsPrefillLabel =
    open && !!prefillContactId && !prefillContactLabel?.trim();

  const { data: prefillContactDetail } = useQuery({
    queryKey: ["contact", prefillContactId, "create-deal-dialog"],
    queryFn: () => getContact(prefillContactId!),
    enabled: needsPrefillLabel,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Reset the form's contact state whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (prefillContactId) {
      const label = prefillContactLabel?.trim() || "";
      setSelectedContactId(prefillContactId);
      setSelectedContactLabel(label || null);
      setContactSearch(label);
    } else {
      setSelectedContactId(CONTACT_NONE);
      setSelectedContactLabel(null);
      setContactSearch("");
    }
  }, [open, prefillContactId, prefillContactLabel]);

  // Fill in the prefilled contact's label once the detail API returns.
  useEffect(() => {
    if (
      prefillContactDetail &&
      selectedContactId === prefillContactId &&
      !selectedContactLabel
    ) {
      const label = labelFromContactDetail(prefillContactDetail);
      setSelectedContactLabel(label);
      setContactSearch(label);
    }
  }, [
    prefillContactDetail,
    selectedContactId,
    prefillContactId,
    selectedContactLabel,
  ]);

  const invalidateDeals = () => {
    void queryClient.invalidateQueries({ queryKey: ["deals"] });
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
        // Omitted stage = the backend places the deal in the workspace's
        // entry stage.
      }),
    onSuccess: (res) => {
      invalidateDeals();
      onOpenChange(false);
      setNewTitle("");
      setNewValue("");
      setSelectedContactId(CONTACT_NONE);
      setSelectedContactLabel(null);
      setContactSearch("");
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

  const selectContact = (id: string, label: string) => {
    setSelectedContactId(id);
    setSelectedContactLabel(label);
    setContactSearch(label);
    setContactPickerOpen(false);
  };

  const clearContact = () => {
    setSelectedContactId(CONTACT_NONE);
    setSelectedContactLabel(null);
    setContactSearch("");
  };

  // Typing in the field searches; it also clears any previously picked contact
  // so the deal isn't tied to a contact the text no longer matches.
  const handleContactInputChange = (value: string) => {
    setContactSearch(value);
    if (selectedContactId !== CONTACT_NONE) {
      setSelectedContactId(CONTACT_NONE);
      setSelectedContactLabel(null);
    }
    if (!contactPickerOpen) setContactPickerOpen(true);
  };

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
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                  setNewValue(formatDealValueInput(e.target.value));
                }}
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
            <Popover
              open={contactPickerOpen}
              onOpenChange={setContactPickerOpen}
            >
              <PopoverAnchor asChild>
                <div className="relative" ref={contactInputWrapperRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="create-deal-contact"
                    value={contactSearch}
                    disabled={!canCreate}
                    onChange={(e) => handleContactInputChange(e.target.value)}
                    onFocus={() => setContactPickerOpen(true)}
                    onClick={() => setContactPickerOpen(true)}
                    placeholder={t("pipeline.fields.searchContactPlaceholder", {
                      defaultValue: "Search contacts…",
                    })}
                    autoComplete="off"
                    className="px-9"
                  />
                  {contactSearch ? (
                    <button
                      type="button"
                      onClick={clearContact}
                      aria-label={t("common.clearSearch", {
                        defaultValue: "Clear",
                      })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                  // Keep the dropdown open while the user types in the anchor input.
                  if (
                    e.target instanceof Node &&
                    contactInputWrapperRef.current?.contains(e.target)
                  ) {
                    e.preventDefault();
                  }
                }}
                className="w-(--radix-popover-trigger-width) p-0 flex flex-col overflow-hidden"
              >
                <div
                  ref={contactListScrollRef}
                  className="min-h-0 max-h-[220px] overflow-y-auto overscroll-contain"
                  onWheel={handleContactListWheel}
                >
                  {contactsQuery.isFetching ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    </div>
                  ) : contactRows.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                      {t("pipeline.attachContactNoResults", {
                        defaultValue: "No contacts found.",
                      })}
                    </div>
                  ) : (
                    contactRows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => selectContact(row.id, row.label)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="flex-1 truncate font-medium">
                          {row.label}
                        </span>
                        {row.subtitle ? (
                          <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                            {row.subtitle}
                          </span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
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
              valueNegative
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
