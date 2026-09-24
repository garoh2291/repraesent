import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarPlus, X } from "lucide-react";
import { getSalesConfig } from "~/lib/api/onboarding-v2";
import { useAuthContext } from "~/providers/auth-provider";

const HIDE_KEY = "intro-call-card-hidden";

function readHidden(workspaceId: string): boolean {
  try {
    return window.localStorage.getItem(`${HIDE_KEY}:${workspaceId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Dashboard nudge for customers who finished onboarding without booking their
 * intro call ("Maybe later" on the welcome screen). Shows only in the
 * workspace that was set up, only while booking is on and nothing is booked.
 * "Hide" is remembered per workspace in this browser.
 */
export function IntroCallCard() {
  const { t } = useTranslation();
  const { currentWorkspace, user } = useAuthContext();
  const isCustomer = user?.user_type === "user";
  const { data } = useQuery({
    queryKey: ["onboarding-v2", "sales-config", "home"],
    queryFn: getSalesConfig,
    enabled: isCustomer && !!currentWorkspace,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const [hidden, setHidden] = useState(() => (currentWorkspace ? readHidden(currentWorkspace.id) : false));

  if (!data || !currentWorkspace || hidden) return null;
  if (!data.enabled || !data.ready || data.booking || data.workspace_id !== currentWorkspace.id) return null;

  const host = data.hosts.map((h) => h.label).find(Boolean);
  const hide = () => {
    try {
      window.localStorage.setItem(`${HIDE_KEY}:${currentWorkspace.id}`, "1");
    } catch {
      /* private mode: hide for this visit only */
    }
    setHidden(true);
  };

  return (
    <section className="app-fade-up relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground" aria-hidden>
        <CalendarPlus className="size-5" />
      </span>
      <div className="min-w-0 flex-1 pr-6 sm:pr-0">
        <h2 className="text-sm font-semibold text-foreground">{t("onb.introCard.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {host ? t("onb.introCard.body", { name: host }) : t("onb.introCard.bodyNoName")}
        </p>
      </div>
      <Link
        to="/welcome"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        {t("onb.introCard.cta")}
      </Link>
      <button
        type="button"
        onClick={hide}
        aria-label={t("onb.introCard.hide")}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground sm:static"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}
