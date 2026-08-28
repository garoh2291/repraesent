import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MailX, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { apiClient, extractErrorMessage } from "~/lib/api/axios-instance";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { formatDateMedium } from "~/lib/utils/format";

interface SuppressionRow {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  note: string | null;
  contact_id: string | null;
  created_at: string;
}

interface PaginatedSuppressions {
  data: SuppressionRow[];
  page: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

async function listSuppressions(params: {
  page: number;
  search?: string;
}): Promise<PaginatedSuppressions> {
  const query = new URLSearchParams({ page: String(params.page), limit: "10" });
  if (params.search) query.set("search", params.search);
  const { data } = await apiClient.get(`/suppressions?${query}`);
  return data;
}

/**
 * The do-not-email list. Lives on the Segments page because it is the other
 * half of "who can a campaign reach" — the gap between matched and sendable.
 *
 * Collapsed by default. Expanded it is the largest thing on a page titled
 * Segments, which put a rarely-touched administrative list above the page's
 * actual subject. The count stays visible in the header while closed, so it
 * still answers "is anyone suppressed?" at a glance.
 */
export function SuppressionsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [newEmail, setNewEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["suppressions", page, debouncedSearch],
    queryFn: () => listSuppressions({ page, search: debouncedSearch }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["suppressions"] });

  const add = useMutation({
    mutationFn: async () => {
      await apiClient.post("/suppressions", { email: newEmail.trim() });
    },
    onSuccess: () => {
      setNewEmail("");
      invalidate();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const unsuppress = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/suppressions/${id}`);
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <Panel>
      <PanelHeader
        icon={<MailX className="h-3.5 w-3.5" />}
        title={t("emailCampaigns.suppressions.title", {
          defaultValue: "Do-not-email list",
        })}
        meta={
          data ? (
            <span className="text-xs text-muted-foreground">
              {/* A bare number said nothing. Give it its unit. */}
              {t("emailCampaigns.suppressions.count", {
                defaultValue_one: "{{count}} address",
                defaultValue_other: "{{count}} addresses",
                defaultValue: "{{count}} addresses",
                count: data.total,
              })}
            </span>
          ) : null
        }
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
          >
            {open
              ? t("common.hide", { defaultValue: "Hide" })
              : t("common.manage", { defaultValue: "Manage" })}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        }
      />
      {!open ? null : (
        <PanelBody>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("emailCampaigns.suppressions.hint", {
              defaultValue:
                "Addresses here never receive campaign emails — unsubscribes land here automatically. Removing an entry makes the address sendable again.",
            })}
          </p>

          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("emailCampaigns.suppressions.search", {
                defaultValue: "Search addresses…",
              })}
              className="h-9 max-w-56"
            />
            <div className="ml-auto flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("emailCampaigns.suppressions.addPlaceholder", {
                  defaultValue: "Suppress an address…",
                })}
                className="h-9 max-w-56"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newEmail.includes("@")) add.mutate();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                disabled={!newEmail.includes("@") || add.isPending}
                onClick={() => add.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {(data?.data.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {t("emailCampaigns.suppressions.empty", {
                defaultValue: "Nobody is suppressed.",
              })}
            </p>
          ) : (
            <div className="space-y-1">
              {data!.data.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {row.email}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`emailCampaigns.suppressions.reason_${row.reason}`, {
                      defaultValue: row.reason,
                    })}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                    {formatDateMedium(row.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => unsuppress.mutate(row.id)}
                    aria-label={t("emailCampaigns.suppressions.remove", {
                      defaultValue: "Allow again",
                    })}
                    title={t("emailCampaigns.suppressions.remove", {
                      defaultValue: "Allow again",
                    })}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {data && data.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasPrev}
                onClick={() => setPage((value) => value - 1)}
              >
                {t("common.previous", { defaultValue: "Previous" })}
              </Button>
              <span className="text-xs text-muted-foreground">
                {data.page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasNext}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("common.next", { defaultValue: "Next" })}
              </Button>
            </div>
          ) : null}
        </PanelBody>
      )}
    </Panel>
  );
}
