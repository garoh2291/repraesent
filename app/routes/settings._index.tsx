import { useState } from "react";
import { Navigate } from "react-router";
import { PHONE_QUERY } from "~/lib/hooks/use-is-phone";
import { SettingsGroups } from "~/components/notebook/settings-groups";

/**
 * /settings. Desktop: straight to your profile (the sidebar lists the rest).
 * Phones: the whole settings list, grouped like iPhone Settings, so nobody
 * lands on "Your profile" without knowing there's more (REDESIGN_PLAN.md §2).
 *
 * Settings pages only render in the browser (after sign-in), so reading the
 * media query on the first render can't cause a hydration mismatch.
 */
export default function SettingsIndex() {
  const [phone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches,
  );
  if (!phone) return <Navigate to="/settings/profile" replace />;
  return <SettingsGroups />;
}
