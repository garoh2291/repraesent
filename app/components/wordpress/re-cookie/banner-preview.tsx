import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cookie, PanelBottom, Square } from "lucide-react";
import { Segmented } from "./fields";
import { CATEGORY_SLUGS } from "./constants";
import type {
  ReCookieLang,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";

/**
 * Live preview of what the plugin actually renders on the site. This is a
 * likeness driven by the same settings object, not the plugin's own bundle —
 * it exists so colours, radius, position and copy can be judged without a
 * round-trip through WordPress. Keep it in step with
 * `plugins/cookies/assets/app/` when that markup changes.
 */

/**
 * The three states a visitor actually sees. `idle` is the post-consent page,
 * which is the only one where the manage-cookies handle is visible — showing it
 * underneath the banner would misrepresent where it lands.
 */
type PreviewMode = "banner" | "modal" | "idle";

/** Perceived luminance, to pick legible text on top of a user-chosen colour. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const int = parseInt(m[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

export function BannerPreview({
  settings,
  lang,
}: {
  settings: ReCookieSettings;
  lang: ReCookieLang;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PreviewMode>("banner");

  const copy = settings.translations[lang];
  const radius = Math.min(Math.max(settings.border_radius || 0, 0), 32);
  const centered = settings.banner_position === "center";

  const surface = {
    background: settings.background_color,
    color: settings.text_color,
    borderRadius: radius,
  };

  const buttons = [
    {
      key: "reject",
      label: copy.buttons.rejectAll,
      bg: settings.reject_button_color,
    },
    {
      key: "customize",
      label: copy.buttons.customize,
      bg: settings.secondary_button_color,
    },
    {
      key: "accept",
      label: copy.buttons.acceptAll,
      bg: settings.accept_button_color,
    },
  ];

  const enabledCategories = CATEGORY_SLUGS.filter(
    (slug) => settings.categories[slug].enabled,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Cookie className="size-4 text-muted-foreground" />
          {t("wordpress.reCookie.preview", "Live preview")}
        </h2>
        <Segmented<PreviewMode>
          value={mode}
          onChange={setMode}
          ariaLabel={t("wordpress.reCookie.preview", "Live preview")}
          options={[
            {
              value: "banner",
              label: t("wordpress.reCookie.previewBanner", "Banner"),
            },
            {
              value: "modal",
              label: t("wordpress.reCookie.previewModal", "Preferences"),
            },
            {
              value: "idle",
              label: t("wordpress.reCookie.previewIdle", "After consent"),
            },
          ]}
        />
      </div>

      {/* Stand-in for the visitor's page, so the banner is judged in context. */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
            {settings.privacy_policy_url
              ? settings.privacy_policy_url.replace(/^https?:\/\//i, "")
              : "example.com"}
          </span>
        </div>

        <div
          className="relative isolate min-h-[380px] overflow-hidden p-4"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        >
          {/* Skeleton page content behind the banner. */}
          <div className="space-y-2.5 opacity-40" aria-hidden>
            <div className="h-6 w-2/5 rounded bg-muted-foreground/20" />
            <div className="h-2.5 w-4/5 rounded bg-muted-foreground/15" />
            <div className="h-2.5 w-3/5 rounded bg-muted-foreground/15" />
            <div className="mt-4 h-28 rounded-xl bg-muted-foreground/10" />
            <div className="h-2.5 w-3/4 rounded bg-muted-foreground/15" />
            <div className="h-2.5 w-2/3 rounded bg-muted-foreground/15" />
          </div>

          {mode === "banner" ? (
            <div
              className={
                centered
                  ? "absolute inset-0 z-10 flex items-center justify-center p-4"
                  : "absolute inset-x-3 bottom-3 z-10"
              }
            >
              {centered && settings.show_modal_overlay ? (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                />
              ) : null}
              <div
                className="relative w-full max-w-md p-4 shadow-lg ring-1 ring-black/5"
                style={surface}
              >
                <p className="text-sm font-semibold">{copy.banner.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">
                  {copy.banner.description}
                  {settings.privacy_policy_url ? (
                    <>
                      {" "}
                      <span
                        className="underline underline-offset-2"
                        style={{ color: settings.primary_color }}
                      >
                        {copy.banner.privacyPolicy}
                      </span>
                    </>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {buttons.map((btn) => (
                    <span
                      key={btn.key}
                      className="px-3 py-1.5 text-xs font-medium"
                      style={{
                        background: btn.bg,
                        color: readableOn(btn.bg),
                        borderRadius: Math.min(radius, 12),
                      }}
                    >
                      {btn.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : mode === "modal" ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
              {settings.show_modal_overlay ? (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                />
              ) : null}
              <div
                className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden p-4 shadow-lg ring-1 ring-black/5"
                style={surface}
              >
                <p className="text-sm font-semibold">{copy.modal.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">
                  {copy.modal.description}
                </p>
                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto">
                  {enabledCategories.map((slug) => (
                    <div
                      key={slug}
                      className="flex items-start justify-between gap-3 p-2.5"
                      style={{
                        borderRadius: Math.min(radius, 12),
                        background: "rgb(0 0 0 / 0.04)",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">
                          {copy.categories[slug].title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed opacity-70">
                          {copy.categories[slug].description}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5"
                        style={{
                          background:
                            slug === "functional"
                              ? settings.primary_color
                              : "rgb(0 0 0 / 0.15)",
                          justifyContent:
                            slug === "functional" ? "flex-end" : "flex-start",
                        }}
                      >
                        <span className="size-3 rounded-full bg-white shadow-sm" />
                      </span>
                    </div>
                  ))}
                  {enabledCategories.length === 0 ? (
                    <p className="py-6 text-center text-xs opacity-60">
                      {t(
                        "wordpress.reCookie.previewNoCategories",
                        "No categories enabled.",
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: settings.reject_button_color,
                      color: readableOn(settings.reject_button_color),
                      borderRadius: Math.min(radius, 12),
                    }}
                  >
                    {copy.buttons.deny}
                  </span>
                  <span
                    className="px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: settings.accept_button_color,
                      color: readableOn(settings.accept_button_color),
                      borderRadius: Math.min(radius, 12),
                    }}
                  >
                    {copy.buttons.savePreferences}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* The handle the plugin leaves behind once the banner is dismissed. */}
          {mode === "idle" ? (
            <span
              className="absolute bottom-3 z-20 px-2.5 py-1 text-[10px] font-medium shadow-md ring-1 ring-black/5"
              style={{
                background: settings.primary_color,
                color: readableOn(settings.primary_color),
                borderRadius: Math.min(radius, 12),
                left:
                  settings.manage_placement === "bottom-left"
                    ? "0.75rem"
                    : "auto",
                right:
                  settings.manage_placement === "bottom-right"
                    ? "0.75rem"
                    : "auto",
              }}
            >
              {copy.buttons.manageCookies}
            </span>
          ) : null}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {centered ? (
          <Square className="size-3.5" />
        ) : (
          <PanelBottom className="size-3.5" />
        )}
        {t(
          "wordpress.reCookie.previewHint",
          "Approximate rendering. Reflects unsaved changes in the current editing language.",
        )}
      </p>
    </div>
  );
}
