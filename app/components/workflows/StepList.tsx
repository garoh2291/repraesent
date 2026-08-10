import {
  ArrowDown,
  ArrowUp,
  AtSign,
  Clock,
  Filter,
  Mail,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { NodeType, WorkflowGraph, WorkflowNode } from "~/lib/api/workflows";
import { triggerOf } from "~/lib/workflows/graph";
import { toTree, type LaneRef, type TreeNode } from "~/lib/workflows/tree";

const ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  condition: Filter,
  delay: Clock,
  send_internal_email: Mail,
  send_customer_email: AtSign,
};

const ADDABLE: Exclude<NodeType, "trigger">[] = [
  "condition",
  "delay",
  "send_internal_email",
  "send_customer_email",
];

/**
 * The workflow as a vertical chain with Yes/No lanes.
 *
 * A condition splits into two indented lanes rather than opening a canvas:
 * the rail colour and the label carry the branch, so the whole shape stays
 * readable in a 380px column and works on a phone. The stored graph already
 * had `branch` on its edges, so nothing about the data changed to get here.
 *
 * Reorder is buttons, not drag: lanes are short, and buttons work with a
 * keyboard and on touch without any sensor wiring.
 */
export function StepList({
  graph,
  selectedId,
  disabled,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  graph: WorkflowGraph;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (nodeId: string) => void;
  onAdd: (type: Exclude<NodeType, "trigger">, lane: LaneRef) => void;
  onRemove: (nodeId: string) => void;
  onMove: (nodeId: string, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const trigger = triggerOf(graph);
  const tree = toTree(graph);

  return (
    <div className="space-y-2">
      {trigger ? (
        <StepCard
          node={trigger}
          label={t("workflows.step.trigger")}
          sublabel={t(
            `workflows.trigger.type_${(trigger.config as { type: string }).type}`,
          )}
          selected={selectedId === trigger.id}
          onSelect={() => onSelect(trigger.id)}
        />
      ) : null}

      <Lane
        lane={tree}
        laneRef={{ parentId: null, branch: "yes" }}
        selectedId={selectedId}
        disabled={disabled}
        onSelect={onSelect}
        onAdd={onAdd}
        onRemove={onRemove}
        onMove={onMove}
      />
    </div>
  );
}

function Lane({
  lane,
  laneRef,
  selectedId,
  disabled,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  lane: TreeNode[];
  laneRef: LaneRef;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (nodeId: string) => void;
  onAdd: (type: Exclude<NodeType, "trigger">, lane: LaneRef) => void;
  onRemove: (nodeId: string) => void;
  onMove: (nodeId: string, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {lane.map((entry, index) => (
        <div key={entry.node.id} className="space-y-2">
          <Connector />
          <StepCard
            node={entry.node}
            label={t(`workflows.node.${entry.node.type}`)}
            sublabel={describe(entry.node, t)}
            selected={selectedId === entry.node.id}
            onSelect={() => onSelect(entry.node.id)}
            actions={
              disabled ? null : (
                <>
                  <IconButton
                    label={t("workflows.step.moveUp")}
                    disabled={index === 0}
                    onClick={() => onMove(entry.node.id, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={t("workflows.step.moveDown")}
                    disabled={index === lane.length - 1}
                    onClick={() => onMove(entry.node.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={t("workflows.step.remove")}
                    destructive
                    onClick={() => onRemove(entry.node.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              )
            }
          />

          {entry.node.type === "condition" ? (
            <div className="space-y-3 pt-1">
              <BranchLane
                tone="yes"
                nodes={entry.yes}
                laneRef={{ parentId: entry.node.id, branch: "yes" }}
                selectedId={selectedId}
                disabled={disabled}
                onSelect={onSelect}
                onAdd={onAdd}
                onRemove={onRemove}
                onMove={onMove}
              />
              <BranchLane
                tone="no"
                nodes={entry.no}
                laneRef={{ parentId: entry.node.id, branch: "no" }}
                selectedId={selectedId}
                disabled={disabled}
                onSelect={onSelect}
                onAdd={onAdd}
                onRemove={onRemove}
                onMove={onMove}
              />
            </div>
          ) : null}
        </div>
      ))}

      {/* A condition owns everything after it, so the parent lane offers no
          "add" — otherwise there would be two plausible places for a step to
          land and no way to tell them apart. */}
      {!disabled && !lane.some((e) => e.node.type === "condition") ? (
        <>
          <Connector />
          <AddStepMenu onAdd={(type) => onAdd(type, laneRef)} />
        </>
      ) : null}
    </div>
  );
}

/** One side of a condition, with a coloured rail and a Yes/No cap. */
function BranchLane({
  tone,
  nodes,
  laneRef,
  selectedId,
  disabled,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  tone: "yes" | "no";
  nodes: TreeNode[];
  laneRef: LaneRef;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (nodeId: string) => void;
  onAdd: (type: Exclude<NodeType, "trigger">, lane: LaneRef) => void;
  onRemove: (nodeId: string) => void;
  onMove: (nodeId: string, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();

  const rail =
    tone === "yes"
      ? "border-emerald-400/50"
      : "border-muted-foreground/30";
  const chip =
    tone === "yes"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
      : "border-border bg-muted/60 text-muted-foreground";

  return (
    <div className={`border-l-2 ${rail} pl-3`}>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${chip}`}
      >
        {t(`workflows.branch.${tone}`)}
      </span>

      {nodes.length === 0 ? (
        disabled ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("workflows.branch.empty")}
          </p>
        ) : (
          <div className="mt-2">
            <AddStepMenu compact onAdd={(type) => onAdd(type, laneRef)} />
          </div>
        )
      ) : (
        <div className="mt-1">
          <Lane
            lane={nodes}
            laneRef={laneRef}
            selectedId={selectedId}
            disabled={disabled}
            onSelect={onSelect}
            onAdd={onAdd}
            onRemove={onRemove}
            onMove={onMove}
          />
        </div>
      )}
    </div>
  );
}

function AddStepMenu({
  compact,
  onAdd,
}: {
  compact?: boolean;
  onAdd: (type: Exclude<NodeType, "trigger">) => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            compact ? "py-2 text-xs" : "py-3 text-sm"
          }`}
        >
          <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {t("workflows.step.add")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        {ADDABLE.map((type) => {
          const Icon = ICONS[type];
          return (
            <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
              <Icon className="h-4 w-4" />
              {t(`workflows.node.${type}`)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Connector() {
  return <div aria-hidden className="mx-auto h-3 w-px bg-border" />;
}

function StepCard({
  node,
  label,
  sublabel,
  selected,
  onSelect,
  actions,
}: {
  node: WorkflowNode;
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  const Icon = ICONS[node.type];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        selected
          ? "border-foreground bg-muted/50 shadow-[0_0_0_1px_var(--color-foreground)]"
          : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {sublabel}
          </span>
        </span>
      </button>
      {actions ? (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  destructive,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-1.5 text-muted-foreground transition-colors disabled:opacity-30 ${
        destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/** One line summarising a step without opening it. */
function describe(
  node: WorkflowNode,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  switch (node.type) {
    case "condition": {
      const group = (node.config as { group?: { conditions?: unknown[] } }).group;
      return t("workflows.step.conditionCount", {
        count: group?.conditions?.length ?? 0,
      });
    }
    case "delay": {
      const minutes = Number((node.config as { minutes?: number }).minutes ?? 0);
      if (minutes % 1440 === 0)
        return t("workflows.step.delayDays", { count: minutes / 1440 });
      if (minutes % 60 === 0)
        return t("workflows.step.delayHours", { count: minutes / 60 });
      return t("workflows.step.delayMinutes", { count: minutes });
    }
    case "send_internal_email": {
      const n = (node.config as { recipients?: unknown[] }).recipients?.length ?? 0;
      return t("workflows.step.recipientCount", { count: n });
    }
    case "send_customer_email":
      return (node.config as { to_path?: string }).to_path ?? "";
    default:
      return "";
  }
}
