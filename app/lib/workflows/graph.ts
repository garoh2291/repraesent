import type {
  ConditionGroup,
  NodeType,
  SendCustomerEmailConfig,
  SendInternalEmailConfig,
  TriggerConfig,
  WorkflowEntity,
  WorkflowGraph,
  WorkflowNode,
} from "~/lib/api/workflows";

/**
 * The bridge between the stored graph and the linear list the builder draws.
 *
 * The backend stores {nodes, edges} so branching can be added later without a
 * data migration. This UI only ever produces a straight chain, so all the
 * edge-handling lives here rather than being smeared through the components —
 * when the canvas arrives, this file is what it replaces.
 */

export function newNodeId(): string {
  return `n${Math.random().toString(36).slice(2, 10)}`;
}

/** Nodes in execution order, starting after the trigger. */
export function stepsOf(graph: WorkflowGraph): WorkflowNode[] {
  const trigger = triggerOf(graph);
  if (!trigger) return [];

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: WorkflowNode[] = [];
  const seen = new Set<string>([trigger.id]);

  let currentId = graph.edges.find((e) => e.from === trigger.id)?.to;
  while (currentId && !seen.has(currentId)) {
    const node = byId.get(currentId);
    if (!node) break;
    out.push(node);
    seen.add(currentId);
    currentId = graph.edges.find((e) => e.from === currentId)?.to;
  }
  return out;
}

export function triggerOf(graph: WorkflowGraph): WorkflowNode | null {
  return graph.nodes.find((n) => n.type === "trigger") ?? null;
}

/** Rebuild a graph from a trigger plus an ordered list of steps. */
export function buildGraph(
  trigger: WorkflowNode,
  steps: WorkflowNode[],
): WorkflowGraph {
  const nodes = [trigger, ...steps];
  const chain = [trigger, ...steps];
  const edges = chain
    .slice(0, -1)
    .map((node, i) => ({ from: node.id, to: chain[i + 1].id }));
  return { nodes, edges };
}

export function replaceStep(
  graph: WorkflowGraph,
  nodeId: string,
  config: WorkflowNode["config"],
): WorkflowGraph {
  const trigger = triggerOf(graph);
  if (!trigger) return graph;

  if (nodeId === trigger.id) {
    return buildGraph({ ...trigger, config }, stepsOf(graph));
  }
  return buildGraph(
    trigger,
    stepsOf(graph).map((s) => (s.id === nodeId ? { ...s, config } : s)),
  );
}

export function addStep(
  graph: WorkflowGraph,
  type: Exclude<NodeType, "trigger">,
  defaultLocale: string,
): { graph: WorkflowGraph; nodeId: string } {
  const trigger = triggerOf(graph) ?? defaultTrigger();
  const node: WorkflowNode = {
    id: newNodeId(),
    type,
    config: defaultConfigFor(type, defaultLocale),
  };
  return {
    graph: buildGraph(trigger, [...stepsOf(graph), node]),
    nodeId: node.id,
  };
}

export function removeStep(graph: WorkflowGraph, nodeId: string): WorkflowGraph {
  const trigger = triggerOf(graph);
  if (!trigger) return graph;
  return buildGraph(
    trigger,
    stepsOf(graph).filter((s) => s.id !== nodeId),
  );
}

export function moveStep(
  graph: WorkflowGraph,
  from: number,
  to: number,
): WorkflowGraph {
  const trigger = triggerOf(graph);
  if (!trigger) return graph;
  const steps = stepsOf(graph);
  if (from < 0 || to < 0 || from >= steps.length || to >= steps.length) return graph;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return buildGraph(trigger, next);
}

export function defaultTrigger(entity: WorkflowEntity = "leads"): WorkflowNode {
  return {
    id: newNodeId(),
    type: "trigger",
    config: { type: "record_created", entity } satisfies TriggerConfig,
  };
}

const EMPTY_GROUP: ConditionGroup = { match: "all", conditions: [] };

/**
 * Sensible starting config per node type.
 *
 * The email nodes get a real template in the workflow's own language rather
 * than blank fields, so a new step previews as something readable instead of
 * an empty message.
 */
