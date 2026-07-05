import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, StickyNote, CheckSquare } from "lucide-react";
import type { LeadHistoryItem } from "~/lib/api/leads";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import { LeadHistorySection } from "~/components/organism/lead-detail-sheet";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { ActivityTimeline } from "./activity-timeline";
import { ActivityEmailsList } from "./emails-list";
import type { ActivityContext } from "./shared";

export interface ActivityPanelProps extends ActivityContext {
  variant: "contact" | "deal";
  canEdit: boolean;
  workspaceMembers: WorkspaceMemberItem[];
  contextLabel?: string;
  history: LeadHistoryItem[];
  historyLoading: boolean;
}

type Tab = "all" | "notes" | "tasks" | "emails" | "history";

export function ActivityPanel(props: ActivityPanelProps) {
  const {
    variant,
    canEdit,
    workspaceMembers,
    contextLabel,
    history,
    historyLoading,
    leadId,
    contactId,
    dealId,
    linkedContactId,
    historyContactId,
    emailContactId,
  } = props;
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("all");
  const [notesSignal, setNotesSignal] = useState(0);
  const [tasksSignal, setTasksSignal] = useState(0);

  const ctx: ActivityContext = useMemo(
    () => ({
      leadId,
      contactId,
      dealId,
      linkedContactId,
      historyContactId,
      emailContactId,
    }),
    [
      leadId,
      contactId,
      dealId,
      linkedContactId,
      historyContactId,
      emailContactId,
    ],
  );

  const addNote = () => {
    setTab("notes");
    setNotesSignal((n) => n + 1);
  };
  const addTask = () => {
    setTab("tasks");
    setTasksSignal((n) => n + 1);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("activity.tabAll", { defaultValue: "All" }) },
    { key: "notes", label: t("activity.tabNotes", { defaultValue: "Notes" }) },
    { key: "tasks", label: t("activity.tabTasks", { defaultValue: "Tasks" }) },
    {
      key: "emails",
      label: t("activity.tabEmails", { defaultValue: "Emails" }),
    },
    {
      key: "history",
      label: t("activity.tabHistory", { defaultValue: "History" }),
    },
  ];

  return (
    <section
      className={cn(
        "app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6",
        variant === "deal" && "shadow-(--shadow)",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("activity.title", { defaultValue: "Activity" })}
        </h2>
        {canEdit && (
          <AddControl tab={tab} onAddNote={addNote} onAddTask={addTask} />
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="w-full"
      >
        <TabsList variant="line" className="mb-4 w-full sm:mb-5">
          {tabs.map((tb) => (
            <TabsTrigger key={tb.key} value={tb.key} className="text-xs">
              {tb.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <ActivityTimeline
            ctx={ctx}
            variant={variant}
            canEdit={canEdit}
            workspaceMembers={workspaceMembers}
            history={history}
            historyLoading={historyLoading}
          />
        </TabsContent>

        {/* forceMount keeps these mounted so the header "Add" signals reach them */}
        <TabsContent
          value="notes"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <LeadNotesSection
            leadId={leadId}
            dealId={dealId}
            contactId={contactId}
            linkedContactId={linkedContactId}
            canEdit={canEdit}
            hideAddButton
            openAddSignal={notesSignal}
          />
        </TabsContent>

        <TabsContent
          value="tasks"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <LeadTasksSection
            leadId={leadId}
            contactId={contactId}
            dealId={dealId}
            linkedContextLabel={contextLabel}
            historyContactId={historyContactId}
            canEdit={canEdit}
            workspaceMembers={workspaceMembers}
            hideAddButton
            openAddSignal={tasksSignal}
          />
        </TabsContent>

        <TabsContent value="emails" className="mt-0">
          <ActivityEmailsList ctx={ctx} variant={variant} />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <LeadHistorySection
            history={history}
            isLoading={historyLoading}
            withoutLink
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** "+ Add ▾" dropdown on All; single button on Notes/Tasks; nothing elsewhere. */
function AddControl({
  tab,
  onAddNote,
  onAddTask,
}: {
  tab: Tab;
  onAddNote: () => void;
  onAddTask: () => void;
}) {
  const { t } = useTranslation();

  if (tab === "notes") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={onAddNote}
      >
        <StickyNote className="size-3.5" />
        {t("activity.addNote", { defaultValue: "Add note" })}
      </Button>
    );
  }
  if (tab === "tasks") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={onAddTask}
      >
        <CheckSquare className="size-3.5" />
        {t("activity.addTask", { defaultValue: "Add task" })}
      </Button>
    );
  }
  if (tab === "all") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            {t("activity.add", { defaultValue: "Add" })}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onAddNote}>
            <StickyNote className="size-3.5" />
            {t("activity.addNote", { defaultValue: "Add note" })}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddTask}>
            <CheckSquare className="size-3.5" />
            {t("activity.addTask", { defaultValue: "Add task" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return null;
}
