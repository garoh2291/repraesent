import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * The one "something didn't work" card: what happened in plain words, and
 * the way forward (try again, go to Today). Used by the page error boundary,
 * the in-app not-found page and failed page loads.
 */
export function ErrorCard({
  title,
  body,
  onRetry,
  showHome = true,
  compact = false,
  className,
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  showHome?: boolean;
  /** Inside a page section instead of filling the page. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn(
        "mx-auto w-full rounded-2xl border border-border bg-card text-center shadow-xs",
        compact ? "max-w-lg px-5 py-6" : "my-10 max-w-md px-6 py-8 sm:my-16",
        className,
      )}
    >
      {/* The mark, in ink: it's still re:praesent, nothing is lost. */}
      <span
        aria-hidden
        className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-foreground text-[15px] font-bold tracking-tight text-background"
      >
        re:
      </span>
      <h2 className="title-display text-[21px] font-semibold text-foreground">{title}</h2>
      {body ? <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{body}</p> : null}
      {children}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        {showHome ? (
          <Button asChild variant="outline" className="h-11 sm:h-10">
            <Link to="/">{t("errors.goToday", "Go to Today")}</Link>
          </Button>
        ) : null}
        {onRetry ? (
          <Button type="button" onClick={onRetry} className="h-11 gap-1.5 sm:h-10">
            <RotateCcw className="size-4" aria-hidden />
            {t("errors.tryAgain", "Try again")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