export function defaultConfigFor(
  type: Exclude<NodeType, "trigger">,
  defaultLocale: string,
): WorkflowNode["config"] {
  switch (type) {
    case "condition":
      return { group: { ...EMPTY_GROUP } };
    case "delay":
      return { minutes: 60 * 24 };
    case "send_internal_email":
      return {
        recipients: [],
        by_locale: {
          [defaultLocale]: {
            subject: "Action needed",
            html: "<p>A record needs your attention.</p>",
          },
        },
      } satisfies SendInternalEmailConfig;
    case "send_customer_email":
      return {
        to_path: "{{trigger.record.email}}",
        email_account_id: null,
        by_locale: {
          [defaultLocale]: {
            subject: "Hello",
            html: "<p>Hello {{trigger.record.first_name}},</p>",
          },
        },
      } satisfies SendCustomerEmailConfig;
  }
}

/** Empty graph with a trigger already in place, so a new workflow is editable. */
export function starterGraph(entity: WorkflowEntity = "leads"): WorkflowGraph {
  return { nodes: [defaultTrigger(entity)], edges: [] };
}

/**
 * Why this workflow cannot be published yet.
 *
 * Mirrors the server's publish-time checks so the button explains itself
 * instead of relying on a 400 to tell the user what is missing.
 */
export function publishBlockers(
  graph: WorkflowGraph,
  t: (key: string, opts?: Record<string, unknown>) => string,
  /** Every node after the trigger, branches included. Injected to avoid a
   *  circular import between this module and `tree.ts`. */
  steps: WorkflowNode[] = stepsOf(graph),
): string[] {
  const problems: string[] = [];
  const trigger = triggerOf(graph);

  if (!trigger) problems.push(t("workflows.validation.noTrigger"));
  if (steps.length === 0) problems.push(t("workflows.validation.noSteps"));

  for (const step of steps) {
    if (step.type === "send_internal_email") {
      const cfg = step.config as SendInternalEmailConfig;
      if ((cfg.recipients ?? []).length === 0) {
        problems.push(t("workflows.validation.noRecipients"));
      }
      if (!hasAnyTemplate(cfg.by_locale)) {
        problems.push(t("workflows.validation.noTemplate"));
      }
    }
    if (step.type === "send_customer_email") {
      const cfg = step.config as SendCustomerEmailConfig;
      if (!cfg.to_path?.trim()) problems.push(t("workflows.validation.noToPath"));
      if (!hasAnyTemplate(cfg.by_locale)) {
        problems.push(t("workflows.validation.noTemplate"));
      }
    }
    if (step.type === "condition") {
      const cfg = step.config as { group: ConditionGroup };
      if ((cfg.group?.conditions ?? []).length === 0) {
        problems.push(t("workflows.validation.emptyCondition"));
      }
    }
  }

  return [...new Set(problems)];
}

/**
 * Filter conditions that can never be true, given the trigger.
 *
 * The trap this exists for: a trigger of "status changed to rejected" plus a
 * filter of "status is in_progress" reads like "was in progress, now rejected"
 * — but filters run against the record *after* the change, where status is
 * already `rejected`. The workflow then silently never fires, and nothing in
 * the run history explains why, because no run is ever created.
 *
 * Only provable contradictions are reported. Anything requiring a guess about
 * intent is left alone.
 */
export function filterWarnings(
  graph: WorkflowGraph,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string[] {
  const trigger = triggerOf(graph);
  const cfg = trigger?.config as TriggerConfig | undefined;
  if (cfg?.type !== "field_changed_to" || !cfg.path || cfg.value === undefined) {
    return [];
  }

  const target = String(cfg.value);
  const out: string[] = [];

  for (const condition of cfg.filter?.conditions ?? []) {
    if (condition.path !== cfg.path) continue;

    const values = (Array.isArray(condition.value) ? condition.value : [condition.value])
      .map((v) => String(v));

    const impossible =
      ((condition.operator === "eq" || condition.operator === "in") &&
        !values.includes(target)) ||
      ((condition.operator === "neq" || condition.operator === "not_in") &&
        values.includes(target));

    if (impossible) {
      out.push(
        t("workflows.validation.filterContradiction", {
          field: condition.path,
          value: values.join(", "),
          target,
        }),
      );
    }
  }

  return [...new Set(out)];
}

function hasAnyTemplate(byLocale: Record<string, { subject: string; html: string } | undefined>) {
  return Object.values(byLocale ?? {}).some((v) => v?.subject && v?.html);
}
