import { Navigate } from "react-router";

/**
 * The old onboarding pages (/onboarding/workspace, /billing, /products,
 * /offers) were replaced by the wizard at /onboarding/start. Old bookmarks,
 * emails and the DoorBoost "start fresh" button still point here.
 */
export default function OnboardingLegacyRedirect() {
  return <Navigate to="/onboarding/start" replace />;
}
