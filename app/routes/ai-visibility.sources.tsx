import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Globe, Search } from "lucide-react";
import { useAiVisibilitySources, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { aiVisibilityApi, apiErrorMessage, type DomainType } from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { Explain, SOURCE_TYPE_ORDER, Segmented, num, pct, useDomainTypeLabel, useFilters } from "~/components/ai-visibility/shared";

type View = "gaps" | "domains" | "pages";

const TYPE_COLOR: Record<string, string> = {
  own: "var(--marker)",
  competitor: "#c8414f",
  editorial: "#141516",
  directory: "#4f6bed",
  ugc: "#1f8a9e",
  reference: "#7c3aed",
  corporate: "#8a8a8a",
  institutional: "#2e7d55",
  other: "#c9c6bf",
};

const EDITABLE_TYPES: DomainType[] = ["corporate", "editorial", "institutional", "ugc", "reference", "directory", "other"];

/**
 * The websites the assistants read before answering. They repeat what these
 * pages say — so a page that names your rivals and not you is the gap to close.
 */
export default function AiVisibilitySources() {
  const { t } = useTranslation();
  const { canEdit } = useAiVisibilityContext();
  const [filters] = useFilters();
  const q = useAiVisibilitySources(filters);
  const invalidate = useInvalidateAiVisibility();
  const typeLabel = useDomainTypeLabel();
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [view, setView] = useState<View>("gaps");
  const [text, setText] = useState("");
  const d = q.data;

  const needle = text.trim().toLowerCase();
  const domains = useMemo(() => (d?.domains ?? []).filter((x) => !needle || x.domain.includes(needle)), [d, needle]);
  const gaps = useMemo(() => (d?.gaps ?? []).filter((x) => !needle || x.domain.includes(needle)), [d, needle]);
  const pages = useMemo(
    () => (d?.urls ?? []).filter((x) => !needle || x.url.toLowerCase().includes(needle) || (x.title ?? "").toLowerCase().includes(needle)),
    [d, needle],
  );

  if (!d) return <Skeleton className="h-72 rounded-xl" />;

  const ownUsed = d.domains.filter((x) => x.owner === "own").reduce((s, x) => s + x.answers_used, 0);
  const mix = SOURCE_TYPE_ORDER.map((k) => ({ k, v: d.by_type[k] ?? 0 })).filter((x) => x.v > 0);
  const mixTotal = mix.reduce((s, x) => s + x.v, 0);

  const setType = async (domain: string, type: DomainType) => {
    try {
      await aiVisibilityApi.setDomainType(domain, type);
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.sources.saveFailed", "Could not change the type.")));
    }
  };

  if (!d.answers) {
    return (
      <Panel>
        <EmptyState icon={<Globe />} title={t("aiVisibility.sources.none", "No answers in this period yet.")} />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SmallStat
            value={pct(d.grounded)}
            label={t("aiVisibility.sources.grounded", "of answers searched the web")}
            help={t(
              "aiVisibility.sources.groundedHelp",
              "The rest were answered from the assistant's memory. Those can still name you — they come from what the web said about you in the past.",
            )}
          />
          <SmallStat value={num(ownUsed)} label={t("aiVisibility.sources.ownUsed", "answers used your website")} />
          <SmallStat
            value={num(d.cited_not_named)}
            label={t("aiVisibility.sources.citedNotNamed", "read your site but didn't name you")}
            help={t(
              "aiVisibility.sources.citedNotNamedHelp",
              "The assistant used your page as background but recommended others. Usually the page doesn't say clearly who you are and what you offer.",
            )}
          />
        </div>
        {mixTotal ? (
          <div className="mt-6">
            <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">{t("aiVisibility.sources.mix", "What kind of websites")}</p>
            <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={t("aiVisibility.sources.mix", "What kind of websites")}>
              {mix.map((m) => (
                <span key={m.k} style={{ width: `${(m.v / mixTotal) * 100}%`, backgroundColor: TYPE_COLOR[m.k] }} title={`${typeLabel(m.k as DomainType)} ${pct(m.v / mixTotal)}`} />
              ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              {mix.map((m) => (
                <li key={m.k} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: TYPE_COLOR[m.k] }} aria-hidden />
                  {typeLabel(m.k as DomainType)} <span className="num">{pct(m.v / mixTotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<View>
          label={t("aiVisibility.sources.view", "Show")}
          value={view}
          onChange={setView}
          options={[
            { value: "gaps", label: t("aiVisibility.sources.gaps", "Gaps") },
            { value: "domains", label: t("aiVisibility.sources.domains", "Websites") },
            { value: "pages", label: t("aiVisibility.sources.pages", "Pages") },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={withHint(t("aiVisibility.sources.search", "Search websites…"))}
            className="h-9 w-[min(260px,80vw)] pl-8"
          />
        </div>
      </div>

      {view === "gaps" ? (
        <>
          <p className="max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
            {t(
              "aiVisibility.sources.gapsIntro",
              "Websites the assistants read in answers that named a competitor and not you. Getting mentioned on the top ones is usually the fastest way in.",
            )}
          </p>
          {gaps.length ? (
            <Panel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                      <th className="px-4 py-2 font-medium sm:px-5">{t("aiVisibility.sources.col.website", "Website")}</th>
                      <th className="px-2 py-2 font-medium">{t("aiVisibility.sources.col.type", "Kind")}</th>
                      <th className="px-2 py-2 text-right font-medium">{t("aiVisibility.sources.col.gapAnswers", "Answers without you")}</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-5">{t("aiVisibility.sources.col.rivals", "Rivals named")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gaps.map((g) => (
                      <tr key={g.domain}>
                        <td className="px-4 py-2.5 font-medium sm:px-5">
                          <DomainLink domain={g.domain} />
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">{typeLabel(g.type)}</td>
                        <td className="num px-2 py-2.5 text-right">{g.gap_answers}</td>
                        <td className="num px-4 py-2.5 text-right sm:px-5">{g.gap_competitors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState compact title={t("aiVisibility.sources.noGaps", "No gaps in this period.")} body={t("aiVisibility.sources.noGapsBody", "Either you're named wherever rivals are, or there isn't enough data yet.")} />
            </Panel>
          )}
        </>
      ) : view === "domains" ? (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="px-4 py-2 font-medium sm:px-5">{t("aiVisibility.sources.col.website", "Website")}</th>
                  <th className="px-2 py-2 font-medium">{t("aiVisibility.sources.col.type", "Kind")}</th>
                  <th className="px-2 py-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1">
                      {t("aiVisibility.sources.col.used", "Used in")}
                      <Explain>{t("aiVisibility.sources.usedHelp", "Share of answers that cited at least one page of this website.")}</Explain>
                    </span>
                  </th>
                  <th className="px-2 py-2 text-right font-medium">{t("aiVisibility.sources.col.citations", "Citations")}</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">{t("aiVisibility.sources.col.pages", "Pages")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {domains.map((x) => (
                  <tr key={x.domain} className={cn(x.owner === "own" && "bg-marker-soft/40")}>
                    <td className="px-4 py-2.5 font-medium sm:px-5">
                      <DomainLink domain={x.domain} />
                      {x.owner_name && x.owner === "competitor" ? <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">({x.owner_name})</span> : null}
                    </td>
                    <td className="px-2 py-2.5">
                      {x.owner ? (
                        <span className="text-muted-foreground">{typeLabel(x.owner)}</span>
                      ) : canEdit ? (
                        <select
                          value={x.type ?? ""}
                          onChange={(e) => setType(x.domain, e.target.value as DomainType)}
                          aria-label={t("aiVisibility.sources.changeType", "Kind of website")}
                          className="h-7 rounded-md border border-transparent bg-transparent px-1 text-[12.5px] text-muted-foreground hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                        >
                          {!x.type ? <option value="">{typeLabel(null)}</option> : null}
                          {EDITABLE_TYPES.map((ty) => (
                            <option key={ty} value={ty}>
                              {typeLabel(ty)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{typeLabel(x.type)}</span>
                      )}
                    </td>
                    <td className="num px-2 py-2.5 text-right">{pct(x.used_pct)}</td>
                    <td className="num px-2 py-2.5 text-right text-muted-foreground">{x.citations}</td>
                    <td className="num px-4 py-2.5 text-right text-muted-foreground sm:px-5">{x.urls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-border">
            {pages.slice(0, 150).map((u) => (
              <li key={u.url} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13.5px] font-medium text-foreground", u.owner === "own" && "marker")}>{u.title || u.url}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {u.domain} · {typeLabel(u.owner ?? u.type)}
                  </span>
                </span>
                <span className="num shrink-0 text-right text-[12.5px] text-muted-foreground">
                  {t("aiVisibility.sources.pageLine", "{{n}} answers · {{p}} questions", { n: u.answers_used, p: u.prompts })}
                </span>
                <a
                  href={u.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={t("aiVisibility.answer.openSource", "Open {{domain}}", { domain: u.domain })}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function DomainLink({ domain }: { domain: string }) {
  return (
    <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
      {domain}
    </a>
  );
}

function SmallStat({ value, label, help }: { value: string; label: string; help?: string }) {
  return (
    <div>
      <p className="title-display num text-[26px] font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
        {label}
        {help ? <Explain>{help}</Explain> : null}
      </p>
    </div>
  );
}
