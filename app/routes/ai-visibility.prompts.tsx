import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MessageSquarePlus, Search, Sparkles } from "lucide-react";
import { useAiVisibilityJob, useAiVisibilityPrompts, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { aiVisibilityApi, apiErrorMessage, isActiveJob, type PromptIntent, type PromptRow, type PromptStatus } from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { Bar, Segmented, intentLabel, pct, rank, useFilters } from "~/components/ai-visibility/shared";

/**
 * The questions we ask every run day, grouped by topic, with how each one
 * goes for the business. Suggested questions wait here until accepted.
 */
export default function AiVisibilityPrompts() {
  const { t } = useTranslation();
  const { state, canEdit } = useAiVisibilityContext();
  const suggestJob = useAiVisibilityJob("suggest_prompts");
  const suggesting = !!suggestJob && isActiveJob(suggestJob);
  const [filters] = useFilters();
  const q = useAiVisibilityPrompts(filters);
  const invalidate = useInvalidateAiVisibility();
  const { search } = useLocation();
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [tab, setTab] = useState<PromptStatus>("active");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const d = q.data;
  const rows = useMemo(() => {
    const all = (d?.prompts ?? []).filter((p) => p.status === tab);
    const needle = text.trim().toLowerCase();
    const list = needle ? all.filter((p) => p.text.toLowerCase().includes(needle) || (p.topic ?? "").toLowerCase().includes(needle)) : all;
    const groups = new Map<string, PromptRow[]>();
    for (const p of list) {
      const k = p.topic ?? t("aiVisibility.prompts.noTopic", "No topic");
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [d, tab, text, t]);

  if (!d) return <Skeleton className="h-72 rounded-xl" />;

  const counts = {
    active: d.prompts.filter((p) => p.status === "active").length,
    suggested: d.prompts.filter((p) => p.status === "suggested").length,
    archived: d.prompts.filter((p) => p.status === "archived").length,
  };
  const visibleIds = rows.flatMap(([, list]) => list.map((p) => p.id));
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const bulk = async (action: PromptStatus | "delete") => {
    setBusy(true);
    try {
      await aiVisibilityApi.bulkPrompts([...selected], action);
      setSelected(new Set());
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.saveFailed", "Could not update the questions.")));
    } finally {
      setBusy(false);
    }
  };

  // Queued on the server: the busy state survives reloads, and the watcher in
  // the layout announces the result even if this page was closed meanwhile.
  const suggest = async () => {
    try {
      await aiVisibilityApi.suggestPrompts({ count: 15 });
      setTab("suggested");
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.suggestFailed", "Could not suggest questions.")));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<PromptStatus>
            label={t("aiVisibility.prompts.view", "Show")}
            value={tab}
            onChange={(v) => {
              setTab(v);
              setSelected(new Set());
            }}
            options={[
              { value: "active", label: `${t("aiVisibility.prompts.active", "Tracked")} ${counts.active}` },
              { value: "suggested", label: `${t("aiVisibility.prompts.suggestedTab", "Suggested")} ${counts.suggested}` },
              { value: "archived", label: `${t("aiVisibility.prompts.archived", "Archived")} ${counts.archived}` },
            ]}
          />
          <span className="num text-[12.5px] text-muted-foreground">
            {t("aiVisibility.prompts.limit", "{{active}} of {{limit}} in your plan", { active: d.active, limit: d.limit })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={withHint(t("aiVisibility.prompts.search", "Search questions…"))}
              className="h-9 w-[min(260px,70vw)] pl-8"
            />
          </div>
          {canEdit ? (
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={suggest} disabled={suggesting}>
                <Sparkles className="size-3.5" />
                {suggesting ? t("aiVisibility.prompts.suggesting", "Thinking…") : t("aiVisibility.prompts.suggest", "Suggest questions")}
              </Button>
              <Button size="sm" className="h-9" onClick={() => setAdding(true)}>
                <MessageSquarePlus className="size-3.5" />
                {t("aiVisibility.prompts.add", "Add questions")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {tab === "suggested" && counts.suggested > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {t("aiVisibility.prompts.suggestedHint", "Suggestions are free to keep here. Only tracked questions are asked — and paid for.")}
        </p>
      ) : null}

      {selected.size > 0 && canEdit ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-foreground bg-card px-3 py-2 shadow-sm">
          <span className="num text-[13px] font-medium text-foreground">
            {t("aiVisibility.prompts.selected", "{{n}} selected", { n: selected.size })}
          </span>
          <span className="flex-1" />
          {tab !== "active" ? (
            <Button size="sm" disabled={busy} onClick={() => bulk("active")}>
              {t("aiVisibility.prompts.track", "Track")}
            </Button>
          ) : null}
          {tab !== "archived" ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("archived")}>
              {t("aiVisibility.prompts.archive", "Archive")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => bulk("delete")}>
            {t("aiVisibility.prompts.delete", "Delete")}
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<MessageSquarePlus />}
            title={
              text
                ? t("aiVisibility.prompts.noMatch", "No questions match.")
                : tab === "suggested"
                  ? t("aiVisibility.prompts.noSuggested", "No suggestions waiting.")
                  : tab === "archived"
                    ? t("aiVisibility.prompts.noArchived", "Nothing archived.")
                    : t("aiVisibility.prompts.none", "No questions tracked yet.")
            }
            body={tab === "suggested" && !text ? t("aiVisibility.prompts.noSuggestedBody", "“Suggest questions” writes new ones from your business profile and topics.") : undefined}
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1.75rem_1fr_8rem_4.5rem_12rem] items-center gap-3 border-b border-border px-4 py-2 text-[12px] text-muted-foreground md:grid sm:px-5">
            <span>
              {canEdit ? (
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set(visibleIds) : new Set())}
                  aria-label={t("aiVisibility.prompts.selectAll", "Select all")}
                />
              ) : null}
            </span>
            <span>{t("aiVisibility.prompts.col.question", "Question")}</span>
            <span>{t("aiVisibility.prompts.col.named", "Named in")}</span>
            <span className="text-right">{t("aiVisibility.prompts.col.place", "Place")}</span>
            <span>{t("aiVisibility.prompts.col.winners", "Named most")}</span>
          </div>
          {rows.map(([topic, list]) => (
            <section key={topic}>
              <h3 className="border-b border-border bg-background/50 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
                {topic} <span className="num font-normal">· {list.length}</span>
              </h3>
              <ul className="divide-y divide-border">
                {list.map((p) => (
                  <li key={p.id} className="grid grid-cols-[1.75rem_1fr] items-start gap-3 px-4 py-3 md:grid-cols-[1.75rem_1fr_8rem_4.5rem_12rem] md:items-center sm:px-5">
                    <span className="pt-0.5 md:pt-0">
                      {canEdit ? (
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            })
                          }
                          aria-label={t("aiVisibility.prompts.select", "Select question")}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <Link to={`/ai-visibility/prompts/${p.id}${search}`} className="text-[14px] font-medium text-foreground hover:underline">
                        {p.text}
                      </Link>
                      <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <Tag>{intentLabel(t, p.intent)}</Tag>
                        {p.branded ? <Tag>{t("aiVisibility.prompts.branded", "names a brand")}</Tag> : null}
                        {p.country && p.country !== state.project.country ? <Tag>{p.country}</Tag> : null}
                      </span>
                      {/* Phone layout: numbers under the question. */}
                      <span className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground md:hidden">
                        {p.metrics ? (
                          <>
                            <span>
                              {t("aiVisibility.prompts.col.named", "Named in")} <b className="num text-foreground">{pct(p.metrics.visibility)}</b>
                            </span>
                            <span>
                              {t("aiVisibility.prompts.col.place", "Place")} <b className="num text-foreground">{rank(p.metrics.position)}</b>
                            </span>
                          </>
                        ) : (
                          t("aiVisibility.prompts.noData", "No answers yet")
                        )}
                      </span>
                    </span>
                    <span className="hidden md:block">
                      {p.metrics ? (
                        <>
                          <span className="num text-[13px] text-foreground">{pct(p.metrics.visibility)}</span>
                          <Bar value={p.metrics.visibility} own className="mt-1" />
                        </>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="num hidden text-right text-[13px] text-foreground md:block">{rank(p.metrics?.position)}</span>
                    <span className="hidden min-w-0 flex-wrap gap-1 md:flex">
                      {(p.metrics?.top_brands ?? []).slice(0, 3).map((b) => (
                        <span
                          key={b.key}
                          className={cn(
                            "truncate rounded-full px-2 py-0.5 text-[11.5px]",
                            b.key === "own" ? "bg-marker-soft font-medium text-marker-ink" : "bg-foreground/[0.05] text-foreground/75",
                          )}
                        >
                          {b.name}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Panel>
      )}

      <AddPromptsSheet open={adding} onClose={() => setAdding(false)} topics={d.topics.map((x) => x.name)} room={d.limit - d.active} />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-foreground/[0.05] px-1.5 py-px text-muted-foreground">{children}</span>;
}

function AddPromptsSheet({ open, onClose, topics, room }: { open: boolean; onClose: () => void; topics: string[]; room: number }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAiVisibility();
  const [lines, setLines] = useState("");
  const [topic, setTopic] = useState("");
  const [intent, setIntent] = useState<PromptIntent>("commercial");
  const [saving, setSaving] = useState(false);
  const items = lines
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  const save = async (status: "active" | "suggested") => {
    setSaving(true);
    try {
      const res = await aiVisibilityApi.addPrompts(
        items.map((text) => ({ text, topic: topic.trim() || null, intent })),
        status,
      );
      toast.success(t("aiVisibility.prompts.added", "{{n}} questions added.", { n: res.added }));
      setLines("");
      void invalidate();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.addFailed", "Could not add the questions.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("aiVisibility.prompts.addTitle", "Add questions")}
      description={t("aiVisibility.prompts.addBody", "One per line, written the way a customer would ask an AI assistant.")}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-muted-foreground">
            {t("aiVisibility.prompts.room", "Room for {{n}} more tracked questions", { n: Math.max(0, room) })}
          </span>
          <Button variant="outline" disabled={!items.length || saving} onClick={() => save("suggested")}>
            {t("aiVisibility.prompts.saveSuggested", "Keep as suggestions")}
          </Button>
          <Button disabled={!items.length || saving || items.length > room} onClick={() => save("active")}>
            {t("aiVisibility.prompts.saveActive", "Track {{n}}", { n: items.length })}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Textarea
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          rows={7}
          autoFocus
          placeholder={t("aiVisibility.prompts.addPlaceholder", "Which kitchen studio in Hamburg is good for a small budget?\nWho installs fitted kitchens near Altona?")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-[13px]">
            <span className="font-medium text-foreground">{t("aiVisibility.prompts.topic", "Topic")}</span>
            <Input list="ai-visibility-topics" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("aiVisibility.prompts.topicPlaceholder", "e.g. Kitchens")} />
            <datalist id="ai-visibility-topics">
              {topics.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1.5 text-[13px]">
            <span className="font-medium text-foreground">{t("aiVisibility.prompts.intent", "The person is…")}</span>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value as PromptIntent)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-[13px]"
            >
              <option value="informational">{intentLabel(t, "informational")}</option>
              <option value="commercial">{intentLabel(t, "commercial")}</option>
              <option value="transactional">{intentLabel(t, "transactional")}</option>
            </select>
          </label>
        </div>
      </div>
    </BottomSheet>
  );
}
