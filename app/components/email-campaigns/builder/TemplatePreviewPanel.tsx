import { useQuery } from "@tanstack/react-query";
import { Eye, Monitor, Smartphone, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Panel,
  PanelBody,
  PanelHeader,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { PreviewAsPicker } from "~/components/workflows/PreviewAsPicker";
import { Spinner } from "~/components/ui/spinner";
import { EmailHtmlFrame } from "~/components/email-campaigns/EmailHtmlFrame";
import type { RecentRecord } from "~/lib/api/workflows";
import {
  previewEmailTemplate,
  type TemplateDocument,
  type TemplateSettings,
} from "~/lib/api/email-templates";

/**
 * The builder's Preview tab: the real MJML output with Liquid substituted,
 * in a sandboxed iframe — what the recipient gets, not the canvas
 * approximation. Desktop/mobile widths, "preview as" over real contacts.
 */
export function TemplatePreviewPanel({
  templateId,
  content,
  settings,
  locale,
}: {
  templateId: string;
  content: TemplateDocument;
  settings: TemplateSettings;
  locale: string;
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewAs, setPreviewAs] = useState<RecentRecord | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: [
      "email-template-preview",
      templateId,
      locale,
      previewAs?.id ?? null,
      // Cheap change signal for unsaved edits; the payload carries the truth.
      JSON.stringify(content.locales[locale] ?? null),
      // Settings too — they change the compiled output (colours, and whether
      // the unsubscribe footer is there at all), so leaving them out left the
      // preview showing a version of the email that no longer existed.
      JSON.stringify(settings ?? null),
    ],
    queryFn: () =>
      previewEmailTemplate(templateId, {
        locale,
        contact_id: previewAs?.id,
        content,
        settings,
      }),
    staleTime: 2000,
  });

  return (
    <Panel>
      <PanelHeader
        icon={<Eye className="h-3.5 w-3.5" />}
        title={t("emailCampaigns.templates.preview.title", {
          defaultValue: "Preview",
        })}
        meta={
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
            {locale}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {/* PreviewAsPicker is styled for the dark command bar; retone its
                trigger for this light panel header. */}
            <div className="[&>button]:border-border [&>button]:bg-muted/40 [&>button]:text-foreground/80 [&>button:hover]:bg-muted [&>button:hover]:text-foreground">
              <PreviewAsPicker
                entity="contacts"
                selected={previewAs}
                onSelect={setPreviewAs}
              />
            </div>
            <Segmented>
              <SegmentedButton
                active={device === "desktop"}
                onClick={() => setDevice("desktop")}
                label={t("emailCampaigns.templates.preview.desktop", {
                  defaultValue: "Desktop",
                })}
              >
                <Monitor className="h-3.5 w-3.5" />
              </SegmentedButton>
              <SegmentedButton
                active={device === "mobile"}
                onClick={() => setDevice("mobile")}
                label={t("emailCampaigns.templates.preview.mobile", {
                  defaultValue: "Mobile",
                })}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </SegmentedButton>
            </Segmented>
          </div>
        }
      />
      <PanelBody>
        {data ? (
          <p className="truncate text-sm">
            <span className="text-muted-foreground">
              {t("emailCampaigns.templates.preview.subject", {
                defaultValue: "Subject:",
              })}
            </span>{" "}
            <span className="font-medium">{data.subject || "—"}</span>
          </p>
        ) : null}

        {data && data.unresolved.length > 0 ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {t("emailCampaigns.templates.preview.unresolved", {
                defaultValue: "Renders blank for this contact:",
              })}{" "}
              <span className="font-mono">{data.unresolved.join(", ")}</span>
            </span>
          </p>
        ) : null}

        <div className="relative min-h-[480px] overflow-auto rounded-xl border border-border bg-muted/30 p-3">
          {isFetching ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <Spinner className="h-5 w-5" />
            </div>
          ) : null}
          <EmailHtmlFrame
            title={t("emailCampaigns.templates.preview.title", {
              defaultValue: "Preview",
            })}
            html={data?.html ?? ""}
            className={`mx-auto block h-[70vh] min-h-[440px] rounded-lg border border-border bg-white transition-[width] ${
              device === "mobile" ? "w-[375px]" : "w-full max-w-[720px]"
            }`}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}
