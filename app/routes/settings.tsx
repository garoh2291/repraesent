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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-(--shadow) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="p-3">Invoice #</TableHead>
            <TableHead className="p-3">Amount</TableHead>
            <TableHead className="p-3">Status</TableHead>
            <TableHead className="p-3 w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv: WorkspaceInvoice) => {
            const statusLabel = getInvoiceStatusLabel(
              inv.status,
              inv.due_date ?? null
            );
            const isPaid = inv.status === "paid";
            return (
              <TableRow key={inv.id}>
                <TableCell className="p-3">
                  {inv.number ?? inv.id.slice(-8)}
                </TableCell>
                <TableCell className="p-3">
                  {formatAmount(
                    (isPaid ? inv.amount_paid : inv.amount_due) ?? null,
                    inv.currency ?? null
                  )}
                </TableCell>
                <TableCell className="p-3">
                  <span
                    className={
                      statusLabel === "Overdue"
                        ? "text-destructive font-medium"
                        : statusLabel === "Paid"
                          ? "text-green-600"
                          : ""
                    }
                  >
                    {statusLabel === "draft" ? "Upcoming" : statusLabel}
                  </span>
                </TableCell>
                <TableCell className="p-3">
                  {inv.status === "draft" ? (
                    inv.due_date ? (
                      <span className="text-sm text-muted-foreground">
                        Upcoming: {formatDate(inv.due_date ?? null)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Upcoming
                      </span>
                    )
                  ) : isPaid ? (
                    (inv.invoice_pdf || inv.hosted_invoice_url) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={
                            inv.invoice_pdf ?? inv.hosted_invoice_url ?? "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download receipt
                        </a>
                      </Button>
                    )
                  ) : (
                    inv.hosted_invoice_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View invoice
                        </a>
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading settings...
        </div>
      </div>
    );
  }

  const services = workspace.services ?? [];
  const members = workspace.members ?? [];
  const workspaceUrl = workspace.url?.url ?? "—";

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          <hr className="border-border" />

          {/* Services Section - Read-only */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Services</h2>
            {services.length > 0 ? (
              <div className="rounded-md border border-border bg-card shadow-(--shadow) overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="p-3">Service</TableHead>
                      <TableHead className="p-3 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((s) => (
                      <TableRow key={s.service_id}>
                        <TableCell className="p-3">{s.service_name}</TableCell>
                        <TableCell className="p-3">
                          {s.service_image ? (
                            <img
                              src={s.service_image}
                              alt=""
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground py-4">
                No services. Contact support to attach services:{" "}
                <a
                  href="mailto:support@dendritecorp.com"
                  className="text-primary underline hover:no-underline"
                >
                  support@dendritecorp.com
                </a>
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* URL Section - Disabled with tooltip */}
          <section>
            <h2 className="text-xl font-semibold mb-4">URL</h2>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Input
                  value={workspaceUrl}
                  disabled
                  className="max-w-md"
                  readOnly
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    To change the URL, contact support:{" "}
                    <a
                      href="mailto:support@dendritecorp.com"
                      className="underline"
                    >
                      support@dendritecorp.com
                    </a>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </section>

          <hr className="border-border" />

          {/* Members Section */}
          <section>
            <h2 className="text-xl font-semibold mb-2">Members</h2>
            <p className="text-sm text-muted-foreground mb-4">
              To add members, contact support:{" "}
              <a
                href="mailto:support@dendritecorp.com"
                className="text-primary underline hover:no-underline"
              >
                support@dendritecorp.com
              </a>
            </p>
            {members.length > 0 ? (
              <div className="rounded-md border border-border bg-card shadow-(--shadow) overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="p-3">User</TableHead>
                      <TableHead className="p-3">Email</TableHead>
                      <TableHead className="p-3">Role</TableHead>
                      <TableHead className="p-3">Lead Notifications</TableHead>
                      <TableHead className="p-3 w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => {
                      const isSelf = m.user_id === currentUserId;
                      const canChangeRole = isAdmin && !isSelf;
                      const canDelete = isAdmin && !isSelf;
                      const displayName =
                        `${m.user_first_name} ${m.user_last_name}`.trim() ||
                        m.user_email;

                      return (
                        <TableRow key={m.user_id}>
                          <TableCell className="p-3">{displayName}</TableCell>
                          <TableCell className="p-3">{m.user_email}</TableCell>
                          <TableCell className="p-3">
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
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-3">
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
                          </TableCell>
                          <TableCell className="p-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMemberToRemove({
                                  userId: m.user_id,
                                  name: displayName,
                                })
                              }
                              disabled={!canDelete}
                              aria-label={`Remove ${displayName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground py-4">
                No members in this workspace.
              </p>
            )}
          </section>
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
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{memberToRemove?.name}" from this
              workspace?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
