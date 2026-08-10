import { useQuery } from "@tanstack/react-query";
import {
  Code2,
  Copy,
  ExternalLink,
  Link2,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
} from "~/components/forms/chrome";
import { FieldHint, InfoNote } from "~/components/wordpress/fields";
import { getFormSnippet, type SnippetMode } from "~/lib/api/forms";
import { buildPublicFormUrl } from "~/lib/config";
import type { FormLocale } from "~/lib/forms/schema";

interface Props {
  formId: string;
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
  defaultLocale: FormLocale;
  /**
   * Override the public address. Only the onboarding demo passes this, so the
   * walkthrough shows the product's real domain instead of whatever
   * VITE_PUBLIC_BOOKING_BASE_URL happens to be in that environment.
   */
  publicUrl?: string;
}

export function SharePanel({
  formId,
  status,
  hasUnpublishedChanges,
  defaultLocale,
  publicUrl: publicUrlOverride,
}: Props) {
  const { t } = useTranslation();
  const published = status === "published";
  const publicUrl = publicUrlOverride ?? buildPublicFormUrl(formId);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("forms.share.copied"));
  };

  if (!published) {
    return <InfoNote>{t("forms.share.publishFirst")}</InfoNote>;
  }

  return (
    <div className="space-y-5">
      {hasUnpublishedChanges ? (
        <InfoNote>{t("forms.share.unpublishedWarning")}</InfoNote>
      ) : null}

      <Panel>
        <PanelHeader
          icon={<Link2 className="h-3.5 w-3.5" />}
          title={t("forms.share.linkTitle")}
        />
        <PanelBody>
          <FieldHint>{t("forms.share.linkHint")}</FieldHint>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={publicUrl}
              className="h-10 flex-1 font-mono text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <GhostAction className="h-10" onClick={() => copy(publicUrl)}>
                <Copy className="h-3.5 w-3.5" />
                {t("forms.share.copy")}
              </GhostAction>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("forms.share.open")}
              </a>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <SnippetCard
        formId={formId}
        mode="embed"
        locale={defaultLocale}
        icon={<Code2 className="h-3.5 w-3.5" />}
        title={t("forms.share.embedTitle")}
        subtitle={t("forms.share.embedHint")}
        onCopy={copy}
      />

      <SnippetCard
        formId={formId}
        mode="iframe"
        locale={defaultLocale}
        icon={<MonitorPlay className="h-3.5 w-3.5" />}
        title={t("forms.share.iframeTitle")}
        subtitle={t("forms.share.iframeHint")}
        onCopy={copy}
      />

      <CspCard formId={formId} locale={defaultLocale} onCopy={copy} />
    </div>
  );
}

/**
 * A Content-Security-Policy is enforced by the browser from the *host* page's
 * headers — nothing we serve can satisfy it on the customer's behalf. Sites that
 * send one see `embed.js (blocked:csp)` and an empty space where the form should
 * be, with no clue why, so the exact directives they need are printed here.
 */
function CspCard({
  formId,
  locale,
  onCopy,
}: {
  formId: string;
  locale: FormLocale;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();

  // Same query key as the embed SnippetCard, so this is a cache read, not a
  // second request. The origin is read back out of the snippet because only the
  // server knows which host it decided to emit.
  const { data: snippet } = useQuery({
    queryKey: ["form-snippet", formId, "embed", locale],
    queryFn: () => getFormSnippet(formId, "embed", locale),
  });

  const origin = originOfSnippet(snippet);
  if (!origin) return null;

  const local = /^https?:\/\/(localhost|127\.|\[?::1)/i.test(origin);
  const directives = [
    `script-src  ${origin};`,
    `connect-src ${origin};`,
    `font-src    ${origin};`,
  ].join("\n");

  return (
    <Panel>
      <PanelHeader
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title={t("forms.share.cspTitle")}
        action={
          <GhostAction onClick={() => onCopy(directives)}>
            <Copy className="h-3.5 w-3.5" />
            {t("forms.share.copy")}
          </GhostAction>
        }
      />
      <PanelBody>
        <FieldHint>{t("forms.share.cspHint")}</FieldHint>
        {local ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {t("forms.share.localhostWarning", { origin })}
          </p>
        ) : null}
        <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {directives}
        </pre>
      </PanelBody>
    </Panel>
  );
}

/** The origin of the `<script src>` inside an embed snippet. */
function originOfSnippet(snippet: string | undefined): string | null {
  const match = snippet?.match(/src="(https?:\/\/[^/"]+)/);
  return match ? match[1] : null;
}

function SnippetCard({
  formId,
  mode,
  locale,
  icon,
  title,
  subtitle,
  onCopy,
}: {
  formId: string;
  mode: SnippetMode;
  locale: FormLocale;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();

  // Cached per mode, and shared with CspCard, which reads the API origin back
  // out of the embed snippet rather than issuing its own request.
  const { data: snippet, isLoading } = useQuery({
    queryKey: ["form-snippet", formId, mode, locale],
    queryFn: () => getFormSnippet(formId, mode, locale),
  });

  return (
    <Panel>
      <PanelHeader
        icon={icon}
        title={title}
        action={
          <GhostAction
            disabled={!snippet}
            onClick={() => snippet && onCopy(snippet)}
          >
            <Copy className="h-3.5 w-3.5" />
            {t("forms.share.copy")}
          </GhostAction>
        }
      />
      <PanelBody>
        <FieldHint>{subtitle}</FieldHint>
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : (
          <pre className="max-h-64 select-all overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {snippet}
          </pre>
        )}
      </PanelBody>
    </Panel>
  );
}
