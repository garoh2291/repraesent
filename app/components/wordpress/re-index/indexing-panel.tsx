import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReIndexSettings } from "~/lib/wordpress/plugin-settings-types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  VERIFY_ROWS,
  formatVerificationMeta,
  hasVerificationCode,
  type PatchSettings,
} from "./constants";
import { CardHeader, Field, InfoNote, SectionCard } from "~/components/wordpress/fields";

export function IndexingPanel({
  settings,
  sitemapUrl,
  regenerating,
  patchSettings,
  onCopied,
  onRegenerate,
}: {
  settings: ReIndexSettings;
  sitemapUrl: string;
  regenerating: boolean;
  patchSettings: PatchSettings;
  onCopied: () => void;
  onRegenerate: () => void;
}) {
  const { t } = useTranslation();

  async function copySitemap() {
    if (!sitemapUrl) return;
    try {
      await navigator.clipboard.writeText(sitemapUrl);
      onCopied();
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          title={t("wordpress.reIndex.sitemapTitle", "XML Sitemap")}
          subtitle={t(
            "wordpress.reIndex.sitemapSubtitle",
            "Auto-generated sitemap for search engines",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs sm:text-sm">
              {sitemapUrl || "—"}
            </code>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!sitemapUrl}
                onClick={() => void copySitemap()}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("wordpress.reIndex.copy", "Copy")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!sitemapUrl}
                onClick={() => {
                  if (sitemapUrl)
                    window.open(sitemapUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("wordpress.reIndex.open", "Open")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={regenerating}
                onClick={onRegenerate}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
                />
                {regenerating
                  ? t("wordpress.reIndex.regenerating", "Regenerating…")
                  : t("wordpress.reIndex.regenerate", "Regenerate Sitemap")}
              </Button>
            </div>
          </div>
          <InfoNote>
            {t(
              "wordpress.reIndex.sitemapNote",
              "The sitemap regenerates automatically when you publish, update, or trash a page. Search engines pick it up on their own crawl schedule. To get a specific page looked at sooner, use URL Inspection in Google Search Console and request indexing.",
            )}
          </InfoNote>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          title={t("wordpress.reIndex.verifyTitle", "Site Verification")}
          subtitle={t(
            "wordpress.reIndex.verifySubtitle",
            "Search Console and webmaster verification codes",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4">
            {VERIFY_ROWS.map((row) => {
              const code = settings.verification[row.key];
              const active = hasVerificationCode(code);
              return (
                <Field key={row.key}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={`verify-${row.key}`}>
                      {t(`wordpress.reIndex.verify.${row.key}`, row.label)}
                    </Label>
                    {active ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        <Check className="h-3 w-3" />
                        {t("wordpress.reIndex.active", "Active")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      id={`verify-${row.key}`}
                      type="text"
                      placeholder={row.placeholder}
                      value={code}
                      onChange={(e) =>
                        patchSettings((prev) => ({
                          ...prev,
                          verification: {
                            ...prev.verification,
                            [row.key]: e.target.value,
                          },
                        }))
                      }
                      onBlur={() => {
                        // Expand a bare code into the full meta tag for display.
                        const formatted = formatVerificationMeta(
                          row.metaName,
                          code,
                        );
                        if (formatted === code) return;
                        patchSettings((prev) => ({
                          ...prev,
                          verification: {
                            ...prev.verification,
                            [row.key]: formatted,
                          },
                        }));
                      }}
                      className={active ? "pr-9 font-mono text-xs" : "font-mono text-xs"}
                    />
                    {active ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-emerald-500"
                        aria-hidden
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                </Field>
              );
            })}
          </div>
          <InfoNote>
            {t(
              "wordpress.reIndex.verifyNote",
              "Paste the full verification meta tag from Google, Bing, Pinterest, etc. It is shown here as the complete tag; WordPress stores the content code for output.",
            )}
          </InfoNote>
        </div>
      </SectionCard>
    </div>
  );
}
