import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Save, Eye, Code, Mail, Paperclip, Info, Activity } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { formatDateLong, formatTime, formatDateShort } from "~/lib/utils/format";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  getAppointmentsFallbackConfig,
  updateAppointmentsFallbackConfig,
  getEmailAnalytics,
  type LeadFallbackConfig,
  type EmailAnalyticsPeriod,
} from "~/lib/api/workspaces";
import { getLeads } from "~/lib/api/leads";
import { type AppointmentConfig } from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";

const FORM_KEY = "appointment_booking";

const DEFAULT_SUBJECT = "Terminbest\u00e4tigung \u2014 {{company_name}}";

const DEFAULT_HTML = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f7f7f7;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;border-collapse:separate;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

<!-- Accent -->
<tr><td style="height:4px;background-color:#000000;">&nbsp;</td></tr>

<!-- Body -->
<tr><td style="padding:40px 36px 12px;">
<h1 style="margin:0 0 8px;font-family:'DM Sans',sans-serif;font-size:24px;font-weight:700;color:#000;">Terminbest\u00e4tigung</h1>
<p style="margin:0 0 28px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:22px;color:#666;">
Vielen Dank f\u00fcr Ihre Buchung bei <strong style="color:#000;">{{company_name}}</strong>. Hier sind Ihre Termindetails:
</p>
</td></tr>

<!-- Details -->
<tr><td style="padding:0 36px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#fafafa;border:1px solid #eee;border-radius:8px;">
<tr>
<td style="padding:14px 18px 6px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Datum</td>
<td style="padding:14px 18px 6px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#000;text-align:right;">{{appointment_date}}</td>
</tr>
<tr>
<td style="padding:6px 18px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Uhrzeit</td>
<td style="padding:6px 18px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#000;text-align:right;">{{appointment_time}}</td>
</tr>
<tr>
<td style="padding:6px 18px 14px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Leistung</td>
<td style="padding:6px 18px 14px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#000;text-align:right;">{{service_name}}</td>
</tr>
</table>
</td></tr>

<!-- ICS hint -->
<tr><td style="padding:0 36px 36px;">
<p style="margin:0;font-family:'DM Sans',sans-serif;font-size:12px;line-height:18px;color:#999;font-style:italic;">
Eine Kalendereinladung (.ics) ist dieser E-Mail beigef\u00fcgt.
</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:18px 36px;background-color:#fafafa;border-top:1px solid #eee;">
<p style="margin:0;font-family:'DM Sans',sans-serif;font-size:11px;color:#bbb;text-align:center;">
{{company_name}}
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

const DUMMY_VARIABLES: Record<string, string> = {
  customer_name: "Max Mustermann",
  customer_email: "max@example.com",
  customer_phone: "+49 170 1234567",
  appointment_date: "Montag, 31. M\u00e4rz 2026",
  appointment_time: "10:00 \u2013 10:30",
  service_name: "Beratung",
  provider_name: "Dr. Schmidt",
  company_name: "Beispiel GmbH",
  notes: "Bitte Unterlagen mitbringen",
};

const VARIABLE_DEFS = [
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Email" },
  { key: "customer_phone", label: "Phone" },
  { key: "appointment_date", label: "Date" },
  { key: "appointment_time", label: "Time" },
  { key: "service_name", label: "Service" },
  { key: "provider_name", label: "Provider" },
  { key: "company_name", label: "Company" },
  { key: "notes", label: "Notes" },
];

interface CustomerEmailTabProps {
  config: AppointmentConfig;
}

