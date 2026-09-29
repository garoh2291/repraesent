import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarCheck, ExternalLink, Globe, Mail, MapPin, Phone, Star, Video } from "lucide-react";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { apiClient } from "~/lib/api/axios-instance";
import type { ProfileData } from "~/lib/api/onboarding-v2";
import { cn } from "~/lib/utils";

interface DealOnboardingProfile {
  run: {
    status: "in_progress" | "completed" | "abandoned";
    current_step: string;
    started_at: string;
    completed_at: string | null;
    booking: { start: string; end: string; host_label?: string; meet_link?: string | null } | null;
  };
  workspace: { id: string; name: string | null; status: string | null; website: string | null };
  profile: { data: ProfileData; updated_at: string | null };
}

async function getDealOnboardingProfile(dealId: string): Promise<DealOnboardingProfile | null> {
  try {
    const { data } = await apiClient.get<DealOnboardingProfile>(`/root-onboarding/deals/${dealId}/profile`);
    return data;
  } catch (error) {
    // 404 = this deal did not come from onboarding: the panel simply isn't shown.
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
}

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const phone = (v: string | undefined) => (v ? formatPhoneNumberIntl(v) || v : "");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[12px] text-foreground/80">
          {i}
        </span>
      ))}
    </div>
  );
}

/**
 * Root workspace only: what a new customer told us during onboarding, next
 * to the deal sales works on. Reads the customer's live profile, so changes
 * they make in Settings → Business profile show up here too.
 */
