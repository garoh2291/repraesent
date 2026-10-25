import { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { CreateLeadDialog } from "~/components/organism/create-lead-dialog";
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import { TaskFormModal } from "~/components/organism/tasks/task-form-modal";
import { AppointmentDialog, type AppointmentPrefill } from "~/components/appointment-book/appointment-dialog";
import { AfterVisitContext, AfterVisitSheet, type AfterVisitApi } from "~/components/appointment-book/after-visit";
import { useDealFlow } from "~/components/notebook/deal-flow";
import type { Appointment } from "~/lib/api/appointment-book";

/**
 * "New inquiry / task / contact / deal / appointment" from anywhere (the ⌘K
 * palette, the Today screen, a deal page) opens the create dialog over the
 * page you're on, instead of sending you to the list page first. Same dialogs
 * as the list pages, mounted once here next to the LeadFlow / DealFlow
 * providers. The `?new=1` links on the list pages keep working for emails and
 * bookmarks.
 */

export type QuickCreateKind = "lead" | "task" | "contact" | "company" | "deal" | "appointment";

/** What the caller already knows. Today only the appointment dialog reads it. */
export interface QuickCreatePrefill {
  appointment?: AppointmentPrefill;
  task?: { leadId?: string; contactId?: string; dealId?: string };
  deal?: { contactId?: string | null; contactLabel?: string | null };
}

const COMPANY_START = { kind: "company" } as const;

interface QuickCreateApi {
  open: (kind: QuickCreateKind, prefill?: QuickCreatePrefill) => void;
}

const QuickCreateContext = createContext<QuickCreateApi | null>(null);

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<QuickCreateKind | null>(null);
  const [prefill, setPrefill] = useState<QuickCreatePrefill | undefined>(undefined);
  // A new key per opening: every dialog starts empty, even after a cancel.
  const [session, setSession] = useState(0);
  const [visit, setVisit] = useState<Appointment | null>(null);
  const dealFlow = useDealFlow();
  const api = useMemo<QuickCreateApi>(
    () => ({
      open: (k, p) => {
        setSession((n) => n + 1);
        setPrefill(p);
        setKind(k);
      },
    }),
    [],
  );
  const afterVisit = useMemo<AfterVisitApi>(
    () => ({
      open: (a) => {
        // A deal already has its own "what's next" — next task or close it.
        if (a.deal) dealFlow.whatsNext({ id: a.deal.id, title: a.deal.title }, "completed");
        else setVisit(a);
      },
    }),
    [dealFlow],
  );
  const close = (open: boolean) => {
    if (!open) setKind(null);
  };

  const fromVisit = (next: QuickCreateKind) => {
    const a = visit;
    setVisit(null);
    if (!a) return;
    const contact = a.contact
      ? { id: a.contact.id, label: a.contact.name ?? "", kind: "person" as const }
      : a.company
        ? { id: a.company.id, label: a.company.name ?? "", kind: "company" as const }
        : null;
    api.open(next, {
      appointment: {
        calendarId: a.calendar_id ?? undefined,
        contact,
        leadId: contact ? null : a.lead?.id ?? null,
        leadLabel: a.display_name,
        customerEmail: a.customer_email,
        customerPhone: a.customer_phone,
        customerName: !contact && !a.lead ? a.customer_name ?? a.display_name : null,
      },
      task: {
        contactId: a.contact?.id ?? a.company?.id,
        leadId: a.contact || a.company ? undefined : a.lead?.id,
      },
      deal: { contactId: a.contact?.id ?? a.company?.id ?? null, contactLabel: a.display_name },
    });
  };

  return (
    <QuickCreateContext.Provider value={api}>
      <AfterVisitContext.Provider value={afterVisit}>
        {children}
        {kind === "lead" ? <CreateLeadDialog key={`lead-${session}`} open onOpenChange={close} /> : null}
        {kind === "contact" ? <CreateContactDialog key={`contact-${session}`} open onOpenChange={close} /> : null}
        {kind === "company" ? (
          <CreateContactDialog key={`company-${session}`} open onOpenChange={close} start="manual" initialValues={COMPANY_START} />
        ) : null}
        {kind === "deal" ? <QuickDeal key={`deal-${session}`} onOpenChange={close} prefill={prefill?.deal} /> : null}
        {kind === "task" ? <QuickTask key={`task-${session}`} onOpenChange={close} prefill={prefill?.task} /> : null}
        {kind === "appointment" ? (
          <AppointmentDialog key={`appointment-${session}`} open onOpenChange={close} prefill={prefill?.appointment} />
        ) : null}
        {visit ? (
          <AfterVisitSheet
            key={`visit-${visit.id}`}
            appointment={visit}
            onOpenChange={(open) => !open && setVisit(null)}
            onBookAgain={() => fromVisit("appointment")}
            onTask={() => fromVisit("task")}
            onDeal={() => fromVisit("deal")}
          />
        ) : null}
      </AfterVisitContext.Provider>
    </QuickCreateContext.Provider>
  );
}

function QuickDeal({
  onOpenChange,
  prefill,
}: {
  onOpenChange: (open: boolean) => void;
  prefill?: QuickCreatePrefill["deal"];
}) {
  const canEdit = useCanEditLeads();
  // No pipeline preset: the dialog offers the picker when there are several.
  return (
    <CreateDealDialog
      open
      onOpenChange={onOpenChange}
      canCreate={canEdit}
      prefillContactId={prefill?.contactId ?? null}
      prefillContactLabel={prefill?.contactLabel ?? null}
    />
  );
}

function QuickTask({
  onOpenChange,
  prefill,
}: {
  onOpenChange: (open: boolean) => void;
  prefill?: QuickCreatePrefill["task"];
}) {
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
  return (
    <TaskFormModal
      open
      onOpenChange={onOpenChange}
      workspaceMembers={members}
      leadId={prefill?.leadId}
      contactId={prefill?.contactId}
      dealId={prefill?.dealId}
    />
  );
}

/** Opens a create dialog over the current page (no-op outside the dashboard). */
export function useQuickCreate(): QuickCreateApi {
  return useContext(QuickCreateContext) ?? { open: () => {} };
}
