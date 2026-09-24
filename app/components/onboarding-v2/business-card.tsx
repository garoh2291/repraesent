"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Star,
  Youtube,
} from "lucide-react";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { cn } from "~/lib/utils";
import { displayHost } from "~/lib/onboarding/helpers";
import type { ProfileData } from "~/lib/api/onboarding-v2";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The fields that make a profile "complete" for the meter. */
const KEY_FIELDS: Array<[string, string]> = [
  ["identity", "display_name"],
  ["presence", "kind"],
  ["location", "street"],
  ["location", "city"],
  ["contact", "phone"],
  ["contact", "email"],
  ["hours", "days"],
  ["online", "website"],
  ["google_business", "status"],
  ["offer", "product_categories"],
  ["identity", "legal_name"],
  ["goals", "primary_goals"],
];

function filled(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

export function completeness(data: ProfileData | undefined): number {
  const n = KEY_FIELDS.filter(([s, f]) => filled(data?.[s]?.[f])).length;
  return Math.round((n / KEY_FIELDS.length) * 100);
}

function todayHours(days: unknown, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  if (!days || typeof days !== "object") return null;
  const key = DAYS[new Date().getDay()];
  const ranges = (days as Record<string, Array<{ open: string; close: string }>>)[key];
  if (!ranges) return null;
  if (ranges.length === 0) return t("onb.card.closedToday");
  return t("onb.card.openToday", { hours: ranges.map((r) => `${r.open}–${r.close}`).join(", ") });
}

function Row({ icon, children, k }: { icon: React.ReactNode; children: React.ReactNode; k: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      key={k}
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
      className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/85"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </motion.li>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px] text-muted-foreground/60">
      <span className="h-2 w-2 rounded-full border border-dashed border-muted-foreground/40" />
      {label}
    </li>
  );
}

/**
 * The customer's business, filling in as they answer and as we find things.
 * Desktop: a sticky card beside the questions. Mobile: a compact chip that
 * expands. Every value that lands animates in once (reduced motion: fades).
 */
export function BusinessCard({
  data,
  name,
  compact = false,
}: {
  data: ProfileData | undefined;
  name: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const d = data ?? {};
  const g = (s: string, f: string) => d[s]?.[f] as unknown;
  const pct = completeness(d);
  const street = g("location", "street") as string | undefined;
  const city = [g("location", "postal_code"), g("location", "city")].filter(Boolean).join(" ");
  const kind = g("presence", "kind") as string | undefined;
  const rating = g("google_business", "rating") as number | undefined;
  const reviews = g("google_business", "review_count") as number | undefined;
  const socials = (d.socials ?? {}) as Record<string, string>;
  const brands = (g("offer", "brands_carried") as string[] | undefined) ?? [];
  const cats = (g("offer", "product_categories") as string[] | undefined) ?? [];
  const hoursToday = todayHours(g("hours", "days"), t as never);

  const socialIcons: Array<[string, React.ComponentType<{ className?: string }>]> = [
    ["facebook", Facebook],
    ["instagram", Instagram],
    ["youtube", Youtube],
    ["linkedin", Linkedin],
  ];

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgba(19,21,21,0.04),0_12px_32px_-12px_rgba(19,21,21,0.12)]", compact && "rounded-2xl")}>
      {/* A thin band in the brand blue — the card is "theirs", ours frames it. */}
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--foreground)_0%,var(--foreground)_62%,var(--secondary)_62%)]" />
      <div className="space-y-5 p-6">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("onb.card.eyebrow")}</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h2
              key={name ? "named" : "empty"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("ob2-heading text-2xl leading-tight tracking-[-0.01em]", !name && "text-muted-foreground/50")}
            >
              {name || t("onb.card.namePlaceholder")}
            </motion.h2>
          </AnimatePresence>
          {kind ? (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground/80">
              {t(`onb.presence.${kind}.title`)}
            </span>
          ) : null}
        </div>

        <ul className="space-y-2.5">
          {street || city ? (
            <Row k="addr" icon={<MapPin className="size-3.5" />}>
              {[street, city].filter(Boolean).join(", ")}
            </Row>
          ) : (
            <Placeholder label={t("onb.card.address")} />
          )}
          {g("contact", "phone") ? (
            <Row k="phone" icon={<Phone className="size-3.5" />}>
              {formatPhoneNumberIntl(String(g("contact", "phone"))) || String(g("contact", "phone"))}
            </Row>
          ) : (
            <Placeholder label={t("onb.card.phone")} />
          )}
          {g("contact", "email") ? (
            <Row k="mail" icon={<Mail className="size-3.5" />}>{String(g("contact", "email"))}</Row>
          ) : null}
          {hoursToday ? (
            <Row k="hours" icon={<Clock className="size-3.5" />}>{hoursToday}</Row>
          ) : (
            <Placeholder label={t("onb.card.hours")} />
          )}
          {g("online", "website") ? (
            <Row k="web" icon={<Globe className="size-3.5" />}>{displayHost(String(g("online", "website")))}</Row>
          ) : null}
          {typeof rating === "number" ? (
            <Row k="rating" icon={<Star className="size-3.5 fill-secondary text-secondary" />}>
              {t("onb.card.rating", { rating: rating.toFixed(1), count: reviews ?? 0 })}
            </Row>
          ) : null}
        </ul>

        {!compact && (brands.length || cats.length) ? (
          <div className="flex flex-wrap gap-1.5">
            {(brands.length ? brands : cats).slice(0, 6).map((b) => (
              <motion.span
                key={b}
                initial={{ opacity: 0, transform: "scale(0.96)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-lg bg-muted px-2 py-1 text-[12px] text-foreground/80"
              >
                {b}
              </motion.span>
            ))}
          </div>
        ) : null}

        {Object.keys(socials).some((k) => socials[k] && k !== "facebook_status") ? (
          <div className="flex gap-2">
            {socialIcons
              .filter(([k]) => socials[k])
              .map(([k, Icon]) => (
                <a
                  key={k}
                  href={socials[k]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground/70 transition-colors hover:text-foreground"
                  aria-label={k}
                >
                  <Icon className="size-4" />
                </a>
              ))}
          </div>
        ) : null}

        <div className="space-y-1.5 border-t border-border pt-4">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>{t("onb.card.complete")}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full origin-left rounded-full bg-foreground"
              initial={false}
              animate={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile: a one-line summary that expands into the full card. */
export function BusinessCardChip({ data, name }: { data: ProfileData | undefined; name: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pct = completeness(data);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-xs active:scale-[0.99]"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground">
          {(name || "?").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name || t("onb.card.namePlaceholder")}</span>
          <span className="block text-xs text-muted-foreground">{t("onb.card.completeShort", { pct })}</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <BusinessCard data={data} name={name} compact />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
