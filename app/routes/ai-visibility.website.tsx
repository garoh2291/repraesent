import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, ExternalLink, Globe, Loader2, Minus, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { useAiVisibilityJob, useAiVisibilityWebsite, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import {
  aiVisibilityApi,
  apiErrorMessage,
  isActiveJob,
  type PageSuggestion,
  type ScannedPage,
  type SiteCheckItem,
  type WebsiteState,
} from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { CopyForWebPerson } from "~/components/notebook/copy-for-web-person";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { CopyBlock } from "~/components/ai-visibility/copy-block";

/**
 * /ai-visibility/website — can AI assistants read, understand and quote your
 * website? The plugin's Site tab, for any website: we read the public site
 * (free, no key), and on request write questions + a direct opening for one
 * page, or a comparison page (on the workspace key, under the cap).
 */
export default function AiVisibilityWebsite() {
  const { t } = useTranslation();
  const { canEdit } = useAiVisibilityContext();
  const q = useAiVisibilityWebsite();
  const invalidate = useInvalidateAiVisibility();
  const checkJob = useAiVisibilityJob("site_check");
  const suggestJob = useAiVisibilityJob("page_suggest");
  const checking = !!checkJob && isActiveJob(checkJob);
  const suggestingUrl = suggestJob && isActiveJob(suggestJob) ? String(suggestJob.payload.url ?? "") : null;
  const [openId, setOpenId] = useState<string | null>(null);

  const checkNow = async () => {
    try {
      await aiVisibilityApi.checkWebsite();
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.website.checkFailed", "Could not start the check.")));
    }
  };

  const suggest = async (url: string) => {
    try {
      const res = await aiVisibilityApi.suggestForPage(url);
      if (res.existing && String(res.job.payload.url ?? "") !== url) {
        toast.message(t("aiVisibility.website.onePage", "One page at a time — the page already in progress comes first."));
      }
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.website.suggestFailed", "Could not start the suggestions.")));
    }
  };

  if (!q.data) return <Skeleton className="h-64 rounded-xl" />;
  const data = q.data;

  if (!data.ready) {
    return (
      <Panel>
        <EmptyState
          icon={<Globe />}
          title={t("aiVisibility.website.pendingTitle", "Your website check is almost ready.")}
          body={t("aiVisibility.website.pendingBody", "It switches on with the next update. Nothing to do on your side.")}
        />
      </Panel>
    );
  }

  if (!data.domain) {
    return (
      <Panel>
        <EmptyState
          icon={<Globe />}
          title={t("aiVisibility.website.noDomainTitle", "Add your website address first.")}
          body={t("aiVisibility.website.noDomainBody", "Enter it under Plan & cost → Your business, then check it here.")}
        />
      </Panel>
    );
  }

  const suggestionFor = (url: string) => data.suggestions.find((s) => s.page_url === url && s.status !== "dismissed") ?? null;
  const open = data.suggestions.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
        {t(
          "aiVisibility.website.intro",
          "Assistants can only recommend what they can read. We look at your website the way they do — from outside, like a visitor — and show what helps them understand and quote it.",
        )}
      </p>

      <Readiness data={data} canEdit={canEdit} checking={checking} onCheck={checkNow} />

      {data.check && data.check.pages.length ? (
        <PagesPanel
          pages={data.check.pages}
          canEdit={canEdit}
          suggestingUrl={suggestingUrl}
          suggestionFor={suggestionFor}
          onSuggest={suggest}
          onOpen={(s) => setOpenId(s.id)}
          domain={data.domain}
        />
      ) : null}

      <Panel className="p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-foreground">{t("aiVisibility.website.outsideTitle", "Two things only you can do")}</p>
        <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-foreground/80">
          {t(
            "aiVisibility.website.outsideBody",
            "Claim your site in Bing Webmaster Tools — ChatGPT search reads from Bing. And submit it to Brave — Claude searches with Brave. Both take a few minutes and need you to sign in.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">
              Bing Webmaster Tools <ExternalLink className="size-3.5" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://search.brave.com/submit-url" target="_blank" rel="noreferrer">
              Brave <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </Panel>

      <SuggestionSheet suggestion={open} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={() => void invalidate()} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── readiness

const STATUS_ORDER: Record<SiteCheckItem["status"], number> = { fail: 0, warn: 1, pass: 2, info: 3 };

function Readiness({ data, canEdit, checking, onCheck }: { data: WebsiteState; canEdit: boolean; checking: boolean; onCheck: () => void }) {
  const { t } = useTranslation();
  const check = data.check;
  const label = useCheckText();

  const action = canEdit ? (
    <Button variant="outline" size="sm" onClick={onCheck} disabled={checking}>
      <RefreshCw className={cn("size-3.5", checking && "animate-spin motion-reduce:animate-none")} />
      {checking ? t("aiVisibility.website.checking", "Checking…") : check ? t("aiVisibility.website.recheck", "Check again") : t("aiVisibility.website.checkNow", "Check my website")}
    </Button>
  ) : null;

  if (!check) {
    return (
      <Panel>
        <EmptyState
          icon={<Globe />}
          title={checking ? t("aiVisibility.website.checkingTitle", "Checking {{domain}}…", { domain: data.domain }) : t("aiVisibility.website.neverTitle", "Not checked yet.")}
          body={t("aiVisibility.website.neverBody", "The check reads your homepage and up to 11 more pages. It is free and takes under a minute.")}
          action={action}
        />
      </Panel>
    );
  }

  const sorted = [...check.checks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const needs = check.checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  return (
    <Panel>
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {t("aiVisibility.website.readiness", "How ready your site is for AI")}
            </p>
            <p className="title-display num mt-1 text-[44px] font-semibold leading-none text-foreground">
              {check.score ?? "—"}
              <span className="ml-1 text-[16px] font-medium text-muted-foreground">/100</span>
            </p>
          </div>
          {/* One tick per check, in checklist order: the score's reasons at a glance. */}
          <div className="mb-1 flex gap-[3px]" aria-hidden>
            {sorted.map((c) => (
              <span
                key={c.id}
                className={cn(
                  "h-6 w-1.5 rounded-full",
                  c.status === "pass" && "bg-foreground/80",
                  c.status === "warn" && "bg-marker",
                  c.status === "fail" && "bg-overdue",
                  c.status === "info" && "bg-foreground/15",
                )}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-[12.5px] text-muted-foreground">
            {check.domain} ·{" "}
            {t("aiVisibility.website.lookedAt", "{{n}} pages looked at", { n: check.pages.length })} ·{" "}
            {t("aiVisibility.website.checked", "checked {{when}}", { when: formatRelativeTime(check.ran_at) })}
          </p>
          {action}
        </div>
      </div>

      {check.error === "unreachable" ? (
        <div className="flex gap-3 border-b border-border bg-overdue-soft px-4 py-3 text-[13.5px] text-foreground sm:px-5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-overdue" />
          {t("aiVisibility.website.unreachable", "We could not open {{domain}}. Check the address under Plan & cost, or whether the site is online.", { domain: check.domain })}
        </div>
      ) : null}

      <p className="px-4 pt-3 text-[12.5px] text-muted-foreground sm:px-5">
        {needs
          ? t("aiVisibility.website.needsCount", "{{n}} things to look at.", { count: needs, n: needs })
          : t("aiVisibility.website.allGood", "Nothing needs your attention.")}
      </p>
      <ul className="divide-y divide-border">
        {sorted.map((c) => {
          const text = label(c);
          return (
            <li key={c.id} className="flex gap-3 px-4 py-3 sm:px-5">
              <StatusMark status={c.status} />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground">{text.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{text.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function StatusMark({ status }: { status: SiteCheckItem["status"] }) {
  const { t } = useTranslation();
  const common = "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full";
  const label = {
    pass: t("aiVisibility.website.status.pass", "Fine"),
    warn: t("aiVisibility.website.status.warn", "Could be better"),
    fail: t("aiVisibility.website.status.fail", "Needs you"),
    info: t("aiVisibility.website.status.info", "Not checked"),
  }[status];
  if (status === "pass")
    return (
      <span className={cn(common, "bg-foreground text-background")} title={label}>
        <Check className="size-3" strokeWidth={3} aria-label={label} />
      </span>
    );
  if (status === "info")
    return (
      <span className={cn(common, "border border-border text-muted-foreground")} title={label}>
        <Minus className="size-3" aria-label={label} />
      </span>
    );
  return (
    <span className={cn(common, status === "fail" ? "bg-overdue text-white" : "bg-marker text-marker-ink")} title={label}>
      <span className="text-[11px] font-bold leading-none" aria-label={label}>
        !
      </span>
    </span>
  );
}

/** Title + one sentence per check, from ids and numbers — the server sends no prose. */
function useCheckText() {
  const { t } = useTranslation();
  return (c: SiteCheckItem): { title: string; detail: string } => {
    const p = c.params as Record<string, string | number | boolean | string[] | undefined>;
    const n = { count: Number(p.count ?? 0), total: Number(p.total ?? 0) };
    const k = (s: string) => `aiVisibility.website.check.${c.id}.${s}`;
    const unreachable = t("aiVisibility.website.check.unreachable", "Could not be checked — the homepage did not open.");
    const noPosts = t("aiVisibility.website.check.noPosts", "We found no blog posts or articles to look at.");
    switch (c.id) {
      case "ai_crawlers_allowed": {
        const blocked = (Array.isArray(p.blocked) ? p.blocked : []).join(", ");
        const training = (Array.isArray(p.training_blocked) ? p.training_blocked : []).join(", ");
        return {
          title: t(k("title"), "AI assistants may read your site"),
          detail:
            c.status === "fail"
              ? t(k("fail"), "Your robots.txt shuts out {{bots}}. They cannot read or recommend your site.", { bots: blocked })
              : training
                ? t(k("passTraining"), "No assistant is shut out of answers. You keep {{bots}} from training on your pages — that is your choice and doesn't hide you.", { bots: training })
                : t(k("pass"), "No assistant is shut out."),
        };
      }
      case "https":
        return {
          title: t(k("title"), "Secure address (https)"),
          detail: c.status === "info" ? unreachable : c.status === "pass" ? t(k("pass"), "Your site opens over https.") : t(k("fail"), "Your site doesn't open over https. Your web person can switch it on."),
        };
      case "homepage_indexable":
        return {
          title: t(k("title"), "Search engines may list your homepage"),
          detail:
            c.status === "info"
              ? unreachable
              : c.status === "pass"
                ? t(k("pass"), "Your homepage can be listed.")
                : t(k("fail"), "Your homepage tells search engines not to list it (noindex). Assistants that search the web won't find it."),
        };
      case "sitemap":
        return {
          title: t(k("title"), "A list of your pages for search engines (sitemap)"),
          detail: c.status === "pass" ? t(k("pass"), "Found at {{path}}.", { path: String(p.path ?? "") }) : t(k("fail"), "No sitemap at the usual addresses. Most website builders can publish one with a switch."),
        };
      case "bing_verification":
        return {
          title: t(k("title"), "Claimed in Bing"),
          detail:
            c.status === "info"
              ? unreachable
              : c.status === "pass"
                ? t(k("pass"), "Bing verification is in place.")
                : t(k("warn"), "Not found. ChatGPT search reads from Bing — claim your site in Bing Webmaster Tools (link below)."),
        };
      case "org_schema":
        return {
          title: t(k("title"), "Business details assistants can read"),
          detail:
            c.status === "info"
              ? unreachable
              : c.status === "pass"
                ? t(k("pass"), "Your homepage carries your name and contact details in a form assistants read directly.")
                : c.status === "warn"
                  ? t(k("warn"), "Found, but without address or phone. Both help assistants tell you apart from others with a similar name.")
                  : t(k("fail"), "Your homepage doesn't carry your name, address and phone in a form assistants read directly (schema). Your web person can add it."),
        };
      case "article_schema":
        return {
          title: t(k("title"), "Posts marked as articles"),
          detail:
            c.status === "info"
              ? p.unreachable
                ? unreachable
                : noPosts
              : c.status === "pass"
                ? t(k("pass"), "All {{total}} posts we looked at are marked.", n)
                : c.status === "warn"
                  ? t(k("warn"), "{{count}} of {{total}} posts are marked.", n)
                  : t(k("fail"), "None of the {{total}} posts we looked at are marked as articles.", n),
        };
      case "faq_schema":
        return {
          title: t(k("title"), "Questions and answers assistants can read"),
          detail:
            c.status === "info"
              ? unreachable
              : c.status === "pass"
                ? t(k("pass"), "{{count}} pages have them.", n)
                : c.status === "warn"
                  ? t(k("warn"), "Only {{count}} of {{total}} pages have them. Below, we can write them for any page.", n)
                  : t(k("fail"), "None of the {{total}} pages we looked at have them. Below, we can write them for any page.", n),
        };
      case "answer_blocks":
        return {
          title: t(k("title"), "Pages that open with a direct answer"),
          detail:
            c.status === "info"
              ? p.unreachable
                ? unreachable
                : t(k("none"), "We found no pages besides the homepage.")
              : c.status === "pass"
                ? t(k("pass"), "{{count}} of {{total}} pages do.", n)
                : c.status === "warn"
                  ? t(k("warn"), "Only {{count}} of {{total}} pages do. Assistants quote the first lines most.", n)
                  : t(k("fail"), "None of the {{total}} pages we looked at do. Assistants quote the first lines most.", n),
        };
      case "author_date":
        return {
          title: t(k("title"), "Author and date on posts"),
          detail:
            c.status === "info"
              ? p.unreachable
                ? unreachable
                : noPosts
              : c.status === "pass"
                ? t(k("pass"), "Posts show who wrote them and when.")
                : c.status === "fail"
                  ? t(k("fail"), "Posts show neither an author nor a date.")
                  : p.missing === "author"
                    ? t(k("noAuthor"), "Posts show a date but no author.")
                    : p.missing === "date"
                      ? t(k("noDate"), "Posts show an author but no date.")
                      : t(k("warn"), "Some posts show no author or no date."),
        };
      case "llms_txt":
        return {
          title: t(k("title"), "Short summary for AI tools (llms.txt)"),
          detail: c.status === "pass" ? t(k("pass"), "Published.") : t(k("warn"), "Not published. A small extra for AI tools — search results don't depend on it."),
        };
    }
  };
}

// ─────────────────────────────────────────────────────────────── pages

function PagesPanel({
  pages,
  domain,
  canEdit,
  suggestingUrl,
  suggestionFor,
  onSuggest,
  onOpen,
}: {
  pages: ScannedPage[];
  domain: string;
  canEdit: boolean;
  suggestingUrl: string | null;
  suggestionFor: (url: string) => PageSuggestion | null;
  onSuggest: (url: string) => void;
  onOpen: (s: PageSuggestion) => void;
}) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState("");
  // Pages that need it most first: no questions and no direct opening.
  const ordered = useMemo(
    () => [...pages].sort((a, b) => Number(a.faq_schema) + Number(a.opens_with_answer) - (Number(b.faq_schema) + Number(b.opens_with_answer))),
    [pages],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = custom.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${domain}/${raw.replace(/^\/+/, "")}`;
    onSuggest(url);
    setCustom("");
  };

  return (
    <Panel>
      <PanelHeader title={t("aiVisibility.website.pagesTitle", "Your pages")} hint={t("aiVisibility.website.pagesHint", "Questions and a direct opening, written from what the page already says")} />
      <ul className="divide-y divide-border">
        {ordered.map((p) => {
          const s = suggestionFor(p.url);
          const busy = suggestingUrl === p.url;
          const path = pathOf(p.url);
          return (
            <li key={p.url} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-foreground">{p.title || path}</p>
                <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-muted-foreground hover:text-foreground">
                  {path}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <Flag on={p.opens_with_answer} label={t("aiVisibility.website.flag.answer", "Direct opening")} />
                <Flag on={p.faq_schema} label={t("aiVisibility.website.flag.faq", "Questions")} />
              </div>
              <div className="shrink-0">
                {s ? (
                  <Button size="sm" variant={s.status === "applied" ? "ghost" : "outline"} onClick={() => onOpen(s)}>
                    {s.status === "applied" ? t("aiVisibility.website.used", "Used") : t("aiVisibility.website.see", "See suggestions")}
                  </Button>
                ) : canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => onSuggest(p.url)} disabled={!!suggestingUrl}>
                    {busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : null}
                    {busy ? t("aiVisibility.website.writing", "Writing…") : t("aiVisibility.website.write", "Write suggestions")}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <label htmlFor="av-page" className="text-[13px] text-muted-foreground sm:shrink-0">
            {t("aiVisibility.website.otherPage", "Another page:")}
          </label>
          <Input
            id="av-page"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`https://${domain}/…`}
            className="h-10 sm:h-9"
          />
          <Button type="submit" size="sm" className="h-10 sm:h-9" disabled={!custom.trim() || !!suggestingUrl}>
            <Sparkles className="size-3.5" />
            {t("aiVisibility.website.write", "Write suggestions")}
          </Button>
        </form>
      ) : null}
      <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground sm:px-5">
        {t("aiVisibility.website.costNote", "Suggestions use your OpenRouter key — a few cents a page, counted in your monthly limit. An unchanged page is never charged twice.")}
      </p>
    </Panel>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", on ? "bg-foreground/[0.06] text-foreground" : "border border-dashed border-border text-muted-foreground")}>
      {on ? <Check className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
      {label}
    </span>
  );
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────── suggestion sheet

function SuggestionSheet({
  suggestion,
  canEdit,
  onClose,
  onChanged,
}: {
  suggestion: PageSuggestion | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const s = suggestion;
  const o = s?.output;

  const setStatus = async (status: PageSuggestion["status"]) => {
    if (!s) return;
    setBusy(true);
    try {
      await aiVisibilityApi.setSuggestionStatus(s.id, status);
      onChanged();
      if (status !== "new") onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.website.saveFailed", "Could not save that.")));
    } finally {
      setBusy(false);
    }
  };

  const code = o?.schema_jsonld ? `<script type="application/ld+json">\n${JSON.stringify(o.schema_jsonld, null, 2)}\n</script>` : "";

  return (
    <BottomSheet
      open={!!s}
      onOpenChange={(v) => !v && onClose()}
      className="max-w-[760px]"
      title={s?.page_title || (s ? pathOf(s.page_url) : "")}
      description={s ? <span className="break-all">{s.page_url}</span> : undefined}
    >
      {o ? (
        <div className="space-y-6">
          {o.answer_block ? (
            <section>
              <SectionTitle>{t("aiVisibility.website.sheet.opening", "Open the page with this")}</SectionTitle>
              <p className="text-[12.5px] text-muted-foreground">
                {t("aiVisibility.website.sheet.openingHint", "Put it right under the main heading. Assistants quote the first lines most.")}
              </p>
              <CopyBlock text={o.answer_block} />
            </section>
          ) : null}

          {o.faqs.length ? (
            <section>
              <SectionTitle>{t("aiVisibility.website.sheet.faqs", "Questions and answers for the page")}</SectionTitle>
              <dl className="mt-2 space-y-3">
                {o.faqs.map((f, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background/60 px-3.5 py-3">
                    <dt className="text-[14px] font-semibold text-foreground">{f.question}</dt>
                    <dd className="mt-1 text-[13.5px] leading-relaxed text-foreground/85">{f.answer}</dd>
                  </div>
                ))}
              </dl>
              <CopyBlock text={o.faqs.map((f) => `${f.question}\n${f.answer}`).join("\n\n")} label={t("aiVisibility.website.sheet.copyFaqs", "Copy the questions")} hideText />
            </section>
          ) : null}

          {code ? (
            <section>
              <CopyForWebPerson
                code={code}
                title={t("aiVisibility.website.sheet.codeTitle", "The same questions, readable for assistants")}
                hint={t("aiVisibility.website.sheet.codeHint", "Once the questions are on the page, this code goes into the same page. Send it to whoever looks after your website.")}
                emailSubject={t("aiVisibility.website.sheet.emailSubject", "Questions and answers for our website")}
                emailIntro={t("aiVisibility.website.sheet.emailIntro", "Could you add the questions and answers to this page ({{url}}), and this code to the same page?", { url: s?.page_url ?? "" })}
              />
            </section>
          ) : null}

          {o.meta_title || o.meta_description ? (
            <section>
              <SectionTitle>{t("aiVisibility.website.sheet.meta", "Title and description in search results")}</SectionTitle>
              {o.meta_title ? <CopyBlock text={o.meta_title} /> : null}
              {o.meta_description ? <CopyBlock text={o.meta_description} /> : null}
            </section>
          ) : null}

          {o.structure_notes.length ? (
            <section>
              <SectionTitle>{t("aiVisibility.website.sheet.notes", "Worth a look")}</SectionTitle>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-foreground/85">
                {o.structure_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[12px] text-muted-foreground">
            {t("aiVisibility.website.sheet.honest", "Written only from what the page says. Read it once before you use it — nothing is published by us.")}
          </p>

          {canEdit ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {s?.status !== "applied" ? (
                <Button onClick={() => setStatus("applied")} disabled={busy}>
                  {t("aiVisibility.website.sheet.markUsed", "Mark as used")}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStatus("new")} disabled={busy}>
                  {t("aiVisibility.website.sheet.markUnused", "Not used after all")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setStatus("dismissed")} disabled={busy}>
                {t("aiVisibility.website.sheet.dismiss", "Don't need these")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[14px] font-semibold text-foreground">{children}</h3>;
}
