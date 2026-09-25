import { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { CreateLeadDialog } from "~/components/organism/create-lead-dialog";
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import { TaskFormModal } from "~/components/organism/tasks/task-form-modal";

/**
 * "New inquiry / task / contact / deal" from anywhere (the ⌘K palette, the
 * Today screen) opens the create dialog over the page you're on, instead of
 * sending you to the list page first. Same dialogs as the list pages, mounted
 * once here next to the LeadFlow / DealFlow providers. The `?new=1` links on
 * the list pages keep working for emails and bookmarks.
 */

export type QuickCreateKind = "lead" | "task" | "contact" | "deal";

interface QuickCreateApi {
  open: (kind: QuickCreateKind) => void;
}

const QuickCreateContext = createContext<QuickCreateApi | null>(null);

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<QuickCreateKind | null>(null);
  // A new key per opening: every dialog starts empty, even after a cancel.
  const [session, setSession] = useState(0);
  const api = useMemo<QuickCreateApi>(
    () => ({
      open: (k) => {
        setSession((n) => n + 1);
        setKind(k);
      },
    }),
    [],
  );
  const close = (open: boolean) => {
    if (!open) setKind(null);
  };

  return (
    <QuickCreateContext.Provider value={api}>
      {children}
      {kind === "lead" ? <CreateLeadDialog key={`lead-${session}`} open onOpenChange={close} /> : null}
      {kind === "contact" ? <CreateContactDialog key={`contact-${session}`} open onOpenChange={close} /> : null}
      {kind === "deal" ? <QuickDeal key={`deal-${session}`} onOpenChange={close} /> : null}
      {kind === "task" ? <QuickTask key={`task-${session}`} onOpenChange={close} /> : null}
    </QuickCreateContext.Provider>
  );
}

function QuickDeal({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const canEdit = useCanEditLeads();
  // No pipeline preset: the dialog offers the picker when there are several.
  return <CreateDealDialog open onOpenChange={onOpenChange} canCreate={canEdit} />;
}

function QuickTask({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { currentWorkspace } = useAuthContext();
  // Same query (and cache) as the tasks page, so assignees are usually instant.
  const workspace = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });
  const members = (workspace.data?.members ?? []).map((m) => ({
    user_id: m.user_id,
    user_first_name: m.user_first_name,
    user_last_name: m.user_last_name,
    user_email: m.user_email,
    role: m.role,
  }));
  return <TaskFormModal open onOpenChange={onOpenChange} workspaceMembers={members} />;
}

/** Opens a create dialog over the current page (no-op outside the dashboard). */
export function useQuickCreate(): QuickCreateApi {
  return useContext(QuickCreateContext) ?? { open: () => {} };
}
