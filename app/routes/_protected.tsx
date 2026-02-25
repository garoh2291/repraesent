import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { clearStoredAuth } from "~/lib/hooks/use-auth";

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, user, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, {
        replace: true,
      });
      return;
    }

    if (user?.user_type !== "user") {
      clearStoredAuth();
      navigate("/login", { replace: true });
      return;
    }

    if (!workspaces?.length) {
      clearStoredAuth();
      navigate("/login", { replace: true });
      return;
    }

    const isOnWorkspacePicker = location.pathname === "/auth/workspace-picker";
    if (
      workspaces.length > 1 &&
      !getStoredWorkspaceId() &&
      !isOnWorkspacePicker
    ) {
      navigate("/auth/workspace-picker", { replace: true });
      return;
    }
  }, [isAuthenticated, isLoading, user, workspaces, navigate, location]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.user_type !== "user" || !workspaces?.length) {
    return null;
  }

  const isOnWorkspacePicker = location.pathname === "/auth/workspace-picker";
  if (
    workspaces.length > 1 &&
    !getStoredWorkspaceId() &&
    !isOnWorkspacePicker
  ) {
    return null;
  }

  return <Outlet />;
}
