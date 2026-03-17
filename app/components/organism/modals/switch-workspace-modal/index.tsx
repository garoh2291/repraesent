import { useNavigate } from "react-router";
import { Building2 } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

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
    <DialogContent className="flex min-w-[400px] flex-col gap-0 font-sans">
      <DialogHeader>
        <DialogTitle className="text-[25px] font-bold leading-8 text-[#333]">
          Switch workspace
        </DialogTitle>
        <DialogDescription>
          Choose a workspace to switch to.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 flex flex-col gap-2">
        {workspaces.map((ws) => (
          <Button
            key={ws.id}
            variant={ws.id === currentWorkspace?.id ? "secondary" : "outline"}
            className="w-full justify-start gap-2"
            onClick={() => handleSelect(ws.id)}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{ws.name}</span>
          </Button>
        ))}
      </div>
    </DialogContent>
  );
}
