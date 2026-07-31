import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { PageShell } from "~/components/wordpress/fields";

/**
 * Chrome shared by the ported WordPress plugin admin screens. Kept separate
 * from any one plugin so each settings page can reuse it.
 *
 * This used to also export PluginSettingsFormError / PluginSettingsFormSuccess.
 * They were never imported anywhere, and they were styled with var(--danger),
 * var(--success-soft) etc. — custom properties that only existed inside a
 * `.wpm-plugin-settings-root` class that was itself never applied, so they would
 * have rendered with no background and no colour had anyone used them. Use the
 * app's own `~/components/ui/alert` instead.
 */
export function PluginSettingsBackLink({ label }: { label: string }) {
  return (
    <Link
      to="/website"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Loading placeholder for every plugin settings screen (and the catalog-resolve
 * gate that sits above them). Mirrors the real header + stats + card layout so
 * the page doesn't jump when data arrives. Pulse bars match the WordPress hub
 * skeleton pattern (`animate-pulse` + `bg-muted`).
 */
export function PluginSettingsLoadingSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7 w-56 animate-pulse rounded bg-muted sm:h-8" />
            <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="space-y-2 border-b p-5">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4 p-5">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

/** Full-page loading shell used by settings routes and early-return loaders. */
export function PluginSettingsLoadingPage() {
  return (
    <PageShell>
      <PluginSettingsLoadingSkeleton />
    </PageShell>
  );
}
