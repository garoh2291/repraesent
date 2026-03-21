import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  getLeadFallbackConfig,
  updateLeadFallbackConfig,
  type LeadFallbackSourceConfig,
} from "~/lib/api/workspaces";
import {
  ArrowLeft,
  Mail,
  Globe,
  CalendarDays,
  Eye,
  Code2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Lead Fallback — Repraesent" },
    { name: "description", content: "Configure lead fallback emails" },
  ];
}

type SourceType = "urls" | "appointment_booking";

const SOURCE_TYPES: Array<{
  key: SourceType;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
}> = [
  {
    key: "urls",
    labelKey: "leadFallback.sources.urls.label",
    descKey: "leadFallback.sources.urls.desc",
    icon: Globe,
  },
  {
    key: "appointment_booking",
    labelKey: "leadFallback.sources.appointment_booking.label",
    descKey: "leadFallback.sources.appointment_booking.desc",
    icon: CalendarDays,
  },
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 40px 32px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; }
    .body { padding: 40px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #444; }
    .cta { display: inline-block; margin-top: 8px; background: #1a1a2e; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
    .footer { padding: 24px 40px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Thank you for reaching out!</h1>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>We have received your inquiry and our team will get back to you as soon as possible.</p>
      <p>In the meantime, feel free to explore our website or contact us directly.</p>
    </div>
    <div class="footer">
      You are receiving this email because you submitted a form on our website.
    </div>
  </div>
</body>
</html>`;

// ─── Source Config Card ───────────────────────────────────────────────────────

interface SourceCardProps {
  sourceKey: SourceType;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
  initial: LeadFallbackSourceConfig | undefined;
  onSave: (key: SourceType, cfg: LeadFallbackSourceConfig) => Promise<void>;
  isSaving: boolean;
  saveSuccess: boolean;
}

function SourceCard({
  sourceKey,
  labelKey,
  descKey,
  icon: Icon,
  initial,
  onSave,
  isSaving,
  saveSuccess,
}: SourceCardProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [html, setHtml] = useState(initial?.html ?? DEFAULT_HTML);
  const [previewMode, setPreviewMode] = useState<"code" | "preview">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync iframe content when html or preview mode changes
  useEffect(() => {
    if (previewMode !== "preview" || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html || "<p style='color:#aaa;font-family:sans-serif;padding:24px'>No HTML yet</p>");
      doc.close();
    }
  }, [html, previewMode]);

  const isDirty =
    enabled !== (initial?.enabled ?? false) ||
    subject !== (initial?.subject ?? "") ||
    html !== (initial?.html ?? DEFAULT_HTML);

  const handleSave = () => {
    onSave(sourceKey, { enabled, subject, html });
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 p-6 border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-[15px]">
              {t(labelKey)}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{t(descKey)}</p>
          </div>
        </div>
        {/* Enable toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Label
            htmlFor={`toggle-${sourceKey}`}
            className={cn(
              "text-xs font-medium select-none",
              enabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {enabled ? t("leadFallback.enabled") : t("leadFallback.disabled")}
          </Label>
          <Switch
            id={`toggle-${sourceKey}`}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Subject */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("leadFallback.subjectLine")}
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("leadFallback.subjectPlaceholder")}
            className="h-9 text-sm"
          />
        </div>

        {/* HTML Editor + Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("leadFallback.emailContent")}
            </Label>
            {/* Toggle code / preview */}
            <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewMode("code")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  previewMode === "code"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="h-3 w-3" />
                HTML
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  previewMode === "preview"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-3 w-3" />
                {t("leadFallback.preview")}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden" style={{ height: 420 }}>
            {previewMode === "code" ? (
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="w-full h-full resize-none bg-[#0f1117] text-[#e2e8f0] font-mono text-xs p-4 outline-none leading-relaxed"
                placeholder="Paste your HTML email here..."
              />
            ) : (
              <iframe
                ref={iframeRef}
                title={`preview-${sourceKey}`}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-same-origin"
              />
            )}
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{t("leadFallback.htmlHint")}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("leadFallback.saved")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="h-8 px-4 text-xs gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              t("common.saveChanges")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadFallbackPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Gate: needs lead-form and email-config services
  const hasLeadForm =
    currentWorkspace?.services?.some((s) => s.service_type === "lead-form") ?? false;
  const hasEmailConfig =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "email-config" || s.service_slug === "email-config"
    ) ?? false;

  useEffect(() => {
    if (currentWorkspace && (!hasLeadForm || !hasEmailConfig)) {
      navigate("/lead-form", { replace: true });
    }
  }, [currentWorkspace, hasLeadForm, hasEmailConfig, navigate]);

  const { data: config, isLoading } = useQuery({
    queryKey: ["lead-fallback-config"],
    queryFn: getLeadFallbackConfig,
    enabled: !!currentWorkspace && hasLeadForm && hasEmailConfig,
  });

  // Per-source save state
  const [savingKey, setSavingKey] = useState<SourceType | null>(null);
  const [successKey, setSuccessKey] = useState<SourceType | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      key,
      cfg,
    }: {
      key: SourceType;
      cfg: LeadFallbackSourceConfig;
    }) => {
      const existing = config ?? {};
      const updated = { ...existing, [key]: cfg };
      await updateLeadFallbackConfig(updated);
      return { key };
    },
    onSuccess: ({ key }) => {
      queryClient.invalidateQueries({ queryKey: ["lead-fallback-config"] });
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 3000);
    },
    onSettled: () => setSavingKey(null),
  });

  const handleSave = useCallback(
    async (key: SourceType, cfg: LeadFallbackSourceConfig) => {
      setSavingKey(key);
      mutation.mutate({ key, cfg });
    },
    [mutation]
  );

  if (!currentWorkspace) return null;

  return (
    <div className="app-fade-in p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="app-fade-up space-y-1">
        <button
          type="button"
          onClick={() => navigate("/lead-form")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("leadFallback.backToLeads")}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                {t("leadFallback.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("leadFallback.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Info banner */}
      <div className="app-fade-up app-fade-up-d1 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <span>{t("leadFallback.infoBanner")}</span>
      </div>

      {/* Source cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {SOURCE_TYPES.map((src) => (
            <div key={src.key} className="app-fade-up app-fade-up-d2">
              <SourceCard
                sourceKey={src.key}
                labelKey={src.labelKey}
                descKey={src.descKey}
                icon={src.icon}
                initial={config?.[src.key]}
                onSave={handleSave}
                isSaving={savingKey === src.key}
                saveSuccess={successKey === src.key}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
