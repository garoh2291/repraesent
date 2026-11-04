import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Smartphone } from "lucide-react";
import { Segmented } from "~/components/wordpress/re-cookie/fields";
import type { ReAccessibilitySettings } from "./settings";
import { previewDocument, type PreviewLang } from "./menu-markup";

const DEVICES = {
  desktop: { width: 960, height: 720 },
  phone: { width: 390, height: 760 },
} as const;

type Device = keyof typeof DEVICES;

/**
 * The menu as visitors will see it, redrawn on every change: the plugin's own
 * stylesheet and markup in a script-less frame, scaled to the column.
 */
export function MenuPreview({
  settings,
  defaultLang,
}: {
  settings: ReAccessibilitySettings;
  /** Language the menu is first shown in; the site's pages pick their own. */
  defaultLang: PreviewLang;
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>("desktop");
  const [open, setOpen] = useState(true);
  const [lang, setLang] = useState<PreviewLang>(defaultLang);
  // The frame only mounts in the browser, so this can't differ from the server.
  const [mac] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /mac|iphone|ipad|ipod/i.test(navigator.platform),
  );

  const doc = useMemo(
    () => previewDocument(settings, lang, open, mac),
    [settings, lang, open, mac],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={device}
          onChange={setDevice}
          ariaLabel={t("wordpress.reAccessibility.previewDevice", "Screen")}
          options={[
            {
              value: "desktop",
              label: t("wordpress.reAccessibility.previewDesktop", "Computer"),
              icon: <Monitor className="size-3.5" />,
            },
            {
              value: "phone",
              label: t("wordpress.reAccessibility.previewPhone", "Phone"),
              icon: <Smartphone className="size-3.5" />,
            },
          ]}
        />
        <Segmented
          value={lang}
          onChange={setLang}
          ariaLabel={t("wordpress.reAccessibility.previewLanguage", "Menu language")}
          options={[
            { value: "de", label: "DE" },
            { value: "en", label: "EN" },
          ]}
        />
      </div>

      <Segmented
        value={open ? "open" : "closed"}
        onChange={(v) => setOpen(v === "open")}
        ariaLabel={t("wordpress.reAccessibility.previewState", "What to show")}
        className="w-full [&>*]:flex-1"
        options={[
          {
            value: "open",
            label: t("wordpress.reAccessibility.previewOpen", "Menu open"),
          },
          {
            value: "closed",
            label: t("wordpress.reAccessibility.previewClosed", "Button only"),
          },
        ]}
      />

      <Frame
        doc={doc}
        width={DEVICES[device].width}
        height={DEVICES[device].height}
        title={t("wordpress.reAccessibility.previewTitle", "Preview of the accessibility menu")}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          "wordpress.reAccessibility.previewHint",
          "Your website shows the menu in the language of each page. The first option is shown switched on, so you can see your main color.",
        )}
      </p>
    </div>
  );
}

/** One frame laid out at the device's width and scaled down to fit. */
function Frame({
  doc,
  width,
  height,
  title,
}: {
  doc: string;
  width: number;
  height: number;
  title: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setHostWidth(host.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Never scale up: a phone stays phone-sized and centered in a wide column.
  const scale = Math.min(1, hostWidth / width);

  return (
    <div
      ref={hostRef}
      className="overflow-hidden rounded-xl border bg-neutral-100"
    >
      <div
        style={{
          width: `${width * scale}px`,
          height: `${height * scale}px`,
          margin: "0 auto",
        }}
      >
        {/* Mounted once measured: a frame that starts at the wrong size and is
            then resized can stay blank. */}
        {hostWidth > 0 ? (
          <iframe
            title={title}
            // No scripts, no same-origin: the frame only draws.
            sandbox=""
            srcDoc={doc}
            tabIndex={-1}
            style={{
              display: "block",
              width: `${width}px`,
              height: `${height}px`,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
