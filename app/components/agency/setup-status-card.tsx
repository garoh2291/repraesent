import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Hammer } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { businessKeys, getSetupStatus } from "~/lib/api/agencies";

/**
 * Today, in a business an agency created: what re:praesent is still setting
 * up (AGENCY_MODE_PLAN.md §3). "Your website is being built" until a super
 * admin links the site; disappears when nothing is open. Shown to the
 * business's own team and to agency people alike. Renders nothing for
 * businesses without set-up items (every standard workspace).
 */
export function SetupStatusCard() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  // Only businesses under an agency can have set-up items.
  const relevant = !!currentWorkspace && (!!currentWorkspace.managed_by || !!currentWorkspace.via_agency_id);
  const q = useQuery({
    queryKey: businessKeys.setup(currentWorkspace?.id),
    queryFn: getSetupStatus,
    enabled: relevant,
    staleTime: 5 * 60_000,
  });
  const open = (q.data?.items ?? []).filter((i) => i.status === "requested" || i.status === "in_progress");
  if (!relevant || open.length === 0) return null;
  const site = open.find((i) => i.kind === "website");
  const others = open.filter((i) => i.kind !== "website");

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5" aria-live="polite">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground" aria-hidden>
        <Hammer className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-foreground">
          {site ? t("agency.setup.websiteTitle") : t("agency.setup.title")}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {site
            ? site.requested_url
              ? t("agency.setup.websiteBodyUrl", { url: site.requested_url.replace(/^https?:\/\//, "") })
              : t("agency.setup.websiteBodyNew")
            : t("agency.setup.body")}
        </p>
        {others.length ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("agency.setup.alsoSettingUp", { items: others.map((i) => t(`agency.businesses.kinds.${i.kind}`)).join(", ") })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
