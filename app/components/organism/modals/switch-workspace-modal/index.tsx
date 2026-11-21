import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { WorkspaceList } from "~/components/notebook/workspace-list";

export default function SwitchWorkspaceModal({
  setIsOpen,
}: {
  setIsOpen?: (isOpen: boolean) => void;
}) {
  const { t } = useTranslation();
  const { workspaces, agencyChildren, currentWorkspace, setCurrentWorkspace } =
    useAuthContext();
  const navigate = useNavigate();

  const handleSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    setIsOpen?.(false);
    navigate("/", { replace: true });
  };

  return (
    <DialogContent className="flex w-[calc(100vw-2rem)] sm:w-[400px] max-h-[85vh] flex-col gap-0">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold text-foreground">
          {t("switchWorkspace.title")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t("switchWorkspace.description")}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 -mx-6 flex min-h-0 flex-col overflow-hidden border-y border-border">
        <WorkspaceList
          workspaces={workspaces}
          agencyChildren={agencyChildren}
          currentId={currentWorkspace?.id}
          onPick={handleSelect}
        />
      </div>
    </DialogContent>
  );
}