export function CustomerEmailTab({ config }: CustomerEmailTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number | null>(null);

  // Fetch fallback config
  const { data: fallbackConfig, isLoading } = useQuery({
    queryKey: ["appointments-fallback-config"],
    queryFn: getAppointmentsFallbackConfig,
  });

  // Fetch last appointment booking lead for preview variables
  const { data: lastLeadData } = useQuery({
    queryKey: ["leads", "appointment_booking", "latest"],
    queryFn: () => getLeads({ form_name: "appointment_booking", limit: 1 }),
  });

  const lastLead = lastLeadData?.data?.[0] ?? null;
  const hasRealData = !!lastLead;

  // Build preview variables from real data or dummy
  const previewVars: Record<string, string> = hasRealData
    ? {
        customer_name: lastLead.full_name || [lastLead.first_name, lastLead.last_name].filter(Boolean).join(" ") || DUMMY_VARIABLES.customer_name,
        customer_email: lastLead.email || DUMMY_VARIABLES.customer_email,
        customer_phone: lastLead.phone || DUMMY_VARIABLES.customer_phone,
        appointment_date: (lastLead.metadata?.start
          ? formatDateLong(lastLead.metadata.start as string)
          : DUMMY_VARIABLES.appointment_date),
        appointment_time: (lastLead.metadata?.start && lastLead.metadata?.end
          ? `${formatTime(lastLead.metadata.start as string)} \u2013 ${formatTime(lastLead.metadata.end as string)}`
          : DUMMY_VARIABLES.appointment_time),
        service_name: (lastLead.metadata?.service_name as string) || DUMMY_VARIABLES.service_name,
        provider_name: config.provider_name || DUMMY_VARIABLES.provider_name,
        company_name: config.company_name || DUMMY_VARIABLES.company_name,
        notes: (lastLead.metadata?.notes as string) || DUMMY_VARIABLES.notes,
      }
    : {
        ...DUMMY_VARIABLES,
        company_name: config.company_name || DUMMY_VARIABLES.company_name,
        provider_name: config.provider_name || DUMMY_VARIABLES.provider_name,
      };

  const [enabled, setEnabled] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [view, setView] = useState<"code" | "preview">("preview");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (fallbackConfig) {
      const cfg = fallbackConfig[FORM_KEY];
      if (cfg) {
        setEnabled(cfg.enabled);
        setSubject(cfg.subject || DEFAULT_SUBJECT);
        setHtml(cfg.html || DEFAULT_HTML);
      } else {
        setEnabled(false);
        setSubject(DEFAULT_SUBJECT);
        setHtml(DEFAULT_HTML);
      }
      setDirty(false);
    }
  }, [fallbackConfig]);

  // Track cursor position in textarea
  const handleTextareaSelect = () => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }
  };

  const mutation = useMutation({
    mutationFn: (updated: LeadFallbackConfig) =>
      updateAppointmentsFallbackConfig(updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-fallback-config"] });
      setDirty(false);
      toast.success(t("appointments.customerEmail.saved", "Saved"));
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err));
    },
  });

  const save = useCallback(
    (overrides?: { enabled?: boolean; subject?: string; html?: string }) => {
      const merged = {
        ...fallbackConfig,
        [FORM_KEY]: {
          enabled: overrides?.enabled ?? enabled,
          subject: overrides?.subject ?? subject,
          html: overrides?.html ?? html,
        },
      };
      mutation.mutate(merged);
    },
    [fallbackConfig, enabled, subject, html, mutation],
  );

  const handleToggle = useCallback(
    (val: boolean) => {
      setEnabled(val);
      save({ enabled: val });
    },
    [save],
  );

  const handleSave = () => save();

  const insertVariable = (key: string) => {
    const tag = `{{${key}}}`;
    const pos = cursorPosRef.current;

    if (pos !== null && pos >= 0 && pos <= html.length) {
      // Insert at cursor position
      const before = html.slice(0, pos);
      const after = html.slice(pos);
      const newHtml = before + tag + after;
      setHtml(newHtml);
      setDirty(true);

      // Restore cursor after the inserted tag and scroll to it
      const newPos = pos + tag.length;
      cursorPosRef.current = newPos;
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(newPos, newPos);

        // Scroll textarea so the cursor line is visible
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
        const textBefore = newHtml.slice(0, newPos);
        const lineNumber = textBefore.split("\n").length;
        const targetScroll = lineNumber * lineHeight - ta.clientHeight / 2;
        ta.scrollTop = Math.max(0, targetScroll);
      });
    } else {
      // No cursor set — append to end and scroll down
      setHtml((prev) => prev + tag);
      setDirty(true);
      cursorPosRef.current = html.length + tag.length;
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          const endPos = textareaRef.current.value.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(endPos, endPos);
        }
      });
    }
  };

  const replacePreview = (src: string) => {
    let out = src;
    for (const [key, value] of Object.entries(previewVars)) {
      out = out.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"),
        value,
      );
    }
    return out;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("appointments.customerEmail.title", "Customer Confirmation Email")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "appointments.customerEmail.description",
                "Sent to customers after booking via your own email service",
              )}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {/* ICS info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-200">
          <Paperclip className="h-3 w-3 text-neutral-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-700">
            {t("appointments.customerEmail.icsInfo", "Calendar invite (.ics) is automatically attached")}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {t(
              "appointments.customerEmail.icsInfoDetail",
              "Every confirmation email includes an .ics file so the customer can add the appointment to their calendar. This cannot be disabled.",
            )}
          </p>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("appointments.customerEmail.subject", "Subject")}
        </Label>
        <Input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setDirty(true);
          }}
          placeholder="Terminbest\u00e4tigung \u2014 {{company_name}}"
          className="h-10 font-mono text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          {t("appointments.customerEmail.subjectHint", "You can use {{variables}} in the subject line too.")}
        </p>
      </div>

      {/* Variable chips */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("appointments.customerEmail.variables", "Available Variables")}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_DEFS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              disabled={view === "preview"}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-mono text-neutral-700 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            >
              <span className="opacity-50">{"{{"}</span>
              {v.key}
              <span className="opacity-50">{"}}"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor / Preview toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appointments.customerEmail.body", "Email Body (HTML)")}
          </Label>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setView("code")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                view === "code"
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code className="h-3 w-3" />
              Code
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                view === "preview"
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>

        {view === "code" ? (
          <textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setDirty(true);
              cursorPosRef.current = e.target.selectionStart;
            }}
            onSelect={handleTextareaSelect}
            onClick={handleTextareaSelect}
            onKeyUp={handleTextareaSelect}
            rows={18}
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            placeholder="<html>...</html>"
          />
        ) : (
          <div className="space-y-2">
            {/* Preview data source info */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              {hasRealData
                ? t(
                    "appointments.customerEmail.previewReal",
                    "Preview uses data from the last appointment booking.",
                  )
                : t(
                    "appointments.customerEmail.previewDummy",
                    "No bookings yet \u2014 preview uses sample data. Once a customer books, their details will appear here.",
                  )}
            </div>
            <div className="rounded-xl border border-border bg-white p-1">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{replacePreview(subject)}</span>
              </div>
              <iframe
                key={html + subject}
                srcDoc={replacePreview(html)}
                title="Email Preview"
                className="h-[400px] w-full rounded-b-lg"
                sandbox=""
              />
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-[11px] text-muted-foreground">
          {dirty
            ? t("appointments.customerEmail.unsaved", "You have unsaved changes")
            : t("appointments.customerEmail.allSaved", "All changes saved")}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || mutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {t("appointments.customerEmail.save", "Save")}
        </button>
      </div>

      {/* Activity Logs */}
      <EmailActivityChart />
    </div>
  );
}

