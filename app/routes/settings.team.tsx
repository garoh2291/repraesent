import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Trash2,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Mail,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getWorkspaceDetail,
  updateWorkspaceMember,
  removeWorkspaceMember,
  type WorkspaceDetail,
} from "~/lib/api/workspaces";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getHistoricalData,
  createHistoricalData,
} from "~/lib/api/historical-data";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export function meta() {
  return [
    { title: `${i18n.t("settings.team.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.team.metaDescription"),
    },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function SettingsSection({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <SectionLabel>{label}</SectionLabel>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export default function SettingsTeam() {
  const { user, currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspaceDetail", currentWorkspace?.id],
    queryFn: getWorkspaceDetail,
    enabled: !!currentWorkspace?.id,
    refetchOnMount: "always",
  });

  const isAdmin = currentWorkspace?.member_role === "admin";
  const currentUserRole = currentWorkspace?.member_role ?? "viewer";
  const currentUserId = user?.id;

  const canChangeLeadNotification = (
    memberRole: string,
    memberUserId: string
  ): boolean => {
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "editor")
      return memberRole === "editor" || memberRole === "viewer";
    if (currentUserRole === "viewer") return memberUserId === currentUserId;
    return false;
  };

  const updateMemberMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: {
        role?: "admin" | "editor" | "viewer";
        lead_notification?: boolean;
      };
    }) => updateWorkspaceMember(userId, data),
    onMutate: async (variables) => {
      const queryKey = ["workspaceDetail", currentWorkspace?.id];
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceDetail>(queryKey);
      queryClient.setQueryData<WorkspaceDetail>(queryKey, (old) => {
        if (!old?.members) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.user_id === variables.userId
              ? {
                  ...m,
                  ...(variables.data.role !== undefined && {
                    role: variables.data.role,
                  }),
                  ...(variables.data.lead_notification !== undefined && {
                    lead_notification: variables.data.lead_notification,
                  }),
                }
              : m
          ),
        };
      });
      return { previousWorkspace, queryKey };
    },
    onError: (error, _variables, context) => {
      if (context?.previousWorkspace && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousWorkspace);
      }
      toast.error(extractErrorMessage(error));
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.data.lead_notification !== undefined
          ? t("settings.members.notificationsUpdated")
          : t("settings.members.roleUpdated")
      );
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeWorkspaceMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaceDetail", currentWorkspace?.id],
      });
      setMemberToRemove(null);
      toast.success(t("settings.members.memberRemoved"));
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleRemoveMember = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.userId);
    }
  };

  if (isLoading || !workspace) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-12">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  const members = workspace.members ?? [];

  return (
    <>
      <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
        <SettingsSection
          label={t("settings.members.title")}
          description={t("settings.members.addHint")}
        >
          {members.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_180px_140px_100px_48px] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
                {[
                  t("settings.members.headerMember"),
                  t("settings.members.headerEmail"),
                  t("settings.members.headerRole"),
                  t("settings.members.headerLeadAlerts"),
                  "",
                ].map((h) => (
                  <span
                    key={h}
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-border">
                {members.map((m) => {
                  const isSelf = m.user_id === currentUserId;
                  const canChangeRole = isAdmin && !isSelf;
                  const canDelete = isAdmin && !isSelf;
                  const displayName =
                    `${m.user_first_name} ${m.user_last_name}`.trim() ||
                    m.user_email;
                  const initials = displayName
                    .split(" ")
                    .slice(0, 2)
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={m.user_id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px_100px_48px] gap-3 md:gap-4 px-5 py-3.5 items-center"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-bold text-muted-foreground">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {displayName}
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                {t("settings.members.youBadge")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate md:hidden mt-0.5">
                            {m.user_email}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground truncate hidden md:block">
                        {m.user_email}
                      </span>
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          updateMemberMutation.mutate({
                            userId: m.user_id,
                            data: {
                              role: v as "admin" | "editor" | "viewer",
                            },
                          })
                        }
                        disabled={!canChangeRole}
                      >
                        <SelectTrigger className="h-8 text-xs w-full md:w-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            {t("settings.members.roles.admin")}
                          </SelectItem>
                          <SelectItem value="editor">
                            {t("settings.members.roles.editor")}
                          </SelectItem>
                          <SelectItem value="viewer">
                            {t("settings.members.roles.viewer")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between md:justify-start gap-2">
                        <span className="text-xs text-muted-foreground md:hidden">
                          {t("settings.members.headerLeadAlerts")}
                        </span>
                        <Switch
                          checked={m.lead_notification ?? false}
                          onCheckedChange={(checked) =>
                            updateMemberMutation.mutate({
                              userId: m.user_id,
                              data: { lead_notification: checked },
                            })
                          }
                          disabled={
                            !canChangeLeadNotification(m.role, m.user_id)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-end md:justify-start">
                        <button
                          type="button"
                          onClick={() =>
                            setMemberToRemove({
                              userId: m.user_id,
                              name: displayName,
                            })
                          }
                          disabled={!canDelete}
                          aria-label={t("settings.members.removeMember")}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-5 py-6">
              <p className="text-sm text-muted-foreground">
                {t("settings.members.noMembers")}
              </p>
            </div>
          )}
        </SettingsSection>
      </div>

      <DoorboostMigrationSection />

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.members.removeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.members.removeDescription", {
                name: memberToRemove?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              className="bg-foreground text-background hover:bg-foreground/90 hover:text-background transition-colors"
              onClick={handleRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending
                ? t("settings.members.removing")
                : t("settings.members.removeMember")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Doorboost Migration Info Section ─── */

function DoorboostMigrationSection() {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isDoorboost =
    currentWorkspace?.was_doorboost_client === true &&
    !!currentWorkspace?.doorboost_partner_house_id;

  const { data: record, isLoading } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: isDoorboost,
  });

  const startMutation = useMutation({
    mutationFn: () => createHistoricalData("not_ready"),
    onSuccess: (data) => {
      queryClient.setQueryData(["historical-data", currentWorkspace?.id], data);
      navigate("/sync");
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (!isDoorboost) return null;
  if (isLoading) return null;

  const status = record?.status;
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      return new Intl.DateTimeFormat(i18n.language === "de" ? "de-DE" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 mt-8 app-fade-up" style={{ animationDelay: "0.12s" }}>
      <div className="space-y-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("historicalData.settingsTitle")}
        </h2>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Finished */}
        {status === "finished" && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t("historicalData.settingsFinished")}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    {formatDate(record?.finished_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failed */}
        {status === "failed" && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("historicalData.settingsFailed")}
                  </p>
                  {record?.error_reason && (
                    <p className="text-xs text-red-400/80 mt-1 font-mono leading-relaxed break-all">
                      {record.error_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="mailto:support@repraesent.com"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3 w-3" />
                    {t("historicalData.settingsContactSupport")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ignored or no record — show start button */}
        {(status === "ignored" || !record) && (
          <div className="px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <Database className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("historicalData.settingsAvailable")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("historicalData.settingsAvailableDescription")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-lg self-start sm:self-auto"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                {t("historicalData.settingsStartSync")}
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Pending / not_synced / not_ready */}
        {(status === "not_synced" || status === "pending" || status === "not_ready") && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("historicalData.settingsInProgress")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("historicalData.bannerPendingDescription")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
