import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useAiVisibilityCompetitors, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { aiVisibilityApi, apiErrorMessage, type CompetitorsPage } from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { Bar, Delta, Explain, pct, rank, useFilters, useToneWord } from "~/components/ai-visibility/shared";

type Row = CompetitorsPage["brands"][number];

/** How you compare, brand by brand — and rivals the assistants keep naming that you don't track yet. */
export default function AiVisibilityCompetitors() {
  const { t } = useTranslation();
  const { canEdit } = useAiVisibilityContext();
  const [filters] = useFilters();
  const q = useAiVisibilityCompetitors(filters);
  const invalidate = useInvalidateAiVisibility();
  const toneWord = useToneWord();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const d = q.data;
  if (!d) return <Skeleton className="h-72 rounded-xl" />;

  const track = async (name: string) => {
    try {
      await aiVisibilityApi.addCompetitor({ name, source: "suggestion" });
      toast.success(t("aiVisibility.competitors.tracked", "{{name}} is now compared.", { name }));
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.competitors.saveFailed", "Could not save the competitor.")));
    }
  };
  const reject = async (name: string) => {
    try {
      await aiVisibilityApi.rejectSuggestion(name);
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.competitors.saveFailed", "Could not save the competitor.")));
    }
  };

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden">
        <PanelHeader
          title={t("aiVisibility.competitors.title", "How you compare")}
          count={d.brands.length}
          action={
            canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
                <Plus className="size-3.5" />
                {t("aiVisibility.competitors.add", "Add competitor")}
              </Button>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                <th className="w-8 px-4 py-2 font-medium sm:px-5">#</th>
                <th className="px-2 py-2 font-medium">{t("aiVisibility.competitors.col.brand", "Brand")}</th>
                <th className="w-[26%] px-2 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t("aiVisibility.metric.visibility", "Named in")}
                  </span>
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t("aiVisibility.metric.share", "Share of mentions")}
                    <Explain>{t("aiVisibility.metric.shareHelp", "Of all the times you and your tracked competitors are mentioned, how many are you. Industry name: share of voice.")}</Explain>
                  </span>
                </th>
                <th className="px-2 py-2 text-right font-medium">{t("aiVisibility.competitors.col.place", "Place")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("aiVisibility.competitors.col.tone", "Tone")}</th>
                <th className="w-16 px-4 py-2 sm:px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.brands.map((b, i) => (
                <tr key={b.key} className={cn(b.is_own && "bg-marker-soft/40")}>
                  <td className="num px-4 py-3 text-muted-foreground sm:px-5">{i + 1}</td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2">
                      {!b.is_own ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: b.color ?? "#9a9a9a" }} aria-hidden /> : null}
                      <span className={cn("font-medium", b.is_own && "marker font-semibold")}>{b.name}</span>
                      {b.is_own ? <span className="text-[11.5px] text-muted-foreground">{t("aiVisibility.competitors.you", "you")}</span> : null}
                    </span>
                    {b.domains.length || b.aliases.length ? (
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{[...b.domains, ...b.aliases].join(" · ")}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2">
                      <span className="num w-10 text-right">{pct(b.visibility)}</span>
                      <Bar value={b.visibility} own={b.is_own} color={b.color} className="max-w-[140px]" />
                      <Delta cur={b.visibility} prev={b.previous_visibility} kind="pp" />
                    </span>
                  </td>
                  <td className="num px-2 py-3 text-right">{pct(b.share_of_voice)}</td>
                  <td className="num px-2 py-3 text-right">{rank(b.position)}</td>
                  <td className="px-2 py-3 text-right text-muted-foreground">{b.tone == null ? "—" : toneWord(b.tone)}</td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    {canEdit && !b.is_own ? (
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        aria-label={t("aiVisibility.competitors.edit", "Edit {{name}}", { name: b.name })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.brands.length === 1 ? (
          <EmptyState
            compact
            title={t("aiVisibility.competitors.noneTracked", "You're not comparing against anyone yet.")}
            body={t("aiVisibility.competitors.noneTrackedBody", "Add 3–5 businesses customers weigh you against, or pick from the names the assistants mention below.")}
          />
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader
          title={t("aiVisibility.competitors.suggestTitle", "Named often, not tracked")}
          hint={t("aiVisibility.competitors.suggestHint", "last 30 days, 2+ answers")}
        />
        {d.suggestions.length ? (
          <ul className="divide-y divide-border">
            {d.suggestions.map((s) => (
              <li key={s.name} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">{s.name}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {t("aiVisibility.competitors.inAnswers", "in {{n}} answers", { n: s.answers })}
                  </span>
                </span>
                {canEdit ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => track(s.name)}>
                      <UserPlus className="size-3.5" />
                      {t("aiVisibility.competitors.track", "Compare")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => reject(s.name)}
                      aria-label={t("aiVisibility.competitors.reject", "Don't suggest {{name}} again", { name: s.name })}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            title={t("aiVisibility.competitors.noSuggestions", "No new names yet.")}
            body={t("aiVisibility.competitors.noSuggestionsBody", "When the assistants name the same business in two or more answers, it shows up here.")}
          />
        )}
      </Panel>

      <CompetitorSheet row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CompetitorSheet({ row, onClose }: { row: Row | "new" | null; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAiVisibility();
  const isNew = row === "new";
  const existing = row && row !== "new" ? row : null;
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [aliases, setAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const rowKey = row === "new" ? "new" : row?.key ?? null;
  if (rowKey !== key) {
    setKey(rowKey);
    setName(existing?.name ?? "");
    setDomains(existing?.domains.join(", ") ?? "");
    setAliases(existing?.aliases.join(", ") ?? "");
  }
  const split = (v: string) =>
    v
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) await aiVisibilityApi.addCompetitor({ name: name.trim(), domains: split(domains), aliases: split(aliases), source: "manual" });
      else if (existing) await aiVisibilityApi.updateCompetitor(existing.key, { name: name.trim(), domains: split(domains), aliases: split(aliases) });
      void invalidate();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.competitors.saveFailed", "Could not save the competitor.")));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await aiVisibilityApi.deleteCompetitor(existing.key);
      void invalidate();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.competitors.saveFailed", "Could not save the competitor.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? t("aiVisibility.competitors.addTitle", "Add a competitor") : existing?.name ?? ""}
      description={t("aiVisibility.competitors.sheetBody", "Answers are matched on the name and its other spellings. The website tells us when an answer used their pages.")}
      footer={
        <div className="flex items-center gap-2">
          {existing ? (
            <Button variant="ghost" onClick={remove} disabled={saving} className="mr-auto text-overdue hover:text-overdue">
              <Trash2 className="size-3.5" />
              {t("aiVisibility.competitors.remove", "Stop comparing")}
            </Button>
          ) : (
            <span className="mr-auto" />
          )}
          <Button onClick={save} disabled={saving || !name.trim()}>
            {t("aiVisibility.common.save", "Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5 text-[13px]">
          <span className="font-medium text-foreground">{t("aiVisibility.competitors.name", "Name as customers say it")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Küchenhaus Nord" autoFocus={isNew} />
        </label>
        <label className="block space-y-1.5 text-[13px]">
          <span className="font-medium text-foreground">{t("aiVisibility.competitors.domains", "Website")}</span>
          <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="kuechenhaus-nord.de" />
        </label>
        <label className="block space-y-1.5 text-[13px]">
          <span className="font-medium text-foreground">{t("aiVisibility.competitors.aliases", "Other spellings (optional)")}</span>
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="KH Nord, Küchenhaus Nord GmbH" />
          <span className="block text-[12px] text-muted-foreground">{t("aiVisibility.competitors.aliasesHint", "Comma-separated. Use when answers write the name differently.")}</span>
        </label>
      </div>
    </BottomSheet>
  );
}
