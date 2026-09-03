import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRight, KeyRound, TriangleAlert } from "lucide-react";
import { useWorkspaceAi } from "~/lib/hooks/useWorkspaceAi";
import { cn } from "~/lib/utils";

/**
 * Amber strip shown wherever an assistant can be worked on while the
 * workspace has no usable OpenRouter key. Silent while loading and when
 * connected — the common case must not flash.
 */
export function AiKeyBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { data, isPending } = useWorkspaceAi();
  if (isPending || !data) return null;

  const revoked = data.status === "revoked" || data.status === "error";
  if (data.connected && !revoked) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"
      >
        {revoked ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          {revoked
            ? t("aiAssistants.banner.revokedTitle")
            : t("aiAssistants.banner.title")}
        </p>
        <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80">
          {revoked
            ? t("aiAssistants.banner.revokedBody", {
                error: data.last_error ?? "",
              })
            : t("aiAssistants.banner.body")}
        </p>
      </div>
      <Link
        to="/settings/ai"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-sm font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
      >
        {t("aiAssistants.banner.cta")}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
