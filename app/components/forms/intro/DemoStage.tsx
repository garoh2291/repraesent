import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Camera, CursorPos } from "./useDirector";
import { DEMO_ORIGIN, DEMO_PUBLIC_URL } from "./constants";
import { DemoBuilder } from "./DemoBuilder";
import type { DemoState } from "./types";

/** The builder is designed for a desktop width; the camera brings it closer. */
export const STAGE_WIDTH = 1100;

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

  return (
    <div
      ref={viewportRef}
      className="relative h-[560px] w-full overflow-hidden bg-background text-foreground"
    >
      <div
        ref={innerRef}
        style={{
          width: STAGE_WIDTH,
          transform: `scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
          transformOrigin: "0 0",
          transition: camera.ms
            ? `transform ${camera.ms}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : "none",
        }}
      >
        <QueryClientProvider client={client}>
          <DemoBuilder state={state} demoId={demoId} />
        </QueryClientProvider>
      </div>

      {/* Cursor lives outside the scaled container so it stays a constant size
          however far the camera is zoomed in; its position is converted from
          layout space into viewport space by the same transform. */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-10"
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
      ["form-snippet", demoId, "script", locale],
      `<div data-rf-form="${demoId}"></div>\n<script src="${origin}/api/public/forms/embed.js" async></script>`,
    );
    client.setQueryData(
      ["form-snippet", demoId, "html", locale],
      `<!-- Paste anywhere. Self-contained: styles and script included. -->\n<div class="rf-${demoId.slice(0, 6)}">\n  <style>/* … */</style>\n  <form class="rf-form"> … </form>\n  <script>/* … */</script>\n</div>`,
    );
  }, [client, demoId, locale]);

  return client;
}
