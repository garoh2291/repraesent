import { useQuery } from "@tanstack/react-query";
import {
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
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
import { AdvancedSection } from "~/components/notebook/advanced-section";
import { CopyForWebPerson } from "~/components/notebook/copy-for-web-person";
import { setLocalFlag } from "~/components/notebook/setup-checklist";
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
  /** Feeds the builder checklist's last step ("Put it on your website"). */
  const copiedFlag = `forms-copied:${formId}`;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("forms.share.copied"));
  };

  // The recommended embed. Same query key as the Advanced script card and the
  // CSP card, so all three read one cached response.
  const { data: embedSnippet } = useQuery({
    queryKey: ["form-snippet", formId, "embed", defaultLocale],
    queryFn: () => getFormSnippet(formId, "embed", defaultLocale),
  });

  return (
    <div className="space-y-5">
      {/* Everything below renders before the form is live, on purpose: the
          owner can hand the code over today, and it starts working the moment
          they turn the form on. The note says exactly that. */}
      {!published ? (
        <InfoNote>{t("forms.share.turnOnFirst")}</InfoNote>
      ) : hasUnpublishedChanges ? (
        <InfoNote>{t("forms.share.unpublishedWarning")}</InfoNote>
      ) : null}

      {/* 1. The link. Needs nobody's help, works in an email, on WhatsApp or
          behind a QR code — so it comes first and is the biggest thing here. */}
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
              aria-label={t("forms.share.linkTitle")}
              className="h-11 flex-1 font-mono text-[13.5px]"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <GhostAction
                className="h-11 flex-1 sm:flex-none"
                onClick={() => {
                  copy(publicUrl);
                  setLocalFlag(copiedFlag);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("forms.share.copy")}
              </GhostAction>
              {published ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  // Opening the link counts as "it's out there": the owner
                  // who shares a link rather than embedding is also done.
                  onClick={() => setLocalFlag(copiedFlag)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted sm:flex-none"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("forms.share.open")}
                </a>
              ) : null}
            </div>
          </div>
        </PanelBody>
      </Panel>

      {/* 2. On the website: the one embed we recommend, handed to whoever
          looks after the site. It updates itself whenever the form is saved
          live, which is why it beats the frozen HTML copy for most owners. */}
      <Panel>
        <PanelHeader
          icon={<Code2 className="h-3.5 w-3.5" />}
          title={t("forms.share.websiteTitle")}
        />
        <PanelBody>
          {embedSnippet ? (
            <CopyForWebPerson
              code={embedSnippet}
              hint={t("forms.share.websiteHint")}
              emailSubject={t("forms.share.emailSubject")}
              emailIntro={t("forms.share.emailIntro", { url: publicUrl })}
              copiedFlag={copiedFlag}
            />
          ) : (
            <Skeleton className="h-28 w-full rounded-lg" />
          )}
        </PanelBody>
      </Panel>

      {/* 3. Everything a web person might need instead: other embed styles
          and the Content-Security-Policy lines. Ordered by how little the
          host site has to change to accept them. */}
      <AdvancedSection
        storageKey="forms-share"
        hint={t("forms.share.advancedHint")}
      >
        <SnippetCard
          formId={formId}
          mode="iframe"
          locale={defaultLocale}
          icon={<MonitorPlay className="h-3.5 w-3.5" />}
          title={t("forms.share.iframeTitle")}
          subtitle={t("forms.share.iframeHint")}
          onCopy={(text) => {
            copy(text);
            setLocalFlag(copiedFlag);
          }}
        />

        <SnippetCard
          formId={formId}
          mode="html"
          locale={defaultLocale}
          icon={<FileCode2 className="h-3.5 w-3.5" />}
          title={t("forms.share.htmlTitle")}
          subtitle={t("forms.share.htmlHint")}
          warning={t("forms.share.htmlWarning")}
          onCopy={(text) => {
            copy(text);
            setLocalFlag(copiedFlag);
          }}
        />

        <CspCard formId={formId} locale={defaultLocale} onCopy={copy} />
      </AdvancedSection>
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
  warning,
  onCopy,
}: {
  formId: string;
  mode: SnippetMode;
  locale: FormLocale;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  warning?: string;
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
        {warning ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {warning}
          </p>
        ) : null}
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : (
          // select-text, not select-all: `user-select: all` makes the browser
          // treat the whole block as one atomic unit, so a click grabs
          // everything and a drag cannot pick out a substring. The Copy button
          // already covers the take-all case.
          <pre className="max-h-64 select-text overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {snippet}
          </pre>
        )}
      </PanelBody>
    </Panel>
  );
}
