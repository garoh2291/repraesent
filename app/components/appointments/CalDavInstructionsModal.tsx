import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Check, Lock, Monitor, Apple, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  getCalDavConfig,
  decryptCalDavPassword,
  type CalDavConfig,
} from "~/lib/api/workspaces";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-neutral-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function PasswordCopyButton({
  config,
}: {
  config: CalDavConfig;
}) {
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
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {t("appointments.caldav.password")}
          </p>
          <p className="font-mono text-sm text-neutral-400">••••••••</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={loading}
          className="ml-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              {t("appointments.caldav.copied")}
            </>
          ) : loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Lock className="h-3 w-3" />
              {t("appointments.caldav.copyPassword")}
            </>
          )}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-neutral-400">
        {t("appointments.caldav.passwordHint")}
      </p>
    </div>
  );
}

function StepItem({
  num,
  text,
}: {
  num: number;
  text: string;
}) {
  // Simple bold rendering: **text** → <strong>text</strong>
  const rendered = text.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-neutral-900">$1</strong>',
  );
  // Simple link rendering: [text](url) → <a href="url">text</a>
  const withLinks = rendered.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-neutral-900 hover:text-neutral-700">$1</a>',
  );

  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
        {num}
      </div>
      <p
        className="text-sm leading-relaxed text-neutral-600 pt-0.5"
        dangerouslySetInnerHTML={{ __html: withLinks }}
      />
    </div>
  );
}

function ImagePlaceholder({ name }: { name: string }) {
  const src = `/${name.split(" — ")[0]}`;
  return (
    <div className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 overflow-hidden">
      <img
        src={src}
        alt={name}
        className="w-full rounded-lg"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const placeholder = el.nextElementSibling as HTMLElement;
          if (placeholder) placeholder.style.display = "flex";
        }}
      />
      <div
        className="hidden items-center justify-center p-6 text-center"
      >
        <p className="text-xs text-neutral-400 font-mono">{name}</p>
      </div>
    </div>
  );
}

export function CalDavInstructionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const { data: config } = useQuery({
    queryKey: ["caldav-config"],
    queryFn: getCalDavConfig,
    enabled: open,
  });

  if (!config) return null;

  const fullUrl = config.caldav_full_url ||
    `${config.caldav_ssl ? "https" : "http"}://${config.caldav_server}${config.caldav_port !== 443 && config.caldav_port !== 80 ? `:${config.caldav_port}` : ""}${config.caldav_path}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("appointments.caldav.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("appointments.caldav.subtitle")}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Connection Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t("appointments.caldav.connectionDetails")}
            </h3>
            <div className="space-y-1.5">
              <CopyField
                label={t("appointments.caldav.server")}
                value={config.caldav_server}
              />
              <CopyField
                label={t("appointments.caldav.path")}
                value={config.caldav_path}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <CopyField
                  label={t("appointments.caldav.port")}
                  value={String(config.caldav_port)}
                />
                <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
          </div>

          <div className="border-t border-neutral-200" />

          {/* Apple Calendar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-950">
                <Apple className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900">
                {t("appointments.caldav.appleTitle")}
              </h3>
            </div>
            <div className="space-y-2.5 pl-1">
              <StepItem num={1} text={t("appointments.caldav.appleStep1")} />
              <StepItem num={2} text={t("appointments.caldav.appleStep2")} />
              <StepItem num={3} text={t("appointments.caldav.appleStep3")} />
              <StepItem num={4} text={t("appointments.caldav.appleStep4")} />
              <StepItem num={5} text={t("appointments.caldav.appleStep5")} />
              <StepItem num={6} text={t("appointments.caldav.appleStep6")} />
              <StepItem num={7} text={t("appointments.caldav.appleStep7")} />
            </div>
            <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 space-y-1">
              <p className="text-[11px] font-semibold text-neutral-500">
                {t("appointments.caldav.appleScreenshots")}
              </p>
              <ImagePlaceholder name={t("appointments.caldav.appleImg1")} />
              <ImagePlaceholder name={t("appointments.caldav.appleImg2")} />
              <ImagePlaceholder name={t("appointments.caldav.appleImg3")} />
              <ImagePlaceholder name={t("appointments.caldav.appleImg4")} />
            </div>
          </div>

          <div className="border-t border-neutral-200" />

          {/* OneCalendar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                <Monitor className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900">
                {t("appointments.caldav.oneCalTitle")}
              </h3>
            </div>
            <div className="space-y-2.5 pl-1">
              <StepItem num={1} text={t("appointments.caldav.oneCalStep1")} />
              <StepItem num={2} text={t("appointments.caldav.oneCalStep2")} />
              <StepItem num={3} text={t("appointments.caldav.oneCalStep3")} />
              <StepItem
                num={4}
                text={`${t("appointments.caldav.oneCalStep4")}: \`${fullUrl}\``}
              />
              <StepItem num={5} text={t("appointments.caldav.oneCalStep5")} />
              <StepItem num={6} text={t("appointments.caldav.oneCalStep6")} />
            </div>
            <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 space-y-1">
              <p className="text-[11px] font-semibold text-neutral-500">
                {t("appointments.caldav.oneCalScreenshots")}
              </p>
              <ImagePlaceholder name={t("appointments.caldav.oneCalImg1")} />
              <ImagePlaceholder name={t("appointments.caldav.oneCalImg2")} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCalDavConfig() {
  return useQuery({
    queryKey: ["caldav-config"],
    queryFn: getCalDavConfig,
  });
}
