import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Eye, ExternalLink, MoreHorizontal, Plus, RefreshCw, Search, Square, Trash2 } from "lucide-react";
import type { ReTranslateLanguage, ReTranslateOverview, ReTranslatePage, ReTranslatePageState, ReTranslateRun, ReTranslateTarget } from "~/lib/api/re-translate";
import { useReTranslateActions, useReTranslatePages, useReTranslateRuns } from "~/lib/hooks/useReTranslate";
import { cn } from "~/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { SectionCard } from "~/components/wordpress/fields";
import { errorText, flash } from "~/components/wordpress/re-translate/constants";
import { flagOf, minutesFor } from "./logic";
import { FlagImage } from "./menu-preview";
import { PageView } from "./page-view";

const K = "wordpress.reTranslate.lp";

/** A language's name in the reader's language; the API's English name for a language added since. */
const nameFor = (t: (key: string, fallback: string) => string, l: { locale: string; name: string }) => t(`wordpress.reTranslate.languageName.${l.locale}`, l.name);
/** Open a dialog from a menu item only once the menu has closed; opened in the same tick, Radix's focus return dismisses it. */
const later = (fn: () => void) => window.setTimeout(fn, 0);

type Confirm =
  | { kind: "remove"; language: ReTranslateLanguage; run?: ReTranslateRun }
  | { kind: "again"; language: ReTranslateLanguage; pages: number }
  | { kind: "source"; locale: string; name: string };

/**
 * Languages & pages. One look answers "which of my pages can visitors read
 * in which language": every language has a strip with one tab per page —
 * ink when it is live, marker yellow when it waits for the owner, an outline
 * when it is not translated — and the strip fills in while a translation
 * runs. One button per language does the next sensible thing; everything
 * that cannot be undone asks first.
 */
