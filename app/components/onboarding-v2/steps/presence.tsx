"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ExternalLink, HelpCircle, Loader2, MapPin, Search, Star, XCircle } from "lucide-react";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";
import {
  errorCodeOf,
  lookupFacebook,
  lookupGoogle,
  type FacebookCandidate,
  type PlaceCandidate,
  type ProfileData,
} from "~/lib/api/onboarding-v2";
import { checkWebsite } from "~/lib/onboarding/helpers";
import { cn } from "~/lib/utils";
import { ActionBar, ChoiceCard, ChoiceGroup, Field, FormError, SkipLink, StepHeading, TextInput, useRevealWhen } from "../primitives";
import { useWizard } from "../wizard-context";

type YesNoUnsure = "has" | "none" | "unknown";

function YesNoUnsureCards({ value, onChange, label }: { value: YesNoUnsure | null; onChange: (v: YesNoUnsure) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <ChoiceGroup label={label} columns={3}>
      <ChoiceCard selected={value === "has"} onSelect={() => onChange("has")} icon={<CheckCircle2 className="size-4" />} title={t("onb.yes")} />
      <ChoiceCard selected={value === "none"} onSelect={() => onChange("none")} icon={<XCircle className="size-4" />} title={t("onb.no")} />
      <ChoiceCard selected={value === "unknown"} onSelect={() => onChange("unknown")} icon={<HelpCircle className="size-4" />} title={t("onb.notSure")} />
    </ChoiceGroup>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(rating) ? "fill-secondary text-secondary" : "text-border")} />
      ))}
    </span>
  );
}

