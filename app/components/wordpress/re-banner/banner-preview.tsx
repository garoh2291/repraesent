import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ReBannerConfig } from "~/lib/wordpress/plugin-settings-types";
import {
  stylesToCss,
  type ReBannerStyleElement,
} from "~/lib/wordpress/re-banner-styles";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Segmented } from "~/components/wordpress/re-cookie/fields";
import { isBlankHtml } from "~/components/wordpress/re-banner/constants";
import {
  renderBoxMarkup,
  renderTextMarkup,
} from "~/components/wordpress/re-banner/banner-markup";
import bannerCss from "~/components/wordpress/re-banner/banner-frontend.css?raw";

type Device = "mobile" | "tablet" | "desktop";
type Ground = "light" | "dark";

/**
 * The width each device renders at. Not "the column's width": a bar banner
 * restructures below 640px, so a preview column that happens to be 480px
 * wide would show every desktop visitor's banner in its phone layout. The
 * document is laid out at the real width and scaled down to fit.
 */
const DEVICE_WIDTH: Record<Device, number> = {
  mobile: 390,
  tablet: 820,
  desktop: 1280,
};

/** Viewport height for pinned layouts (floating, bottom bar) so top/bottom is a real corner. */
const DEVICE_VIEWPORT: Record<Device, number> = {
  mobile: 667,
  tablet: 900,
  desktop: 720,
};

/** The id the preview draws with before the banner has one. Never printed as a shortcode. */
const DRAFT_ID = 0;

/**
 * The banner as the site will draw it.
 *
 * A sandboxed iframe with the plugin's real stylesheet, the real override CSS
 * (`stylesToCss`, byte-identical to what the plugin emits) and the real
 * markup structure — so what changes in the Design tab is what changes here.
 * Two things it still cannot know are the site's fonts and, for the text
 * variant, the theme's own type styles; the frame uses a neutral page for
 * both and says so.
 *
 * `highlight` outlines one override element (the one selected in the
 * typography inspector) so "Paragraph" and "Heading 2" stop being abstract:
 * the preview shows which words a control is about to move.
 */
