"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  cancelReTranslateRun,
  detectReTranslateMenu,
  getReTranslateOverview,
  getReTranslatePage,
  getReTranslatePages,
  getReTranslateRuns,
  getReTranslateStyle,
  publishReTranslateWaiting,
  putReTranslateLanguages,
  putReTranslateOptions,
  putReTranslateSentence,
  putReTranslateStyle,
  setReTranslatePageLive,
  startReTranslateRun,
  type ReTranslateLanguage,
  type ReTranslateOverview,
  type ReTranslatePage,
  type ReTranslatePageView,
  type ReTranslatePublishWaitingResult,
  type ReTranslateRun,
  type ReTranslateSettings,
  type ReTranslateStyle,
  type ReTranslateTarget,
} from "~/lib/api/re-translate";

/**
 * How this screen stays true:
 *
 * - A click changes the screen at once (optimistic write into the cache) and
 *   the request runs behind it. A failure puts the old value back and says so.
 * - What the server answers is written into the cache; nothing refetches the
 *   whole site after a click. Only the one thing a click can change is
 *   refreshed in the background.
 * - A translation that moves forward (a page finished, the run ended) marks
 *   the page list and every opened page as stale, so what you open afterwards
 *   is never the text from before.
 * - Everything here is stale at once (the app default is five minutes): a page
 *   opened again always asks the site what it holds now.
 */

type Key = readonly unknown[];

/** While a run is being created, a refresh must not wipe the "Starting…" the person already sees. */
const START_RUN = ["re-translate", "start-run"] as const;
const STARTING = "starting-";

const root = (target: ReTranslateTarget) => ["wordpress", "re-translate", target.urlId ?? "site", target.pluginUuid] as const;
const overviewKey = (target: ReTranslateTarget): Key => [...root(target), "overview"];
const pagesKey = (target: ReTranslateTarget): Key => [...root(target), "pages"];
const runsKey = (target: ReTranslateTarget): Key => [...root(target), "runs"];
const pageKey = (target: ReTranslateTarget, path: string | null, lang: string | null): Key => [...root(target), "page", path, lang];
const styleKey = (target: ReTranslateTarget): Key => [...root(target), "style"];

type PagesData = { pages: ReTranslatePage[]; site_changed: boolean };
type RunsData = { runs: ReTranslateRun[] };

const isActive = (r: ReTranslateRun) => r.status === "queued" || r.status === "running";

function hasActiveRun(overview: ReTranslateOverview | undefined): boolean {
  return !!overview?.runs.some(isActive);
}

/** A run's progress as one string: when it differs, the translation moved. */
function progressOf(overview: ReTranslateOverview | undefined): string {
  return (overview?.runs ?? []).map((r) => `${r.id}:${r.status}:${r.done}:${r.failed}`).join("|");
}

/** The pages, the live strips and every opened page read the site again; the next look is never old. */
function markTranslationMoved(qc: QueryClient, target: ReTranslateTarget) {
  void qc.invalidateQueries({ queryKey: pagesKey(target) });
  void qc.invalidateQueries({ queryKey: runsKey(target) });
  void qc.invalidateQueries({ queryKey: [...root(target), "page"] });
}

/**
 * Writes `change` into the cache before the request answers. Returns what is
 * needed to put things back if the request fails.
 */
async function optimistic(qc: QueryClient, keys: Key[], change: () => void) {
  await Promise.all(keys.map((queryKey) => qc.cancelQueries({ queryKey })));
  const before = keys.map((queryKey) => [queryKey, qc.getQueryData(queryKey)] as const);
  change();
  return {
    rollback: () => {
      for (const [queryKey, data] of before) qc.setQueryData(queryKey, data);
    },
  };
}

function patchOverview(qc: QueryClient, target: ReTranslateTarget, fn: (o: ReTranslateOverview) => ReTranslateOverview) {
  qc.setQueryData<ReTranslateOverview>(overviewKey(target), (o) => (o ? fn(o) : o));
}

