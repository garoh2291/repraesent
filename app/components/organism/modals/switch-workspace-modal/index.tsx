import { useNavigate } from "react-router";
import { Building2, Check } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export default function SwitchWorkspaceModal({
  setIsOpen,
}: {
  setIsOpen?: (isOpen: boolean) => void;
}) {
  const { workspaces, currentWorkspace, setCurrentWorkspace } =
    useAuthContext();
  const navigate = useNavigate();

  const handleSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    setIsOpen?.(false);
    navigate("/", { replace: true });
  };

  return (
    <DialogContent className="flex w-[400px] flex-col gap-0">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold text-foreground">
          Switch workspace
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Choose a workspace to switch to.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-5 flex flex-col gap-1.5">
        {workspaces.map((ws) => {
          const isActive = ws.id === currentWorkspace?.id;
          return (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150",
                isActive
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border bg-transparent text-foreground hover:bg-muted/60 hover:border-border/80"
              )}
            >
              <div className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}>
                {ws.name?.[0]?.toUpperCase() ?? <Building2 className="h-3.5 w-3.5" />}
              </div>
              <span className="truncate flex-1 text-left">{ws.name}</span>
              {isActive && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          );
        })}
      </div>
    </DialogContent>
  );
}
