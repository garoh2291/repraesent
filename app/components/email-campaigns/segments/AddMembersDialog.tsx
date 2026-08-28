import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getContacts } from "~/lib/api/contacts-crm";
import { addSegmentMembers, importSegmentMembers } from "~/lib/api/segments";
import { useDebounce } from "~/lib/hooks/useDebounce";

/**
 * Add members to a manual segment: pick contacts by search, or paste a list
 * of email addresses (CSV column, newline or comma separated) that get
 * matched to existing contacts by address.
 */
export function AddMembersDialog({
  open,
  onOpenChange,
  segmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasted, setPasted] = useState("");

  const { data: contacts } = useQuery({
    queryKey: ["segment-add-contacts", debounced],
    queryFn: () => getContacts({ search: debounced, limit: 20 }),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["segment-members", segmentId] });
    queryClient.invalidateQueries({ queryKey: ["segments"] });
    queryClient.invalidateQueries({ queryKey: ["segment", segmentId] });
  };

  const addPicked = useMutation({
    mutationFn: () => addSegmentMembers(segmentId, [...selected]),
    onSuccess: (result) => {
      toast.success(
        t("emailCampaigns.segments.membersAdded", {
          defaultValue: "{{count}} added",
          count: result.added,
        }),
      );
      setSelected(new Set());
      invalidate();
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const importPasted = useMutation({
    mutationFn: () =>
      importSegmentMembers(
        segmentId,
        pasted
          .split(/[\n,;]+/)
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    onSuccess: (result) => {
      toast.success(
        t("emailCampaigns.segments.importResult", {
          defaultValue: "{{added}} added, {{unmatched}} not found",
          added: result.added,
          unmatched: result.unmatched.length,
        }),
      );
      setPasted("");
      invalidate();
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("emailCampaigns.segments.addMembers", {
              defaultValue: "Add contacts",
            })}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pick">
          <TabsList>
            <TabsTrigger value="pick">
              {t("emailCampaigns.segments.pickTab", {
                defaultValue: "Pick contacts",
              })}
            </TabsTrigger>
            <TabsTrigger value="paste">
              {t("emailCampaigns.segments.pasteTab", {
                defaultValue: "Paste emails",
              })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pick" className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border px-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("emailCampaigns.segments.searchContacts", {
                  defaultValue: "Search contacts…",
                })}
                className="h-9 border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {(contacts?.data ?? []).map((contact) => (
                <label
                  key={contact.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.has(contact.id)}
                    onCheckedChange={() => toggle(contact.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {contact.contact_full_name ||
                        t("emailCampaigns.segments.unnamed", {
                          defaultValue: "Unnamed",
                        })}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {contact.primary_email ?? "—"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button
                onClick={() => addPicked.mutate()}
                disabled={selected.size === 0 || addPicked.isPending}
              >
                {t("emailCampaigns.segments.addSelected", {
                  defaultValue: "Add {{count}}",
                  count: selected.size,
                })}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3">
            <Textarea
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"anna@example.com\nben@example.com"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t("emailCampaigns.segments.pasteHint", {
                defaultValue:
                  "One address per line (commas work too). Matched to existing contacts by email — unknown addresses are reported, not created.",
              })}
            </p>
            <DialogFooter>
              <Button
                onClick={() => importPasted.mutate()}
                disabled={!pasted.trim() || importPasted.isPending}
              >
                {importPasted.isPending
                  ? t("common.importing", { defaultValue: "Importing…" })
                  : t("emailCampaigns.segments.import", {
                      defaultValue: "Import",
                    })}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