/** Overview polls while a run is in progress, so progress moves without a refresh. */
export function useReTranslateOverview(target: ReTranslateTarget) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: overviewKey(target),
    queryFn: async () => {
      const before = progressOf(qc.getQueryData<ReTranslateOverview>(overviewKey(target)));
      const next = await getReTranslateOverview(target);
      if (qc.isMutating({ mutationKey: START_RUN }) > 0) {
        const placeholders = (qc.getQueryData<ReTranslateOverview>(overviewKey(target))?.runs ?? []).filter((r) => r.id.startsWith(STARTING) && !next.runs.some((n) => isActive(n) && n.target_lang === r.target_lang));
        next.runs = [...placeholders, ...next.runs];
      }
      // A page was finished, or a run started, ended or stopped: what is shown for pages must follow.
      if (before !== progressOf(next) && qc.getQueryData(overviewKey(target))) markTranslationMoved(qc, target);
      return next;
    },
    enabled: !!target.pluginUuid,
    staleTime: 0,
    refetchInterval: (q) => (hasActiveRun(q.state.data) && qc.isMutating({ mutationKey: START_RUN }) === 0 ? 3000 : false),
  });
}

export function useReTranslatePages(target: ReTranslateTarget, polling: boolean) {
  return useQuery({
    queryKey: pagesKey(target),
    queryFn: () => getReTranslatePages(target),
    enabled: !!target.pluginUuid,
    staleTime: 0,
    refetchInterval: polling ? 8000 : false,
  });
}

/** Runs with their pages, while one is going: which page is being translated right now. */
export function useReTranslateRuns(target: ReTranslateTarget, polling: boolean) {
  return useQuery({
    queryKey: runsKey(target),
    queryFn: () => getReTranslateRuns(target),
    enabled: !!target.pluginUuid && polling,
    staleTime: 0,
    refetchInterval: polling ? 3000 : false,
  });
}

/**
 * One page with its sentences. Always asked again when opened, and kept
 * current while a translation into this language is running.
 */
export function useReTranslatePage(target: ReTranslateTarget, path: string | null, lang: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: pageKey(target, path, lang),
    queryFn: () => getReTranslatePage(target, path!, lang!),
    enabled: !!target.pluginUuid && !!path && !!lang,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: () => {
      const overview = qc.getQueryData<ReTranslateOverview>(overviewKey(target));
      return overview?.runs.some((r) => isActive(r) && r.target_lang === lang) ? 3000 : false;
    },
  });
}

export function useReTranslateStyle(target: ReTranslateTarget) {
  return useQuery({
    queryKey: styleKey(target),
    queryFn: () => getReTranslateStyle(target),
    enabled: !!target.pluginUuid,
  });
}

/** Mirrors the API's merge of an options change into the stored settings. */
export function applyOptions(settings: ReTranslateSettings, body: Parameters<typeof putReTranslateOptions>[1]): ReTranslateSettings {
  const patch = body.switcher ?? {};
  const flag = (locale: string, current?: string) => (body.flags && locale in body.flags ? body.flags[locale] : current);
  return {
    ...settings,
    paused: body.paused ?? settings.paused,
    switcher: {
      ...settings.switcher,
      ...patch,
      colors: { ...settings.switcher.colors, ...(patch.colors ?? {}) },
      site: "site" in patch ? (patch.site ?? null) : settings.switcher.site,
    },
    source: { ...settings.source, flag: flag("source", settings.source.flag) },
    languages: settings.languages.map((l) => ({ ...l, enabled: body.enabled?.[l.locale] ?? l.enabled, flag: flag(l.locale, l.flag) })),
  };
}

