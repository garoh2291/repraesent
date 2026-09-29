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

  // Stacked on every width: it lives in Today's narrow right column, where a
  // side-by-side layout overflowed and added a second (horizontal) scrollbar.
  // Dark ink so it reads as the one personal invitation on the screen.
  return (
    <section className="relative overflow-hidden rounded-xl bg-[#141516] p-5 text-white shadow-sm">
      <span
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-marker/15"
        aria-hidden
      />
      <button
        type="button"
        onClick={hide}
        aria-label={t("onb.introCard.hide")}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" />
      </button>
      <span
        className="relative flex size-10 items-center justify-center rounded-lg bg-marker text-[#141516]"
        aria-hidden
      >
        <CalendarPlus className="size-5" />
      </span>
      <h2 className="relative mt-4 pr-6 text-[16px] font-semibold leading-snug">
        {t("onb.introCard.title")}
      </h2>
      <p className="relative mt-1.5 text-[13.5px] leading-relaxed text-white/65">
        {host ? t("onb.introCard.body", { name: host }) : t("onb.introCard.bodyNoName")}
      </p>
      <Link
        to="/welcome"
        className="press relative mt-4 flex h-10 w-full items-center justify-center rounded-lg bg-marker px-4 text-[14px] font-semibold text-[#141516] transition-opacity hover:opacity-90"
      >
        {t("onb.introCard.cta")}
      </Link>
    </section>
  );
}
