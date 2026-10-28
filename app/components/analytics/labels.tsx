import type { TFunction } from "i18next";
import { countryName } from "~/lib/forms/phone";
import { flagEmoji, regionName, secondsToWords } from "~/lib/analytics/website-stats";
import { formatNumber } from "~/lib/utils/format";
import type { StatsDimension, StatsMetric } from "~/lib/api/website-stats";

/** Plain-word name of a dimension, for filter chips and headers. */
export function dimensionLabel(dim: StatsDimension, t: TFunction): string {
  const map: Record<StatsDimension, [string, string]> = {
    channel: ["analytics.dim.channel", "Channel"],
    source: ["analytics.dim.source", "Source"],
    referrer: ["analytics.dim.referrer", "Referring page"],
    utm_medium: ["analytics.dim.utmMedium", "UTM medium"],
    utm_source: ["analytics.dim.utmSource", "UTM source"],
    utm_campaign: ["analytics.dim.utmCampaign", "UTM campaign"],
    utm_content: ["analytics.dim.utmContent", "UTM content"],
    utm_term: ["analytics.dim.utmTerm", "UTM term"],
    page: ["analytics.dim.page", "Page"],
    entry_page: ["analytics.dim.entryPage", "Entry page"],
    exit_page: ["analytics.dim.exitPage", "Exit page"],
    country: ["analytics.dim.country", "Country"],
    region: ["analytics.dim.region", "Region"],
    device: ["analytics.dim.device", "Device"],
    browser: ["analytics.dim.browser", "Browser"],
    os: ["analytics.dim.os", "System"],
    goal: ["analytics.dim.goal", "Goal"],
  };
  const [k, fallback] = map[dim];
  return t(k, fallback);
}

/** How a stored value reads on screen. The raw value is what filters use. */
export function valueLabel(
  dim: StatsDimension,
  value: string,
  t: TFunction,
  locale: string,
): { text: string; prefix?: string; hint?: string; mono?: boolean } {
  if (value === "(none)") return { text: t("analytics.none", "(none)") };
  if (dim === "source" && value === "Direct / None") {
    return { text: t("analytics.sourceDirect", "Typed your address or saved link") };
  }
  if (dim === "channel" && value === "Direct") {
    return { text: t("analytics.channelDirect", "Direct") };
  }
  if (dim === "country") {
    return { text: countryName(value, locale), prefix: flagEmoji(value) };
  }
  if (dim === "region") {
    const name = regionName(value);
    return name === value ? { text: value } : { text: name, hint: value };
  }
  if (dim === "device") {
    const devices: Record<string, [string, string]> = {
      Mobile: ["analytics.device.mobile", "Phone"],
      Desktop: ["analytics.device.desktop", "Computer"],
      Tablet: ["analytics.device.tablet", "Tablet"],
      Laptop: ["analytics.device.laptop", "Laptop"],
    };
    const hit = devices[value];
    return { text: hit ? t(hit[0], hit[1]) : value };
  }
  if (dim === "browser" && value === "Mobile App") {
    return { text: t("analytics.inAppBrowser", "In-app browser (Instagram, Facebook…)") };
  }
  if (dim === "page" || dim === "entry_page" || dim === "exit_page") {
    return { text: value, mono: true };
  }
  return { text: value };
}

export function formatMetric(metric: StatsMetric, value: number, locale: string): string {
  if (metric === "bounce_rate") return `${Math.round(value)}%`;
  if (metric === "visit_duration") return secondsToWords(value, locale);
  if (metric === "views_per_visit") {
    return value.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  }
  return formatNumber(value);
}

export function metricLabel(metric: StatsMetric, t: TFunction): string {
  const map: Record<StatsMetric, [string, string]> = {
    visitors: ["analytics.metric.visitors", "People"],
    visits: ["analytics.metric.visits", "Visits"],
    pageviews: ["analytics.metric.pageviews", "Pages viewed"],
    views_per_visit: ["analytics.metric.viewsPerVisit", "Pages per visit"],
    bounce_rate: ["analytics.metric.bounceRate", "Left after one page"],
    visit_duration: ["analytics.metric.visitDuration", "Time per visit"],
  };
  return t(map[metric][0], map[metric][1]);
}
