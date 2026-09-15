/**
 * Public order tracking: /t/:token
 *
 * The one page in this app whose reader has no account, arrived from an email,
 * and is almost certainly on a phone. So: one column, one job — say where the
 * order is — and no navigation to anywhere they cannot go.
 *
 * Never rendered on the server. The token is a credential and the endpoint
 * answers `no-store`; fetching it in a loader would put a customer's order
 * state through the app's SSR layer for no benefit, since there is nothing
 * here to index.
 */

import { useQuery } from "@tanstack/react-query";
import { Check, PackageX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { DocumentScheme } from "~/components/forms/PublicShell";
import i18n from "~/i18n";
import {
  getDealTracking,
  type DealTrackingView,
  type TrackingStage,
} from "~/lib/api/deal-tracking";
import { resolveStageColors } from "~/lib/pipeline-stages/colors";
import { resolveStageLabelByKey } from "~/lib/pipeline-stages/labels";
import type { PipelineStage } from "~/lib/api/pipeline-stages";

export function meta() {
  return [
    {
      title: i18n.t("tracking.metaTitle", { defaultValue: "Order status" }),
    },
    // The URL is a capability. It must never end up in an index.
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function DealTrackingRoute() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["deal-tracking", token],
    queryFn: () => getDealTracking(token!),
    enabled: !!token,
    // A 404 means the link is not active. Retrying cannot change that, and
    // three silent retries just makes the page feel broken for four seconds.
    retry: false,
    refetchOnWindowFocus: true,
  });

  return (
    <>
      <DocumentScheme background="#eeeeee" />
      <main className="min-h-dvh w-full bg-[#eeeeee] px-4 py-8 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-2xl">
          {isLoading ? (
            <Skeleton />
          ) : isError || !data ? (
            <NotActive />
          ) : (
            <Tracking view={data} />
          )}

          <p className="mt-8 text-center text-[11px] text-neutral-400">
            {t("tracking.footer", { defaultValue: "Powered by Repraesent" })}
          </p>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------

function Tracking({ view }: { view: DealTrackingView }) {
  const { t, i18n: i18next } = useTranslation();

  const outcomeLine =
    view.outcome === "won"
      ? t("tracking.outcomeWon", { defaultValue: "This order is complete." })
      : view.outcome === "lost"
        ? t("tracking.outcomeLost", {
            defaultValue: "This order was closed.",
          })
        : null;

  return (
    <div className="space-y-4">
      {/* Who this is from. The logo is the only branding a customer gets, and
          a workspace without one still needs a legible header. */}
      <header className="flex items-center gap-3">
        {view.workspace.logoUrl ? (
          // `contain`, not `cover`: a workspace logo is usually wordmark-shaped
          // and cropping it to a square cuts the name in half. The white plate
          // behind it keeps a transparent logo legible on the grey ground.
          <img
            src={view.workspace.logoUrl}
            alt=""
            className="h-10 w-10 rounded-xl bg-white object-contain p-1 ring-1 ring-black/5"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white">
            {view.workspace.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {view.workspace.name}
          </p>
          <p className="text-xs text-neutral-500">
            {t("tracking.reference", {
              reference: view.reference,
              defaultValue: "Reference {{reference}}",
            })}
          </p>
        </div>
      </header>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t("tracking.statusLabel", { defaultValue: "Status" })}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900 sm:text-2xl">
          {view.currentStage
            ? stageLabel(view.currentStage, t)
            : t("tracking.unknownStage", { defaultValue: "In progress" })}
        </h1>
        {view.title ? (
          <p className="mt-1 text-sm text-neutral-600">{view.title}</p>
        ) : null}
        {outcomeLine ? (
          <p className="mt-3 text-sm text-neutral-600">{outcomeLine}</p>
        ) : null}
        <p className="mt-3 text-xs text-neutral-400">
          {t("tracking.lastUpdated", {
            date: formatDateTime(view.updatedAt, i18next.language),
            defaultValue: "Last updated {{date}}",
          })}
        </p>
      </Card>

      {view.products.length > 0 ? (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t("tracking.itemsLabel", { defaultValue: "What was ordered" })}
          </p>
          <ul className="mt-3 space-y-3">
            {view.products.map((product, index) => (
              <li key={index} className="flex items-center gap-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-neutral-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {product.name ??
                      t("tracking.unnamedItem", { defaultValue: "Item" })}
                  </p>
                  {product.quantity > 1 ? (
                    <p className="text-xs text-neutral-500">
                      {t("tracking.quantity", {
                        count: product.quantity,
                        defaultValue: "Quantity {{count}}",
                      })}
                    </p>
                  ) : null}
                </div>
                {product.unitAmount !== null && product.currency ? (
                  <p className="shrink-0 text-sm tabular-nums text-neutral-700">
                    {formatMoney(
                      product.unitAmount * product.quantity,
                      product.currency,
                      i18next.language,
                    )}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {view.stages.length > 0 ? (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t("tracking.progressLabel", { defaultValue: "Progress" })}
          </p>
          <ol className="mt-4">
            {view.stages.map((stage, index) => (
              <Bead
                key={stage.key}
                stage={stage}
                last={index === view.stages.length - 1}
              />
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * One step of the timeline.
 *
 * Colour is never the only signal: the reached state also carries a tick, the
 * current one carries a text marker and heavier weight, and an upcoming one is
 * a hollow ring with no date. Someone who cannot distinguish the colours still
 * reads the same three states.
 */
function Bead({ stage, last }: { stage: TrackingStage; last: boolean }) {
  const { t, i18n: i18next } = useTranslation();
  const colors = resolveStageColors({
    entity: "deal",
    key: stage.key,
    // The API sends the raw category string; the colour map falls back to a
    // category default for anything it does not know.
    category: stage.category as PipelineStage["category"],
    color: stage.color,
  });

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={`flex items-center justify-center rounded-full transition-colors ${
            stage.current
              ? `size-5 ${colors.dot} ring-4 ring-black/5`
              : stage.reached
                ? `size-4 ${colors.dot}`
                : "size-4 border-2 border-neutral-300 bg-transparent"
          }`}
        >
          {stage.reached && !stage.current ? (
            <Check className="size-2.5 text-white" strokeWidth={4} />
          ) : null}
        </span>
        {!last ? (
          <span
            aria-hidden
            className={`w-0.5 flex-1 ${
              stage.reached ? "bg-neutral-800/70" : "bg-neutral-200"
            }`}
          />
        ) : null}
      </div>

      <div className={last ? "pb-0" : "pb-5"}>
        <p
          className={`text-sm ${
            stage.current
              ? "font-semibold text-neutral-900"
              : stage.reached
                ? "text-neutral-800"
                : "text-neutral-400"
          }`}
        >
          {stageLabel(stage, t)}
        </p>
        {stage.current ? (
          <p className="text-xs font-medium text-neutral-600">
            {t("tracking.currentMarker", { defaultValue: "You are here" })}
          </p>
        ) : stage.reachedAt ? (
          <p className="text-xs text-neutral-500">
            {formatDate(stage.reachedAt, i18next.language)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.2)] sm:p-6">
      {children}
    </section>
  );
}

/**
 * The single failure state.
 *
 * Says the link is not active and stops there. Distinguishing "never existed"
 * from "switched off" from "deleted" would tell a stranger holding an old link
 * something about the workspace, which is exactly what the identical 404s on
 * the server exist to prevent.
 */
function NotActive() {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
          <PackageX className="size-6 text-neutral-400" aria-hidden />
        </div>
        <p className="text-base font-semibold text-neutral-900">
          {t("tracking.invalidTitle", {
            defaultValue: "This link is no longer active",
          })}
        </p>
        <p className="max-w-sm text-sm text-neutral-500">
          {t("tracking.invalidBody", {
            defaultValue:
              "Check the most recent email you received, or reply to it and ask for a new link.",
          })}
        </p>
      </div>
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
      </div>
      <Card>
        <div className="h-3 w-16 animate-pulse rounded bg-neutral-200" />
        <div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-neutral-200" />
      </Card>
      <Card>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-4 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * A stage's name for the customer.
 *
 * The server sends null for a stage nobody renamed — those are the legacy keys
 * (`new`, `in_progress`, `won`, `lost`), which the app already translates into
 * every locale. Resolving them here means a German reader gets the German
 * word, where a server-side fallback would have shipped the raw key.
 */
function stageLabel(
  stage: TrackingStage,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return stage.label ?? resolveStageLabelByKey("deal", stage.key, t as never);
}

/** Absolute, never "3 days ago": a customer wants the date to quote back. */
function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Minor units in, formatted money out. */
function formatMoney(minor: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    // An unknown currency code must not blank the whole line.
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
