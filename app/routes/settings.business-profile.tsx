import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Globe, Loader2, MapPin, RefreshCw, Star } from "lucide-react";
import i18n from "~/i18n";
import { errorCodeOf, type FieldSource } from "~/lib/api/onboarding-v2";
import {
  addWorkspaceWebsite,
  getWorkspaceProfile,
  getWorkspaceProfileJob,
  rereadWorkspaceWebsite,
  saveWorkspaceProfile,
  workspaceProfileKey,
  type WorkspaceProfileView,
} from "~/lib/api/workspace-profile";
import { checkWebsite, displayHost } from "~/lib/onboarding/helpers";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useAuthContext } from "~/providers/auth-provider";
import { ReviewSettings } from "~/components/notebook/review-settings";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Field, FormError, TextInput } from "~/components/onboarding-v2/primitives";
import { DETAIL_PATHS, ProfileFields } from "~/components/onboarding-v2/steps/details";
import { focusFirstError, mapFieldErrors, useProfileDraft } from "~/components/onboarding-v2/steps/profile-draft";

export function meta() {
  return [
    { title: `${i18n.t("settings.businessProfile.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.businessProfile.metaDescription") },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

const SOCIALS = ["facebook", "instagram", "youtube", "linkedin", "tiktok", "pinterest"] as const;
const SOCIAL_PATHS = SOCIALS.map((s) => `socials.${s}`);
const SOCIAL_LABELS: Record<(typeof SOCIALS)[number], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

/** One outcome message for a finished website read: what really changed, never what was merely seen. */
function readOutcome(job: { status: string; fields?: string[] | null; progress?: Array<{ code: string }> }, t: (k: string, o?: Record<string, unknown>) => string) {
  if (job.status !== "done") return { ok: false, text: t("settings.businessProfile.readFailed") };
  if (job.progress?.some((p) => p.code === "skipped_changed_site")) return { ok: false, text: t("settings.businessProfile.readSkipped") };
  const n = job.fields?.filter((f) => f !== "online.website").length ?? 0;
  return n > 0
    ? { ok: true, text: t("settings.businessProfile.readUpdated", { count: n }) }
    : { ok: true, text: t("settings.businessProfile.readNothingNew") };
}

/**
 * Settings → Business profile, for every workspace. The same fields as the
 * onboarding "Here's what we found" step, the website (add one if there is
 * none; read it again if there is), socials, and the Google profile we linked.
 * Admins edit; everyone else reads.
 */
export default function SettingsBusinessProfile() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.businessProfile.metaTitle",
    descriptionKey: "settings.businessProfile.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { currentWorkspace } = useAuthContext();
  const key = workspaceProfileKey(currentWorkspace?.id);
  const { data, isPending } = useQuery({ queryKey: key, queryFn: getWorkspaceProfile });

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </div>
    );
  }
  // Remount the form when the stored profile changes (after a save or a website read).
  return <ProfileEditor key={data.profile.updated_at ?? "empty"} view={data} queryKey={key} />;
}

function ProfileEditor({ view, queryKey }: { view: WorkspaceProfileView; queryKey: readonly unknown[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const data = view.profile.data;
  const sources = view.profile.field_sources as Record<string, FieldSource>;
  const draft = useProfileDraft(data, sources, [...DETAIL_PATHS, ...SOCIAL_PATHS]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const canEdit = view.can_edit;

  const save = useMutation({
    mutationFn: () => saveWorkspaceProfile(draft.patch(), draft.confirmPaths()),
    onSuccess: (fresh) => {
      setErrors({});
      setFormError(null);
      queryClient.setQueryData(queryKey, fresh);
      toast.success(t("settings.businessProfile.saved"));
    },
    onError: (error) => {
      const mapped = mapFieldErrors(error, t);
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setFormError(t("onb.errors.fixFields"));
        focusFirstError();
      } else setFormError(t("onb.errors.generic"));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!((draft.get<string>("identity.display_name") ?? "") as string).trim()) {
      setErrors({ "identity.display_name": t("onb.fieldErrors.required") });
      focusFirstError();
      return;
    }
    save.mutate();
  };

  const google = (data.google_business ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl space-y-8 app-fade-up app-fade-up-d2">
      <WebsiteSection view={view} queryKey={queryKey} />

      {typeof google.name === "string" ? (
        <section className="space-y-3">
          <SectionLabel>{t("settings.businessProfile.googleLabel")}</SectionLabel>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{google.name}</p>
              {typeof google.address === "string" ? <p className="truncate text-sm text-muted-foreground">{google.address}</p> : null}
              {typeof google.rating === "number" ? (
                <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                  <Star className="size-3.5 fill-secondary text-secondary" aria-hidden />
                  {t("onb.card.rating", { rating: (google.rating as number).toFixed(1), count: (google.review_count as number) ?? 0 })}
                </p>
              ) : null}
            </div>
            {typeof google.maps_url === "string" ? (
              <a href={google.maps_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-foreground underline-offset-4 hover:underline">
                <ExternalLink className="size-3.5" aria-hidden />
                {t("settings.businessProfile.openMaps")}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <ReviewSettings view={view} queryKey={queryKey} />

      <form onSubmit={submit} noValidate className="space-y-4">
        <SectionLabel>{t("settings.businessProfile.detailsLabel")}</SectionLabel>
        <FormError message={formError} />
        {/* A disabled fieldset turns every input and button inside read-only for non-admins. */}
        <fieldset disabled={!canEdit || save.isPending} className="min-w-0 space-y-4">
          <ProfileFields draft={draft} sources={sources} errors={errors} />
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">{t("settings.businessProfile.socialsLabel")}</h2>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              {SOCIALS.map((s) => (
                <Field
                  key={s}
                  label={SOCIAL_LABELS[s]}
                  source={sources[`socials.${s}`]}
                  error={errors[`socials.${s}`]}
                >
                  {(a) => (
                    <TextInput
                      id={a.id}
                      type="url"
                      inputMode="url"
                      placeholder={`https://www.${s}.com/…`}
                      value={(draft.get<string>(`socials.${s}`) ?? "") as string}
                      onChange={(e) => draft.set(`socials.${s}`, e.target.value)}
                      aria-invalid={a.invalid}
                      aria-describedby={a.describedBy}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" className="h-10 rounded-lg px-5 max-sm:h-11 max-sm:w-full" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
              {t("settings.businessProfile.save")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("settings.businessProfile.adminOnly")}</p>
        )}
      </form>
    </div>
  );
}

