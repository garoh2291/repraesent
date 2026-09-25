import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

export type ChecklistStep = {
  id: string;
  label: ReactNode;
  /** One short line under the label. Shown on the step that needs you. */
  hint?: ReactNode;
  done: boolean;
  onClick?: () => void;
};

const HIDDEN_PREFIX = "checklist-hidden:";

/** Local "the owner did this" flags the server has no record of (copied the code, tried the chat). */
export function readLocalFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setLocalFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
    window.dispatchEvent(new CustomEvent("local-flag", { detail: key }));
  } catch {
    /* private window — the step just stays open */
  }
}

/** Subscribes to a flag set by `setLocalFlag`, from this tab or another one. */
export function useLocalFlag(key: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readLocalFlag(key));
    const sync = () => setOn(readLocalFlag(key));
    window.addEventListener("local-flag", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("local-flag", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);
  return on;
}

/**
 * "Getting ready": the three or four things that take an editor from empty to
 * live on the owner's website. The first open step carries the marker — it is
 * the one that needs them. Once everything is done it shrinks to one line.
 */
export function SetupChecklist({
  id,
  title,
  steps,
  doneLabel,
  className,
}: {
  /** Per-editor key; closing the list is remembered in this browser. */
  id: string;
  title?: ReactNode;
  steps: ChecklistStep[];
  /** Shown as the single line once every step is done. */
  doneLabel?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(readLocalFlag(HIDDEN_PREFIX + id));
  }, [id]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const nextIndex = steps.findIndex((s) => !s.done);

  // On a phone the steps are a sideways strip and only the first two fit.
  // Bring the one that needs the owner to the front instead of leaving it
  // off-screen behind the steps they already finished.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list || nextIndex < 0) return;
    const item = list.children[nextIndex] as HTMLElement | undefined;
    if (!item || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: Math.max(0, item.offsetLeft - 12) });
  }, [nextIndex, hidden]);

  if (hidden) return null;

  if (allDone) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px]",
          className,
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-earned-soft text-earned">
          <Check className="size-3.5" aria-hidden />
        </span>
        <span className="font-medium text-foreground">
          {doneLabel ?? t("guided.checklist.allDone")}
        </span>
        <button
          type="button"
          onClick={() => {
            setLocalFlag(HIDDEN_PREFIX + id);
            setHidden(true);
          }}
          className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("guided.checklist.hide")}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <nav
      aria-label={t("guided.checklist.label")}
      className={cn("rounded-xl border border-border bg-card", className)}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <p className="text-[13px] font-semibold text-foreground">
          {title ?? t("guided.checklist.title")}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("guided.checklist.progress", { done: doneCount, total: steps.length })}
        </p>
      </div>
      <ol ref={listRef} className="relative flex snap-x gap-2 overflow-x-auto px-3 pb-3 pt-2 [scrollbar-width:none] sm:grid sm:overflow-visible sm:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]"
        style={{ ["--steps" as string]: steps.length }}
      >
        {steps.map((step, i) => {
          const isNext = i === nextIndex;
          return (
            <li key={step.id} className="min-w-[13rem] snap-start sm:min-w-0">
              <button
                type="button"
                onClick={step.onClick}
                disabled={!step.onClick}
                aria-current={isNext ? "step" : undefined}
                className={cn(
                  "flex h-full min-h-11 w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-default",
                  isNext
                    ? "bg-marker-soft hover:bg-marker/60"
                    : "hover:bg-muted/70",
                )}
              >
                <span
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                    step.done
                      ? "bg-foreground text-background"
                      : isNext
                        ? "bg-marker text-foreground ring-1 ring-foreground/15"
                        : "border border-border text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-3" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[13px] leading-snug",
                      step.done
                        ? "text-muted-foreground line-through decoration-foreground/25"
                        : "font-medium text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {isNext && step.hint ? (
                    <span className="mt-0.5 block text-xs leading-snug text-marker-ink">
                      {step.hint}
                    </span>
                  ) : null}
                  {step.done ? (
                    <span className="sr-only">{t("guided.checklist.doneSr")}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
