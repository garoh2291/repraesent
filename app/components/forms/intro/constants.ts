/**
 * The demo's fixed identity.
 *
 * The origin is hard-coded rather than read from `VITE_PUBLIC_BOOKING_BASE_URL`
 * on purpose: the walkthrough should show the product's real address whatever
 * environment it happens to be running in. Otherwise everyone watching it on a
 * dev machine is taught that their forms live at `http://localhost:5173`.
 */
export const DEMO_ORIGIN = "https://my.repraesent.com";

/** Stable, so the seeded snippet cache keys never move between renders. */
export const DEMO_ID = "demo-form-0000";

export const DEMO_PUBLIC_URL = `${DEMO_ORIGIN}/f/${DEMO_ID}`;
