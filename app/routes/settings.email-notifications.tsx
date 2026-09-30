import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, BellOff, Bell, ChevronRight, Hourglass, Inbox, Kanban, ListTodo, Loader2, Send } from "lucide-react";
import { ALWAYS_ITEMS, AlertItemList, SWITCH_ITEMS } from "~/components/team/alert-coverage";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  digestSettingsKey,
  getDigestSettings,
  muteDigest,
  sendDigestTest,
  updateDigestSettings,
  type DigestAudience,
  type DigestKey,
  type DigestSettings,
} from "~/lib/api/workspace-notifications";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";

export function meta() {
  return [
    { title: `${i18n.t("settings.emailNotifications.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.emailNotifications.metaDescription") },
  ];
}

const ICONS: Record<DigestKey, React.ComponentType<{ className?: string }>> = {
  weekly_leads_digest: Inbox,
  daily_tasks_digest: ListTodo,
  weekly_pipeline_summary: Kanban,
  stale_leads_reminder: Hourglass,
  monthly_performance_report: BarChart3,
};

/** Matches the eyebrow used by every other settings page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Settings → Email notifications: the five scheduled digests. Admins switch
 * them on for the workspace and choose who gets them; everyone can send
 * themselves a test and stop a digest just for themselves. The instant email
 * per new lead is a per-person switch on the Team page and is only linked here.
 */
export default function SettingsEmailNotifications() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.emailNotifications.metaTitle",
    descriptionKey: "settings.emailNotifications.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { currentWorkspace, user } = useAuthContext();
  const queryClient = useQueryClient();
  const key = digestSettingsKey(currentWorkspace?.id);
  const { data, isPending } = useQuery({ queryKey: key, queryFn: getDigestSettings });
  const [testing, setTesting] = useState<DigestKey | null>(null);

  const setData = (next: DigestSettings) => queryClient.setQueryData(key, next);

  const save = useMutation({
    mutationFn: (next: DigestSettings) =>
      updateDigestSettings(
        next.items.map((i) => ({ key: i.key, enabled: i.enabled, audience: i.audience, recipient_user_ids: i.recipient_user_ids })),
        browserTimezone(),
      ),
    onMutate: (next) => {
      const previous = queryClient.getQueryData<DigestSettings>(key);
      setData(next);
      return { previous };
    },
    onSuccess: (fresh) => {
      setData(fresh);
      toast.success(t("settings.emailNotifications.saved"));
    },
    onError: (error, _next, ctx) => {
      if (ctx?.previous) setData(ctx.previous);
      toast.error(extractErrorMessage(error));
    },
  });

  const mute = useMutation({
    mutationFn: ({ k, muted }: { k: DigestKey; muted: boolean }) => muteDigest(k, muted),
    onSuccess: (fresh, { muted }) => {
      setData(fresh);
      toast.success(muted ? t("settings.emailNotifications.mutedToast") : t("settings.emailNotifications.unmutedToast"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const test = async (k: DigestKey) => {
    setTesting(k);
    try {
      const r = await sendDigestTest(k);
      if (r.sent) toast.success(t("settings.emailNotifications.testSent", { email: user?.email ?? "" }));
      else toast.info(t("settings.emailNotifications.testEmpty"));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setTesting(null);
    }
  };

  // One audience for all digests (what onboarding sets up); the API keeps it per digest.
  const audience: DigestAudience = data?.items.find((i) => i.enabled)?.audience ?? data?.items[0]?.audience ?? "all_members";
  const selected = useMemo(() => {
    const first = data?.items.find((i) => i.audience === "selected");
    return new Set(first?.recipient_user_ids ?? []);
  }, [data]);

  const applyAudience = (nextAudience: DigestAudience, ids: string[]) => {
    if (!data) return;
    save.mutate({
      ...data,
      items: data.items.map((i) => ({ ...i, audience: nextAudience, recipient_user_ids: nextAudience === "selected" ? ids : [] })),
    });
  };

  const toggle = (k: DigestKey, enabled: boolean) => {
    if (!data) return;
    save.mutate({
      ...data,
      items: data.items.map((i) =>
        i.key === k
          ? { ...i, enabled, audience, recipient_user_ids: audience === "selected" ? [...selected] : [] }
          : i,
      ),
    });
  };

  const togglePerson = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size === 1) {
        toast.error(t("settings.emailNotifications.pickOne"));
        return;
      }
      next.delete(id);
    } else next.add(id);
    applyAudience("selected", [...next]);
  };

  const tz = data?.timezone ?? browserTimezone() ?? "Europe/Berlin";
  const canEdit = !!data?.can_edit;

  return (
    <div className="space-y-8 app-fade-up app-fade-up-d2">
      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.emailNotifications.sectionLabel")}</SectionLabel>
          <p className="text-sm text-muted-foreground">{t("settings.emailNotifications.sectionDescription", { tz: tz.replace(/_/g, " ") })}</p>
        </div>

        {isPending || !data ? (
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.items.map((item) => {
              const Icon = ICONS[item.key];
              const titleId = `digest-${item.key}`;
              return (
                <li key={item.key} className="flex gap-4 p-4 sm:p-5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      item.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p id={titleId} className="text-sm font-semibold text-foreground">
                          {t(`onb.notif.kinds.${item.key}.title`)}
                          {item.enabled && item.muted_by_me ? (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 align-middle text-[11px] font-medium text-muted-foreground">
                              <BellOff className="size-3" aria-hidden />
                              {t("settings.emailNotifications.mutedBadge")}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">{t(`onb.notif.kinds.${item.key}.desc`)}</p>
                      </div>
                      <Switch
                        checked={item.enabled}
                        disabled={!canEdit || save.isPending}
                        onCheckedChange={(v) => toggle(item.key, v)}
                        aria-labelledby={titleId}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                      <button
                        type="button"
                        onClick={() => test(item.key)}
                        disabled={testing !== null}
                        className="inline-flex min-h-8 items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {testing === item.key ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                        {t("settings.emailNotifications.test")}
                      </button>
                      {item.enabled ? (
                        <button
                          type="button"
                          onClick={() => mute.mutate({ k: item.key, muted: !item.muted_by_me })}
                          disabled={mute.isPending}
                          className="inline-flex min-h-8 items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                        >
                          {item.muted_by_me ? <Bell className="size-3.5" aria-hidden /> : <BellOff className="size-3.5" aria-hidden />}
                          {item.muted_by_me ? t("settings.emailNotifications.unmuteForMe") : t("settings.emailNotifications.muteForMe")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!isPending && !canEdit ? <p className="text-xs text-muted-foreground">{t("settings.emailNotifications.adminOnly")}</p> : null}
      </section>

      {data ? (
        <section className="space-y-4">
          <div className="space-y-0.5">
            <SectionLabel>{t("settings.emailNotifications.whoLabel")}</SectionLabel>
            <p className="text-sm text-muted-foreground">{t("settings.emailNotifications.whoDescription")}</p>
          </div>
          <div role="radiogroup" aria-label={t("settings.emailNotifications.whoLabel")} className="inline-flex rounded-xl border border-border bg-card p-1">
            {(["all_members", "selected"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={audience === a}
                disabled={!canEdit || save.isPending}
                onClick={() => {
                  if (a === audience) return;
                  const everyoneActive = data.members.filter((m) => m.active).map((m) => m.user_id);
                  applyAudience(a, a === "selected" ? (everyoneActive.length ? everyoneActive : data.members.map((m) => m.user_id)) : []);
                }}
                className={cn(
                  "min-h-9 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                  audience === a ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a === "all_members" ? t("settings.emailNotifications.everyone") : t("settings.emailNotifications.pick")}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.members.map((m) => {
              const checked = audience === "all_members" || selected.has(m.user_id);
              const id = `member-${m.user_id}`;
              return (
                <li key={m.user_id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  {audience === "selected" ? (
                    <Checkbox id={id} checked={checked} disabled={!canEdit || save.isPending} onCheckedChange={() => togglePerson(m.user_id)} />
                  ) : null}
                  <label htmlFor={audience === "selected" ? id : undefined} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {m.name ?? m.email}
                      {m.user_id === user?.id ? <span className="ml-1.5 font-normal text-muted-foreground">({t("settings.emailNotifications.you")})</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.name ? m.email : null}
                      {m.name && !m.active ? " · " : null}
                      {!m.active ? t("settings.emailNotifications.neverSignedIn") : null}
                    </span>
                  </label>
                  <span className="shrink-0 text-xs text-muted-foreground">{t(`settings.members.roles.${m.role}`, { defaultValue: m.role })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.emailNotifications.instantTitle")}</SectionLabel>
          <p className="text-sm text-muted-foreground">{t("settings.emailNotifications.instantDescription")}</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid gap-5 px-5 py-4 md:grid-cols-2 md:gap-8">
            <AlertItemList label={t("settings.emailNotifications.instantAlertsGroup")} items={SWITCH_ITEMS} />
            <AlertItemList label={t("settings.emailNotifications.instantAlwaysGroup")} items={ALWAYS_ITEMS} muted />
          </div>
          <Link
            to="/settings/team"
            prefetch="intent"
            className="press group flex min-h-12 items-center gap-3 border-t border-border px-5 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <span className="min-w-0 flex-1">{t("settings.emailNotifications.instantManage")}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
