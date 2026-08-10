import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import type { Camera, CursorPos } from "./useDirector";
import { DEMO_ORIGIN, DEMO_PUBLIC_URL } from "./constants";
import { DemoBuilder } from "./DemoBuilder";
import type { DemoState } from "./types";

/** The builder is designed for a desktop width; the camera brings it closer. */
export const STAGE_WIDTH = 1100;

/**
 * Below this the three-column builder cannot be shown at a legible size, so the
 * stage switches to rendering it 1:1 in the app's own mobile layout instead.
 */
const COMPACT_BELOW = 900;

/**
 * Pick the width the builder lays out at.
 *
 * On a wide stage the builder renders at its desktop width and the camera
 * scales it down slightly — 1100 into ~1024 is a 7% reduction nobody notices.
 *
 * On a phone that same trick is fatal: 1100 into 360 is a 0.33 scale, which
 * renders the builder's 11px labels at under 4px. So instead the builder lays
 * out at exactly the stage width, the zoom becomes 1, and every pixel is the
 * size it would be in the real app on that phone.
 */
function layoutWidthFor(stageWidth: number): number {
  if (stageWidth <= 0) return STAGE_WIDTH; // pre-measurement
  return stageWidth < COMPACT_BELOW ? Math.max(320, stageWidth) : STAGE_WIDTH;
}

interface Props {
  state: DemoState;
  demoId: string;
  camera: Camera;
  cursor: CursorPos;
  clickAt: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  innerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * A fixed-size window onto a full-width builder, with a camera that pans and
 * zooms to whatever the cursor is about to touch.
 *
 * Scaling the whole builder down to modal width would put its 14px text at 7px.
 * Instead the builder renders at its real size and the camera moves — the text
 * stays legible, and the zoom does the job of pointing at things.
 */
export function DemoStage({
  state,
  demoId,
  camera,
  cursor,
  clickAt,
  viewportRef,
  innerRef,
}: Props) {
  const client = useDemoQueryClient(demoId, state.defaultLocale);
  const stageWidth = useStageWidth(viewportRef);
  const layoutWidth = layoutWidthFor(stageWidth);
  const compact = stageWidth > 0 && stageWidth < COMPACT_BELOW;

  return (
    <div
      ref={viewportRef}
      // Height follows the SCREEN (so the modal always fits), while the layout
      // above follows the STAGE WIDTH. They are different questions: one is
      // "will this fit on the phone", the other is "can this be read".
      className="relative h-[58svh] min-h-[320px] w-full overflow-hidden bg-background text-foreground sm:h-[560px] sm:min-h-0"
    >
      <div
        ref={innerRef}
        style={{
          width: layoutWidth,
          transform: `scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
          transformOrigin: "0 0",
          transition: camera.ms
            ? `transform ${camera.ms}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : "none",
        }}
      >
        <QueryClientProvider client={client}>
          <DemoBuilder state={state} demoId={demoId} compact={compact} />
        </QueryClientProvider>
      </div>

      {/* Cursor lives outside the scaled container so it stays a constant size
          however far the camera is zoomed in; its position is converted from
          layout space into viewport space by the same transform. Hidden on the
          celebration, which has nothing to point at. */}
      <div
        className={`pointer-events-none absolute left-0 top-0 z-10 ${
          state.screen === "done" ? "opacity-0" : ""
        }`}
        style={{
          transform: `translate(${(cursor.x - camera.x) * camera.zoom}px, ${
            (cursor.y - camera.y) * camera.zoom
          }px)`,
          transition: cursor.ms
            ? `transform ${cursor.ms}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : "none",
        }}
      >
        <span
          key={clickAt}
          className={clickAt ? "fi-ripple" : undefined}
          aria-hidden="true"
        />
        <svg viewBox="0 0 12 18" className="h-5 w-5 drop-shadow-lg">
          <path
            d="M1 1l10 8.5-4.6.7 2.6 5.3-2.2 1-2.6-5.3L1 14.6z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * The stage's own width in CSS pixels, 0 until first measured.
 *
 * Measured rather than taken from a media query: the stage is a modal whose
 * width is capped well below the viewport, so `window.innerWidth` would say
 * "desktop" while the stage is actually 468px wide. Kept live with a
 * ResizeObserver so rotating a phone re-lays-out instead of staying wrong.
 */
function useStageWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.clientWidth);

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      // Round: sub-pixel jitter would otherwise re-render on every frame of the
      // dialog's open animation.
      const next = Math.round(entry.contentRect.width);
      setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/**
 * A private QueryClient whose cache is pre-seeded with the three snippets
 * `SharePanel` asks for.
 *
 * SharePanel is the one panel in the flow that is not prop-only — it runs three
 * `useQuery` calls against `/forms/:id/snippet`. Seeding the exact keys and
 * setting `staleTime: Infinity` means those resolve from cache and the demo
 * never touches the network.
 */
function useDemoQueryClient(demoId: string, locale: string) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
        },
      }),
  );

  useMemo(() => {
    const origin = DEMO_ORIGIN;
    const url = DEMO_PUBLIC_URL;

    client.setQueryData(
      ["form-snippet", demoId, "iframe", locale],
      `<iframe src="${url}?embed=1"\n        style="width:100%;border:0"\n        loading="lazy"\n        title="Form"></iframe>`,
    );
    client.setQueryData(
      ["form-snippet", demoId, "embed", locale],
      `<div data-rf-form="${demoId}" data-rf-locale="${locale}"></div>\n<script src="${origin}/api/public/forms/embed.js" async></script>`,
    );
  }, [client, demoId, locale]);

  return client;
}
