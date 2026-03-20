import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Package,
  Trash2,
  HelpCircle,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getLocalizedServiceName } from "~/lib/api/auth";
import {
  getWorkspaceDetail,
  getCurrentWorkspaceInvoices,
  updateWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceLanguage,
  type WorkspaceDetail,
  type WorkspaceInvoice,
} from "~/lib/api/workspaces";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Settings - Repraesent" },
    { name: "description", content: "Workspace settings" },
  ];
}

function formatAmount(cents: string | null, currency: string | null): string {
  if (cents == null) return "—";
  const amount = Number(cents) / 100;
  const curr = (currency || "eur").toUpperCase();
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: curr,
  }).format(amount);
}

function formatDate(unixStr: string | null): string {
  if (!unixStr) return "—";
  const sec = parseInt(unixStr, 10);
  if (Number.isNaN(sec)) return unixStr;
  return new Date(sec * 1000).toLocaleDateString();
}

function getInvoiceStatusCode(
  status: string,
  dueDate: string | null,
): string {
  if (status === "paid") return "paid";
  if (status === "open") {
    if (dueDate) {
      const sec = parseInt(dueDate, 10);
      if (!Number.isNaN(sec) && sec * 1000 < Date.now()) return "overdue";
    }
    return "unpaid";
  }
  if (status === "draft") return "draft";
  return status || "unknown";
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

function StatusPill({ code, label }: { code: string; label: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
    unpaid: "bg-amber-50 text-amber-700 border-amber-200",
    draft: "bg-stone-100 text-stone-500 border-stone-200",
  };
  const cls = map[code] ?? "bg-stone-100 text-stone-500 border-stone-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function SettingsInvoicesTab() {
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["workspaceInvoices", currentWorkspace?.id],
    queryFn: getCurrentWorkspaceInvoices,
    enabled: !!currentWorkspace?.id,
    refetchOnMount: "always",
  });

  const invoices = data?.invoices ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.invoices.noInvoices")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_100px_160px] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
        {[t("settings.invoices.number"), t("settings.invoices.amount"), t("settings.invoices.status"), ""].map((h) => (
          <span
            key={h}
            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {h}
          </span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {invoices.map((inv: WorkspaceInvoice) => {
          const statusCode = getInvoiceStatusCode(inv.status, inv.due_date ?? null);
          const statusLabel = t(`settings.invoices.statuses.${statusCode}`, { defaultValue: statusCode });
          const isPaid = inv.status === "paid";
          return (
            <div
              key={inv.id}
              className="grid grid-cols-[1fr_120px_100px_160px] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors"
            >
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">
                {inv.number ?? inv.id.slice(-8)}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatAmount(
                  (isPaid ? inv.amount_paid : inv.amount_due) ?? null,
                  inv.currency ?? null,
                )}
              </span>
              <StatusPill code={statusCode} label={statusLabel} />
              <div>
                {inv.status === "draft" ? (
                  <span className="text-xs text-muted-foreground">
                    {inv.due_date
                      ? t("settings.invoices.dueLabel", { date: formatDate(inv.due_date ?? null) })
                      : t("settings.invoices.upcoming")}
                  </span>
                ) : isPaid ? (
                  (inv.invoice_pdf || inv.hosted_invoice_url) && (
                    <a
                      href={inv.invoice_pdf ?? inv.hosted_invoice_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("settings.invoices.downloadReceipt")}
                    </a>
                  )
                ) : (
                  inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("settings.invoices.viewInvoice")}
                    </a>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, currentWorkspace } = useAuthContext();
  const { t, i18n } = useTranslation();
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
    memberUserId: string,
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
              : m,
          ),
        };
      });
      return { previousWorkspace, queryKey };
    },
    onError: (error, variables, context) => {
      if (context?.previousWorkspace && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousWorkspace);
      }
      toast.error(extractErrorMessage(error));
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.data.lead_notification !== undefined
          ? t("settings.members.notificationsUpdated")
          : t("settings.members.roleUpdated"),
      );
    },
    onSettled: (_, __, ___, context) => {
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

  const workspaceLanguageMutation = useMutation({
    mutationFn: (language: "en" | "de") => updateWorkspaceLanguage(language),
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ["userContext"] });
      toast.success(t("settings.workspace.saveSuccess"));
      // If no personal override, also update UI language to match
      const hasPersonal = document.cookie
        .split(";")
        .some((c) => c.trim().startsWith("personal_lang="));
      if (!hasPersonal) {
        i18n.changeLanguage(language);
      }
    },
    onError: (error) => {
      toast.error(t("settings.workspace.saveFailed"), {
        description: extractErrorMessage(error),
      });
    },
  });

  const handlePersonalLanguageChange = (lang: "en" | "de") => {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${lang}; path=/; max-age=${maxAge}; samesite=lax`;
    i18n.changeLanguage(lang);
  };

  const handleRemoveMember = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.userId);
    }
  };

  if (isLoading || !workspace) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  const services = workspace.services ?? [];
  const members = workspace.members ?? [];
  const workspaceUrl = workspace.url?.url ?? "—";

  return (
    <div className="p-6 space-y-6 app-fade-in">
      {/* Header */}
      <div className="app-fade-up">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("settings.workspace.title")}
        </p>
      </div>

      <div className="border-t border-border" />

      <Tabs
        defaultValue="general"
        className="w-full app-fade-up app-fade-up-d1"
      >
        <TabsList variant="line" className="w-full mb-6">
          <TabsTrigger value="general">{t("settings.workspace.title")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("settings.invoices.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          {/* Services */}
          <SettingsSection label={t("settings.services.title")}>
            {services.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {services.map((s) => (
                    <div
                      key={s.service_id}
                      className="flex items-center gap-4 px-5 py-3.5"
                    >
                      {s.service_image ? (
                        <img
                          src={s.service_image}
                          alt=""
                          className="h-8 w-8 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {getLocalizedServiceName(s, i18n.language ?? "de")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card px-5 py-6">
                <p className="text-sm text-muted-foreground">
                  {t("settings.services.noServices")}
                </p>
              </div>
            )}
          </SettingsSection>

          <div className="border-t border-border" />

          {/* URL */}
          <SettingsSection label={t("settings.workspace.urlLabel")}>
            <TooltipProvider>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  value={workspaceUrl}
                  disabled
                  readOnly
                  className="h-10 bg-muted/60 border-border text-foreground font-mono text-sm"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="shrink-0 h-10 w-10 rounded-lg border border-border bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    {t("settings.workspace.urlTooltip")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </SettingsSection>

          <div className="border-t border-border" />

          {/* Members */}
          <SettingsSection
            label={t("settings.members.title")}
            description={t("settings.members.addHint")}
          >
            {members.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header row */}
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
                        {/* Name + avatar */}
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
                          </div>
                        </div>
                        {/* Email */}
                        <span className="text-sm text-muted-foreground truncate hidden md:block">
                          {m.user_email}
                        </span>
                        {/* Role */}
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
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t("settings.members.roles.admin")}</SelectItem>
                            <SelectItem value="editor">{t("settings.members.roles.editor")}</SelectItem>
                            <SelectItem value="viewer">{t("settings.members.roles.viewer")}</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Lead notification */}
                        <div className="flex items-center">
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
                        {/* Remove */}
                        <div className="flex items-center">
                          <button
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

          <div className="border-t border-border" />

          {/* Workspace Language (admin only) */}
          {isAdmin && (
            <SettingsSection
              label={t("settings.workspace.language")}
              description={t("settings.workspace.languageHint")}
            >
              <Select
                value={currentWorkspace?.language ?? "de"}
                onValueChange={(v) =>
                  workspaceLanguageMutation.mutate(v as "en" | "de")
                }
                disabled={workspaceLanguageMutation.isPending}
              >
                <SelectTrigger className="h-10 max-w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">{t("settings.workspace.languageDe")}</SelectItem>
                  <SelectItem value="en">{t("settings.workspace.languageEn")}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsSection>
          )}

          <div className="border-t border-border" />

          {/* Personal Language */}
          <SettingsSection
            label={t("settings.language.title")}
            description={t("settings.language.hint")}
          >
            <Select
              value={i18n.language?.startsWith("de") ? "de" : "en"}
              onValueChange={(v) => handlePersonalLanguageChange(v as "en" | "de")}
            >
              <SelectTrigger className="h-10 max-w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">{t("settings.language.de")}</SelectItem>
                <SelectItem value="en">{t("settings.language.en")}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="invoices">
          <SettingsInvoicesTab />
        </TabsContent>
      </Tabs>

      {/* Remove member confirmation */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.members.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.members.removeDescription", { name: memberToRemove?.name ?? "" })}
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
    </div>
  );
}
