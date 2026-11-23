import { Navigate } from "react-router";

/** Old address of the confirmation emails; they live in Settings now. */
export default function EmailConfirmationRedirect() {
  return <Navigate to="/settings/confirmation-emails" replace />;
}
