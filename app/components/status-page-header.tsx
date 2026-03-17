import { LogOut, ArrowLeftRight } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useModal } from "~/components/modal-provider";
import { Button } from "~/components/ui/button";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function StatusPageHeader() {
  const { logout, isLoggingOut, workspaces } = useAuthContext();
  const { openModal } = useModal();
  const hasMultipleWorkspaces = (workspaces?.length ?? 0) > 1;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <img
        src={logoUrl}
        alt="Repraesent"
        className="h-8 w-auto max-w-[140px]"
      />
      <div className="flex items-center gap-2">
        {hasMultipleWorkspaces && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => openModal({ modalName: "SwitchWorkspaceModal" })}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch workspace
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => logout()}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </header>
  );
}
