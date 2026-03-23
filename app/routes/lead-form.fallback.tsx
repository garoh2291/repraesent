import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import axios from "axios";
import {
  getLeadFallbackConfig,
  updateLeadFallbackConfig,
  getServiceConfig,
  type LeadFallbackConfig,
  type LeadFallbackSourceConfig,
} from "~/lib/api/workspaces";
import {
  Mail,
  Eye,
  Code2,
  CheckCircle2,
  Loader2,
  Info,
  Play,
  AlertTriangle,
  Save,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import { cn } from "~/lib/utils";
import TooltipContainer from "~/components/tooltip-container";
import { EmailTabs } from "~/components/email-tabs";

export function meta() {
  return [
    { title: "Confirmation Email — Repraesent" },
    {
      name: "description",
      content: "Configure confirmation emails for new leads",
    },
  ];
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg,#1a1a2e,#16213e); padding: 36px 40px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #fff; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 14px; font-size: 15px; line-height: 1.65; color: #444; }
    .footer { padding: 20px 40px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Thank you for reaching out!</h1></div>
    <div class="body">
      <p>Hi there,</p>
      <p>We have received your inquiry and will get back to you shortly.</p>
    </div>
    <div class="footer">You received this because you submitted a form on our website.</div>
  </div>
</body>
</html>`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEmpty(): LeadFallbackSourceConfig {
  return { enabled: false, subject: "", html: "" };
}

function makeDefault(): LeadFallbackSourceConfig {
  return { enabled: false, subject: "Thank You", html: DEFAULT_HTML };
}

function cfgOrEmpty(
  c: LeadFallbackSourceConfig | undefined
): LeadFallbackSourceConfig {
  return c ?? makeEmpty();
}

function formatFormName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toFormKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

// ─── Preview iframe ────────────────────────────────────────────────────────────

function HtmlPreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      html.trim() ||
        "<p style='color:#bbb;font-family:sans-serif;padding:32px;font-size:13px'>No HTML yet — switch to the editor and paste your template.</p>"
    );
    doc.close();
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="email-preview"
      className="w-full h-full border-0 bg-white"
      sandbox="allow-same-origin"
    />
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  enabled,
  label,
  onClick,
}: {
  active: boolean;
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-xl px-4 py-3.5 transition-all duration-150",
        "border",
        active
          ? "border-border bg-background shadow-sm"
          : "border-transparent hover:bg-muted/60"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[13px] font-semibold truncate",
                active
                  ? "text-foreground"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
              {enabled ? "Active" : "Off"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Editor panel (stateless, controlled) ────────────────────────────────────

interface EditorPanelProps {
  formKey: string;
  saved: LeadFallbackSourceConfig;
  local: LeadFallbackSourceConfig;
  onChange: (key: string, patch: Partial<LeadFallbackSourceConfig>) => void;
  onToggle: (key: string, enabled: boolean) => void;
  onSave: (key: string) => void;
  onDelete: (key: string) => void;
  isSaving: boolean;
  isTogglingOn: boolean;
  justSaved: boolean;
  fromEmail: string | null;
}

function EditorPanel({
  formKey,
  saved,
  local,
  onChange,
  onToggle,
  onSave,
  onDelete,
  isSaving,
  isTogglingOn,
  justSaved,
  fromEmail,
}: EditorPanelProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"preview" | "preview">("code");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canEnable = local.subject.trim() !== "" && local.html.trim() !== "";
  const isDirty = local.subject !== saved.subject || local.html !== saved.html;
  const canSave =
    isDirty && local.subject.trim() !== "" && local.html.trim() !== "";

  const displayName = formatFormName(formKey);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 pb-5 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {displayName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {formKey}
            </p>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center gap-2.5 shrink-0 sm:mt-0.5">
          {!canEnable && !local.enabled && (
            <span className="text-[11px] text-muted-foreground">
              {t("leadFallback.fillToEnable")}
            </span>
          )}
          {isTogglingOn && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={local.enabled}
            onCheckedChange={(v) => onToggle(formKey, v)}
            disabled={isTogglingOn || (!canEnable && !local.enabled)}
          />
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              local.enabled ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            {local.enabled
              ? t("leadFallback.enabled")
              : t("leadFallback.disabled")}
          </span>
        </div>
      </div>

      {/* Scrollable fields area */}
      <div className="flex flex-col gap-4 pt-5 overflow-y-auto flex-1 min-h-0">
        {/* Email composer header: From + Subject */}
        <div className="rounded-xl border border-border overflow-hidden shrink-0">
          {/* From — read-only */}
          <div className="flex items-center border-b border-border/60">
            <span className="shrink-0 w-[72px] px-3.5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest bg-muted/50 border-r border-border/60 select-none">
              {t("leadFallback.fromLabel")}
            </span>
            <div className="flex items-center gap-2 flex-1 px-3.5 py-2.5 bg-muted/20 min-w-0">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono text-foreground truncate">
                {fromEmail}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50 italic hidden sm:inline">
                {t("leadFallback.configuredInEmailSettings")}
              </span>
            </div>
          </div>

          {/* Subject — editable */}
          <div className="flex items-center">
            <span className="shrink-0 w-[72px] px-3.5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest bg-muted/50 border-r border-border/60 select-none">
              {t("leadFallback.subjectLabel")}
            </span>
            <input
              type="text"
              value={local.subject}
              onChange={(e) => onChange(formKey, { subject: e.target.value })}
              placeholder={t("leadFallback.subjectPlaceholder")}
              className="flex-1 px-3.5 py-2.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* HTML editor + preview */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {t("leadFallback.emailContent")}
            </label>
            <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              {(["code", "preview"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                    viewMode === m
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "code" ? (
                    <Code2 className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {m === "code" ? "HTML" : t("leadFallback.preview")}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden h-[260px] sm:h-[380px]">
            {viewMode === "code" ? (
              <textarea
                value={local.html}
                onChange={(e) => onChange(formKey, { html: e.target.value })}
                spellCheck={false}
                placeholder="Paste your full HTML email here…"
                className="w-full h-full resize-none bg-[#0d1117] text-[#c9d1d9] font-mono text-[12px] p-4 outline-none leading-relaxed"
              />
            ) : (
              <HtmlPreview html={local.html} />
            )}
          </div>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-px shrink-0" />
            {t("leadFallback.htmlHint")}
          </p>
        </div>

        {/* Validation warning */}
        {local.enabled && (!local.subject.trim() || !local.html.trim()) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0 text-amber-500" />
            {t("leadFallback.missingFields")}
          </div>
        )}
      </div>

      {/* Action bar — always visible, pinned outside scroll */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border shrink-0">
        <div className="flex items-center gap-3">
          {justSaved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("leadFallback.saved")}
            </span>
          )}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">
                {t("leadFallback.confirmDelete")}
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  onDelete(formKey);
                  setShowDeleteConfirm(false);
                }}
                className="h-7 px-3 text-xs"
              >
                {t("common.delete")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-7 px-3 text-xs"
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-red-600 gap-1"
            >
              <Trash2 className="h-3 w-3" />
              {t("leadFallback.deleteForm")}
            </Button>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onSave(formKey)}
          disabled={isSaving || !canSave}
          className="h-8 px-4 text-xs gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

// ─── Add form dialog ─────────────────────────────────────────────────────────

function AddFormInline({
  existingKeys,
  onAdd,
}: {
  existingKeys: string[];
  onAdd: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formKey = toFormKey(title);
  const isDuplicate = existingKeys.includes(formKey);
  const isValid = formKey.length >= 2 && !isDuplicate;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!isValid) return;
    onAdd(formKey);
    setTitle("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("leadFallback.addForm")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3.5 space-y-3 shadow-sm">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
        {t("leadFallback.newFormTitle")}
      </p>
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("leadFallback.formNamePlaceholder")}
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
      />
      {title.trim() && (
        <p className="text-[10px] text-muted-foreground font-mono">
          {t("leadFallback.formKey")}:{" "}
          <span className="text-foreground">{formKey}</span>
          {isDuplicate && (
            <span className="text-red-500 ml-2">
              {t("leadFallback.formKeyExists")}
            </span>
          )}
        </p>
      )}
      <div className="flex items-center flex-wrap gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!isValid}
          className="h-7 px-3 text-xs gap-1 w-full"
        >
          <Plus className="h-3 w-3" />
          {t("leadFallback.addForm")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle("");
            setOpen(false);
          }}
          className="h-7 px-3 text-xs w-full"
        >
          {t("common.cancel")}
        </Button>
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

  // Gate
  const hasLeadForm =
    currentWorkspace?.services?.some((s) => s.service_type === "lead-form") ??
    false;
  const hasEmailConfig =
    currentWorkspace?.services?.some(
      (s) =>
        s.service_type === "email-config" || s.service_slug === "email-config"
    ) ?? false;

  const emailConfigServiceId =
    currentWorkspace?.services?.find(
      (s) =>
        s.service_type === "email-config" || s.service_slug === "email-config"
    )?.service_id ?? null;

  const { data: emailServiceConfig } = useQuery({
    queryKey: ["service-config", emailConfigServiceId],
    queryFn: () => getServiceConfig(emailConfigServiceId!),
    enabled: !!emailConfigServiceId,
  });

  const fromEmail =
    (emailServiceConfig?.["email"] as string | undefined) ?? null;

  useEffect(() => {
    if (currentWorkspace && (!hasLeadForm || !hasEmailConfig)) {
      navigate("/email", { replace: true });
    }
  }, [currentWorkspace, hasLeadForm, hasEmailConfig, navigate]);

  const { data: remoteConfig, isLoading } = useQuery({
    queryKey: ["lead-fallback-config"],
    queryFn: getLeadFallbackConfig,
    enabled: !!currentWorkspace && hasLeadForm && hasEmailConfig,
  });

  // ── Dynamic form keys from config ────────────────────────────────────────
  const [local, setLocal] = useState<Record<string, LeadFallbackSourceConfig>>(
    {}
  );
  const [saved, setSaved] = useState<Record<string, LeadFallbackSourceConfig>>(
    {}
  );
  const [formKeys, setFormKeys] = useState<string[]>([]);

  const remoteRef = useRef<LeadFallbackConfig | undefined>(undefined);
  useEffect(() => {
    if (!remoteConfig || remoteConfig === remoteRef.current) return;
    remoteRef.current = remoteConfig;
    const keys = Object.keys(remoteConfig).filter(
      (k) => remoteConfig[k] && typeof remoteConfig[k] === "object"
    );
    const init: Record<string, LeadFallbackSourceConfig> = {};
    for (const k of keys) {
      init[k] = cfgOrEmpty(remoteConfig[k]);
    }
    setFormKeys(keys);
    setLocal(init);
    setSaved(init);
  }, [remoteConfig]);

  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Auto-select first tab if none selected
  useEffect(() => {
    if (
      formKeys.length > 0 &&
      (activeTab === null || !formKeys.includes(activeTab))
    ) {
      setActiveTab(formKeys[0]);
    }
  }, [formKeys, activeTab]);

  // ── Saving state ─────────────────────────────────────────────────────────
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [justSavedKey, setJustSavedKey] = useState<string | null>(null);

  const buildFullConfig = useCallback(
    (
      overrides?: Record<string, LeadFallbackSourceConfig>
    ): LeadFallbackConfig => {
      const base = { ...local, ...overrides };
      const result: LeadFallbackConfig = {};
      for (const k of formKeys) {
        if (base[k]) result[k] = base[k];
      }
      return result;
    },
    [local, formKeys]
  );

  const mutate = useMutation({
    mutationFn: async ({
      key,
      cfg,
      fullConfig,
    }: {
      key: string;
      cfg: LeadFallbackSourceConfig;
      fullConfig?: LeadFallbackConfig;
    }) => {
      const updated = fullConfig ?? { ...buildFullConfig(), [key]: cfg };
      await updateLeadFallbackConfig(updated);
      return { key, cfg };
    },
    onSuccess: ({ key, cfg }) => {
      queryClient.invalidateQueries({ queryKey: ["lead-fallback-config"] });
      setSaved((prev) => ({ ...prev, [key]: cfg }));
      setLocal((prev) => ({ ...prev, [key]: cfg }));
      setJustSavedKey(key);
      setTimeout(() => setJustSavedKey(null), 2500);
    },
    onSettled: () => {
      setSavingKey(null);
      setTogglingKey(null);
    },
    onError: () => {
      setSavingKey(null);
      setTogglingKey(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const updated = { ...buildFullConfig() };
      delete updated[key];
      await updateLeadFallbackConfig(updated);
      return key;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["lead-fallback-config"] });
      setFormKeys((prev) => prev.filter((k) => k !== key));
      setLocal((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSaved((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (activeTab === key) {
        setActiveTab(null);
      }
    },
  });

  const handleChange = useCallback(
    (key: string, patch: Partial<LeadFallbackSourceConfig>) => {
      setLocal((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    []
  );

  const handleToggle = useCallback(
    (key: string, enabled: boolean) => {
      const canEnable =
        local[key].subject.trim() !== "" && local[key].html.trim() !== "";
      if (enabled && !canEnable) return;
      const next = { ...local[key], enabled };
      setLocal((prev) => ({ ...prev, [key]: next }));
      setTogglingKey(key);
      mutate.mutate({ key, cfg: next });
    },
    [local, mutate]
  );

  const handleSave = useCallback(
    (key: string) => {
      setSavingKey(key);
      mutate.mutate({ key, cfg: local[key] });
    },
    [local, mutate]
  );

  const handleDelete = useCallback(
    (key: string) => {
      deleteMutation.mutate(key);
    },
    [deleteMutation]
  );

  const handleAddForm = useCallback(
    (key: string) => {
      const newCfg = makeDefault();
      setFormKeys((prev) => [...prev, key]);
      setLocal((prev) => ({ ...prev, [key]: newCfg }));
      setSaved((prev) => ({ ...prev, [key]: makeEmpty() }));
      setActiveTab(key);
      // Persist immediately so backend knows about this form
      setSavingKey(key);
      const fullConfig = { ...buildFullConfig(), [key]: newCfg };
      mutate.mutate({ key, cfg: newCfg, fullConfig });
    },
    [buildFullConfig, mutate]
  );

  // ── Dev cron trigger ───────────────────────────────────────────────────────
  const [triggerState, setTriggerState] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const handleTrigger = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
    const cronKey = import.meta.env.VITE_CRON_API_KEY || "";
    setTriggerState("loading");
    setTriggerResult(null);
    try {
      const res = await axios.post(
        `${apiUrl}/internal/process-lead-fallback-emails`,
        {},
        { headers: { "x-cron-api-key": cronKey } }
      );
      setTriggerResult(JSON.stringify(res.data));
      setTriggerState("ok");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : String(err);
      setTriggerResult(msg);
      setTriggerState("error");
    }
  };

  if (!currentWorkspace) return null;

  return (
    <div className="app-fade-in flex flex-col min-h-[calc(100vh-8rem)] p-4 sm:p-6 gap-0">
      {/* ── Page header ── */}
      <div className="shrink-0 pb-5">
        <div className="app-fade-up flex items-start justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
              <Mail className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                {t("email.tabConfirmation")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("leadFallback.subtitle")}
              </p>
            </div>
          </div>
        </div>
        <EmailTabs />
      </div>

      <div className="h-1 shrink-0" />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* ── Split panel ── */
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 flex-1 min-h-0">
          {/* Left: tab list */}
          <div className="sm:w-64 shrink-0 flex flex-col gap-1.5">
            {formKeys.map((key) => (
              <TabButton
                key={key}
                active={activeTab === key}
                enabled={local[key]?.enabled ?? false}
                label={formatFormName(key)}
                onClick={() => setActiveTab(key)}
              />
            ))}

            <AddFormInline existingKeys={formKeys} onAdd={handleAddForm} />

            {/* Dev trigger panel */}
            {import.meta.env.DEV && (
              <div className="mt-auto pt-4">
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3.5 space-y-2.5">
                  <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                    <Play className="h-3 w-3" /> Dev: run processor
                  </p>
                  <p className="text-[10px] text-amber-600 leading-relaxed">
                    Simulates the cron. Set{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">
                      VITE_CRON_API_KEY
                    </code>{" "}
                    in{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">
                      .env
                    </code>
                    .
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTrigger}
                    disabled={triggerState === "loading"}
                    className="h-7 w-full gap-1.5 text-[11px] border-amber-400 text-amber-800 hover:bg-amber-100"
                  >
                    {triggerState === "loading" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Run now
                  </Button>
                  {triggerResult && (
                    <p
                      className={cn(
                        "text-[10px] font-mono break-all leading-relaxed",
                        triggerState === "ok"
                          ? "text-emerald-700"
                          : "text-red-600"
                      )}
                    >
                      {triggerResult}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: editor */}
          <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-6 flex flex-col min-h-0 shadow-sm">
            {activeTab && local[activeTab] ? (
              <EditorPanel
                key={activeTab}
                formKey={activeTab}
                saved={saved[activeTab] ?? makeEmpty()}
                local={local[activeTab]}
                onChange={handleChange}
                onToggle={handleToggle}
                onSave={handleSave}
                onDelete={handleDelete}
                isSaving={savingKey === activeTab}
                isTogglingOn={togglingKey === activeTab}
                justSaved={justSavedKey === activeTab}
                fromEmail={fromEmail}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center space-y-2">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {formKeys.length === 0
                      ? t("leadFallback.noFormsYet")
                      : t("leadFallback.selectForm")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
