import { LogOut, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { useModal } from "~/components/modal-provider";
import { Button } from "~/components/ui/button";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function StatusPageHeader() {
  const { t } = useTranslation();
  const { logout, isLoggingOut, workspaces } = useAuthContext();
  const { openModal } = useModal();
  const hasMultipleWorkspaces = (workspaces?.length ?? 0) > 1;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-6">
      <img
        src={logoUrl}
        alt={t("statusPage.logoAlt")}
        className="h-7 w-auto max-w-[130px]"
      />
      <div className="flex items-center gap-1.5">
        {hasMultipleWorkspaces && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => openModal({ modalName: "SwitchWorkspaceModal" })}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {t("statusPage.switchWorkspace")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => logout()}
          disabled={isLoggingOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {isLoggingOut ? t("statusPage.signingOut") : t("statusPage.signOut")}
        </Button>
      </div>
    </header>
  );
}
