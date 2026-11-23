import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";

/**
 * A thin ink strip while an agency person works inside one of the agency's
 * businesses: whose data this is, and the way back. Not shown to the
 * business's own team (AGENCY_MODE_PLAN.md, switching).
 */
export function ViaAgencyBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useAuthContext();
  const agencyId = currentWorkspace?.via_agency_id;
  if (!currentWorkspace || !agencyId) return null;
  const agencyName =
    currentWorkspace.via_agency_name ?? workspaces.find((w) => w.id === agencyId)?.name ?? "";
  const canGoBack = workspaces.some((w) => w.id === agencyId);

  return (
    <div
      role="status"
      className="flex min-h-10 items-center gap-3 bg-foreground px-4 py-2 text-[13px] text-background sm:px-5"
    >
      <p className="min-w-0 flex-1 truncate">
        {t("agency.banner.youAreIn", { business: currentWorkspace.name, agency: agencyName })}
      </p>
      {canGoBack ? (
        <button
          type="button"
          onClick={() => {
            setCurrentWorkspace(agencyId);
            navigate("/businesses", { replace: true });
          }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t("agency.banner.back", { agency: agencyName })}</span>
          <span className="sm:hidden">{t("agency.banner.backShort")}</span>
        </button>
      ) : null}
    </div>
  );
}
