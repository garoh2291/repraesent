"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CalendarCheck,
  Clock3,
  Hammer,
  Megaphone,
  MessageSquareText,
  MessageCircleQuestion,
  Hourglass,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { formatMoney, PROFILE_ENUMS } from "~/lib/onboarding/helpers";
import { ActionBar, ChipQuestion, ChipToggle, ChoiceCard, ChoiceGroup, Field, inkSwitchCls, Segmented, StepHeading, TagInput, TextArea, TextInput } from "../primitives";
import { useWizard } from "../wizard-context";

const GOAL_ICONS: Record<string, React.ReactNode> = {
  more_enquiries: <MessageSquareText className="size-4" />,
  more_appointments: <CalendarCheck className="size-4" />,
  google_presence: <Search className="size-4" />,
  reviews: <Star className="size-4" />,
  sell_online: <ShoppingBag className="size-4" />,
  save_time: <Clock3 className="size-4" />,
  brand_awareness: <Megaphone className="size-4" />,
};

export function StepGoals() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const g = (state?.profile?.data?.goals ?? {}) as Record<string, unknown>;
  const [goals, setGoals] = useState<string[]>((g.primary_goals as string[] | undefined) ?? []);
  const [channels, setChannels] = useState<string[]>((g.lead_channels as string[] | undefined) ?? []);
  const [volume, setVolume] = useState<string | null>((g.monthly_inquiries as string | undefined) ?? null);
  const [tools, setTools] = useState<string[]>((g.current_tools as string[] | undefined) ?? []);
  const [pain, setPain] = useState<string>((g.biggest_pain as string | undefined) ?? "");
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({
      step: "goals",
      profile: {
        goals: {
          primary_goals: goals,
          lead_channels: channels,
          monthly_inquiries: volume,
          current_tools: tools,
          biggest_pain: pain.trim() || null,
        },
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.goals.title")} sub={t("onb.goals.sub")} />
      <ChoiceGroup label={t("onb.goals.title")} columns={2} multi>
        {PROFILE_ENUMS.primaryGoals.map((k) => (
          <ChoiceCard
            key={k}
            role="checkbox"
            selected={goals.includes(k)}
            onSelect={() => setGoals((s) => toggle(s, k))}
            icon={GOAL_ICONS[k]}
            title={t(`onb.goals.options.${k}`)}
          />
        ))}
      </ChoiceGroup>

      <div className="mt-10 space-y-3">
        <p className="text-[15px] font-medium">{t("onb.goals.channels")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("onb.goals.channels")}>
          {PROFILE_ENUMS.leadChannels.map((c) => (
            <ChipToggle key={c} selected={channels.includes(c)} onToggle={() => setChannels((s) => toggle(s, c))}>
              {t(`onb.goals.channelOptions.${c}`)}
            </ChipToggle>
          ))}
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <p className="text-[15px] font-medium">{t("onb.goals.volume")}</p>
        <Segmented
          label={t("onb.goals.volume")}
          value={volume}
          onChange={setVolume}
          options={PROFILE_ENUMS.monthlyInquiries.map((v) => ({ value: v, label: t(`onb.goals.volumeOptions.${v}`) }))}
        />
      </div>

      <div className="mt-10 space-y-6">
        <Field label={t("onb.goals.tools")} optional hint={t("onb.goals.toolsHint")}>
          {(a) => (
            <TagInput id={a.id} describedBy={a.describedBy} value={tools} onChange={setTools} max={20} suggestions={t("onb.goals.toolSuggestions").split("|")} />
          )}
        </Field>
        <Field label={t("onb.goals.pain")} optional>
          {(a) => <TextArea id={a.id} rows={3} maxLength={1000} value={pain} placeholder={t("onb.goals.painPlaceholder")} onChange={(e) => setPain(e.target.value)} />}
        </Field>
      </div>
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} />
    </form>
  );
}

