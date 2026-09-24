import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarCheck2, Mail, Video } from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { OnbLanguageSwitcher, OnboardingStyles } from "~/components/onboarding-v2/shell";
import { BookingPanel, type BookedCall } from "~/components/onboarding-v2/booking";
import { dismissWelcome, getSalesConfig } from "~/lib/api/onboarding-v2";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

/** A single, short burst of brand-coloured shapes — once, never on repeat. */
function Celebration() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2 + Math.random() * 0.4,
        dist: 90 + Math.random() * 70,
        color: ["#5265f3", "#f5d74f", "#a4dab8"][i % 3],
        size: 6 + Math.random() * 6,
        round: i % 2 === 0,
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-10 h-0 w-0">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ width: p.size, height: p.size, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ opacity: 0, transform: "translate(0px, 0px) scale(0.6) rotate(0deg)" }}
          animate={{
            opacity: [0, 1, 1, 0],
            transform: `translate(${Math.cos(p.angle) * p.dist}px, ${Math.sin(p.angle) * p.dist}px) scale(1) rotate(${Math.random() * 180}deg)`,
          }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], times: [0, 0.15, 0.7, 1] }}
        />
      ))}
    </div>
  );
}

export default function WelcomeRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { user, currentWorkspace } = useAuthContext();
  const [booked, setBooked] = useState<BookedCall | null>(null);
  const [leaving, setLeaving] = useState(false);
  const celebrate = !!(location.state as { celebrate?: boolean } | null)?.celebrate;
  useDocumentMeta({ titleKey: "onb.welcome.metaTitle", descriptionKey: "onb.welcome.sub", titleSuffix: " - re:praesent" });

  // Sales setup (and the root lead) finish a moment after "Finish": poll briefly.
  const config = useQuery({
    queryKey: ["onboarding-v2", "sales-config"],
    queryFn: getSalesConfig,
    refetchInterval: (q) => (q.state.data && !q.state.data.ready && q.state.dataUpdateCount < 12 ? 2500 : false),
    retry: false,
  });

  useEffect(() => {
    if (config.data?.booking && !booked) setBooked(config.data.booking as BookedCall);
  }, [booked, config.data?.booking]);

  const leave = async () => {
    setLeaving(true);
    try {
      await dismissWelcome();
    } catch {
      /* the dashboard is still where they belong */
    }
    await qc.invalidateQueries({ queryKey: ["auth"] });
    navigate("/", { replace: true });
  };

  const hosts = config.data?.hosts ?? [];
  const hostNames = hosts.map((h) => h.label).filter(Boolean) as string[];
  const firstName = user?.first_name?.trim();
  const bookedStart = booked ? new Date(booked.start) : null;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <OnboardingStyles />
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <img src={logoUrl} alt="re:praesent" className="h-6 w-auto" />
        <OnbLanguageSwitcher />
      </div>
      <main className="relative mx-auto max-w-2xl px-5 pb-20 pt-10">
        {celebrate ? <Celebration /> : null}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98) translateY(8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "scale(1) translateY(0px)" }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
          className="text-center"
        >
          <h1 className="ob2-heading text-balance text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
            {firstName ? t("onb.welcome.title", { name: firstName }) : t("onb.welcome.titleNoName")}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {t("onb.welcome.sub", { workspace: currentWorkspace?.name ?? "" })}
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: reduce ? 0 : 0.2 }}
          className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-[0_12px_32px_-16px_rgba(19,21,21,0.18)] sm:p-8"
        >
          {booked && bookedStart ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#a4dab8]/40 text-[#2f7d4f]">
                <CalendarCheck2 className="size-6" />
              </span>
              <h2 className="text-xl font-semibold">{t("onb.welcome.bookedTitle")}</h2>
              <p className="text-[15px]">
                {new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(bookedStart)}
                {booked.host_label ? ` · ${t("onb.welcome.with", { name: booked.host_label })}` : ""}
              </p>
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4" /> {t("onb.welcome.inviteSent", { email: user?.email ?? "" })}
              </p>
              {booked.meet_link ? (
                <a href={booked.meet_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground">
                  <Video className="size-4" /> {t("onb.welcome.meetLink")}
                </a>
              ) : null}
            </div>
          ) : config.data?.enabled ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {hosts.slice(0, 3).map((h, i) =>
                    h.avatar_url ? (
                      <img key={i} src={h.avatar_url} alt="" className="size-11 rounded-full object-cover ring-2 ring-card" />
                    ) : (
                      <span key={i} className="flex size-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-2 ring-card">
                        {(h.label ?? "?").charAt(0)}
                      </span>
                    ),
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("onb.welcome.bookTitle")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {hostNames.length ? t("onb.welcome.bookSubNamed", { names: hostNames.slice(0, 2).join(" & "), minutes: config.data.duration_minutes ?? 30 }) : t("onb.welcome.bookSub", { minutes: config.data.duration_minutes ?? 30 })}
                  </p>
                </div>
              </div>
              {config.data.ready ? (
                <BookingPanel config={config.data} onBooked={setBooked} />
              ) : (
                <p className="text-sm text-muted-foreground">{t("onb.book.preparing")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <Mail className="size-6" />
              </span>
              <h2 className="text-lg font-semibold">{t("onb.welcome.contactTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("onb.welcome.contactSub", { email: user?.email ?? "" })}</p>
            </div>
          )}
        </motion.section>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void leave()}
            disabled={leaving}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-[transform,opacity] hover:opacity-90 active:scale-[0.97] disabled:opacity-50 sm:h-10"
          >
            {t("onb.welcome.dashboard")} <ArrowRight className="size-4" />
          </button>
          {!booked && config.data?.enabled ? (
            <p className="text-balance text-center text-[13px] text-muted-foreground">{t("onb.welcome.later")}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
