import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ExternalLink, Languages, ListPlus, MessageSquareText, PencilLine, RefreshCw, Search, X } from "lucide-react";
import type { ReTranslateLanguage, ReTranslateReason, ReTranslateSentence, ReTranslateTarget } from "~/lib/api/re-translate";
import { useReTranslateActions, useReTranslateOverview, useReTranslatePage } from "~/lib/hooks/useReTranslate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { errorText, flash } from "~/components/wordpress/re-translate/constants";
import { SentenceText, fromEditable, hasMarkers, matchesSearch, toEditable, tokensMatch } from "./sentence-text";
import { StateChip } from "./state-chip";

/** Checker rule → words a site owner understands. Staff see the raw detail too. */
export function flagWords(t: (k: string, f: string) => string, rule: string): string {
  const r = rule.split(":")[0];
  if (r === "parity.numbers") return t("wordpress.reTranslate.flag.numbers", "A number differs from the original");
  if (r === "parity.currency") return t("wordpress.reTranslate.flag.currency", "The currency sign is missing");
  if (r === "parity.link") return t("wordpress.reTranslate.flag.link", "A web or email address changed");
  if (/^parity\.(brand|entity)$|^consistency\.entity$/.test(r)) return t("wordpress.reTranslate.flag.name", "A name is written differently from the original");
  if (r === "parity.question") return t("wordpress.reTranslate.flag.question", "The original asks a question; the translation doesn't");
  if (r.startsWith("consistency.")) return t("wordpress.reTranslate.flag.consistency", "Translated differently elsewhere on this page");
  if (r === "fit.button" || r === "fit.heading") return t("wordpress.reTranslate.flag.long", "Longer than the original — may not fit");
  if (r === "fit.untranslated") return t("wordpress.reTranslate.flag.same", "Same as the original");
  if (r === "marketing.hype") return t("wordpress.reTranslate.flag.hype", "Adds a claim the original doesn't make");
  if (r === "marketing.bare-cta") return t("wordpress.reTranslate.flag.cta", "The button says little about what happens");
  if (r.startsWith("slop.")) return t("wordpress.reTranslate.flag.slop", "Reads like machine writing");
  if (r === "untranslated" || r === "tokens" || r === "parity.tokens") return t("wordpress.reTranslate.flag.missing", "Not translated");
  return t("wordpress.reTranslate.flag.other", "Worth a second look");
}

export function reasonWords(t: (k: string, f: string) => string, reason: ReTranslateReason): string {
  switch (reason) {
    case "untranslated_parts":
      return t("wordpress.reTranslate.reason.untranslated", "A few sentences are waiting for your check before this page goes live.");
    case "too_long":
      return t("wordpress.reTranslate.reason.tooLong", "The page is very long; the end stays in the original language.");
    case "numbers_changed":
      return t("wordpress.reTranslate.reason.numbers", "A price or number may have changed.");
    case "names":
      return t("wordpress.reTranslate.reason.names", "A name is spelled differently from the original.");
    case "links":
      return t("wordpress.reTranslate.reason.links", "A web or email address changed.");
    case "low_score":
      return t("wordpress.reTranslate.reason.low", "Some sentences are worth a second look.");
  }
}

