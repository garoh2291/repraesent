import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isFormLocale, type FormLocale } from "~/lib/forms/schema";
import { cn } from "~/lib/utils";
import { DEMO_ID } from "./constants";
import { DemoStage } from "./DemoStage";
import { buildStoryboard, initialState, stateAtChapter } from "./storyboard";
import { useDirector } from "./useDirector";

export function IntroPlayer({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(false);

  const locale: FormLocale = isFormLocale(i18n.language)
    ? i18n.language
    : ((i18n.language?.slice(0, 2) ?? "en") as FormLocale);
  const safeLocale: FormLocale = isFormLocale(locale) ? locale : "en";

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Built once: emptyDefinition/createField call Math.random(), so re-running
  // this on every render would churn ids and remount the canvas mid-play.
  const chapters = useMemo(
    () => buildStoryboard(t, safeLocale),
    [t, safeLocale],
  );
  const seed = useMemo(() => initialState(safeLocale, t), [safeLocale, t]);

  const handleFinished = useCallback(() => setDone(true), []);

  const {
    state,
    chapterIndex,
    chapter,
    playing,
    setPlaying,
    camera,
    cursor,
    clickAt,
    goTo,
  } = useDirector({
    chapters,
    initial: seed,
    innerRef,
    viewportRef,
    reducedMotion: !!reducedMotion,
    onFinished: handleFinished,
  });

  const restart = () => {
    setDone(false);
    goTo(0, initialState(safeLocale, t));
  };

  const progress = ((chapterIndex + (done ? 1 : 0)) / chapters.length) * 100;

  return (
    <>
      <IntroStyles />

      <DemoStage
        state={state}
        demoId={DEMO_ID}
        camera={camera}
        cursor={cursor}
        clickAt={clickAt}
        viewportRef={viewportRef}
        innerRef={innerRef}
      />

      <div className="space-y-3 border-t border-white/10 bg-[#0e0e12] px-4 py-4 text-white sm:space-y-4 sm:px-6 sm:py-5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="min-h-[3.25rem] sm:min-h-[3.25rem]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            {t("forms.intro.stepOf", {
              step: chapterIndex + 1,
              total: chapters.length,
            })}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-white/85">
            {done
              ? t("forms.intro.finished")
              : t(`forms.intro.chapter.${chapter?.key ?? "create"}`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {chapters.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setDone(false);
                  // Replay earlier chapters' outcomes so the jump lands in the
                  // right state — chapter 4 needs a built form to add a
                  // language to.
                  goTo(
                    i,
                    stateAtChapter(chapters, i, initialState(safeLocale, t)),
                  );
                }}
                aria-label={t("forms.intro.goToStep", { step: i + 1 })}
                aria-current={i === chapterIndex || undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === chapterIndex
                    ? "w-6 bg-amber-400"
                    : "w-1.5 bg-white/20 hover:bg-white/40",
                )}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {done ? (
              <button
                type="button"
                onClick={restart}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("forms.intro.replayShort")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={
                  playing ? t("forms.intro.pause") : t("forms.intro.play")
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-[#131515] transition-opacity hover:opacity-90"
            >
              {done ? t("forms.intro.done") : t("forms.intro.skip")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function IntroStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.fi-ripple {
  position: absolute;
  left: -14px; top: -14px;
  width: 32px; height: 32px;
  border-radius: 9999px;
  border: 2px solid rgba(255,255,255,.9);
  box-shadow: 0 0 0 1px rgba(0,0,0,.35);
  animation: fi-ripple .45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes fi-ripple {
  0%   { opacity: 0; transform: scale(.35); }
  35%  { opacity: 1; transform: scale(.6); }
  100% { opacity: 0; transform: scale(1.25); }
}
@media (prefers-reduced-motion: reduce) {
  .fi-ripple { animation: none; opacity: 0; }
}
`,
      }}
    />
  );
}
