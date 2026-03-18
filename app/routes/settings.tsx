import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Trash2,
  HelpCircle,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getWorkspaceDetail,
  getCurrentWorkspaceInvoices,
  updateWorkspaceMember,
  removeWorkspaceMember,
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

function getInvoiceStatusLabel(status: string, dueDate: string | null): string {
  if (status === "paid") return "Paid";
  if (status === "open") {
    if (dueDate) {
      const sec = parseInt(dueDate, 10);
      if (!Number.isNaN(sec) && sec * 1000 < Date.now()) return "Overdue";
    }
    return "Unpaid";
  }
  return status || "—";
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

function StatusPill({ label }: { label: string }) {
  const map: Record<string, string> = {
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Overdue: "bg-red-50 text-red-700 border-red-200",
    Unpaid: "bg-amber-50 text-amber-700 border-amber-200",
    Upcoming: "bg-stone-100 text-stone-500 border-stone-200",
  };
  const cls = map[label] ?? "bg-stone-100 text-stone-500 border-stone-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}

function SettingsInvoicesTab() {
  const { currentWorkspace } = useAuthContext();
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
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_100px_160px] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
        {["Invoice #", "Amount", "Status", ""].map((h) => (
          <span key={h} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {h}
          </span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {invoices.map((inv: WorkspaceInvoice) => {
          const statusLabel = getInvoiceStatusLabel(inv.status, inv.due_date ?? null);
          const isPaid = inv.status === "paid";
          const displayStatus = statusLabel === "draft" ? "Upcoming" : statusLabel;
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
                  inv.currency ?? null
                )}
              </span>
              <StatusPill label={displayStatus} />
              <div>
                {inv.status === "draft" ? (
                  <span className="text-xs text-muted-foreground">
                    {inv.due_date ? `Due ${formatDate(inv.due_date ?? null)}` : "Upcoming"}
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
                      Download receipt
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
                      View invoice
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
    onError: (error, variables, context) => {
      if (context?.previousWorkspace && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousWorkspace);
      }
      toast.error(extractErrorMessage(error));
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.data.lead_notification !== undefined
          ? "Lead notifications updated"
          : "Member role updated"
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
      toast.success("Member removed");
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
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="text-sm">Loading settings…</span>
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
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your workspace configuration and team
        </p>
      </div>

      <div className="border-t border-border" />

      <Tabs defaultValue="general" className="w-full app-fade-up app-fade-up-d1">
        <TabsList variant="line" className="w-full mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          {/* Services */}
          <SettingsSection label="Services">
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
                        {s.service_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card px-5 py-6">
                <p className="text-sm text-muted-foreground">
                  No services active.{" "}
                  <a
                    href="mailto:support@dendritecorp.com"
                    className="text-primary hover:underline"
                  >
                    Contact support
                  </a>{" "}
                  to get started.
                </p>
              </div>
            )}
          </SettingsSection>

          <div className="border-t border-border" />

          {/* URL */}
          <SettingsSection label="Workspace URL">
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
                    To change the URL, contact{" "}
                    <a href="mailto:support@dendritecorp.com" className="underline">
                      support@dendritecorp.com
                    </a>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </SettingsSection>

          <div className="border-t border-border" />

          {/* Members */}
          <SettingsSection
            label="Team members"
            description={`To add members, contact support@dendritecorp.com`}
          >
            {members.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header row */}
                <div className="hidden md:grid grid-cols-[1fr_180px_140px_100px_48px] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
                  {["Member", "Email", "Role", "Lead alerts", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                                  you
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
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
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
                            aria-label={`Remove ${displayName}`}
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
                  No members in this workspace.
                </p>
              </div>
            )}
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
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{memberToRemove?.name}</strong> from the workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
