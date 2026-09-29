/**
 * Shared motion values (REDESIGN_PLAN.md §0, apple-design §4).
 *
 * Critically damped by default: things arrive without overshoot. A little
 * bounce only after something the owner flicked or threw.
 */

/** Strong ease-out for anything entering or answering a tap. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** iOS-like sheet / drawer curve. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Default UI spring: no overshoot, settles in about a third of a second. */
export const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

/** After a flick or a throw only. */
export const SPRING_SOFT = { type: "spring", bounce: 0.12, duration: 0.4 } as const;
