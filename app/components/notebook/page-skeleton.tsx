import { useTranslation } from "react-i18next";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Shown the moment a tap goes to a page whose code is still downloading
 * (slow connection): the new page's frame at once, filled in when ready.
 * Title line, action row, three cards — close to every daily page.
 */
export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      className="mx-auto w-full max-w-[1200px] space-y-5 p-4 sm:space-y-6 sm:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading", "Loading…")}</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl sm:w-40" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