export function OnboardingProfilePanel({ dealId }: { dealId: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["root-deal-onboarding-profile", dealId],
    queryFn: () => getDealOnboardingProfile(dealId),
    staleTime: 60_000,
    retry: false,
  });
  if (!data) return null;

  const d = data.profile.data ?? {};
  const g = <T,>(s: string, f: string) => (d[s]?.[f] ?? undefined) as T | undefined;
  const list = (s: string, f: string) => (g<string[]>(s, f) ?? []).filter(Boolean);
  const address = [g<string>("location", "street"), [g<string>("location", "postal_code"), g<string>("location", "city")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const rating = g<number>("google_business", "rating");
  const person = g<{ first_name?: string; last_name?: string; role?: string; phone?: string; email?: string }>("contact", "contact_person");
  const goals = list("goals", "primary_goals").map((k) => t(`onb.goals.options.${k}`));
  const channels = list("goals", "lead_channels").map((k) => t(`onb.goals.channelOptions.${k}`));
  const volume = g<string>("goals", "monthly_inquiries");
  const plan = g<string>("interests", "website_plan");
  const ai = g<string>("interests", "ai_visibility");
  const addons = (["managed_ads", "social_posts", "content_updates"] as const)
    .filter((k) => g<boolean>("interests", k))
    .map((k) => t(`onb.growth.addons.${k === "managed_ads" ? "ads" : k === "social_posts" ? "social" : "content"}.title`));
  const provider = g<string>("email_setup", "provider");
  const providerLabel: Record<string, string> = {
    google_workspace: "Google Workspace",
    microsoft_365: "Microsoft 365",
    other: t("onb.email.other"),
    none: t("onb.email.none"),
  };
  const statusTone =
    data.run.status === "completed"
      ? "bg-[#e3f3e8] text-[#2f7d4f]"
      : data.run.status === "abandoned"
        ? "bg-destructive/10 text-destructive"
        : "bg-secondary/40 text-secondary-foreground";
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, opts).format(new Date(iso));

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-(--shadow) sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("pipeline.onboardingPanel.title")}</h2>
          <p className="truncate text-[13px] text-muted-foreground">{data.workspace.name}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone)}>
          {t(`pipeline.onboardingPanel.status.${data.run.status}`, { step: data.run.current_step })}
        </span>
      </div>

      {data.run.booking ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/[0.06] p-3 text-sm">
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">
              {fmt(data.run.booking.start, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {data.run.booking.host_label ? ` · ${data.run.booking.host_label}` : ""}
            </p>
            {data.run.booking.meet_link ? (
              <a href={data.run.booking.meet_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                <Video className="size-3.5" aria-hidden />
                {t("pipeline.onboardingPanel.join")}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {person && (person.first_name || person.phone) ? (
        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="font-medium">
            {[person.first_name, person.last_name].filter(Boolean).join(" ")}
            {person.role ? <span className="font-normal text-muted-foreground"> · {person.role}</span> : null}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {person.email ? (
              <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="size-3.5" aria-hidden />
                {person.email}
              </a>
            ) : null}
            {person.phone ? (
              <a href={`tel:${person.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {phone(person.phone)}
              </a>
            ) : null}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">{t("pipeline.onboardingPanel.contactFirst")}</p>
        </div>
      ) : null}

      <dl className="space-y-2.5">
        {g<string>("identity", "legal_name") ? <Row label={t("pipeline.onboardingPanel.legalName")}>{g<string>("identity", "legal_name")}</Row> : null}
        {g<string>("identity", "industry") ? (
          <Row label={t("onb.f.industry")}>{capitalize(t(`clientTypes.${g<string>("identity", "industry")}`, { count: 1 }))}</Row>
        ) : null}
        {g<string>("presence", "kind") ? <Row label={t("pipeline.onboardingPanel.presence")}>{t(`onb.presence.${g<string>("presence", "kind")}.title`)}</Row> : null}
        {address ? (
          <Row label={t("pipeline.onboardingPanel.address")}>
            <span className="inline-flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {address}
            </span>
          </Row>
        ) : null}
        {g<string>("contact", "phone") ? (
          <Row label={t("pipeline.onboardingPanel.phone")}>
            <a href={`tel:${g<string>("contact", "phone")}`} className="inline-flex items-center gap-1.5 hover:underline">
              <Phone className="size-3.5 text-muted-foreground" aria-hidden />
              {phone(g<string>("contact", "phone"))}
            </a>
          </Row>
        ) : null}
        {g<string>("contact", "email") ? (
          <Row label={t("pipeline.onboardingPanel.email")}>
            <a href={`mailto:${g<string>("contact", "email")}`} className="inline-flex items-center gap-1.5 hover:underline">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              {g<string>("contact", "email")}
            </a>
          </Row>
        ) : null}
        {data.workspace.website ? (
          <Row label={t("pipeline.onboardingPanel.website")}>
            <a href={data.workspace.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Globe className="size-3.5" aria-hidden />
              {data.workspace.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              {g<string>("online", "cms_detected") ? <span className="text-muted-foreground"> · {g<string>("online", "cms_detected")}</span> : null}
            </a>
          </Row>
        ) : null}
        {typeof rating === "number" ? (
          <Row label="Google">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-secondary text-secondary" aria-hidden />
              {t("onb.card.rating", { rating: rating.toFixed(1), count: g<number>("google_business", "review_count") ?? 0 })}
              {g<string>("google_business", "maps_url") ? (
                <a href={g<string>("google_business", "maps_url")} target="_blank" rel="noreferrer" aria-label="Google Maps" className="ml-1 text-primary">
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </span>
          </Row>
        ) : null}
        {list("offer", "brands_carried").length ? (
          <Row label={t("onb.f.brands_carried")}>
            <Chips items={list("offer", "brands_carried")} />
          </Row>
        ) : null}
        {goals.length ? (
          <Row label={t("pipeline.onboardingPanel.goals")}>
            <Chips items={goals} />
          </Row>
        ) : null}
        {channels.length ? <Row label={t("pipeline.onboardingPanel.channels")}>{channels.join(", ")}</Row> : null}
        {volume ? <Row label={t("pipeline.onboardingPanel.volume")}>{t(`onb.goals.volumeOptions.${volume}`)}</Row> : null}
        {plan ? <Row label={t("pipeline.onboardingPanel.websitePlan")}>{t(`onb.growth.plan.${plan}.title`)}</Row> : null}
        {ai ? <Row label={t("pipeline.onboardingPanel.ai")}>{t(`onb.growth.ai.${ai}`)}</Row> : null}
        {addons.length ? (
          <Row label={t("pipeline.onboardingPanel.addons")}>
            <Chips items={addons} />
          </Row>
        ) : null}
        {provider ? <Row label={t("pipeline.onboardingPanel.emailProvider")}>{providerLabel[provider] ?? provider}</Row> : null}
        {g<number>("interests", "locations_count") && (g<number>("interests", "locations_count") ?? 1) > 1 ? (
          <Row label={t("pipeline.onboardingPanel.locations")}>{g<number>("interests", "locations_count")}</Row>
        ) : null}
        {g<string>("goals", "biggest_pain") ? (
          <Row label={t("pipeline.onboardingPanel.pain")}>
            <span className="whitespace-pre-line italic text-foreground/85">“{g<string>("goals", "biggest_pain")}”</span>
          </Row>
        ) : null}
      </dl>

      {data.profile.updated_at ? (
        <p className="border-t border-border pt-3 text-[12px] text-muted-foreground">
          {t("pipeline.onboardingPanel.live", { date: fmt(data.profile.updated_at, { day: "numeric", month: "short", year: "numeric" }) })}
        </p>
      ) : null}
    </section>
  );
}