export function StepGrowth() {
  const { t, i18n } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const data = state?.profile?.data;
  const i = (data?.interests ?? {}) as Record<string, unknown>;
  const cms = data?.online?.cms_detected as string | undefined;
  const hasSite = !!state?.workspace?.website;
  const managed = cms?.includes("re:praesent");
  const q = state?.pricing;
  const money = (c: number) => (q ? formatMoney(c, q.currency, i18n.language) : "");
  const [plan, setPlan] = useState<string | null>((i.website_plan as string | undefined) ?? (managed ? "keep" : null));
  const [ai, setAi] = useState<string | null>((i.ai_visibility as string | undefined) ?? null);
  const [ads, setAds] = useState<boolean>(!!i.managed_ads);
  const [social, setSocial] = useState<boolean>(!!i.social_posts);
  const [content, setContent] = useState<boolean>(!!i.content_updates);
  const [locations, setLocations] = useState<number>((i.locations_count as number | undefined) ?? 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({
      step: "growth",
      profile: {
        interests: {
          website_plan: plan,
          move_to_wordpress: plan === "rebuild" ? "yes" : plan === "refresh" ? "maybe" : plan ? "no" : null,
          ai_visibility: ai,
          managed_ads: ads,
          social_posts: social,
          content_updates: content,
          locations_count: locations,
        },
      },
    });
  };

  const addon = (key: string, on: boolean, set: (v: boolean) => void, price: string) => (
    <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/25">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t(`onb.growth.addons.${key}.title`)}</span>
        <span className="block text-[13px] text-muted-foreground">{t(`onb.growth.addons.${key}.desc`)}</span>
      </span>
      <span className="shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{price}</span>
      <Switch className={inkSwitchCls} checked={on} onCheckedChange={set} aria-label={t(`onb.growth.addons.${key}.title`)} />
    </label>
  );

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading
        title={hasSite ? t("onb.growth.title") : t("onb.growth.titleNoSite")}
        sub={!hasSite ? t("onb.growth.subNoSite") : cms ? t("onb.growth.subCms", { cms }) : t("onb.growth.sub")}
      />
      <ChoiceGroup label={t("onb.growth.title")}>
        {hasSite ? (
          <>
            <ChoiceCard
              selected={plan === "keep"}
              onSelect={() => setPlan("keep")}
              icon={<ThumbsUp className="size-4" />}
              title={t("onb.growth.plan.keep.title")}
              description={managed ? t("onb.growth.plan.keep.managed") : t("onb.growth.plan.keep.desc", { price: money(q?.addons.cmsTransfer ?? 0) })}
            />
            <ChoiceCard
              selected={plan === "refresh"}
              onSelect={() => setPlan("refresh")}
              icon={<Wrench className="size-4" />}
              title={t("onb.growth.plan.refresh.title")}
              description={t("onb.growth.plan.refresh.desc", { price: money(q?.addons.hourly ?? 0) })}
            />
            <ChoiceCard
              selected={plan === "rebuild"}
              onSelect={() => setPlan("rebuild")}
              icon={<Hammer className="size-4" />}
              title={t("onb.growth.plan.rebuild.title")}
              description={t("onb.growth.plan.rebuild.desc", { price: money(q?.addons.newWebsite ?? 0) })}
            />
          </>
        ) : (
          <>
            <ChoiceCard
              selected={plan === "rebuild"}
              onSelect={() => setPlan("rebuild")}
              icon={<Hammer className="size-4" />}
              title={t("onb.growth.plan.new.title")}
              description={t("onb.growth.plan.new.desc", { price: money(q?.addons.newWebsite ?? 0) })}
            />
            <ChoiceCard selected={plan === "keep"} onSelect={() => setPlan("keep")} icon={<Clock3 className="size-4" />} title={t("onb.growth.plan.later.title")} />
          </>
        )}
      </ChoiceGroup>

      <div className="mt-10 space-y-3">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <Sparkles className="size-4 text-foreground" /> {t("onb.growth.ai.question")}
        </p>
        <p className="text-[13px] text-muted-foreground">{t("onb.growth.ai.explain")}</p>
        <ChoiceGroup label={t("onb.growth.ai.question")} columns={3}>
          <ChoiceCard selected={ai === "yes"} onSelect={() => setAi("yes")} icon={<BadgeCheck className="size-4" />} title={t("onb.growth.ai.yes")} />
          <ChoiceCard selected={ai === "more_info"} onSelect={() => setAi("more_info")} icon={<MessageCircleQuestion className="size-4" />} title={t("onb.growth.ai.more_info")} />
          <ChoiceCard selected={ai === "no"} onSelect={() => setAi("no")} icon={<Hourglass className="size-4" />} title={t("onb.growth.ai.no")} />
        </ChoiceGroup>
      </div>

      <div className="mt-10 space-y-3">
        <p className="text-[15px] font-medium">{t("onb.growth.addonsTitle")}</p>
        {addon("ads", ads, setAds, t("onb.growth.perMonth", { price: money(q?.addons.managedAds.monthly ?? 0) }))}
        {addon("social", social, setSocial, t("onb.growth.perMonth", { price: money(q?.addons.socialPosts.monthly ?? 0) }))}
        {addon("content", content, setContent, t("onb.growth.perMonth", { price: money(q?.addons.contentUpdates.monthly ?? 0) }))}
        <p className="text-[12px] text-muted-foreground">{t("onb.growth.noCommitment")}</p>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-[15px] font-medium">{t("onb.growth.locations")}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="−" onClick={() => setLocations((n) => Math.max(1, n - 1))} className="size-9 rounded-full border border-border text-lg leading-none active:scale-95">
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {locations}
          </span>
          <button type="button" aria-label="+" onClick={() => setLocations((n) => Math.min(500, n + 1))} className="size-9 rounded-full border border-border text-lg leading-none active:scale-95">
            +
          </button>
        </div>
      </div>
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} />
    </form>
  );
}