export function BannerPreview({
  config,
  bannerId,
  imageUrl,
  highlight,
  className,
}: {
  config: ReBannerConfig;
  bannerId: number | null;
  imageUrl: string | null;
  highlight?: ReBannerStyleElement | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>("desktop");
  const [ground, setGround] = useState<Ground>("light");
  const [expanded, setExpanded] = useState(false);

  const settled = useDebounced(config, 120);
  const isText = settled.variant === "text";
  const useViewport =
    settled.variant === "floating" ||
    (settled.variant === "bar" && settled.position === "bottom");

  const labels = useMemo(
    () => ({
      empty: t("wordpress.reBanner.noContent", "No content yet"),
      pageTitle: t("wordpress.reBanner.previewFrame.pageTitle", "Your page"),
      pageBody: t(
        "wordpress.reBanner.previewFrame.pageBody",
        "Placeholder text, standing in for the page the banner appears on. The banner's own styling is real; the page around it is not your theme.",
      ),
    }),
    [t],
  );

  const doc = useMemo(
    () =>
      buildDocument({
        config: settled,
        id: bannerId ?? DRAFT_ID,
        imageUrl,
        ground,
        highlight: highlight ?? null,
        labels,
      }),
    [settled, bannerId, imageUrl, ground, highlight, labels],
  );

  const deviceOptions = [
    {
      value: "mobile" as const,
      label: "",
      icon: (
        <Smartphone
          className="size-4"
          aria-label={t("wordpress.reBanner.previewFrame.mobile", "Mobile")}
        />
      ),
    },
    {
      value: "tablet" as const,
      label: "",
      icon: (
        <Tablet
          className="size-4"
          aria-label={t("wordpress.reBanner.previewFrame.tablet", "Tablet")}
        />
      ),
    },
    {
      value: "desktop" as const,
      label: "",
      icon: (
        <Monitor
          className="size-4"
          aria-label={t("wordpress.reBanner.previewFrame.desktop", "Desktop")}
        />
      ),
    },
  ];

  const groundOptions = [
    {
      value: "light" as const,
      label: "",
      icon: (
        <Sun
          className="size-4"
          aria-label={t("wordpress.reBanner.previewFrame.light", "Light page")}
        />
      ),
    },
    {
      value: "dark" as const,
      label: "",
      icon: (
        <Moon
          className="size-4"
          aria-label={t("wordpress.reBanner.previewFrame.dark", "Dark page")}
        />
      ),
    },
  ];

  const note = isText
    ? t(
        "wordpress.reBanner.previewFrame.noteText",
        "Your overrides are real; the type around them is a stand-in. On the site a text banner takes the styling of whatever it is placed in.",
      )
    : t(
        "wordpress.reBanner.previewFrame.noteBox",
        "The plugin's real stylesheet and your overrides. Fonts come from your theme.",
      );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Device>
          ariaLabel={t("wordpress.reBanner.previewFrame.device", "Preview width")}
          value={device}
          onChange={setDevice}
          options={deviceOptions}
        />
        <div className="flex items-center gap-2">
          <Segmented<Ground>
            ariaLabel={t("wordpress.reBanner.previewFrame.background", "Page background")}
            value={ground}
            onChange={setGround}
            options={groundOptions}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setExpanded(true)}
            aria-label={t("wordpress.reBanner.previewFrame.expand", "Open full-size preview")}
            title={t("wordpress.reBanner.previewFrame.expand", "Open full-size preview")}
          >
            <Maximize2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Stage
        doc={doc}
        virtualWidth={DEVICE_WIDTH[device]}
        ground={ground}
        title={t("wordpress.reBanner.previewFrame.title", "Banner preview")}
        minHeight={useViewport ? DEVICE_VIEWPORT[device] : 220}
        maxHeight={useViewport ? DEVICE_VIEWPORT[device] : 640}
        lockHeight={useViewport}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[92vh] w-[min(1360px,calc(100vw-2rem))] overflow-hidden p-0 sm:max-w-[1360px]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {t("wordpress.reBanner.previewFrame.expandedTitle", "Full-size preview")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "wordpress.reBanner.previewFrame.expandedSubtitle",
                "Laid out at {{width}}px, the way a desktop visitor sees it.",
                { width: DEVICE_WIDTH.desktop },
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(92vh-120px)] overflow-y-auto px-6 pb-6">
            {expanded ? (
              <Stage
                doc={doc}
                virtualWidth={DEVICE_WIDTH.desktop}
                ground={ground}
                title={t("wordpress.reBanner.previewFrame.title", "Banner preview")}
                minHeight={useViewport ? DEVICE_VIEWPORT.desktop : 320}
                maxHeight={useViewport ? DEVICE_VIEWPORT.desktop : 2000}
                lockHeight={useViewport}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── The stage ───────────────────────────────────────────────────────── */

/**
 * One iframe, laid out at `virtualWidth` and scaled to fit its container.
 *
 * The frame reports its own document height (via postMessage, keyed by a
 * per-stage token so two stages on one page never read each other's), and
 * the wrapper is sized to `height × scale` so the page below does not leave
 * a void under a shrunken frame.
 */
function Stage({
  doc,
  virtualWidth,
  ground,
  title,
  minHeight,
  maxHeight,
  lockHeight = false,
}: {
  doc: string;
  virtualWidth: number;
  ground: Ground;
  title: string;
  minHeight: number;
  maxHeight: number;
  lockHeight?: boolean;
}) {
  const token = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(minHeight);

  useEffect(() => {
    setFrameHeight(minHeight);
  }, [minHeight, lockHeight]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setHostWidth(host.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (lockHeight) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; token?: string; height?: number } | null;
      if (data?.type !== "rebnr-preview-height" || data.token !== token) return;
      if (typeof data.height !== "number") return;
      setFrameHeight(Math.min(maxHeight, Math.max(minHeight, Math.ceil(data.height))));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token, minHeight, maxHeight, lockHeight]);

  // Never scale up: a phone-width frame in a wide column stays phone-sized
  // and centred, which is what a phone looks like.
  const scale = hostWidth > 0 ? Math.min(1, hostWidth / virtualWidth) : 1;
  const docWithToken = useMemo(() => doc.replace("__REBNR_TOKEN__", token), [doc, token]);

  return (
    <div className="space-y-1.5">
      <div
        ref={hostRef}
        className={cn(
          "overflow-hidden rounded-xl border",
          ground === "dark" ? "bg-neutral-900" : "bg-neutral-100",
        )}
      >
        <div
          style={{
            width: `${virtualWidth * scale}px`,
            height: `${frameHeight * scale}px`,
            margin: "0 auto",
            transition: "height 120ms ease",
          }}
        >
          <iframe
            ref={frameRef}
            title={title}
            sandbox="allow-scripts"
            srcDoc={docWithToken}
            style={{
              display: "block",
              width: `${virtualWidth}px`,
              height: `${frameHeight}px`,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
      {/* Outside the frame on purpose: anything drawn over it would cover a
          corner of the banner — exactly where the button and close sit. */}
      <p className="text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {virtualWidth}px{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}
      </p>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/* ── The document ────────────────────────────────────────────────────── */

const PAGE_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0}
  html{height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
  body.ground-light{background:#f5f5f4;color:#1c1917}
  body.ground-dark{background:#171717;color:#f5f5f4}
  body.viewport{min-height:100%;height:100%}
  .page{max-width:1120px;margin:0 auto;padding:32px 28px 36px}
  .rebnr--card{--rebnr-site-width:1120px}
  .page h1{margin:0 0 10px;font-size:28px;line-height:1.2;letter-spacing:-.02em}
  .page h2{margin:24px 0 8px;font-size:20px;line-height:1.25;letter-spacing:-.01em}
  .page p{margin:0 0 12px;font-size:15px;opacity:.75}
  .page p.muted{opacity:.35}
  .empty{opacity:.45;font-size:13px}
  .rebnr__cta{cursor:default}
  .rebnr__dismiss{cursor:default}
`;

const HIGHLIGHT_CSS = `outline:2px dashed #2563eb;outline-offset:3px;border-radius:2px;box-shadow:0 0 0 6px rgba(37,99,235,.12)`;

const HEIGHT_SCRIPT = `
  (function(){
    function report(){
      // The body's own height, not documentElement.scrollHeight: that one is
      // never smaller than the viewport, so it would grow the frame on every
      // report until it hit the cap.
      var h = document.body.getBoundingClientRect().height;
      parent.postMessage({type:"rebnr-preview-height",token:"__REBNR_TOKEN__",height:h},"*");
    }
    if (window.ResizeObserver) { new ResizeObserver(report).observe(document.body); }
    window.addEventListener("load", report);
    report();
  })();
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The selector the inspector's element maps to inside the frame — the same
 * map `rulesFor()` in re-banner-styles.ts uses to emit the overrides, so the
 * outline lands on exactly the elements a control would restyle.
 */
function highlightSelector(element: ReBannerStyleElement, isText: boolean): string {
  if (isText) {
    if (element === "container" || element === "body") return ".rebnr-text";
    if (element === "cta" || element === "image") return "";
    // The block itself carries the classes; the descendant form is for a
    // list item or link inside one.
    return `${element}.rebnr-text,.rebnr-text ${element}`;
  }
  switch (element) {
    case "container":
      return ".rebnr";
    case "body":
      return ".rebnr .rebnr__body";
    case "cta":
      return ".rebnr .rebnr__cta";
    case "image":
      return ".rebnr .rebnr__image";
    default:
      return `.rebnr .rebnr__body ${element}`;
  }
}

function buildDocument({
  config,
  id,
  imageUrl,
  ground,
  highlight,
  labels,
}: {
  config: ReBannerConfig;
  id: number;
  imageUrl: string | null;
  ground: Ground;
  highlight: ReBannerStyleElement | null;
  labels: {
    empty: string;
    pageTitle: string;
    pageBody: string;
  };
}): string {
  const overrides = stylesToCss({
    id,
    variant: config.variant,
    styles: config.styles,
    align: config.align,
  });
  const isText = config.variant === "text";
  const useViewport =
    config.variant === "floating" ||
    (config.variant === "bar" && config.position === "bottom");

  let bodyHtml: string;

  if (isText) {
    const banner = renderTextMarkup(config, id);
    const empty = `<span class="empty">${escapeHtml(labels.empty)}</span>`;
    const blank = isBlankHtml(config.body_html);
    bodyHtml =
      `<main class="page">` +
      `${blank ? empty : banner}` +
      `<p class="muted">${escapeHtml(labels.pageBody)}</p>` +
      `</main>`;
  } else {
    // A box with nothing in it draws as a bare strip, which reads as broken
    // rather than as "type something". Stand-in words, preview only — the
    // site renders an empty banner as nothing at all.
    const withBody = isBlankHtml(config.body_html)
      ? { ...config, body_html: `<p><em style="opacity:.55">${escapeHtml(labels.empty)}</em></p>` }
      : config;
    const banner = renderBoxMarkup(withBody, id, imageUrl);
    const inFlow =
      config.variant === "card" ||
      config.variant === "hero" ||
      (config.variant === "bar" && config.position !== "bottom");
    const page =
      `<div class="page"><h1>${escapeHtml(labels.pageTitle)}</h1>` +
      `<p>${escapeHtml(labels.pageBody)}</p><p class="muted">${escapeHtml(labels.pageBody)}</p>` +
      `<p class="muted">${escapeHtml(labels.pageBody)}</p></div>`;
    bodyHtml = inFlow ? `<main>${banner}${page}</main>` : `<main>${page}</main>${banner}`;
    if (config.variant === "bar" && config.position === "bottom") {
      bodyHtml = bodyHtml.replace(
        '<div class="page">',
        `<div class="page" style="padding-bottom:88px">`,
      );
    }
  }

  const selector = highlight ? highlightSelector(highlight, isText) : "";
  const highlightStyle = selector ? `<style>${selector}{${HIGHLIGHT_CSS}}</style>` : "";

  return (
    `<!doctype html><html><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<style>${PAGE_CSS}</style>` +
    (isText ? "" : `<style>${bannerCss}</style>`) +
    (overrides ? `<style id="re-banner-styles">${overrides}</style>` : "") +
    highlightStyle +
    `</head><body class="ground-${ground}${useViewport ? " viewport" : ""}">${bodyHtml}<script>${HEIGHT_SCRIPT}</script></body></html>`
  );
}