/** The language list as the API will store it: asked-for languages on, the rest kept but off. */
export function applyLanguages(overview: ReTranslateOverview, body: { source?: string; targets: string[] }): ReTranslateSettings {
  const s = overview.settings;
  const known = (locale: string): ReTranslateLanguage | undefined => s.languages.find((l) => l.locale === locale) ?? overview.locales.find((l) => l.locale === locale);
  const source = body.source ?? s.source.locale;
  const info = known(source) ?? overview.locales.find((l) => l.locale === source);
  const languages = body.targets.flatMap((locale) => {
    const l = known(locale);
    return l ? [{ ...l, enabled: true }] : [];
  });
  for (const l of s.languages) if (!body.targets.includes(l.locale)) languages.push({ ...l, enabled: false });
  return {
    ...s,
    source: source === s.source.locale ? s.source : { locale: source, bcp47: info?.bcp47 ?? source, name: info?.name, native: info?.native, flag: undefined },
    languages,
  };
}

/** Every write shows at once; the answer from the site then settles it. */
export function useReTranslateActions(target: ReTranslateTarget) {
  const qc = useQueryClient();
  /** What the answer from the site changes beyond what was already shown. Quiet: nothing waits on it. */
  const settle = (...keys: Key[]) => keys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
  const takeSettings = (settings: ReTranslateSettings) => patchOverview(qc, target, (o) => ({ ...o, settings }));

  return {
    saveLanguages: useMutation({
      mutationFn: (body: { source?: string; targets: string[] }) => putReTranslateLanguages(target, body),
      onMutate: async (body) => {
        const current = qc.getQueryData<ReTranslateOverview>(overviewKey(target));
        return optimistic(qc, [overviewKey(target)], () => current && patchOverview(qc, target, (o) => ({ ...o, settings: applyLanguages(o, body) })));
      },
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: (settings) => {
        takeSettings(settings);
        settle(overviewKey(target));
      },
    }),

    saveOptions: useMutation({
      mutationFn: (body: Parameters<typeof putReTranslateOptions>[1]) => putReTranslateOptions(target, body),
      onMutate: (body) => optimistic(qc, [overviewKey(target)], () => patchOverview(qc, target, (o) => ({ ...o, settings: applyOptions(o.settings, body) }))),
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: (settings) => {
        takeSettings(settings);
        // Only a switch that changes what visitors can open needs the overview read again.
        settle(overviewKey(target));
      },
    }),

    startRun: useMutation({
      mutationKey: START_RUN,
      mutationFn: (body: Parameters<typeof startReTranslateRun>[1]) => startReTranslateRun(target, body),
      onMutate: (body) => {
        const now = new Date().toISOString();
        const pages = qc.getQueryData<PagesData>(pagesKey(target))?.pages ?? [];
        const total = body.scope === "pages" ? (body.paths?.length ?? 0) : body.scope === "changed" ? pages.filter((p) => p.changed || !p.languages[body.lang]).length : pages.length;
        // The run is on screen before the site has answered: the button turns into progress.
        return optimistic(qc, [overviewKey(target)], () =>
          patchOverview(qc, target, (o) =>
            o.runs.some((r) => isActive(r) && r.target_lang === body.lang)
              ? o
              : { ...o, runs: [{ id: `${STARTING}${body.lang}`, target_lang: body.lang, scope: body.scope ?? "all", status: "queued", total, done: 0, failed: 0, error: null, created_at: now, finished_at: null }, ...o.runs] },
          ),
        );
      },
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: ({ run }, body) => {
        patchOverview(qc, target, (o) => ({ ...o, runs: [run, ...o.runs.filter((r) => r.id !== run.id && r.id !== `${STARTING}${body.lang}`)] }));
        settle(overviewKey(target), runsKey(target));
      },
    }),

    cancelRun: useMutation({
      mutationFn: (runId: string) => cancelReTranslateRun(target, runId),
      onMutate: (runId) => {
        const stopped = (r: ReTranslateRun): ReTranslateRun => (r.id === runId && isActive(r) ? { ...r, status: "cancelled", finished_at: new Date().toISOString() } : r);
        return optimistic(qc, [overviewKey(target), runsKey(target)], () => {
          patchOverview(qc, target, (o) => ({ ...o, runs: o.runs.map(stopped) }));
          qc.setQueryData<RunsData>(runsKey(target), (d) => d && { runs: d.runs.map(stopped) });
        });
      },
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: ({ runs }) => {
        qc.setQueryData<RunsData>(runsKey(target), { runs });
        patchOverview(qc, target, (o) => ({ ...o, runs: runs.map(({ items: _items, ...run }) => run) }));
        markTranslationMoved(qc, target);
      },
    }),

    saveSentence: useMutation({
      mutationFn: (body: Parameters<typeof putReTranslateSentence>[1]) => putReTranslateSentence(target, body),
      onMutate: (body) =>
        optimistic(qc, [pageKey(target, body.path, body.lang)], () =>
          qc.setQueryData<ReTranslatePageView>(pageKey(target, body.path, body.lang), (v) =>
            v && { ...v, sentences: v.sentences.map((s) => (s.key === body.key ? { ...s, target: body.target, origin: "edit", flags: [] } : s)) },
          ),
        ),
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: ({ sentence }, body) => {
        qc.setQueryData<ReTranslatePageView>(pageKey(target, body.path, body.lang), (v) => v && { ...v, sentences: v.sentences.map((s) => (s.key === body.key ? sentence : s)) });
        settle(pagesKey(target));
      },
    }),

    setLive: useMutation({
      mutationFn: (body: Parameters<typeof setReTranslatePageLive>[1]) => setReTranslatePageLive(target, body),
      onMutate: (body) => {
        const state = body.live ? "live" : "draft";
        return optimistic(qc, [pageKey(target, body.path, body.lang), pagesKey(target)], () => {
          qc.setQueryData<ReTranslatePageView>(pageKey(target, body.path, body.lang), (v) => (v?.page ? { ...v, page: { ...v.page, state } } : v));
          qc.setQueryData<PagesData>(
            pagesKey(target),
            (d) =>
              d && {
                ...d,
                pages: d.pages.map((p) => {
                  const cur = p.languages[body.lang];
                  return p.path === body.path && cur ? { ...p, languages: { ...p.languages, [body.lang]: { ...cur, state } } } : p;
                }),
              },
          );
        });
      },
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: (_r, body) => {
        // Which languages visitors can open depends on what is live.
        settle(overviewKey(target), pageKey(target, body.path, body.lang));
      },
    }),

    /** Every waiting page live. The site answers a large set in parts, so this asks again while pages are left and the last answer moved some. */
    publishWaiting: useMutation({
      mutationFn: async (body: { lang?: string }) => {
        let published = 0;
        const failed = new Map<string, ReTranslatePublishWaitingResult["failed"][number]>();
        for (let part = 0; part < 50; part++) {
          const res = await publishReTranslateWaiting(target, body);
          published += res.published;
          for (const f of res.failed) failed.set(`${f.lang}:${f.path}`, f);
          if (res.remaining === 0 || res.published === 0) break;
        }
        return { published, failed: [...failed.values()] };
      },
      // Also after an error halfway: pages made live before it are live.
      onSettled: () => {
        markTranslationMoved(qc, target);
        settle(overviewKey(target));
      },
    }),

    saveStyle: useMutation({
      mutationFn: (body: Parameters<typeof putReTranslateStyle>[1]) => putReTranslateStyle(target, body),
      onMutate: (body) => optimistic(qc, [styleKey(target)], () => qc.setQueryData<ReTranslateStyle>(styleKey(target), (s) => s && { ...s, brand: { ...s.brand, ...body } })),
      onError: (_e, _b, ctx) => ctx?.rollback(),
      onSuccess: (style) => qc.setQueryData<ReTranslateStyle>(styleKey(target), (s) => (s ? { ...s, ...style } : s)),
    }),

    /** Looks for the website's own language menu; saves nothing. */
    detectMenu: useMutation({ mutationFn: () => detectReTranslateMenu(target) }),
  };
}