export function PageView({
  target,
  path,
  title,
  language,
  onClose,
  detailed = false,
}: {
  target: ReTranslateTarget;
  path: string | null;
  title: string;
  language: ReTranslateLanguage | null;
  onClose: () => void;
  /** Staff view: raw checker details, drafts and the page brief. */
  detailed?: boolean;
}) {
  const { t } = useTranslation();
  const open = !!path && !!language;
  const { data, isLoading, isFetching, error } = useReTranslatePage(target, path, language?.locale ?? null);
  const actions = useReTranslateActions(target);
  const { data: overview } = useReTranslateOverview(target);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";

  // Another page or language starts with an empty search.
  useEffect(() => setQuery(""), [path, language?.locale]);

  const sentences = useMemo(() => {
    const all = data?.sentences ?? [];
    return all.filter((s) => (!onlyFlagged || s.flags.length > 0 || !s.target) && (matchesSearch(s.source, query) || matchesSearch(s.target, query)));
  }, [data, onlyFlagged, query]);

  const flaggedCount = (data?.sentences ?? []).filter((s) => s.flags.length > 0 || !s.target).length;
  const state = data?.page?.state ?? null;
  const dir = language?.rtl ? "rtl" : "ltr";
  const emptyCount = (data?.sentences ?? []).filter((s) => !s.target).length;
  // A translation into this language is going (this page, or the whole site): one at a time.
  const translating = !!language && !!overview?.runs.some((r) => (r.status === "queued" || r.status === "running") && r.target_lang === language.locale);

  function translatePage(mode: "again" | "missing") {
    if (!path || !language) return;
    actions.startRun.mutate(
      { lang: language.locale, scope: "pages", paths: [path], mode },
      {
        onSuccess: (res) =>
          flash(
            res.joined
              ? t("wordpress.reTranslate.pageBusy", "{{language}}: a translation is already running. Try again when it has finished.", { language: language.native || language.name })
              : mode === "again"
                ? t("wordpress.reTranslate.pageAgainStarted", "Translating this page again. The new wording shows here when it is ready.")
                : t("wordpress.reTranslate.pageMissingStarted", "Translating the empty sentences. They show here when they are ready."),
          ),
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );
  }

  function setLive(live: boolean) {
    if (!path || !language) return;
    // The page already shows the new state; the toast waits until the site has confirmed it.
    actions.setLive.mutate(
      { path, lang: language.locale, live },
      {
        onSuccess: () =>
          flash(
            live
              ? t("wordpress.reTranslate.madeLive", "Live. Visitors now see this page in {{language}}.", { language: language.native || language.name })
              : t("wordpress.reTranslate.madeOffline", "Taken offline. Visitors see the original page."),
          ),
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[760px]"
        onEscapeKeyDown={(e) => {
          // Escape in the search clears it first; the next one closes the panel.
          if (searching && document.activeElement === searchRef.current) {
            e.preventDefault();
            setQuery("");
          }
        }}
      >
        <SheetHeader className="sticky top-0 z-10 gap-3 border-b bg-background px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
            {language ? <Badge variant="outline" className="font-normal">{language.native || language.name}</Badge> : null}
            {state ? <StateChip state={state} /> : null}
            {data && isFetching ? <Spinner className="size-3.5 text-muted-foreground" aria-label={t("wordpress.reTranslate.refreshing", "Checking for the latest text…")} /> : null}
          </div>
          <SheetDescription className="text-xs text-muted-foreground">{path}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10" disabled={translating || actions.startRun.isPending || isLoading}>
                  {translating ? <Spinner className="size-4" /> : <Languages className="size-4" />}
                  {translating ? t("wordpress.reTranslate.translating", "Translating…") : t("wordpress.reTranslate.translatePage", "Translate page")}
                  {translating ? null : <ChevronDown className="size-4 opacity-60" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuItem className="min-h-10 items-start py-2.5" onSelect={() => translatePage("again")}>
                  <RefreshCw className="mt-0.5 size-4" />
                  <span className="flex flex-col gap-0.5">
                    <span>{t("wordpress.reTranslate.translateAgain", "Translate the page again")}</span>
                    <span className="text-xs text-muted-foreground">{t("wordpress.reTranslate.translateAgainHint", "Every sentence gets a new translation. Wording you changed yourself stays.")}</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 items-start py-2.5" disabled={emptyCount === 0} onSelect={() => translatePage("missing")}>
                  <ListPlus className="mt-0.5 size-4" />
                  <span className="flex flex-col gap-0.5">
                    <span>{t("wordpress.reTranslate.translateEmpty", "Translate empty sentences")}</span>
                    <span className="text-xs text-muted-foreground">
                      {emptyCount === 0
                        ? t("wordpress.reTranslate.translateEmptyNone", "Every sentence has a translation.")
                        : t("wordpress.reTranslate.translateEmptyHint", "Only the sentences without a translation ({{count}}). The rest stays as it is.", { count: emptyCount })}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {data?.preview ? (
              <Button asChild variant="outline" className="h-10">
                <a href={data.preview} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {t("wordpress.reTranslate.openPreview", "Open preview")}
                </a>
              </Button>
            ) : null}
            {state && state !== "live" ? (
              <Button className="h-10" onClick={() => setLive(true)} >
                {t("wordpress.reTranslate.makeLive", "Make live")}
              </Button>
            ) : null}
            {state === "live" ? (
              <Button variant="ghost" className="h-10" onClick={() => setLive(false)}>
                {t("wordpress.reTranslate.takeOffline", "Take offline")}
              </Button>
            ) : null}
          </div>
          {data && data.sentences.length > 0 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                dir="auto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("wordpress.reTranslate.searchSentences", "Find words in the original or the translation")}
                aria-label={t("wordpress.reTranslate.searchSentencesLabel", "Find words on this page")}
                className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {searching ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-0 size-10 -translate-y-1/2"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label={t("wordpress.reTranslate.clearSearch", "Clear search")}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
          {data && data.reasons.length > 0 && state !== "live" ? (
            <ul className="space-y-1 rounded-xl bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground">
              {data.reasons.map((r) => (
                <li key={r}>{reasonWords(t, r)}</li>
              ))}
            </ul>
          ) : null}
        </SheetHeader>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t("wordpress.reTranslate.loadingPage", "Loading the page…")}
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{errorText(t, error)}</p>
          ) : data && data.sentences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("wordpress.reTranslate.notTranslatedYet", "This page has not been translated into this language yet. Start a translation from the language card.")}
            </p>
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {searching
                    ? t("wordpress.reTranslate.searchCount", "{{count}} of {{total}} sentences contain these words", { count: sentences.length, total: data.sentences.length })
                    : t("wordpress.reTranslate.sentenceCount", "{{count}} sentences", { count: data.sentences.length })}
                  {flaggedCount > 0 && !searching ? ` · ${t("wordpress.reTranslate.flaggedCount", "{{count}} worth a look", { count: flaggedCount })}` : ""}
                </p>
                {flaggedCount > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setOnlyFlagged((v) => !v)}>
                    {onlyFlagged ? t("wordpress.reTranslate.showAll", "Show all") : t("wordpress.reTranslate.showFlagged", "Only those worth a look")}
                  </Button>
                ) : null}
              </div>

              {detailed && data.brief ? (
                <div className="rounded-xl border bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{t("wordpress.reTranslate.brief", "What the translator understood about this page")}</p>
                  <p className="mt-1">{data.brief.business}</p>
                  <p>{[data.brief.audience, data.brief.tone].filter(Boolean).join(" · ")}</p>
                </div>
              ) : null}

              {searching && sentences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {onlyFlagged
                    ? t("wordpress.reTranslate.searchNoneFlagged", "None of the sentences worth a look contain “{{query}}”. Show all to search the whole page.", { query: query.trim() })
                    : t("wordpress.reTranslate.searchNone", "No sentence on this page contains “{{query}}”. Check the spelling, or try fewer words.", { query: query.trim() })}
                </p>
              ) : null}

              <ol className="space-y-3">
                {sentences.map((s) => (
                  <SentenceRow key={s.key} sentence={s} dir={dir} detailed={detailed} highlight={query} onSave={(target) => actions.saveSentence.mutateAsync({ path: path!, lang: language!.locale, key: s.key, target })} />
                ))}
              </ol>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SentenceRow({
  sentence,
  dir,
  detailed,
  highlight,
  onSave,
}: {
  sentence: ReTranslateSentence;
  dir: "rtl" | "ltr";
  detailed: boolean;
  highlight: string;
  onSave: (target: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showWhy, setShowWhy] = useState(false);
  const [problem, setProblem] = useState("");

  function start() {
    setValue(toEditable(sentence.target ?? sentence.source));
    setProblem("");
    setEditing(true);
  }

  function save() {
    const target = fromEditable(value).trim();
    if (!target) return setProblem(t("wordpress.reTranslate.emptyTranslation", "Write a translation, or cancel."));
    if (!tokensMatch(sentence.source, target)) return setProblem(t("wordpress.reTranslate.keepMarkers", "Keep every 〔 〕 marker exactly once — they hold the links and bold words in place."));
    // The new wording is on screen at once; if the site refuses it, the editor comes back with the words kept.
    setEditing(false);
    onSave(target).then(
      () => flash(t("wordpress.reTranslate.sentenceSaved", "Saved. This wording is used from now on.")),
      (err) => {
        setProblem(errorText(t, err));
        setEditing(true);
      },
    );
  }

  const flagged = sentence.flags.length > 0 || !sentence.target;

  return (
    <li className={`rounded-xl border px-3.5 py-3 ${flagged ? "border-secondary bg-secondary/15" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            <SentenceText text={sentence.source} highlight={highlight} />
          </p>
          {editing ? (
            <div className="space-y-2">
              <Textarea dir={dir} value={value} onChange={(e) => setValue(e.target.value)} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 70)))} className="text-sm" autoFocus />
              {hasMarkers(sentence.source) ? (
                <p className="text-xs text-muted-foreground">{t("wordpress.reTranslate.markersHint", "Words between 〔1〕 and 〔/1〕 are a link or bold. Move the markers with the words; don't delete them.")}</p>
              ) : null}
              {problem ? <p role="alert" className="text-xs text-destructive">{problem}</p> : null}
              <div className="flex gap-2">
                <Button className="h-10" onClick={save}>
                  {t("wordpress.reTranslate.saveWording", "Save wording")}
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => setEditing(false)}>
                  {t("wordpress.reTranslate.cancel", "Cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground">{sentence.target ? <SentenceText text={sentence.target} dir={dir} highlight={highlight} /> : <span className="text-muted-foreground">{t("wordpress.reTranslate.noTranslation", "Not translated yet")}</span>}</p>
          )}
          {sentence.flags.length > 0 && !editing ? (
            <ul className="space-y-0.5 text-xs text-foreground/80">
              {[...new Set(sentence.flags.map((f) => flagWords(t, f)))].map((w) => (
                <li key={w}>• {w}</li>
              ))}
              {detailed ? sentence.flags.map((f) => <li key={f} className="font-mono text-[11px] text-muted-foreground">{f}</li>) : null}
            </ul>
          ) : null}
          {showWhy && sentence.why.length > 0 ? (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {sentence.why.map((w) => (
                <p key={w}>{w}</p>
              ))}
              {detailed && sentence.draft && sentence.draft !== sentence.target ? (
                <p className="mt-1">
                  <span className="font-medium">{t("wordpress.reTranslate.firstDraft", "First draft:")}</span> <SentenceText text={sentence.draft} dir={dir} />
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {!editing ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {sentence.origin === "edit" ? <Badge variant="outline" className="font-normal">{t("wordpress.reTranslate.yourWording", "Your wording")}</Badge> : null}
            <Button variant="ghost" size="icon" className="size-10" onClick={start} aria-label={t("wordpress.reTranslate.editWording", "Edit wording")}>
              <PencilLine className="size-4" />
            </Button>
            {sentence.why.length > 0 ? (
              <Button variant="ghost" size="icon" className="size-10" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} aria-label={t("wordpress.reTranslate.whyWording", "Why this wording?")}>
                <MessageSquareText className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
