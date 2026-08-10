import type {
  NodeType,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "~/lib/api/workflows";
import { defaultConfigFor, defaultTrigger, newNodeId, triggerOf } from "./graph";

/**
 * The graph as a tree, which is the shape branch editing actually needs.
 *
 * Stored form is {nodes, edges} because that is what the engine walks and what
 * a future canvas will want. But "insert a step into the No lane" is miserable
 * to express against a flat edge list and trivial against a tree, so every
 * editing operation converts, mutates, and converts back. The round trip is
 * lossless for anything this UI can draw.
 *
 * The one structural rule: a condition ends its lane. Whatever follows lives in
 * its Yes or No branch. That is what makes the tree unambiguous — without it,
 * "the step after the condition" could mean three different things.
 */
export interface TreeNode {
  node: WorkflowNode;
  yes: TreeNode[];
  no: TreeNode[];
}

function edgeFrom(
  edges: WorkflowEdge[],
  from: string,
  branch?: "true" | "false",
): WorkflowEdge | undefined {
  if (branch) {
    return (
      edges.find((e) => e.from === from && e.branch === branch) ??
      // The linear editor wrote untagged edges; treat those as the Yes lane so
      // workflows built before branching existed still render.
      (branch === "true"
        ? edges.find((e) => e.from === from && !e.branch)
        : undefined)
    );
  }
  return edges.find((e) => e.from === from && !e.branch);
}

function chainFrom(
  graph: WorkflowGraph,
  startId: string | undefined,
  seen: Set<string>,
): TreeNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: TreeNode[] = [];

  let id = startId;
  // `seen` guards against a hand-crafted cycle turning this into a hang.
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = byId.get(id);
    if (!node) break;

    if (node.type === "condition") {
      out.push({
        node,
        yes: chainFrom(graph, edgeFrom(graph.edges, id, "true")?.to, seen),
        no: chainFrom(graph, edgeFrom(graph.edges, id, "false")?.to, seen),
      });
      break;
    }

    out.push({ node, yes: [], no: [] });
    id = edgeFrom(graph.edges, id)?.to;
  }

  return out;
}

/** Everything after the trigger, as a tree. */
export function toTree(graph: WorkflowGraph): TreeNode[] {
  const trigger = triggerOf(graph);
  if (!trigger) return [];
  return chainFrom(graph, edgeFrom(graph.edges, trigger.id)?.to, new Set());
}

export function fromTree(trigger: WorkflowNode, tree: TreeNode[]): WorkflowGraph {
  const nodes: WorkflowNode[] = [trigger];
  const edges: WorkflowEdge[] = [];

  const walk = (
    lane: TreeNode[],
    parentId: string,
    branch: "true" | "false" | undefined,
  ) => {
    let prevId = parentId;
    let prevBranch = branch;

    for (const entry of lane) {
      nodes.push(entry.node);
      edges.push({
        from: prevId,
        to: entry.node.id,
        ...(prevBranch ? { branch: prevBranch } : {}),
      });

      if (entry.node.type === "condition") {
        walk(entry.yes, entry.node.id, "true");
        walk(entry.no, entry.node.id, "false");
        return; // a condition ends the lane
      }

      prevId = entry.node.id;
      prevBranch = undefined;
    }
  };

  walk(tree, trigger.id, undefined);
  return { nodes, edges };
}

/** Where a lane lives: the condition that owns it, or the root. */
export type LaneRef = { parentId: string | null; branch: "yes" | "no" };

function laneAt(tree: TreeNode[], ref: LaneRef): TreeNode[] | null {
  if (ref.parentId === null) return tree;

  const find = (lane: TreeNode[]): TreeNode[] | null => {
    for (const entry of lane) {
      if (entry.node.id === ref.parentId) {
        return ref.branch === "yes" ? entry.yes : entry.no;
      }
      const hit = find(entry.yes) ?? find(entry.no);
      if (hit) return hit;
    }
    return null;
  };

  return find(tree);
}

function clone(tree: TreeNode[]): TreeNode[] {
  return tree.map((t) => ({ ...t, yes: clone(t.yes), no: clone(t.no) }));
}

function edit(
  graph: WorkflowGraph,
  mutate: (tree: TreeNode[]) => void,
): WorkflowGraph {
  const trigger = triggerOf(graph) ?? defaultTrigger();
  const tree = clone(toTree(graph));
  mutate(tree);
  return fromTree(trigger, tree);
}

export function addToLane(
  graph: WorkflowGraph,
  ref: LaneRef,
  type: Exclude<NodeType, "trigger">,
  defaultLocale: string,
): { graph: WorkflowGraph; nodeId: string } {
  const node: WorkflowNode = {
    id: newNodeId(),
    type,
    config: defaultConfigFor(type, defaultLocale),
  };

  const next = edit(graph, (tree) => {
    const lane = laneAt(tree, ref);
    (lane ?? tree).push({ node, yes: [], no: [] });
  });

  return { graph: next, nodeId: node.id };
}

/**
 * Remove a node.
 *
 * Deleting a condition keeps its Yes lane in place rather than discarding both
 * branches — losing several configured steps to one click is the kind of thing
 * people do not forgive. The No lane goes, which is stated in the UI.
 */
export function removeNode(graph: WorkflowGraph, nodeId: string): WorkflowGraph {
  return edit(graph, (tree) => {
    const strip = (lane: TreeNode[]): TreeNode[] => {
      const out: TreeNode[] = [];
      for (const entry of lane) {
        if (entry.node.id === nodeId) {
          out.push(...strip(entry.yes));
          continue;
        }
        out.push({ ...entry, yes: strip(entry.yes), no: strip(entry.no) });
      }
      return out;
    };
    const next = strip(tree);
    tree.length = 0;
    tree.push(...next);
  });
}

/** Move a node up or down within its own lane. */
export function moveNode(
  graph: WorkflowGraph,
  nodeId: string,
  direction: -1 | 1,
): WorkflowGraph {
  return edit(graph, (tree) => {
    const shift = (lane: TreeNode[]): boolean => {
      const index = lane.findIndex((e) => e.node.id === nodeId);
      if (index !== -1) {
        const target = index + direction;
        if (target < 0 || target >= lane.length) return true;
        const [moved] = lane.splice(index, 1);
        lane.splice(target, 0, moved);
        return true;
      }
      return lane.some((e) => shift(e.yes) || shift(e.no));
    };
    shift(tree);
  });
}

export function replaceConfig(
  graph: WorkflowGraph,
  nodeId: string,
  config: WorkflowNode["config"],
): WorkflowGraph {
  const trigger = triggerOf(graph);
  if (trigger && trigger.id === nodeId) {
    return fromTree({ ...trigger, config }, toTree(graph));
  }

  return edit(graph, (tree) => {
    const apply = (lane: TreeNode[]) => {
      for (const entry of lane) {
        if (entry.node.id === nodeId) entry.node = { ...entry.node, config };
        apply(entry.yes);
        apply(entry.no);
      }
    };
    apply(tree);
  });
}

/** Flat list of every node after the trigger — for validation and analytics. */
export function allSteps(graph: WorkflowGraph): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  const walk = (lane: TreeNode[]) => {
    for (const entry of lane) {
      out.push(entry.node);
      walk(entry.yes);
      walk(entry.no);
    }
  };
  walk(toTree(graph));
  return out;
}
