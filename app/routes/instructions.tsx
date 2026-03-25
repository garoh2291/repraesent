import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Check,
  Lock,
  Monitor,
  Apple,
  ArrowLeft,
} from "lucide-react";
import {
  getCalDavConfig,
  decryptCalDavPassword,
  type CalDavConfig,
} from "~/lib/api/workspaces";

export function meta() {
  return [
    { title: "Calendar Setup — Repraesent" },
    { name: "description", content: "Instructions to connect your calendar" },
  ];
}

/* ── Reusable sub-components ──────────────────────────────────────── */

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-neutral-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-all hover:bg-neutral-100 hover:border-neutral-300 active:scale-95"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function PasswordCopyButton({ config }: { config: CalDavConfig }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCopy = useCallback(async () => {
    setLoading(true);
    try {
      const pw = await decryptCalDavPassword(config.service_id);
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [config.service_id]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {t("appointments.caldav.password")}
          </p>
          <p className="font-mono text-sm text-neutral-400">••••••••</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={loading}
          className="ml-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-50 active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {t("appointments.caldav.copied")}
            </>
          ) : loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              {t("appointments.caldav.copyPassword")}
            </>
          )}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-400 leading-relaxed">
        {t("appointments.caldav.passwordHint")}
      </p>
    </div>
  );
}

function StepItem({
  num,
  text,
  values,
}: {
  num: number;
  text: string;
  values?: Record<string, string>;
}) {
  // Parse: **bold**, [link](url), {{val:key:Label}}
  // Split on all three patterns, preserving delimiters
  const parts: React.ReactNode[] = [];
  // Process in order: first replace {{val:...}} markers, then bold, then links
  const regex =
    /(\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|\{\{val:([^:}]+):([^}]+)\}\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-neutral-900">
          {match[2]}
        </strong>,
      );
    } else if (match[3] && match[4]) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-emerald-700 hover:text-emerald-600"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5] && match[6]) {
      // {{val:key:Label}} — hoverable value tooltip
      const val = values?.[match[5]];
      if (val) {
        parts.push(
          <span key={match.index} className="relative group/val inline-block">
            <span className="font-semibold text-neutral-900 border-b border-dashed border-neutral-400 cursor-help">
              {match[6]}
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-[11px] font-mono text-white opacity-0 shadow-lg transition-opacity group-hover/val:opacity-100 z-10">
              {val}
              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral-900" />
            </span>
          </span>,
        );
      } else {
        parts.push(
          <strong key={match.index} className="font-semibold text-neutral-900">
            {match[6]}
          </strong>,
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
        {num}
      </div>
      <p className="text-sm leading-relaxed text-neutral-600 pt-1">{parts}</p>
    </div>
  );
}

