import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";

/**
 * `?ws=<workspace id>` on a link from a phone alert (`/lead-form/:id?ws=…`,
 * `/tasks?task_id=…&ws=…`, `/?ws=…`): switch to that workspace when the person
 * is a member of it, then drop the parameter. Not a member → ignored.
 *
 * Returns true while the parameter is still in the URL. The layout holds the
 * page until then, so the page's own requests go out with the right
 * workspace and its own URL clean-ups (e.g. `task_id`) can't race this one.
 */
export function useWorkspaceFromParam(): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAuthContext();
  const params = new URLSearchParams(location.search);
  const ws = params.get("ws");

  useEffect(() => {
    if (!ws) return;
    if (workspaces.some((w) => w.id === ws) && currentWorkspace?.id !== ws) {
      setCurrentWorkspace(ws);
    }
    const next = new URLSearchParams(location.search);
    next.delete("ws");
    const search = next.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash },
      { replace: true, state: location.state },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, location.pathname, location.search]);

  return !!ws;
}
