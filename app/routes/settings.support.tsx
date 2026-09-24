import { useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Headset, Search } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { listCalendarAccounts } from "~/lib/api/calendar";
import { listSupportWorkspaces, setSupportContact, type SupportHost, type SupportWorkspaceRow } from "~/lib/api/support";
import { HostRow } from "~/components/onboarding-settings/host-picker";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const PAGE_SIZE = 25;
type Filter = "all" | "on" | "off";

/**
 * Root Settings → Support. Every live customer workspace, with whether its
 * members see "Contact re:praesent" in the sidebar and who answers them.
 * Off for all until switched on; switching on asks for the person first.
 */
export default function SupportSettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const allowed = currentWorkspace?.is_root === true && currentWorkspace.member_role === "admin";
  useDocumentMeta({ titleKey: "settings.support.metaTitle", descriptionKey: "settings.support.metaDescription", titleSuffix: " - Repraesent" });
  const { ref: searchInputRef, withHint } = useSearchShortcut();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 250);

  const listQuery = useQuery({
    queryKey: ["root-support", debounced, filter, page],
    queryFn: () => listSupportWorkspaces({ search: debounced || undefined, filter, page, limit: PAGE_SIZE }),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });
  const membersQuery = useWorkspaceMembers();
  const calendarsQuery = useQuery({ queryKey: ["calendar-accounts"], queryFn: listCalendarAccounts, enabled: allowed });

  if (!currentWorkspace) return null;
  if (!allowed) return <Navigate to="/settings/profile" replace />;

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={withHint(t("settings.support.searchPlaceholder"))}
            className="h-10 pl-9"
          />
        </div>
        <div role="tablist" aria-label={t("settings.support.filterLabel")} className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(["all", "on", "off"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`settings.support.filter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Headset className="mx-auto h-7 w-7 text-muted-foreground/50" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">{t(debounced ? "settings.support.noMatch" : "settings.support.empty")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row) => (
            <SupportRow
              key={row.id}
              row={row}
              members={membersQuery.data?.members ?? []}
              accounts={calendarsQuery.data?.accounts ?? []}
              baikal={calendarsQuery.data?.baikal_configs ?? []}
            />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("settings.support.count", { count: total })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("common.previous", { defaultValue: "Previous" })}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t("common.next", { defaultValue: "Next" })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SupportRow({
  row,
  members,
  accounts,
  baikal,
}: {
  row: SupportWorkspaceRow;
  members: Parameters<typeof HostRow>[0]["members"];
  accounts: Parameters<typeof HostRow>[0]["accounts"];
  baikal: Parameters<typeof HostRow>[0]["baikal"];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(row.support.enabled);
  const [host, setHost] = useState<SupportHost | null>(row.support.host);

  const save = useMutation({
    mutationFn: (body: { enabled: boolean; host: SupportHost | null }) => setSupportContact(row.id, body),
    onSuccess: (res, body) => {
      setEnabled(res.enabled);
      setHost(res.host);
      void queryClient.invalidateQueries({ queryKey: ["root-support"] });
      toast.success(body.enabled ? t("settings.support.savedOn", { name: row.name }) : t("settings.support.savedOff", { name: row.name }));
    },
    onError: (err) => {
      setEnabled(row.support.enabled);
      toast.error(extractErrorMessage(err) || t("settings.support.saveFailed"));
    },
  });

  const toggle = (on: boolean) => {
    setEnabled(on);
    // Switching on needs a person first; the picker opens and saving waits for it.
    if (on && !host?.userId) return;
    save.mutate({ enabled: on, host });
  };

  const pick = (next: SupportHost) => {
    setHost(next.userId ? next : null);
    if (next.userId && enabled) save.mutate({ enabled: true, host: next });
  };

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground/70" aria-hidden>
          {row.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="truncate">{row.name}</span>
            {row.status !== "active" ? (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                {t(`settings.support.status.${row.status}`, { defaultValue: row.status })}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.owner_email ?? t("settings.support.noOwner")}
            {enabled && host?.label ? ` · ${t("settings.support.answeredBy", { name: host.label })}` : ""}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={save.isPending}
          onCheckedChange={toggle}
          aria-label={t("settings.support.toggleLabel", { name: row.name })}
          className="data-[state=checked]:bg-foreground"
        />
      </div>
      {enabled ? (
        <div className="mt-3 pl-12">
          {!host?.userId ? <p className="mb-2 text-xs font-medium text-foreground">{t("settings.support.pickFirst")}</p> : null}
          <HostRow
            host={{ targetKey: host?.targetKey ?? "", userId: host?.userId ?? "", label: host?.label, avatarUrl: host?.avatarUrl }}
            members={members}
            accounts={accounts}
            baikal={baikal}
            calendarOptional
            onChange={(h) => pick({ ...h, targetKey: h.targetKey || undefined })}
          />
        </div>
      ) : null}
    </li>
  );
}