function PlaceCard({ place, onPick, busy }: { place: PlaceCandidate; onPick: () => void; busy?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
        <MapPin className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{place.name}</p>
        {place.address ? <p className="text-[13px] text-muted-foreground">{place.address}</p> : null}
        {typeof place.rating === "number" ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px]">
            <Stars rating={place.rating} />
            <span className="tabular-nums">{place.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({t("onb.google.reviews", { count: place.review_count ?? 0 })})</span>
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {place.maps_url ? (
          <a href={place.maps_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-3.5" /> {t("onb.google.open")}
          </a>
        ) : null}
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {t("onb.google.thisIsUs")}
        </button>
      </div>
    </div>
  );
}

/** Fill only EMPTY profile fields from the chosen place — never overwrite what they typed. */
function fromPlace(p: PlaceCandidate, data: ProfileData | undefined): ProfileData {
  const empty = (s: string, f: string) => {
    const v = data?.[s]?.[f];
    return v === undefined || v === null || v === "" || (typeof v === "object" && Object.keys(v as object).length === 0);
  };
  const patch: ProfileData = {
    google_business: {
      status: "has",
      place_id: p.place_id,
      name: p.name,
      maps_url: p.maps_url,
      rating: p.rating,
      review_count: p.review_count,
      address: p.address,
      phone: p.phone,
      primary_type: p.primary_type,
    },
  };
  const loc: Record<string, unknown> = {};
  if (p.street && empty("location", "street")) loc.street = p.street;
  if (p.postal_code && empty("location", "postal_code")) loc.postal_code = p.postal_code;
  if (p.city && empty("location", "city")) loc.city = p.city;
  if (p.country && empty("location", "country")) loc.country = p.country;
  if (p.lat !== null && empty("location", "lat")) loc.lat = p.lat;
  if (p.lng !== null && empty("location", "lng")) loc.lng = p.lng;
  if (Object.keys(loc).length) patch.location = loc;
  if (p.phone && empty("contact", "phone")) patch.contact = { phone: p.phone };
  if (p.hours && empty("hours", "days")) patch.hours = { days: p.hours };
  for (const section of Object.values(patch)) for (const [k, v] of Object.entries(section)) if (v === null || v === undefined) delete section[k];
  return patch;
}

// ── Google ───────────────────────────────────────────────────────────────────

export function StepGoogle() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const data = state?.profile?.data;
  const existing = data?.google_business as Record<string, unknown> | undefined;
  const country = (data?.location?.country as string | undefined) ?? "DE";
  const [answer, setAnswer] = useState<YesNoUnsure | null>((existing?.status as YesNoUnsure) ?? null);
  const [phone, setPhone] = useState<string>((data?.contact?.phone as string | undefined) ?? "");
  const [candidates, setCandidates] = useState<PlaceCandidate[] | null>(null);
  const candidatesRef = useRevealWhen<HTMLDivElement>(!!candidates);
  const [searchedBy, setSearchedBy] = useState<"phone" | "find" | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (mode: "phone" | "find") => {
    setSearching(true);
    setError(null);
    setCandidates(null);
    setSearchedBy(mode);
    try {
      const res = await lookupGoogle(mode === "phone" ? { mode, phone } : { mode });
      setCandidates(res.candidates);
    } catch (err) {
      const code = errorCodeOf(err);
      setError(code === "PLACES_NOT_CONFIGURED" ? t("onb.google.unavailable") : code === "INVALID_PHONE" ? t("onb.google.badPhone") : t("onb.errors.lookup"));
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  const choose = (a: YesNoUnsure) => {
    setAnswer(a);
    setPicked(null);
    setCandidates(null);
    if (a === "unknown") void search("find");
  };

  const finish = async () => {
    if (picked) {
      await save({ step: "google", profile: fromPlace(picked, data) });
    } else if (answer === "none") {
      await save({ step: "google", profile: { google_business: { status: "none" } } });
    } else {
      await save({ step: "google", profile: { google_business: { status: answer ?? "unknown" } }, skipped: !answer });
    }
  };

  const observation = picked && typeof picked.rating === "number"
    ? picked.rating >= 4.5 && (picked.review_count ?? 0) >= 20
      ? t("onb.google.strong", { rating: picked.rating.toFixed(1), count: picked.review_count ?? 0 })
      : t("onb.google.grow", { count: picked.review_count ?? 0 })
    : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void finish();
      }}
      noValidate
    >
      <StepHeading title={t("onb.google.title")} sub={t("onb.google.sub")} />
      {!picked ? <YesNoUnsureCards value={answer} onChange={choose} label={t("onb.google.title")} /> : null}

      <AnimatePresence mode="wait" initial={false}>
        {answer === "has" && !picked ? (
          <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-6 space-y-3">
            <Field label={t("onb.google.phoneLabel")} hint={t("onb.google.phoneHint")}>
              {(a) => <PhoneNumberInput className="crm-phone-input--control" id={a.id} aria-describedby={a.describedBy} value={phone} defaultCountry={country as never} onChange={setPhone} />}
            </Field>
            <button
              type="button"
              onClick={() => void search("phone")}
              disabled={searching || phone.replace(/\D/g, "").length < 7}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {t("onb.google.find")}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {searching && answer === "unknown" ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t("onb.google.searching")}
        </p>
      ) : null}

      {candidates && !picked ? (
        <div ref={candidatesRef} className="mt-6 scroll-mb-32 space-y-3">
          {candidates.length ? (
            <>
              <p className="text-sm font-medium">{t("onb.google.isThisYou")}</p>
              {candidates.map((c) => (
                <PlaceCard key={c.place_id} place={c} onPick={() => setPicked(c)} />
              ))}
            </>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{t("onb.google.nothing")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {searchedBy === "phone" ? <SkipLink label={t("onb.google.byName")} onClick={() => void search("find")} /> : null}
            <SkipLink label={t("onb.google.noneOfThese")} onClick={() => setCandidates(null)} />
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {picked ? (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="mt-2 space-y-4"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-foreground/15 bg-secondary/25 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground" />
              <div>
                <p className="font-semibold">{picked.name}</p>
                <p className="text-[13px] text-muted-foreground">{picked.address}</p>
                {observation ? <p className="mt-2 text-sm text-foreground">{observation}</p> : null}
              </div>
            </div>
            <SkipLink label={t("onb.google.change")} onClick={() => setPicked(null)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <FormError message={error} />
      <ActionBar
        onBack={back}
        busy={saving}
        primaryLabel={t("onb.continue")}
        primaryDisabled={!answer && !picked}
        secondary={!answer ? <SkipLink onClick={() => void save({ step: "google", skipped: true })} /> : null}
      />
    </form>
  );
}

// ── Socials ──────────────────────────────────────────────────────────────────

const NETWORKS = ["facebook", "instagram", "youtube", "linkedin", "tiktok", "pinterest"] as const;

export function StepSocial() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const found = (state?.profile?.data?.socials ?? {}) as Record<string, string | undefined>;
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(NETWORKS.map((n) => [n, found[n] ?? ""])),
  );
  const [fbAnswer, setFbAnswer] = useState<YesNoUnsure | null>(found.facebook ? "has" : ((found.facebook_status as YesNoUnsure | undefined) ?? null));
  const [fbCandidates, setFbCandidates] = useState<FacebookCandidate[] | null>(null);
  const fbRef = useRevealWhen<HTMLDivElement>(!!fbCandidates?.length);
  const [searching, setSearching] = useState(false);
  const [shown, setShown] = useState<string[]>(() => NETWORKS.filter((n) => found[n]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const foundAny = NETWORKS.some((n) => found[n]);

  const searchFb = async () => {
    setSearching(true);
    try {
      const res = await lookupFacebook();
      setFbCandidates(res.candidates.filter((c) => c.from === "search"));
    } catch {
      setFbCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseFb = (a: YesNoUnsure) => {
    setFbAnswer(a);
    if (a === "has" && !shown.includes("facebook")) setShown((s) => ["facebook", ...s]);
    if (a === "unknown") void searchFb();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad: Record<string, string> = {};
    const socials: Record<string, unknown> = {};
    for (const n of NETWORKS) {
      const v = urls[n]?.trim();
      if (!v) {
        if (found[n]) socials[n] = null;
        continue;
      }
      const c = checkWebsite(v.includes(".") ? v : `${n}.com/${v.replace(/^@/, "")}`);
      if (!c.ok) bad[n] = t("onb.fieldErrors.url");
      else socials[n] = c.url;
    }
    if (Object.keys(bad).length) {
      setErrors(bad);
      return;
    }
    socials.facebook_status = socials.facebook || found.facebook ? "has" : (fbAnswer ?? "unknown");
    await save({ step: "social", profile: { socials } });
  };

  const hidden = NETWORKS.filter((n) => !shown.includes(n));

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.social.title")} sub={foundAny ? t("onb.social.subFound") : t("onb.social.sub")} />

      {!found.facebook ? (
        <div className="mb-6 space-y-3">
          <p className="text-[15px] font-medium">{t("onb.social.fbQuestion")}</p>
          <YesNoUnsureCards value={fbAnswer} onChange={chooseFb} label={t("onb.social.fbQuestion")} />
          {searching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("onb.social.searching")}
            </p>
          ) : null}
          {fbCandidates ? (
            fbCandidates.length ? (
              <div ref={fbRef} className="scroll-mb-32 space-y-2">
                {fbCandidates.map((c) => (
                  <button
                    key={c.url}
                    type="button"
                    onClick={() => {
                      setUrls((u) => ({ ...u, facebook: c.url }));
                      setShown((s) => (s.includes("facebook") ? s : ["facebook", ...s]));
                      setFbAnswer("has");
                      setFbCandidates(null);
                    }}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/25 active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.title || c.url}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{c.url}</span>
                    </span>
                    <span className="text-sm font-semibold text-foreground">{t("onb.google.thisIsUs")}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{t("onb.social.nothing")}</p>
            )
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {shown.map((n) => (
          <Field key={n} label={t(`onb.social.networks.${n}`)} error={errors[n]} source={found[n] && urls[n] === found[n] ? (state?.profile?.field_sources?.[`socials.${n}`] ?? null) : null}>
            {(a) => (
              <TextInput
                id={a.id}
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={`https://${n}.com/…`}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                value={urls[n]}
                onChange={(e) => setUrls((u) => ({ ...u, [n]: e.target.value }))}
              />
            )}
          </Field>
        ))}
        {hidden.length ? (
          <div className="flex flex-wrap gap-2">
            {hidden.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setShown((s) => [...s, n])}
                className="inline-flex h-9 items-center rounded-full border border-dashed border-border px-3.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                + {t(`onb.social.networks.${n}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} />
    </form>
  );
}