function ImagePlaceholder({ name }: { name: string }) {
  const src = `/${name.split(" — ")[0]}`;
  return (
    <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 overflow-hidden">
      <img
        src={src}
        alt={name}
        className="w-full rounded-xl"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const next = el.nextElementSibling as HTMLElement;
          if (next) next.style.display = "flex";
        }}
      />
      <div className="hidden items-center justify-center p-8 text-center">
        <p className="text-xs text-neutral-400 font-mono">{name}</p>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function InstructionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: config, isLoading } = useQuery({
    queryKey: ["caldav-config"],
    queryFn: getCalDavConfig,
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-96 bg-muted/60 rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/appointments")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("appointments.title")}
        </button>
        <p className="text-sm text-muted-foreground">
          {t("appointments.caldav.notConfigured", "Calendar sync has not been set up for this workspace yet.")}
        </p>
      </div>
    );
  }

  const fullUrl =
    config.caldav_full_url ||
    `${config.caldav_ssl ? "https" : "http"}://${config.caldav_server}${config.caldav_port !== 443 && config.caldav_port !== 80 ? `:${config.caldav_port}` : ""}${config.caldav_path}`;

  const stepValues: Record<string, string> = {
    username: config.caldav_username,
    server: config.caldav_server,
    path: config.caldav_path,
    port: String(config.caldav_port),
    full_url: fullUrl,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto app-fade-in">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate("/appointments")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("appointments.title")}
      </button>

      {/* Title */}
      <div className="mb-8 app-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          {t("appointments.caldav.title")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          {t("appointments.caldav.subtitle")}
        </p>
      </div>

      {/* Connection Details */}
      <section className="mb-10 app-fade-up app-fade-up-d1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">
          {t("appointments.caldav.connectionDetails")}
        </h2>
        <div className="space-y-2">
          <CopyField
            label={t("appointments.caldav.server")}
            value={config.caldav_server}
          />
          <CopyField
            label={t("appointments.caldav.path")}
            value={config.caldav_path}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <CopyField
              label={t("appointments.caldav.port")}
              value={String(config.caldav_port)}
            />
            <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {t("appointments.caldav.ssl")}
                </p>
                <p className="font-mono text-sm text-neutral-900">
                  {config.caldav_ssl
                    ? t("appointments.caldav.yes")
                    : t("appointments.caldav.no")}
                </p>
              </div>
            </div>
          </div>
          <CopyField
            label={t("appointments.caldav.username")}
            value={config.caldav_username}
          />
          {config.has_password && <PasswordCopyButton config={config} />}
          {fullUrl && (
            <CopyField
              label={t("appointments.caldav.fullUrl")}
              value={fullUrl}
            />
          )}
        </div>
      </section>

      <div className="border-t border-border mb-10" />

      {/* Apple Calendar */}
      <section className="mb-10 app-fade-up app-fade-up-d2">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 shadow-sm">
            <Apple className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("appointments.caldav.appleTitle")}
          </h2>
        </div>
        <div className="space-y-4 pl-1">
          <StepItem values={stepValues} num={1} text={t("appointments.caldav.appleStep1")} />
          <StepItem values={stepValues} num={2} text={t("appointments.caldav.appleStep2")} />
          <StepItem values={stepValues} num={3} text={t("appointments.caldav.appleStep3")} />
          <ImagePlaceholder name={t("appointments.caldav.appleImg1")} />
          <StepItem values={stepValues} num={4} text={t("appointments.caldav.appleStep4")} />
          <ImagePlaceholder name={t("appointments.caldav.appleImg2")} />
          <StepItem values={stepValues} num={5} text={t("appointments.caldav.appleStep5")} />
          <StepItem values={stepValues} num={6} text={t("appointments.caldav.appleStep6")} />
          <StepItem values={stepValues} num={7} text={t("appointments.caldav.appleStep7")} />
          <ImagePlaceholder name={t("appointments.caldav.appleImg3")} />
          <StepItem values={stepValues} num={8} text={t("appointments.caldav.appleStep8")} />
          <ImagePlaceholder name={t("appointments.caldav.appleImg4")} />
        </div>
      </section>

      <div className="border-t border-border mb-10" />

      {/* OneCalendar */}
      <section className="mb-10 app-fade-up app-fade-up-d3">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
            <Monitor className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("appointments.caldav.oneCalTitle")}
          </h2>
        </div>
        <div className="space-y-4 pl-1">
          <StepItem values={stepValues} num={1} text={t("appointments.caldav.oneCalStep1")} />
          <StepItem values={stepValues} num={2} text={t("appointments.caldav.oneCalStep2")} />
          <StepItem values={stepValues} num={3} text={t("appointments.caldav.oneCalStep3")} />
          <ImagePlaceholder name={t("appointments.caldav.oneCalImg1")} />
          <StepItem values={stepValues} num={4} text={t("appointments.caldav.oneCalStep4")} />
          <StepItem values={stepValues} num={5} text={t("appointments.caldav.oneCalStep5")} />
          <ImagePlaceholder name={t("appointments.caldav.oneCalImg2")} />
          <StepItem values={stepValues} num={6} text={t("appointments.caldav.oneCalStep6")} />
          <ImagePlaceholder name={t("appointments.caldav.oneCalImg3")} />
          <StepItem values={stepValues} num={7} text={t("appointments.caldav.oneCalStep7")} />
          <ImagePlaceholder name={t("appointments.caldav.oneCalImg4")} />
        </div>
      </section>
    </div>
  );
}
