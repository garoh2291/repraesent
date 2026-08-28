import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  LayoutTemplate,
  Mail,
  Send,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { SegmentCountBadge } from "~/components/email-campaigns/segments/SegmentCountBadge";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { listEmailAccountsForWorkspace } from "~/lib/api/email-accounts";
import {
  createCampaign,
  scheduleCampaign,
  updateCampaign,
} from "~/lib/api/email-campaigns";
import { listEmailTemplates } from "~/lib/api/email-templates";
import { listSegments } from "~/lib/api/segments";
import { getWorkflowCapabilities } from "~/lib/api/workflows";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatInTimeZone } from "date-fns-tz";
import {
  browserTimeZone,
  resolveScheduledInstant,
  ScheduleFields,
} from "~/components/email-campaigns/ScheduleFields";

/**
 * Four steps — audience, template, settings, review — with an explicit step
 * indicator (never an unmarked multi-page form). The campaign row is only
 * created at the end, so abandoning the wizard leaves nothing behind.
 */

const STEPS = ["audience", "template", "settings", "review"] as const;
type Step = (typeof STEPS)[number];

/** Conservative provider floor for the review-step duration estimate. */
const ESTIMATE_PER_HOUR = 100;

export default function CampaignNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentMeta({
    titleKey: "emailCampaigns.wizard.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const [step, setStep] = useState<Step>("audience");
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>("default");
  const [replyTo, setReplyTo] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  // Kept as three fields rather than one datetime string: the zone is a real
  // choice here, not whatever the author's laptop is set to, and the absolute
  // instant is derived from all three at submit.
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleZone, setScheduleZone] = useState(browserTimeZone());

  const scheduledInstant = resolveScheduledInstant(
    scheduleDate,
    scheduleTime,
    scheduleZone,
  );

  const { data: segments } = useQuery({
    queryKey: ["segments"],
    queryFn: listSegments,
  });
  const { data: templates } = useQuery({
    queryKey: ["email-templates", ""],
    queryFn: () => listEmailTemplates({ page: 1, limit: 100 }),
  });
  const { data: accounts } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
  });
  const { data: capability } = useQuery({
    queryKey: ["workflow-capabilities"],
    queryFn: getWorkflowCapabilities,
  });

  const segment = segments?.find((entry) => entry.id === segmentId) ?? null;
  const template =
    templates?.data.find((entry) => entry.id === templateId) ?? null;

  const publishedTemplates = useMemo(
    () => (templates?.data ?? []).filter((entry) => entry.current_version > 0),
    [templates],
  );

  const stepIndex = STEPS.indexOf(step);
  const canNext =
    step === "audience"
      ? !!segmentId && name.trim() !== ""
      : step === "template"
        ? !!templateId
        : true;

  const finish = useMutation({
    mutationFn: async (schedule: boolean) => {
      const campaign = await createCampaign({
        name: name.trim(),
        segment_id: segmentId!,
        template_id: templateId!,
        email_account_id: accountId === "default" ? undefined : accountId,
      });
      if (replyTo.trim()) {
        await updateCampaign(campaign.id, { reply_to: replyTo.trim() });
      }
      if (schedule) {
        await scheduleCampaign(
          campaign.id,
          when === "later" && scheduledInstant
            ? scheduledInstant.toISOString()
            : null,
          // Sent even for "now": the send window and the schedule readout both
          // work in it, and the author's zone is the honest default.
          scheduleZone,
        );
      }
      return campaign;
    },
    onSuccess: (campaign) => navigate(`/campaigns/${campaign.id}`),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const sendable = segment?.sendable_count ?? null;
  const estimatedHours =
    sendable !== null
      ? Math.max(1, Math.ceil(sendable / ESTIMATE_PER_HOUR))
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 py-10! sm:p-6 app-fade-in">
      <div className="app-fade-up flex items-center gap-3">
        <Link
          to="/campaigns"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          aria-label={t("common.back", { defaultValue: "Back" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t("emailCampaigns.wizard.title", { defaultValue: "New campaign" })}
        </h1>
      </div>

      {/* Step indicator — always visible, always says where you are. */}
      <ol className="app-fade-up app-fade-up-d1 flex flex-wrap items-center gap-2">
        {STEPS.map((key, index) => (
          <li key={key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => index < stepIndex && setStep(key)}
              disabled={index > stepIndex}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                index === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : index < stepIndex
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index < stepIndex ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{index + 1}</span>
              )}
              {t(`emailCampaigns.wizard.step_${key}`, {
                defaultValue: key,
              })}
            </button>
            {index < STEPS.length - 1 ? (
              <span className="h-px w-4 bg-border" />
            ) : null}
          </li>
        ))}
      </ol>

      {capability && !capability.available ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {t("emailCampaigns.wizard.noMailbox", {
            defaultValue:
              "No sending mailbox connected — connect one under Settings → Email accounts before scheduling.",
          })}
        </p>
      ) : null}

      {step === "audience" ? (
        <Panel>
          <PanelHeader
            icon={<UsersRound className="h-3.5 w-3.5" />}
            title={t("emailCampaigns.wizard.step_audience", {
              defaultValue: "Audience",
            })}
          />
          <PanelBody>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("emailCampaigns.wizard.campaignName", {
                  defaultValue: "Campaign name",
                })}
              </Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("emailCampaigns.wizard.namePlaceholder", {
                  defaultValue: "September newsletter",
                })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                {t("emailCampaigns.wizard.pickSegment", {
                  defaultValue: "Who receives it?",
                })}
              </Label>
              {(segments?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("emailCampaigns.wizard.noSegments", {
                    defaultValue: "No segments yet —",
                  })}{" "}
                  <Link to="/segments" className="text-primary hover:underline">
                    {t("emailCampaigns.wizard.createSegment", {
                      defaultValue: "create one first",
                    })}
                  </Link>
                </p>
              ) : (
                <div className="space-y-1.5">
                  {segments!.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSegmentId(entry.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        segmentId === entry.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {entry.name}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t(`emailCampaigns.segments.kind_${entry.kind}`, {
                            defaultValue: entry.kind,
                          })}
                        </span>
                      </span>
                      <SegmentCountBadge
                        matched={entry.matched_count}
                        sendable={entry.sendable_count}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {step === "template" ? (
        <Panel>
          <PanelHeader
            icon={<LayoutTemplate className="h-3.5 w-3.5" />}
            title={t("emailCampaigns.wizard.step_template", {
              defaultValue: "Template",
            })}
          />
          <PanelBody>
            {publishedTemplates.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("emailCampaigns.wizard.noTemplates", {
                  defaultValue: "No published templates —",
                })}{" "}
                <Link
                  to="/email-templates"
                  className="text-primary hover:underline"
                >
                  {t("emailCampaigns.wizard.createTemplate", {
                    defaultValue: "build and publish one first",
                  })}
                </Link>
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {publishedTemplates.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setTemplateId(entry.id)}
                    className={`space-y-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      templateId === entry.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {entry.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        v{entry.current_version}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      {entry.complete_locales.map((locale) => (
                        <span
                          key={locale}
                          className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
                        >
                          {locale}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("emailCampaigns.wizard.templateHint", {
                defaultValue:
                  "Only published templates can be sent. The version you schedule is frozen — later edits never change a scheduled campaign.",
              })}
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      {step === "settings" ? (
        <Panel>
          <PanelHeader
            icon={<Mail className="h-3.5 w-3.5" />}
            title={t("emailCampaigns.wizard.step_settings", {
              defaultValue: "Settings",
            })}
          />
          <PanelBody>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("emailCampaigns.wizard.fromMailbox", {
                  defaultValue: "Send from",
                })}
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {t("emailCampaigns.wizard.defaultAccount", {
                      defaultValue: "Workspace default",
                    })}
                  </SelectItem>
                  {(accounts ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("emailCampaigns.wizard.replyTo", {
                  defaultValue: "Reply-to (optional)",
                })}
              </Label>
              <Input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="replies@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                {t("emailCampaigns.wizard.whenTitle", {
                  defaultValue: "When?",
                })}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWhen("now")}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    when === "now"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {t("emailCampaigns.wizard.sendNow", {
                    defaultValue: "Send now",
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setWhen("later")}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    when === "later"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {t("emailCampaigns.wizard.schedule", {
                    defaultValue: "Schedule",
                  })}
                </button>
              </div>
              {when === "later" ? (
                <ScheduleFields
                  date={scheduleDate}
                  time={scheduleTime}
                  timeZone={scheduleZone}
                  onChange={(patch) => {
                    if (patch.date !== undefined) setScheduleDate(patch.date);
                    if (patch.time !== undefined) setScheduleTime(patch.time);
                    if (patch.timeZone !== undefined)
                      setScheduleZone(patch.timeZone);
                  }}
                />
              ) : null}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {step === "review" ? (
        <Panel>
          <PanelHeader
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            title={t("emailCampaigns.wizard.step_review", {
              defaultValue: "Review",
            })}
          />
          <PanelBody>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <ReviewRow
                label={t("emailCampaigns.wizard.campaignName", {
                  defaultValue: "Campaign name",
                })}
                value={name}
              />
              <ReviewRow
                label={t("emailCampaigns.wizard.step_audience", {
                  defaultValue: "Audience",
                })}
                value={
                  segment ? (
                    <span className="flex items-center gap-2">
                      {segment.name}
                      <SegmentCountBadge
                        matched={segment.matched_count}
                        sendable={segment.sendable_count}
                      />
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <ReviewRow
                label={t("emailCampaigns.wizard.step_template", {
                  defaultValue: "Template",
                })}
                value={
                  template
                    ? `${template.name} · v${template.current_version}`
                    : "—"
                }
              />
              <ReviewRow
                label={t("emailCampaigns.wizard.fromMailbox", {
                  defaultValue: "Send from",
                })}
                value={
                  accountId === "default"
                    ? t("emailCampaigns.wizard.defaultAccount", {
                        defaultValue: "Workspace default",
                      })
                    : (accounts?.find((account) => account.id === accountId)
                        ?.email ?? "—")
                }
              />
              <ReviewRow
                label={t("emailCampaigns.wizard.whenTitle", {
                  defaultValue: "When?",
                })}
                value={
                  when === "now"
                    ? t("emailCampaigns.wizard.sendNow", {
                        defaultValue: "Send now",
                      })
                    : scheduledInstant
                      ? // Shown in the zone it was scheduled for, not the
                        // reviewer's — that is the decision being confirmed.
                        `${formatInTimeZone(scheduledInstant, scheduleZone, "EEEE d MMMM yyyy, HH:mm")} (${scheduleZone})`
                      : "—"
                }
              />
              {estimatedHours !== null ? (
                <ReviewRow
                  label={t("emailCampaigns.wizard.estimatedDuration", {
                    defaultValue: "Estimated duration",
                  })}
                  value={t("emailCampaigns.wizard.estimatedHours", {
                    defaultValue: "~{{count}} hour(s) at safe sending speed",
                    count: estimatedHours,
                  })}
                />
              ) : null}
            </dl>
            {sendable !== null && sendable > 400 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {t("emailCampaigns.wizard.dailyCapWarning", {
                  defaultValue:
                    "This audience is larger than a mailbox's safe daily volume — sending will stretch over more than one day.",
                })}
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() =>
            stepIndex === 0
              ? navigate("/campaigns")
              : setStep(STEPS[stepIndex - 1])
          }
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t("common.back", { defaultValue: "Back" })}
        </Button>
        <div className="flex items-center gap-2">
          {step === "review" ? (
            <>
              <Button
                variant="outline"
                onClick={() => finish.mutate(false)}
                disabled={finish.isPending}
              >
                {t("emailCampaigns.wizard.saveDraft", {
                  defaultValue: "Save as draft",
                })}
              </Button>
              <Button
                onClick={() => finish.mutate(true)}
                disabled={
                  finish.isPending ||
                  // Incomplete, or a time already gone — the server would
                  // reject the second one, so do not offer it.
                  (when === "later" &&
                    (!scheduledInstant ||
                      scheduledInstant.getTime() <= Date.now()))
                }
              >
                <Send className="mr-1.5 h-4 w-4" />
                {finish.isPending
                  ? t("emailCampaigns.wizard.scheduling", {
                      defaultValue: "Scheduling…",
                    })
                  : when === "now"
                    ? t("emailCampaigns.wizard.confirmSendNow", {
                        defaultValue: "Send now",
                      })
                    : t("emailCampaigns.wizard.confirmSchedule", {
                        defaultValue: "Schedule",
                      })}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={!canNext}
            >
              {t("common.next", { defaultValue: "Next" })}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
