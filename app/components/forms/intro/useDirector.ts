import { useCallback, useEffect, useRef, useState } from "react";
import type { Chapter, DemoState, Sel, Step } from "./types";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /** Transition duration for this move, ms. 0 = snap. */
  ms: number;
}

export interface CursorPos {
  x: number;
  y: number;
  ms: number;
}

interface Options {
  chapters: Chapter[];
  initial: DemoState;
  /** The element the builder is rendered into — the coordinate space. */
  innerRef: React.RefObject<HTMLDivElement | null>;
  /** Visible viewport size, needed to centre the camera on a target. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  onFinished: () => void;
}

const DEFAULTS = {
  move: 620,
  camera: 700,
  click: 420,
  perChar: 55,
};

/**
 * Plays a storyboard against the demo builder.
 *
 * The important idea: a step names a CSS selector, and the director resolves it
 * to a live `DOMRect` *at the moment the step runs*. Both the cursor position
 * and the camera transform come from that one measurement. Nothing is authored
 * as a percentage, so the cursor cannot land on empty space — not in another
 * language, not at another size, not after the layout shifts because a field
 * was just added.
 */
export function useDirector({
  chapters,
  initial,
  innerRef,
  viewportRef,
  reducedMotion,
  onFinished,
}: Options) {
  const [state, setState] = useState<DemoState>(initial);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1, ms: 0 });
  // Mirrors `camera` for synchronous reads inside callbacks, which run before
  // the state update has been applied.
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1, ms: 0 });
  const [cursor, setCursor] = useState<CursorPos>({ x: 0, y: 0, ms: 0 });
  const [clickAt, setClickAt] = useState(0);

  // A single scheduled continuation. Kept in a ref so pause/close can cancel it
  // and a stale timer can never resurrect a closed demo.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelled.current = true;
      clear();
    },
    [clear],
  );

  /** Rect of `sel` in the inner container's own (untransformed) coordinates. */
  const measure = useCallback(
    (sel: Sel): { x: number; y: number; w: number; h: number } | null => {
      const inner = innerRef.current;
      if (!inner) return null;
      const el = inner.querySelector(sel);
      if (!el) return null;

      const a = el.getBoundingClientRect();
      const b = inner.getBoundingClientRect();
      // b is already scaled by the camera, so divide back out to get the
      // element's position in unscaled layout space.
      const z = b.width / inner.offsetWidth || 1;
      return {
        x: (a.left - b.left) / z + a.width / z / 2,
        y: (a.top - b.top) / z + a.height / z / 2,
        w: a.width / z,
        h: a.height / z,
      };
    },
    [innerRef],
  );

  /**
   * Frame a target.
   *
   * The zoom is CONSTANT — always whatever fits the builder's full width into
   * the viewport. An earlier version zoomed per step (1.25–1.6) and it was
   * genuinely unpleasant: the view lurched on every move, and at 1.25 the
   * canvas was cropped so hard you could not see the field you had just added.
   * The whole builder now stays on screen and the camera only slides
   * vertically, and only when the target would otherwise be out of view.
   */
  const frame = useCallback(
    (sel: Sel | undefined, ms: number) => {
      const inner = innerRef.current;
      const viewport = viewportRef.current;
      if (!inner || !viewport) return;

      const zoom = viewport.clientWidth / inner.offsetWidth;
      const visibleH = viewport.clientHeight / zoom;
      const maxY = Math.max(0, inner.offsetHeight - visibleH);

      let y = 0;
      if (sel) {
        const m = measure(sel);
        if (m) y = Math.min(Math.max(0, m.y - visibleH / 2), maxY);
      }

      cameraRef.current = { x: 0, y, zoom, ms };
      setCamera(cameraRef.current);
    },
    [innerRef, viewportRef, measure],
  );

  /**
   * Safety net. A `move` whose target sits outside the current framing would
   * park the cursor off-screen — that is exactly how the Share step ended up
   * pointing at y = -103. Rather than hand-matching every camera/move pair in
   * the storyboard, any target that isn't comfortably in view re-frames itself.
   */
  const pointAt = useCallback(
    (sel: Sel, ms: number) => {
      const m = measure(sel);
      if (!m) return;

      const viewport = viewportRef.current;
      const cam = cameraRef.current;
      if (viewport) {
        // Width always fits, so only vertical position can put a target out of
        // reach. This is what stopped the Share step pointing at y = -103.
        const pad = 32;
        const top = cam.y + pad / cam.zoom;
        const bottom = cam.y + (viewport.clientHeight - pad) / cam.zoom;
        if (m.y < top || m.y > bottom) frame(sel, ms);
      }

      setCursor({ x: m.x, y: m.y, ms });
    },
    [measure, frame, viewportRef],
  );

  /**
   * Run one step; the returned number is how long to hold before the next.
   *
   * Reduced motion removes the *animation* — the camera cuts instead of gliding,
   * the cursor teleports, no ripple — but keeps the *timing*. Zeroing the dwells
   * too would rip through all seven chapters in a few milliseconds and land on
   * the end card, which is not an accessible version of a walkthrough.
   */
  const runStep = useCallback(
    (step: Step): number => {
      const fast = reducedMotion;
      const cut = 220; // dwell that replaces a transition when motion is off

      switch (step.kind) {
        case "camera": {
          const ms = step.ms ?? DEFAULTS.camera;
          frame(step.at, fast ? 0 : ms);
          return fast ? cut : ms;
        }
        case "move": {
          const ms = step.ms ?? DEFAULTS.move;
          pointAt(step.at, fast ? 0 : ms);
          return fast ? cut : ms;
        }
        case "click": {
          const ms = step.ms ?? DEFAULTS.click;
          if (!fast) setClickAt(Date.now());
          if (step.run) setState((s) => step.run!(s));
          return fast ? cut : ms;
        }
        case "act": {
          setState((s) => step.run(s));
          return 0;
        }
        case "wait":
          return step.ms;
        case "type":
          return 0; // handled by the caller, which needs to iterate
      }
    },
    [frame, pointAt, reducedMotion],
  );

  /** Walk the steps of the current chapter, then advance. */
  useEffect(() => {
    if (!playing) return;
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    let i = 0;
    cancelled.current = false;

    const next = () => {
      if (cancelled.current) return;

      if (i >= chapter.steps.length) {
        if (chapterIndex + 1 < chapters.length) {
          setChapterIndex((c) => c + 1);
        } else {
          onFinished();
        }
        return;
      }

      const step = chapter.steps[i];
      i += 1;

      if (step.kind === "type") {
        // Typing needs its own inner loop so each character lands separately.
        const per = reducedMotion ? 0 : (step.msPerChar ?? DEFAULTS.perChar);
        let n = 0;
        const tick = () => {
          if (cancelled.current) return;
          n += 1;
          const typed = step.text.slice(0, n);
          setState((s) => step.run(s, typed));
          if (n >= step.text.length) {
            timer.current = setTimeout(next, per * 4);
          } else {
            timer.current = setTimeout(tick, per);
          }
        };
        if (reducedMotion) {
          // Whole string at once, then hold long enough to actually read it.
          setState((s) => step.run(s, step.text));
          timer.current = setTimeout(next, 700);
        } else {
          tick();
        }
        return;
      }

      const ms = runStep(step);
      timer.current = setTimeout(next, ms);
    };

    // Let the DOM settle after the previous chapter's state changes before the
    // first measurement of this one, or we frame a layout that no longer exists.
    const raf = requestAnimationFrame(() => {
      timer.current = setTimeout(next, 60);
    });

    return () => {
      cancelAnimationFrame(raf);
      clear();
    };
  }, [
    chapterIndex,
    playing,
    chapters,
    runStep,
    reducedMotion,
    onFinished,
    clear,
  ]);

  const goTo = useCallback(
    (index: number, seed: DemoState) => {
      clear();
      cancelled.current = true;
      // Chapters are cumulative, so jumping means replaying state from a seed.
      setState(seed);
      setCursor((c) => ({ ...c, ms: 0 }));
      setChapterIndex(index);
      setPlaying(true);
    },
    [clear],
  );

  return {
    state,
    setState,
    chapterIndex,
    chapter: chapters[chapterIndex],
    playing,
    setPlaying,
    camera,
    cursor,
    clickAt,
    goTo,
  };
}
