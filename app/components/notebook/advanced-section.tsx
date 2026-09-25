import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

const STORAGE_PREFIX = "advanced-open:";

function readOpen(key: string | undefined): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function writeOpen(key: string | undefined, open: boolean) {
  if (!key) return;
  try {
    if (open) window.localStorage.setItem(STORAGE_PREFIX + key, "1");
    else window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* private window — the section just starts closed next time */
  }
}

/**
 * The layer for everything a web person needs and an owner never does.
 * Closed by default; `forceOpen` wins whenever a problem lives inside, so
 * tucking a setting away can never hide the error that blocks publishing.
 */
export function AdvancedSection({
  storageKey,
  hint,
  title,
  forceOpen = false,
  children,
  className,
}: {
  /** Remembers the open state per section in this browser. */
  storageKey?: string;
  /** One plain line: what lives in here. */
  hint?: ReactNode;
  /** Defaults to "Advanced · for your web person". */
  title?: ReactNode;
  forceOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const bodyId = useId();
  // Read after mount: localStorage does not exist during SSR.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (readOpen(storageKey)) setOpen(true);
  }, [storageKey]);

  const expanded = open || forceOpen;
  const toggle = () => {
    const next = !expanded;
    setOpen(next);
    writeOpen(storageKey, next);
  };

  return (
    <section
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/60",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Wrench
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">
            {title ?? t("guided.advanced.title")}
          </span>
          {hint ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={bodyId} className="space-y-4 border-t border-dashed border-border px-4 pb-4 pt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
