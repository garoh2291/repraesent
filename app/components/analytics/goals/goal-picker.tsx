import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, FileDown, FolderOpen, Link2, MapPin, MessageCircle, Search, Share2, MousePointerClick, Target } from "lucide-react";
import { cn } from "~/lib/utils";
import { useFocusOnOpen } from "./use-focus-on-open";
import { formatNumber } from "~/lib/utils/format";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import type { StatsParams } from "~/lib/api/website-stats";
import {
  getGoalSuggestions,
  goalKeys,
  previewGoal,
  type GoalSpec,
  type PresetKey,
  type WebsiteGoal,
} from "~/lib/api/website-goals";
import { PRESETS, defaultLabel, eventLabel, presetHint, presetLabel, specKey } from "./goal-words";

const PRESET_ICON: Record<PresetKey, ReactNode> = {
  directions: <MapPin className="size-4" aria-hidden />,
  whatsapp: <MessageCircle className="size-4" aria-hidden />,
  social: <Share2 className="size-4" aria-hidden />,
  download: <FileDown className="size-4" aria-hidden />,
};

/** Events the ready-made goals already cover, kept out of "other things". */
const COVERED_EVENTS = new Set(["Outbound Link: Click", "File Download", "engagement", "pageview"]);

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Pick what counts: ready-made goals, real pages from the website, a group of
 * pages, links people clicked, other events. Shared by "Add a goal" and the
 * step editor. Numbers next to each choice are people in the picked period.
 */