export function LanguagesPanel({ target, overview, detailed = false }: { target: ReTranslateTarget; overview: ReTranslateOverview; detailed?: boolean }) {
  const { t } = useTranslation();
  const actions = useReTranslateActions(target);
  const activeRuns = overview.runs.filter((r) => r.status === "queued" || r.status === "running");
  const { data: pagesData, isLoading: pagesLoading } = useReTranslatePages(target, activeRuns.length > 0);
  const { data: runsData } = useReTranslateRuns(target, activeRuns.length > 0);
  const [open, setOpen] = useState<{ path: string; title: string; language: ReTranslateLanguage } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [publishAll, setPublishAll] = useState(false);

  const settings = overview.settings;
  const sourceName = settings.source.native?.replace(/\s*\(.*\)$/u, "") || settings.source.name || settings.source.locale;
  const targets = settings.languages.filter((l) => l.enabled);
  const pages = pagesData?.pages ?? [];
  const siteChanged = !!pagesData?.site_changed;
  const locked = overview.plugin.v1_active;

  const saveLanguages = (source: string, next: string[], done?: string) =>
    actions.saveLanguages.mutate({ source, targets: next }, { onSuccess: () => (done ? flash(done) : undefined), onError: (err) => flash(errorText(t, err), "error") });

  const translate = (language: ReTranslateLanguage, scope: "all" | "changed") =>
    actions.startRun.mutate(
      { lang: language.locale, scope },
      {
        onSuccess: (res) =>
          flash(
            res.joined
              ? t(`${K}.alreadyRunning`, "Already translating into {{language}}.", { language: language.native })
              : t(`${K}.started`, "Translating into {{language}}. You can close this page; it keeps going.", { language: language.native }),
          ),
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );

  const waiting = useMemo(() => {
    const out: Array<{ page: ReTranslatePage; language: ReTranslateLanguage }> = [];
    for (const page of pages) for (const language of targets) if (page.languages[language.locale]?.state === "needs_you") out.push({ page, language });
    return out;
  }, [pages, targets]);

  const makeAllLive = () =>
    actions.publishWaiting.mutate(
      {},
      {
        onSuccess: (res) => {
          setPublishAll(false);
          flash(
            res.failed.length === 0
              ? t(`${K}.publishedAll`, "Every waiting page is live now.")
              : t(`${K}.publishedSome`, "The other pages are live. Some could not be changed: open them under Waiting for you to see why."),
            res.failed.length === 0 ? undefined : "error",
          );
        },
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );

  const runFor = (locale: string) => activeRuns.find((r) => r.target_lang === locale);
  const runItems = (run?: ReTranslateRun) => (run ? (runsData?.runs.find((r) => r.id === run.id)?.items ?? []) : []);

  return (
    <div className="space-y-6">
      {/* The original: a sentence, not a form. Changing it asks first once translations exist. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="re-translate-source" className="text-sm text-muted-foreground">
          {t(`${K}.writtenIn`, "Your website is written in")}
        </label>
        <NativeSelect
          id="re-translate-source"
          className="h-10 w-auto min-w-44 font-medium"
          value={settings.source.locale}
          disabled={actions.saveLanguages.isPending}
          onChange={(e) => {
            const locale = e.target.value;
            const info = overview.locales.find((l) => l.locale === locale);
            const anyTranslated = targets.some((l) => (overview.counts[l.locale]?.rows ?? 0) > 0);
            if (anyTranslated && settings.source.locale) setConfirm({ kind: "source", locale, name: info?.native ?? locale });
            else saveLanguages(locale, targets.map((l) => l.locale));
          }}
        >
          {settings.source.locale === "" ? <NativeSelectOption value="">{t(`${K}.chooseLanguage`, "Choose a language")}</NativeSelectOption> : null}
          {overview.locales.map((l) => (
            <NativeSelectOption key={l.locale} value={l.locale}>
              {l.native}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <SectionCard>
        <div className="flex items-baseline justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <h2 className="title-display text-lg font-semibold tracking-tight">{t(`${K}.languagesTitle`, "Languages visitors can read")}</h2>
        </div>

        {!settings.source.locale ? (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">{t(`${K}.sourceFirst`, "First choose the language your website is written in, above.")}</p>
        ) : targets.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8 sm:px-6">
            <p className="max-w-md text-sm text-muted-foreground">{t(`${K}.empty`, "Add the first language your visitors should be able to read your website in. Nothing changes on your website until you translate it.")}</p>
            <AddLanguage overview={overview} onAdd={(l) => saveLanguages(settings.source.locale, [...targets.map((x) => x.locale), l.locale], t(`${K}.added`, "{{language}} added. Translate your website to start.", { language: l.native }))} prominent />
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {targets.map((language) => (
                <LanguageRow
                  key={language.locale}
                  language={language}
                  pages={pages}
                  loading={pagesLoading}
                  siteChanged={siteChanged}
                  home={overview.plugin.site_url ?? overview.plugin.home}
                  run={runFor(language.locale)}
                  runItems={runItems(runFor(language.locale))}
                  locked={locked}
                  starting={actions.startRun.isPending && actions.startRun.variables?.lang === language.locale}
                  stopping={actions.cancelRun.isPending}
                  onTranslate={(scope) => translate(language, scope)}
                  onStop={(run) => actions.cancelRun.mutate(run.id, { onSuccess: () => flash(t(`${K}.stopped`, "Stopped. Pages already translated are kept.")) })}
                  onAskAgain={(count) => setConfirm({ kind: "again", language, pages: count })}
                  onAskRemove={(run) => setConfirm({ kind: "remove", language, run })}
                />
              ))}
            </ul>
            <div className="border-t px-5 py-3 sm:px-6">
              <AddLanguage overview={overview} onAdd={(l) => saveLanguages(settings.source.locale, [...targets.map((x) => x.locale), l.locale], t(`${K}.added`, "{{language}} added. Translate your website to start.", { language: l.native }))} />
            </div>
          </>
        )}
      </SectionCard>

      {waiting.length > 0 ? (
        <SectionCard>
          <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-sm font-semibold tabular-nums">{waiting.length}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{t(`${K}.waitingTitle`, "Waiting for you")}</h2>
              <p className="text-xs text-muted-foreground">{t(`${K}.waitingHint`, "Translated, but not shown to visitors until you have had a look.")}</p>
            </div>
            <Button className="h-10 shrink-0" disabled={locked || actions.publishWaiting.isPending} onClick={() => setPublishAll(true)}>
              {actions.publishWaiting.isPending ? <Spinner className="size-4" /> : <Eye className="size-4" />}
              {t(`${K}.publishAll`, "Make all live")}
            </Button>
          </div>
          <ul className="divide-y">
            {waiting.map(({ page, language }) => (
              <li key={`${page.path}:${language.locale}`} className="flex min-h-14 items-center gap-3 px-5 py-2 sm:px-6">
                <FlagImage country={flagOf(language)} className="h-3.5 w-5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{page.title || page.path}</span>
                  <span className="block truncate text-xs text-muted-foreground">{language.native} · {page.path}</span>
                </span>
                <Button variant="outline" className="h-10 shrink-0" onClick={() => setOpen({ path: page.path, title: page.title || page.path, language })}>
                  {t(`${K}.check`, "Check")}
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {targets.length > 0 ? (
        <PagesList
          pages={pages}
          targets={targets}
          loading={pagesLoading}
          siteChanged={siteChanged}
          working={(locale, path) => runItems(runFor(locale)).some((i) => i.path === path && i.status === "translating")}
          onOpen={(page, language) => setOpen({ path: page.path, title: page.title || page.path, language })}
        />
      ) : null}

      <ConfirmDialog
        confirm={confirm}
        sourceName={sourceName}
        onClose={() => setConfirm(null)}
        onConfirm={(c) => {
          setConfirm(null);
          if (c.kind === "remove") {
            if (c.run) actions.cancelRun.mutate(c.run.id);
            saveLanguages(settings.source.locale, targets.filter((l) => l.locale !== c.language.locale).map((l) => l.locale), t(`${K}.removed`, "Visitors no longer see {{language}}. Its translations are kept.", { language: c.language.native }));
          } else if (c.kind === "again") translate(c.language, "all");
          else saveLanguages(c.locale, targets.map((l) => l.locale), t(`${K}.sourceChanged`, "Your website's language is now {{language}}.", { language: c.name }));
        }}
      />

      <PublishAllDialog
        open={publishAll}
        waiting={waiting}
        busy={actions.publishWaiting.isPending}
        onClose={() => (actions.publishWaiting.isPending ? undefined : setPublishAll(false))}
        onConfirm={makeAllLive}
      />

      <PageView target={target} path={open?.path ?? null} title={open?.title ?? ""} language={open?.language ?? null} onClose={() => setOpen(null)} detailed={detailed} />
    </div>
  );
}

// ------------------------------------------------------------------ one language

function LanguageRow(props: {
  language: ReTranslateLanguage;
  pages: ReTranslatePage[];
  loading: boolean;
  siteChanged: boolean;
  home: string;
  run?: ReTranslateRun;
  runItems: NonNullable<ReTranslateRun["items"]>;
  locked: boolean;
  starting: boolean;
  stopping: boolean;
  onTranslate: (scope: "all" | "changed") => void;
  onStop: (run: ReTranslateRun) => void;
  onAskAgain: (pages: number) => void;
  onAskRemove: (run?: ReTranslateRun) => void;
}) {
  const { t } = useTranslation();
  const { language, pages, run } = props;
  const state = (p: ReTranslatePage) => p.languages[language.locale]?.state;
  const live = pages.filter((p) => state(p) === "live").length;
  const waiting = pages.filter((p) => state(p) === "needs_you").length;
  const translated = pages.filter((p) => state(p)).length;
  // Same rule the API uses for "new and changed": edited since read, or never translated into this language.
  const pending = props.siteChanged ? pages.length : pages.filter((p) => p.changed || !state(p)).length;
  const address = `${props.home.replace(/^https?:\/\//, "").replace(/\/$/, "")}/${language.prefix}/`;

  return (
    <li className="space-y-3 px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <FlagImage country={flagOf(language)} className="mt-1 h-4 w-6" />
        <div className="min-w-0 flex-1">
          <p className="title-display text-xl font-semibold leading-tight tracking-tight">{language.native}</p>
          <p className="truncate text-xs text-muted-foreground">
            {nameFor(t, language) !== language.native ? `${nameFor(t, language)} · ` : ""}
            {address}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="text-right" aria-live="polite">
            {props.loading ? (
              <Skeleton className="ml-auto mt-2.5 h-5 w-16" />
            ) : translated === 0 ? (
              <p className="text-sm leading-10 text-muted-foreground">{t(`${K}.notYet`, "Not translated yet")}</p>
            ) : (
              <>
                <p className="text-lg font-semibold leading-tight tabular-nums">{t(`${K}.liveCount`, "{{live}} of {{total}}", { live, total: pages.length })}</p>
                <p className="text-xs text-muted-foreground">{t(`${K}.livePages`, "pages live")}</p>
                {waiting > 0 ? <p className="text-xs text-muted-foreground">{t(`${K}.waitingCount`, "{{count}} waiting for you", { count: waiting })}</p> : null}
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="-mr-2 shrink-0" aria-label={t(`${K}.moreFor`, "More for {{language}}", { language: language.native })}>
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {live > 0 ? (
                <DropdownMenuItem asChild className="min-h-10">
                  <a href={`${props.home.replace(/\/$/, "")}/${language.prefix}/`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    {t(`${K}.visit`, "Open your website in {{language}}", { language: language.native })}
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="min-h-10" disabled={!!run || props.locked || pages.length === 0} onSelect={() => later(() => props.onAskAgain(pages.length))}>
                <RefreshCw className="size-4" />
                {t(`${K}.again`, "Translate every page again")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-10" variant="destructive" onSelect={() => later(() => props.onAskRemove(run))}>
                <Trash2 className="size-4" />
                {t(`${K}.remove`, "Stop offering {{language}}", { language: language.native })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="min-w-0">
          {run ? (
            <RunStatus run={run} items={props.runItems} stopping={props.stopping} onStop={() => props.onStop(run)} />
          ) : props.loading ? null : pending === 0 ? (
            <span className="inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="size-4" />
              {t(`${K}.upToDate`, "Up to date")}
            </span>
          ) : (
            <div className="flex flex-col items-end gap-1 text-right">
              <Button className="h-10" disabled={props.locked || props.starting} onClick={() => props.onTranslate(translated === 0 ? "all" : "changed")}>
                {props.starting ? <Spinner className="size-4" /> : null}
                {translated === 0 ? t(`${K}.translateSite`, "Translate website") : t(`${K}.translatePages`, "Translate {{count}} pages", { count: pending })}
              </Button>
              <span className="text-xs text-muted-foreground">
                {translated === 0
                  ? t(`${K}.estimate`, "{{count}} pages · about {{minutes}} min", { count: pending, minutes: minutesFor(pending) })
                  : props.siteChanged
                    ? t(`${K}.menuChanged`, "Your menu or footer changed")
                    : t(`${K}.newOrChanged`, "New or edited since last time")}
              </span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function RunStatus({ run, items, stopping, onStop }: { run: ReTranslateRun; items: NonNullable<ReTranslateRun["items"]>; stopping: boolean; onStop: () => void }) {
  const { t } = useTranslation();
  const finished = run.done + run.failed;
  const left = Math.max(0, run.total - finished);
  const now = items.find((i) => i.status === "translating");
  return (
    <div className="flex items-center justify-end gap-3" aria-live="polite">
      <div className="min-w-0 text-right">
        <p className="flex items-center justify-end gap-2 text-sm font-medium">
          <Spinner className="size-4" />
          {run.status === "queued" ? t(`${K}.runStarting`, "Starting…") : t(`${K}.runDone`, "{{done}} of {{total}} pages done", { done: finished, total: run.total })}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {now ? t(`${K}.runNow`, "Now: {{page}}", { page: now.title || now.path }) : null}
          {now && left ? " · " : null}
          {left ? t(`${K}.runLeft`, "about {{minutes}} min left", { minutes: minutesFor(left) }) : null}
        </p>
        {run.failed > 0 ? <p className="text-xs text-destructive">{t(`${K}.runFailed`, "{{count}} pages could not be translated and stay in the original.", { count: run.failed })}</p> : null}
      </div>
      <Button variant="outline" className="h-10 shrink-0" onClick={onStop} disabled={stopping || run.id.startsWith("starting-")}>
        <Square className="size-3.5" />
        {t(`${K}.stop`, "Stop")}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ adding a language

function AddLanguage({ overview, onAdd, prominent = false }: { overview: ReTranslateOverview; onAdd: (l: ReTranslateLanguage) => void; prominent?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const settings = overview.settings;
  const available = overview.locales.filter((l) => l.locale !== settings.source.locale && !settings.languages.some((x) => x.enabled && x.locale === l.locale));
  if (available.length === 0) return <p className="text-sm text-muted-foreground">{t(`${K}.allAdded`, "Every language the translator knows is added.")}</p>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={prominent ? "default" : "ghost"} className={cn("h-10", !prominent && "-ml-3")}>
          <Plus className="size-4" />
          {t(`${K}.add`, "Add a language")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder={t(`${K}.searchLanguages`, "Search languages")} />
          <CommandList>
            <CommandEmpty>{t(`${K}.noLanguage`, "No language by that name.")}</CommandEmpty>
            <CommandGroup>
              {available.map((l) => (
                <CommandItem
                  key={l.locale}
                  value={`${l.native} ${nameFor(t, l)} ${l.name} ${l.locale}`}
                  className="min-h-11 gap-3"
                  onSelect={() => {
                    setOpen(false);
                    onAdd(l);
                  }}
                >
                  <FlagImage country={flagOf(l)} className="h-3.5 w-5" />
                  <span className="flex-1">{l.native}</span>
                  {l.native !== nameFor(t, l) ? <span className="text-xs text-muted-foreground">{nameFor(t, l)}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------ pages

type Filter = "all" | "live" | "needs_you" | "none";

function PagesList({ pages, targets, loading, siteChanged, working, onOpen }: { pages: ReTranslatePage[]; targets: ReTranslateLanguage[]; loading: boolean; siteChanged: boolean; working: (locale: string, path: string) => boolean; onOpen: (page: ReTranslatePage, language: ReTranslateLanguage) => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const matches = (p: ReTranslatePage, f: Filter) =>
    f === "all" || targets.some((l) => (f === "none" ? !p.languages[l.locale]?.state || p.languages[l.locale]?.state === "draft" : p.languages[l.locale]?.state === f));
  const q = query.trim().toLowerCase();
  const shown = pages.filter((p) => matches(p, filter) && (!q || `${p.title} ${p.path}`.toLowerCase().includes(q)));
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t(`${K}.filter.all`, "All") },
    { id: "live", label: t(`${K}.state.live`, "Live") },
    { id: "needs_you", label: t(`${K}.state.waiting`, "Waiting for you") },
    { id: "none", label: t(`${K}.state.none`, "Not translated") },
  ];

  return (
    <SectionCard>
      <div className="space-y-3 border-b px-5 py-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="title-display text-lg font-semibold tracking-tight">{t(`${K}.pagesTitle`, "Pages")}</h2>
          <span className="text-xs text-muted-foreground">{t(`${K}.pageCount`, "{{count}} pages", { count: pages.length })}</span>
        </div>
        {siteChanged ? <p className="text-xs text-muted-foreground">{t(`${K}.siteChanged`, "Your menu or footer changed since the last translation; every page will be updated next time.")}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label={t(`${K}.filterLabel`, "Show pages")} className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {filters.map((f) => {
              const n = pages.filter((p) => matches(p, f.id)).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors", filter === f.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
                >
                  {f.label}
                  <span className={cn("tabular-nums text-xs", filter === f.id ? "text-background/70" : "text-muted-foreground")}>{n}</span>
                </button>
              );
            })}
          </div>
          {pages.length > 8 ? (
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(`${K}.searchPages`, "Find a page")} aria-label={t(`${K}.searchPages`, "Find a page")} className="h-10 pl-9" />
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">{pages.length === 0 ? t(`${K}.noPages`, "No published pages were found on your website.") : t(`${K}.noMatch`, "No page matches.")}</p>
      ) : (
        <ul className="divide-y">
          {shown.map((page) => (
            <li key={page.path} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{page.title || page.path}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {page.path}
                  {page.changed ? <span className="text-foreground/70"> · {t(`${K}.edited`, "edited since translated")}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {targets.map((language) => (
                  <StatePill key={language.locale} state={page.languages[language.locale]?.state} busy={working(language.locale, page.path)} language={language} showName={targets.length > 1} onClick={() => onOpen(page, language)} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function StatePill({ state, busy, language, showName, onClick }: { state: ReTranslatePageState | undefined; busy: boolean; language: ReTranslateLanguage; showName: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const text = busy ? t(`${K}.state.working`, "Translating now") : state === "live" ? t(`${K}.state.live`, "Live") : state === "needs_you" ? t(`${K}.state.waiting`, "Waiting for you") : state === "draft" ? t(`${K}.state.draft`, "Not shown yet") : t(`${K}.state.none`, "Not translated");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${language.native}: ${text}`}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "border bg-card hover:bg-muted",
        state === "live" || busy ? "text-foreground" : state === "needs_you" ? "font-semibold text-foreground" : "font-normal text-muted-foreground",
      )}
    >
      {showName ? <FlagImage country={flagOf(language)} className="h-3 w-4" /> : null}
      {busy ? <Spinner className="size-3" /> : null}
      {text}
    </button>
  );
}

// ------------------------------------------------------------------ asking first

function ConfirmDialog({ confirm, sourceName, onClose, onConfirm }: { confirm: Confirm | null; sourceName: string; onClose: () => void; onConfirm: (c: Confirm) => void }) {
  const { t } = useTranslation();
  if (!confirm) return <AlertDialog open={false} />;

  const copy =
    confirm.kind === "remove"
      ? {
          title: t(`${K}.removeTitle`, "Stop offering {{language}}?", { language: confirm.language.native }),
          body: t(`${K}.removeBody`, "Visitors will read your website in {{source}} only. The {{language}} addresses (/{{prefix}}/…) stop working and {{language}} disappears from the language menu. Your translations are kept: add {{language}} again later and they come back.", {
            language: confirm.language.native,
            source: sourceName,
            prefix: confirm.language.prefix,
          }),
          extra: confirm.run ? t(`${K}.removeRunning`, "The translation that is running now will be stopped.") : null,
          cancel: t(`${K}.keep`, "Keep {{language}}", { language: confirm.language.native }),
          action: t(`${K}.remove`, "Stop offering {{language}}", { language: confirm.language.native }),
          destructive: true,
        }
      : confirm.kind === "again"
        ? {
            title: t(`${K}.againTitle`, "Translate all {{count}} pages again?", { count: confirm.pages, language: confirm.language.native }),
            body: t(`${K}.againBody`, "Every page is translated into {{language}} once more. Wording you changed yourself is kept. Pages that are live stay live while this runs. It takes about {{minutes}} min.", {
              language: confirm.language.native,
              minutes: minutesFor(confirm.pages),
            }),
            extra: null,
            cancel: t(`${K}.cancel`, "Cancel"),
            action: t(`${K}.againAction`, "Translate {{count}} pages", { count: confirm.pages }),
            destructive: false,
          }
        : {
            title: t(`${K}.sourceTitle`, "Is your website written in {{language}}?", { language: confirm.name }),
            body: t(`${K}.sourceBody`, "Your translations were made from {{source}}. After this change, translate every page again so they are made from {{language}}.", { source: sourceName, language: confirm.name }),
            extra: null,
            cancel: t(`${K}.cancel`, "Cancel"),
            action: t(`${K}.sourceAction`, "Yes, it is written in {{language}}", { language: confirm.name }),
            destructive: false,
          };

  return (
    <AlertDialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="title-display text-xl">{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">{copy.body}</AlertDialogDescription>
          {copy.extra ? <p className="text-sm font-medium">{copy.extra}</p> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10">{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction className={cn("h-10", copy.destructive && "bg-destructive text-white hover:bg-destructive/90")} onClick={() => onConfirm(confirm)}>
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * "Make all live" asks whether the owner has looked: these pages wait because
 * something on them needs a person's eye. The button stays off until the box
 * is ticked, and the dialog names the pages, so nothing goes live unseen by
 * accident.
 */
function PublishAllDialog({ open, waiting, busy, onClose, onConfirm }: { open: boolean; waiting: Array<{ page: ReTranslatePage; language: ReTranslateLanguage }>; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  // Every opening asks again, also after the last one closed on its own when the pages went live.
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);
  const shown = waiting.slice(0, 6);
  const languages = [...new Set(waiting.map((w) => w.language.native))].join(", ");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => (!v ? onClose() : undefined)}
    >
      <AlertDialogContent className="[&>*]:min-w-0 sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="title-display text-xl">{t(`${K}.publishAllTitle`, "Make every waiting page live?")}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {t(`${K}.publishAllLead`, "Visitors will see these pages in {{languages}} right away.", { languages })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-w-0 overflow-hidden rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>{t(`${K}.publishAllList`, "Pages that will go live")}</span>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 font-semibold tabular-nums text-foreground">{waiting.length}</span>
          </div>
          <ul className="max-h-48 divide-y overflow-y-auto">
            {shown.map(({ page, language }) => (
              <li key={`${page.path}:${language.locale}`} className="flex items-center gap-2 px-3 py-2">
                <FlagImage country={flagOf(language)} className="h-3 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{page.title || page.path}</span>
                <span className="hidden max-w-[45%] truncate text-xs text-muted-foreground sm:block">{page.path}</span>
              </li>
            ))}
            {waiting.length > shown.length ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t(`${K}.publishAllMore`, "and {{count}} more", { count: waiting.length - shown.length })}</li>
            ) : null}
          </ul>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => setChecked(v === true)} disabled={busy} />
          <span>{t(`${K}.publishAllChecked`, "I have checked these pages, or I am fine with them as they are.")}</span>
        </label>
        <p className="text-xs text-muted-foreground">{t(`${K}.publishAllUndo`, "You can take any page offline again from the page itself.")}</p>

        <AlertDialogFooter>
          <AlertDialogCancel className="h-10" disabled={busy}>
            {t(`${K}.cancel`, "Cancel")}
          </AlertDialogCancel>
          <Button
            className="h-10"
            disabled={!checked || busy}
            onClick={onConfirm}
          >
            {busy ? <Spinner className="size-4" /> : null}
            {busy ? t(`${K}.publishAllWorking`, "Making pages live…") : t(`${K}.publishAllAction`, "Make them live")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
