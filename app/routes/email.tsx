import { Navigate, useSearchParams } from "react-router";
import { emailSetupPath } from "~/lib/api/email-accounts";

/**
 * Old address of "Set up in your email app". It moved into Settings → Email
 * accounts (one setup page per mailbox); bookmarks and old links land there,
 * keeping `?account=` when they carried one.
 */
export default function EmailRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={emailSetupPath(params.get("account"))} replace />;
}