function WebsiteSection({ view, queryKey }: { view: WorkspaceProfileView; queryKey: readonly unknown[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(
    view.website_job && (view.website_job.status === "queued" || view.website_job.status === "running") ? view.website_job.id : null,
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the website read until it finishes, then refresh the whole page's data.
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const tick = async () => {
      try {
        const { job } = await getWorkspaceProfileJob(jobId);
        if (!alive) return;
        if (job.status === "done" || job.status === "failed") {
          setJobId(null);
          await queryClient.invalidateQueries({ queryKey });
          const outcome = readOutcome(job, t);
          if (outcome.ok) toast.success(outcome.text);
          else toast.error(outcome.text);
          return;
        }
      } catch {
        /* keep trying; the job sweeper fails stuck jobs after a few minutes */
      }
      timer.current = setTimeout(tick, 2500);
    };
    timer.current = setTimeout(tick, 1500);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId, queryClient, queryKey, t]);

  const reread = useMutation({
    mutationFn: rereadWorkspaceWebsite,
    onSuccess: ({ job_id }) => setJobId(job_id),
    onError: (e) => toast.error(t(`onb.errors.${errorCodeOf(e)}`, { defaultValue: t("onb.errors.generic") })),
  });

  const add = useMutation({
    mutationFn: (site: string) => addWorkspaceWebsite(site),
    onSuccess: (fresh) => {
      queryClient.setQueryData(queryKey, fresh);
      if (fresh.website_job) setJobId(fresh.website_job.id);
      toast.success(t("settings.businessProfile.websiteAdded"));
    },
    onError: (e) => {
      const code = errorCodeOf(e);
      setError(
        code === "WEBSITE_TAKEN"
          ? t("onb.website.errors.taken")
          : code === "WEBSITE_INVALID"
            ? t("onb.website.errors.invalid")
            : t("onb.errors.generic"),
      );
    },
  });

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkWebsite(value);
    if (!check.ok) {
      setError(t(`onb.website.errors.${check.reason}`));
      return;
    }
    setError(null);
    add.mutate(check.url);
  };

  const reading = !!jobId || reread.isPending;
  const lastRead = view.website_job?.finished_at ? new Date(view.website_job.finished_at) : null;

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <SectionLabel>{t("settings.businessProfile.websiteLabel")}</SectionLabel>
        <p className="text-sm text-muted-foreground">{t("settings.businessProfile.websiteDescription")}</p>
      </div>
      {view.website ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70" aria-hidden>
            <Globe className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <a href={view.website} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold hover:underline">
              {displayHost(view.website)}
            </a>
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {reading
                ? t("settings.businessProfile.reading")
                : lastRead
                  ? t("settings.businessProfile.lastRead", { date: lastRead.toLocaleDateString(undefined, { dateStyle: "medium" }) })
                  : t("settings.businessProfile.neverRead")}
            </p>
          </div>
          {view.can_edit ? (
            <Button type="button" variant="outline" className="h-10 rounded-lg" disabled={reading} onClick={() => reread.mutate()}>
              {reading ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-1.5 size-4" aria-hidden />}
              {t("settings.businessProfile.reread")}
            </Button>
          ) : null}
        </div>
      ) : view.can_edit ? (
        <form onSubmit={submitAdd} noValidate className="rounded-2xl border border-dashed border-border p-4">
          <label htmlFor="bp-website" className="text-[13px] font-medium">
            {t("settings.businessProfile.addWebsiteLabel")}
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <TextInput
              id="bp-website"
              inputMode="url"
              autoComplete="url"
              placeholder={t("onb.website.placeholder")}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "bp-website-err" : undefined}
            />
            <Button type="submit" className="h-10 rounded-lg" disabled={add.isPending || !value.trim()}>
              {add.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
              {t("settings.businessProfile.addWebsite")}
            </Button>
          </div>
          {error ? (
            <p id="bp-website-err" className="mt-1.5 text-[13px] font-medium text-destructive">
              {error}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] text-muted-foreground">{t("settings.businessProfile.addWebsiteHint")}</p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t("settings.businessProfile.noWebsite")}</p>
      )}
    </section>
  );
}