// ── Sales ────────────────────────────────────────────────────────────────────

/**
 * Four one-tap questions that tell our sales team how to follow up: timing,
 * where they heard of us, ads today, and how enquiries are handled. All
 * optional, each with "Not sure". Answers land in the root lead + deal note.
 */
export function StepSales() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const s = (state?.profile?.data?.sales ?? {}) as Record<string, string | undefined>;
  const [goLive, setGoLive] = useState<string | null>(s.go_live ?? null);
  const [heard, setHeard] = useState<string | null>(s.heard_from ?? null);
  const [heardDetail, setHeardDetail] = useState<string>(s.heard_from_detail ?? "");
  const [ads, setAds] = useState<string | null>(s.ads_running ?? null);
  const [budget, setBudget] = useState<string | null>(s.ads_budget ?? null);
  const [handler, setHandler] = useState<string | null>(s.enquiry_handler ?? null);
  const [reply, setReply] = useState<string | null>(s.reply_time ?? null);
  const runsAds = !!ads && !["ads_none", "unknown"].includes(ads);
  const symbol = state?.pricing?.currency === "CAD" ? "CA$" : state?.pricing?.currency === "USD" ? "US$" : "€";
  const opts = (key: keyof typeof PROFILE_ENUMS, prefix: string) =>
    (PROFILE_ENUMS[key] as readonly string[]).map((v) => ({ value: v, label: t(`onb.sales.${prefix}.${v}`, { symbol }) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({
      step: "sales",
      profile: {
        sales: {
          go_live: goLive,
          heard_from: heard,
          heard_from_detail: heard === "heard_recommendation" || heard === "heard_other" ? heardDetail.trim() || null : null,
          ads_running: ads,
          ads_budget: runsAds ? budget : null,
          enquiry_handler: handler,
          reply_time: reply,
        },
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.sales.title")} sub={t("onb.sales.sub")} />
      <div className="space-y-9">
        <ChipQuestion label={t("onb.sales.goLive.q")} value={goLive} options={opts("goLive", "goLive")} onChange={setGoLive} />
        <div className="space-y-3">
          <ChipQuestion label={t("onb.sales.heard.q")} value={heard} options={opts("heardFrom", "heard")} onChange={setHeard} />
          {heard === "heard_recommendation" || heard === "heard_other" ? (
            <Field label={heard === "heard_recommendation" ? t("onb.sales.heard.whoLabel") : t("onb.sales.heard.otherLabel")} optional>
              {(a) => (
                <TextInput id={a.id} aria-describedby={a.describedBy} maxLength={200} value={heardDetail} onChange={(e) => setHeardDetail(e.target.value)} />
              )}
            </Field>
          ) : null}
        </div>
        <div className="space-y-5">
          <ChipQuestion label={t("onb.sales.ads.q")} hint={t("onb.sales.ads.hint")} value={ads} options={opts("adsRunning", "ads")} onChange={setAds} />
          {runsAds ? <ChipQuestion label={t("onb.sales.budget.q")} value={budget} options={opts("adsBudget", "budget")} onChange={setBudget} /> : null}
        </div>
        <div className="space-y-5">
          <ChipQuestion label={t("onb.sales.handler.q")} value={handler} options={opts("enquiryHandler", "handler")} onChange={setHandler} />
          <ChipQuestion label={t("onb.sales.reply.q")} value={reply} options={opts("replyTime", "reply")} onChange={setReply} />
        </div>
      </div>
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} />
    </form>
  );
}
