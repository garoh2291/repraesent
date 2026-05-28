import {
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

/**
 * Collision strategy tuned for multi-column kanban boards.
 *
 * dnd-kit's default `closestCorners` measures the dragged rect's corners
 * against every droppable corner. Column droppables are huge, so their
 * nearest corner is often far from the cursor — the dragged card "loses" to
 * nearby cards in its source column even when the pointer is clearly over
 * the target column, which is why column changes can take several tries.
 *
 * Priority: whatever the pointer is over (most specific droppable wins),
 * else any rect we intersect, else fall back to closest corners.
 */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  const intersections = rectIntersection(args);
  if (intersections.length > 0) return intersections;
  return closestCorners(args);
};

/**
 * Compute a new `board_position` value for a kanban card given its target
 * neighbors. Positions are stored as doubles spaced ~STEP apart; clients pick
 * the midpoint between the two neighbors of the drop target so a full
 * renumbering is rarely needed.
 *
 * Rows that were inserted after the original backfill migration carry a
 * `board_position = null`. The backend reorder endpoint runs the same
 * per-column backfill on every call (assigning `MAX(real) + n*STEP` to nulls
 * in visual order), so the client must synthesize matching positions while
 * computing the drop — otherwise a drop between two null neighbors would
 * collapse to a constant value and land wherever the tiebreaker decides.
 */
const STEP = 1000;

function positionOrNull(p: number | null | undefined): number | null {
  return p == null || !Number.isFinite(p) ? null : Number(p);
}

export function computeBoardPosition(opts: {
  before: number | null | undefined;
  after: number | null | undefined;
}): number {
  const before = positionOrNull(opts.before);
  const after = positionOrNull(opts.after);
  if (before != null && after != null) return (before + after) / 2;
  if (before != null) return before + STEP;
  if (after != null) return after - STEP;
  return STEP;
}

/**
 * Helper for dnd-kit drops: given the ordered column items (in their visual
 * order, the same order the backend backfill would produce) and the
 * destination index where the moved card will land, returns the position for
 * the card. The moved card is excluded from neighbor lookups so in-column
 * reorders compute their midpoint against the *post-move* neighbors.
 */
export function positionForInsertion<
  T extends { id: string; board_position: number | null },
>(columnItems: T[], insertionIndex: number, movedId: string): number {
  const filtered = columnItems.filter((x) => x.id !== movedId);

  // Mirror the backend backfill: real positions stay; nulls get
  // `MAX(real) + n*STEP` in their current visual order, with n starting at 1
  // and incrementing per null encountered.
  let maxReal = 0;
  for (const item of filtered) {
    const p = positionOrNull(item.board_position);
    if (p != null && p > maxReal) maxReal = p;
  }
  let nullsSeen = 0;
  const synthesized: number[] = filtered.map((item) => {
    const p = positionOrNull(item.board_position);
    if (p != null) return p;
    nullsSeen += 1;
    return maxReal + nullsSeen * STEP;
  });

  const clamped = Math.max(0, Math.min(insertionIndex, synthesized.length));
  const before = clamped > 0 ? synthesized[clamped - 1] : null;
  const after = clamped < synthesized.length ? synthesized[clamped] : null;
  return computeBoardPosition({ before, after });
}
