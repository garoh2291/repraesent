import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  verifyMagicLink,
  getUserContext,
  type UserContextResponse,
} from "~/lib/api/auth";
import {
  setStoredToken,
  clearStoredToken,
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
} from "~/lib/api/axios-instance";

export function meta() {
  return [
    { title: "Signing in - Repraesent" },
    { name: "description", content: "Completing sign in" },
  ];
}

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/login?error=missing_token", { replace: true });
      return;
    }

    const run = async () => {
      try {
        const auth = await verifyMagicLink(token);
        setStoredToken(auth.access_token);
        queryClient.invalidateQueries({ queryKey: ["auth"] });

        const context: UserContextResponse = await getUserContext();

        if (!context.workspaces?.length) {
          clearStoredToken();
          clearStoredWorkspaceId();
          navigate("/login?error=no_workspace", { replace: true });
          return;
        }

        if (context.workspaces.length === 1) {
          navigate("/", { replace: true });
          return;
        }

        if (context.workspaces.length > 1) {
          const stored = getStoredWorkspaceId();
          const hasValidStored = stored && context.workspaces.some((w) => w.id === stored);
          if (hasValidStored) {
            navigate("/", { replace: true });
            return;
          }
          navigate("/auth/workspace-picker", { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch {
        setStatus("error");
        clearStoredToken();
        clearStoredWorkspaceId();
      }
    };

    run();
  }, [searchParams, navigate, queryClient]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Invalid or expired link</h1>
          <p className="text-muted-foreground">
            This magic link is invalid or has expired. Please request a new one.
          </p>
          <a href="/login" className="text-primary underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