/* ── Activity Logs Chart ─────────────────────────────────────────── */

const PERIODS: { key: EmailAnalyticsPeriod; labelKey: string }[] = [
  { key: "1d", labelKey: "appointments.customerEmail.period1d" },
  { key: "7d", labelKey: "appointments.customerEmail.period7d" },
  { key: "30d", labelKey: "appointments.customerEmail.period30d" },
  { key: "all_time", labelKey: "appointments.customerEmail.periodAll" },
];

function fillEmailSeriesGaps(
  series: { date: string; success: number; error: number }[],
  period: EmailAnalyticsPeriod
): { date: string; success: number; error: number }[] {
  const now = new Date();
  const map = new Map(series.map((p) => [p.date, p]));
  const slots: string[] = [];

  if (period === "1d") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(today);
      d.setHours(h);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`
      );
    }
  } else if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  } else if (period === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  } else {
    if (series.length === 0) return [];
    const start = new Date(series[0].date + "T00:00:00");
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  }

  return slots.map((key) => {
    const found = map.get(key);
    return found ?? { date: key, success: 0, error: 0 };
  });
}

function EmailActivityChart() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<EmailAnalyticsPeriod>("7d");

  const { data } = useQuery({
    queryKey: ["email-analytics", period],
    queryFn: () => getEmailAnalytics(period),
  });

  const series = useMemo(
    () => fillEmailSeriesGaps(data?.series ?? [], period),
    [data?.series, period]
  );
  const totalSuccess = data?.total_success ?? 0;
  const totalError = data?.total_error ?? 0;
  const total = totalSuccess + totalError;
  const maxY = Math.max(...series.map((d) => d.success + d.error), 1);

  const formatTick = (val: string) => {
    if (period === "1d") {
      return val.split("T")[1]?.slice(0, 5) ?? val;
    }
    const d = new Date(val);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100">
            <Activity className="h-4 w-4 text-neutral-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("appointments.customerEmail.activityTitle", "Email Activity")}
            </p>
            <p className="text-xs text-muted-foreground">
              {total > 0
                ? t("appointments.customerEmail.activityCount", "{{count}} emails sent", { count: total })
                : t("appointments.customerEmail.activityNone", "No emails sent yet")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5 overflow-x-auto scrollbar-hide">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium whitespace-nowrap shrink-0 transition-all ${
                period === p.key
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats badges */}
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">
              {t("appointments.customerEmail.sent", "Sent")}
            </span>
            <span className="font-semibold text-foreground">{totalSuccess}</span>
          </div>
          {totalError > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">
                {t("appointments.customerEmail.failed", "Failed")}
              </span>
              <span className="font-semibold text-foreground">{totalError}</span>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {series.length > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border, #e5e5e5)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                tick={{ fontSize: 10, fill: "#999" }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(series.length / 8) - 1)}
              />
              <YAxis
                domain={[0, maxY + Math.ceil(maxY * 0.2)]}
                tick={{ fontSize: 10, fill: "#999" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                  padding: "8px 12px",
                }}
                labelFormatter={(label: string) =>
                  period === "1d"
                    ? label.split("T")[1]?.slice(0, 5) ?? label
                    : formatDateShort(label)
                }
                formatter={(value: number, name: string) => [
                  value,
                  name === "success"
                    ? t("appointments.customerEmail.sent", "Sent")
                    : t("appointments.customerEmail.failed", "Failed"),
                ]}
              />
              <Line
                type="monotone"
                dataKey="success"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", stroke: "var(--card)", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="error"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {t("appointments.customerEmail.noData", "No data for this period")}
          </p>
        </div>
      )}
    </div>
  );
}