export function GoalPicker({
  workspaceId,
  params,
  onPick,
  savedGoals,
  taken,
}: {
  workspaceId: string;
  params: StatsParams;
  onPick: (spec: GoalSpec, label: string) => void;
  /** Offered first when building steps. */
  savedGoals?: WebsiteGoal[];
  /** Goals already saved: shown as "Added" and not pickable again. */
  taken?: Set<string>;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useFocusOnOpen(searchRef, "picker");
  const [group, setGroup] = useState("");
  const needle = q.trim().toLowerCase();

  const suggestions = useQuery({
    queryKey: goalKeys.suggestions(workspaceId, params),
    queryFn: () => getGoalSuggestions(params),
    staleTime: 5 * 60_000,
  });

  const groupPath = normaliseGroup(group);
  const groupSpec: GoalSpec | null = groupPath ? { kind: "page", match: { path: groupPath } } : null;
  const debounced = useDebounced(groupSpec, 400);
  const preview = useQuery({
    queryKey: goalKeys.preview(workspaceId, params, debounced ?? { kind: "page" }),
    queryFn: () => previewGoal(params, debounced as GoalSpec),
    enabled: !!debounced,
    staleTime: 60_000,
  });

  const match = (text: string) => !needle || text.toLowerCase().includes(needle);
  const data = suggestions.data;
  const presets = PRESETS.filter((p) => match(presetLabel(p, t)) || match(presetHint(p, t)));
  const goals = (savedGoals ?? []).filter((g) => match(g.label));
  const pages = (data?.pages ?? []).filter((p) => match(p.value)).slice(0, needle ? 20 : 8);
  const hosts = (data?.hosts ?? []).filter((h) => match(h.value)).slice(0, 8);
  const events = (data?.events ?? []).filter((e) => !COVERED_EVENTS.has(e.value) && match(eventLabel(e.value, t))).slice(0, 8);

  const pick = (spec: GoalSpec, label?: string) => onPick(spec, label ?? defaultLabel(spec, t));
  const isTaken = (spec: GoalSpec) => !!taken?.has(specKey(spec));

  // Enter in the search picks the top match, like a native select would.
  const first: { spec: GoalSpec; label?: string } | null = (() => {
    const g = goals[0];
    if (g) return { spec: { kind: g.kind, preset: g.preset ?? null, match: g.match }, label: g.label };
    const p = presets.find((k) => !isTaken({ kind: "preset", preset: k }));
    if (p && needle) return { spec: { kind: "preset", preset: p } };
    const page = pages.find((x) => !isTaken({ kind: "page", match: { path: x.value } }));
    if (page) return { spec: { kind: "page", match: { path: page.value } } };
    const h = hosts[0];
    if (h) return { spec: { kind: "event", match: { name: "Outbound Link: Click", prop: { key: "url", contains: [h.value] } } } };
    const e = events[0];
    if (e) return { spec: { kind: "event", match: { name: e.value } } };
    return null;
  })();

  const nothing =
    !suggestions.isLoading && presets.length + goals.length + pages.length + hosts.length + events.length === 0;

  return (
    <div className="space-y-5">
      <label className="relative block">
        <span className="sr-only">{t("analytics.goals.searchLabel", "Search pages and actions")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("analytics.goals.searchPlaceholder", "Search a page or an action…")}
          className="h-11 pl-9"
          autoComplete="off"
          enterKeyHint="search"
          ref={searchRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && first && needle) {
              e.preventDefault();
              pick(first.spec, first.label);
            }
          }}
        />
      </label>

      {goals.length ? (
        <Group title={t("analytics.goals.group.yours", "Your goals")}>
          {goals.map((g) => (
            <Row
              key={g.id}
              icon={<Target className="size-4" aria-hidden />}
              title={g.label}
              onClick={() => pick({ kind: g.kind, preset: g.preset ?? null, match: g.match }, g.label)}
            />
          ))}
        </Group>
      ) : null}

      {presets.length ? (
        <Group title={t("analytics.goals.group.ready", "Ready-made")}>
          {presets.map((p) => {
            const spec: GoalSpec = { kind: "preset", preset: p };
            return (
              <Row
                key={p}
                icon={PRESET_ICON[p]}
                title={presetLabel(p, t)}
                hint={presetHint(p, t)}
                added={isTaken(spec)}
                onClick={() => pick(spec)}
              />
            );
          })}
        </Group>
      ) : null}

      <Group title={t("analytics.goals.group.pages", "A page on your website")}>
        {suggestions.isLoading ? (
          <Skeleton className="h-24" />
        ) : pages.length ? (
          pages.map((p) => {
            const spec: GoalSpec = { kind: "page", match: { path: p.value } };
            return (
              <Row
                key={p.value}
                title={<span className="font-mono text-[13.5px]">{p.value}</span>}
                count={p.visitors}
                added={isTaken(spec)}
                onClick={() => pick(spec)}
              />
            );
          })
        ) : (
          <p className="px-1 text-[13px] text-muted-foreground">
            {t("analytics.goals.noPages", "No visited pages in this period yet.")}
          </p>
        )}
      </Group>

      {!needle ? (
        <Group title={t("analytics.goals.group.pageGroup", "A group of pages")}>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-[13px] text-muted-foreground">
              {t("analytics.goals.pageGroupHint", "Every page whose address starts like this — for example all your blog posts.")}
            </p>
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{t("analytics.goals.pageGroupLabel", "Start of the page address")}</span>
                <FolderOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="/blog/"
                  className="h-11 pl-9 font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                disabled={!groupSpec || isTaken(groupSpec)}
                onClick={() => groupSpec && pick(groupSpec)}
              >
                {t("analytics.goals.use", "Use this")}
              </Button>
            </div>
            <p className="mt-2 min-h-5 text-[13px] text-muted-foreground" aria-live="polite">
              {groupSpec && preview.data
                ? t("analytics.goals.previewCount", "{{count}} people visited such a page in this period", {
                    count: preview.data.visitors,
                    formatted: formatNumber(preview.data.visitors),
                  })
                : groupSpec && preview.isFetching
                  ? t("analytics.goals.previewLoading", "Counting…")
                  : null}
            </p>
          </div>
        </Group>
      ) : null}

      {hosts.length ? (
        <Group title={t("analytics.goals.group.links", "A link people clicked")}>
          {hosts.map((h) => {
            const spec: GoalSpec = {
              kind: "event",
              match: { name: "Outbound Link: Click", prop: { key: "url", contains: [h.value] } },
            };
            return (
              <Row
                key={h.value}
                icon={<Link2 className="size-4" aria-hidden />}
                title={h.value}
                count={h.visitors}
                added={isTaken(spec)}
                onClick={() => pick(spec)}
              />
            );
          })}
        </Group>
      ) : null}

      {events.length ? (
        <Group title={t("analytics.goals.group.events", "Something else people did")}>
          {events.map((e) => {
            const spec: GoalSpec = { kind: "event", match: { name: e.value } };
            return (
              <Row
                key={e.value}
                icon={<MousePointerClick className="size-4" aria-hidden />}
                title={eventLabel(e.value, t)}
                count={e.visitors}
                added={isTaken(spec)}
                onClick={() => pick(spec)}
              />
            );
          })}
        </Group>
      ) : null}

      {nothing ? (
        <p className="text-[14px] text-muted-foreground">
          {t("analytics.goals.searchEmpty", "Nothing matches “{{q}}”. Try part of the page address, like “kontakt”.", { q })}
        </p>
      ) : null}
    </div>
  );
}

/** "/blog" → "/blog/*", "/blog/*" stays; "" → null. */
function normaliseGroup(raw: string): string | null {
  let v = raw.trim();
  if (!v || v === "/" || /\s/.test(v)) return null;
  if (!v.startsWith("/")) v = `/${v}`;
  if (!v.endsWith("*")) v = v.endsWith("/") ? `${v}*` : `${v}*`;
  return v.length > 300 ? null : v;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({
  icon,
  title,
  hint,
  count,
  added,
  onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: string;
  count?: number;
  added?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={added}
      className={cn(
        "press flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
        "disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
      )}
    >
      {icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-[14.5px] font-medium leading-snug text-foreground">{title}</span>
        {hint ? <span className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
      {added ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-muted-foreground">
          <Check className="size-3.5" aria-hidden />
          {t("analytics.goals.added", "Added")}
        </span>
      ) : count != null ? (
        <span className="num shrink-0 text-[13px] text-muted-foreground">
          {t("analytics.goals.peopleShort", "{{formatted}} people", { count, formatted: formatNumber(count) })}
        </span>
      ) : null}
      {added ? null : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>
  );
}
