import { useNavigate } from "react-router";
import { Building } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAuthContext } from "~/providers/auth-provider";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Choose workspace - Repraesent" },
    { name: "description", content: "Select a workspace to continue" },
  ];
}

export default function WorkspacePicker() {
  const { workspaces, setCurrentWorkspace } = useAuthContext();
  const navigate = useNavigate();

  const handleSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    if (workspaces.length > 1) {
      setStoredWorkspaceId(workspaceId);
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <img
            src={logoUrl}
            alt="Repraesent"
            className="mx-auto h-10 w-auto"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Choose workspace
            </h1>
            <p className="text-muted-foreground">
              You have access to multiple workspaces. Select one to continue.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.map((workspace) => (
            <Button
              key={workspace.id}
              type="button"
              variant="outline"
              onClick={() => handleSelect(workspace.id)}
              className="h-auto flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors text-left w-full"
            >
              <Building className="h-12 w-12 text-muted-foreground" />
              <span className="font-medium">{workspace.name}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
