import { useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { desktopAutoFocus } from "~/lib/utils/touch";
import { formatNumber } from "~/lib/utils/format";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { StatsCompare, StatsParams } from "~/lib/api/website-stats";
import {
  createGoal,
  deleteGoal,
  getGoalDetails,
  getGoalStats,
  goalKeys,
  isGoalsNotReady,
  listGoals,
  renameGoal,
  undoGoalRemoval,
  useInvalidateGoals,
  type GoalSpec,
  type WebsiteGoal,
} from "~/lib/api/website-goals";
import { GoalPicker } from "./goal-picker";
import { useFocusOnOpen } from "./use-focus-on-open";
import { defaultLabel, presetLabel, specKey, specSummary } from "./goal-words";
import { valueLabel } from "../labels";

const QUICK = ["directions", "social", "download"] as const;

/** Retry network hiccups, never "not set up yet". */
const retryUnlessNotReady = (count: number, err: unknown) => !isGoalsNotReady(err) && count < 2;

/**
 * "Your goals": what the owner wants people to do on the website, each with
 * how many people did it in the picked period. The first panel after the
 * chart, because it answers "is the website doing its job?".
 */
export function YourGoalsPanel({
  workspaceId,
  params,
  compare,
  onFilterEvent,
}: {
  workspaceId: string;
  params: StatsParams;
  compare: StatsCompare;
  onFilterEvent: (eventName: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const invalidate = useInvalidateGoals(workspaceId);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<WebsiteGoal | null>(null);
  const [renaming, setRenaming] = useState<WebsiteGoal | null>(null);

  const list = useQuery({
    queryKey: goalKeys.list(workspaceId),
    queryFn: listGoals,
    staleTime: 60_000,
    retry: retryUnlessNotReady,
  });
  const goals = list.data ?? [];
  const stats = useQuery({
    queryKey: goalKeys.stats(workspaceId, params, compare),
    queryFn: () => getGoalStats(params, compare),
    enabled: goals.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: retryUnlessNotReady,
  });
  const byId = new Map((stats.data?.rows ?? []).map((r) => [r.id, r]));

  const add = useMutation({
    mutationFn: (body: GoalSpec & { label: string }) => createGoal(body),
    onSuccess: (g) => {
      toast.success(t("analytics.goals.added_toast", "Goal added: {{label}}", { label: g.label }));
      setAdding(false);
      void invalidate();
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (g: WebsiteGoal) => deleteGoal(g.id).then((removal) => ({ g, removal })),
    onSuccess: ({ g, removal }) => {
      void invalidate();
      const lists = removal.paths.map((p) => p.label);
      toast(t("analytics.goals.removed", "Goal removed: {{label}}", { label: g.label }), {
        description: lists.length
          ? t("analytics.goals.removedSteps", "Also taken out of: {{lists}}", { lists: lists.join(", ") })
          : undefined,
        duration: 8000, // Undo needs time on a phone (5–8 s guidance).
        action: {
          label: t("analytics.goals.undo", "Undo"),
          onClick: () => {
            undoGoalRemoval(g.id, removal)
              .then(() => invalidate())
              .catch((err) => toast.error(extractErrorMessage(err)));
          },
        },
      });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (list.isError && isGoalsNotReady(list.error)) {
    return (
      <Panel>
        <PanelHeader title={t("analytics.goals.title", "Your goals")} />
        <p className="px-4 py-5 text-[14px] text-muted-foreground sm:px-5">
          {t("analytics.goals.notReady", "Goals are being set up for your account. Check back a little later.")}
        </p>
      </Panel>
    );
  }

  const taken = new Set(goals.map((g) => specKey({ kind: g.kind, preset: g.preset ?? null, match: g.match })));

  return (
    <Panel>
      <PanelHeader
        title={t("analytics.goals.title", "Your goals")}
        hint={t("analytics.goals.subtitle", "What you want people to do on your website")}
        action={
          goals.length ? (
            <Button
              variant="outline"
              size="sm"
              className="max-sm:size-11 max-sm:px-0 sm:h-9"
              aria-label={t("analytics.goals.add", "Add a goal")}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden />
              <span className="max-sm:sr-only">{t("analytics.goals.add", "Add a goal")}</span>
            </Button>
          ) : null
        }
      />

      {list.isLoading ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.isError ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-5 sm:px-5">
          <p className="text-[14px] text-muted-foreground">
            {t("analytics.goals.loadFailed", "Your goals didn't load.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            {t("analytics.retry", "Try again")}
          </Button>
        </div>
      ) : goals.length === 0 ? (
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <div className="max-w-prose space-y-1">
            <p className="text-[15px] font-semibold text-foreground">
              {t("analytics.goals.emptyTitle", "What should people do on your website?")}
            </p>
            <p className="text-[14px] text-muted-foreground">
              {t(
                "analytics.goals.emptyBody",
                "Pick it once and you'll see here how many people did it — this month, last month, any time.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((key) => {
              const spec: GoalSpec = { kind: "preset", preset: key };
              return (
                <button
                  key={key}
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ ...spec, label: presetLabel(key, t) })}
                  className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-[14px] font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  <Plus className="size-4" aria-hidden />
                  {presetLabel(key, t)}
                </button>
              );
            })}
            <Button className="min-h-11" onClick={() => setAdding(true)}>
              {t("analytics.goals.addOther", "Something else…")}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {goals.map((g) => (
            <li key={g.id}>
              <GoalCard
                goal={g}
                stat={byId.get(g.id)}
                loading={stats.isLoading}
                compared={stats.data?.previous_total_visitors != null}
                locale={i18n.language}
                onOpen={() => setOpen(g)}
                onRename={() => setRenaming(g)}
                onRemove={() => remove.mutate(g)}
              />
            </li>
          ))}
        </ul>
      )}

      <AddGoalSheet
        open={adding}
        onOpenChange={setAdding}
        workspaceId={workspaceId}
        params={params}
        taken={taken}
        saving={add.isPending}
        onSave={(spec, label) => add.mutate({ ...spec, label })}
      />
      <GoalDetailsSheet
        goal={open}
        onClose={() => setOpen(null)}
        workspaceId={workspaceId}
        params={params}
        stat={open ? byId.get(open.id) : undefined}
        onFilterEvent={(name) => {
          setOpen(null);
          onFilterEvent(name);
        }}
      />
      <RenameSheet
        goal={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null);
          void invalidate();
        }}
      />
    </Panel>
  );
}

function GoalCard({
  goal,
  stat,
  loading,
  compared,
  locale,
  onOpen,
  onRename,
  onRemove,
}: {
  goal: WebsiteGoal;
  stat?: { visitors: number; conversion_rate: number; previous_visitors: number | null };
  loading: boolean;
  compared: boolean;
  locale: string;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const visitors = stat?.visitors ?? 0;
  const prev = stat?.previous_visitors ?? null;
  const diff = prev == null ? null : visitors - prev;

  return (
    <div className="relative h-full rounded-lg border border-border bg-background/60">
      <button
        type="button"
        onClick={onOpen}
        className="press flex h-full w-full flex-col gap-1 rounded-lg p-4 pr-12 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">{goal.label}</span>
        {loading && !stat ? (
          <Skeleton className="mt-1 h-9 w-20" />
        ) : (
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-[30px] font-semibold leading-none tracking-tight text-foreground">
              {formatNumber(visitors)}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {t("analytics.goals.people", "people", { count: visitors })}
            </span>
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
          <span>
            {t("analytics.goals.share", "{{pct}} % of all people", {
              pct: (stat?.conversion_rate ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 }),
            })}
          </span>
          {compared && diff != null ? <Trend diff={diff} /> : null}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("analytics.goals.more", "More for {{label}}", { label: goal.label })}
            className="press absolute right-1 top-1 flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="max-sm:min-h-11" onSelect={onRename}>{t("analytics.goals.rename", "Rename")}</DropdownMenuItem>
          <DropdownMenuItem className="max-sm:min-h-11" onSelect={onRemove}>{t("analytics.goals.remove", "Remove")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** "▲ 5 more than before" — the words carry the meaning, not the colour. */
function Trend({ diff }: { diff: number }) {
  const { t } = useTranslation();
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <Minus className="size-3.5" aria-hidden />
        {t("analytics.goals.same", "same as before")}
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5", up ? "text-foreground" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden />
      {up
        ? t("analytics.goals.more_than", "{{n}} more than before", { n: formatNumber(diff) })
        : t("analytics.goals.fewer_than", "{{n}} fewer than before", { n: formatNumber(-diff) })}
    </span>
  );
}

function AddGoalSheet({
  open,
  onOpenChange,
  workspaceId,
  params,
  taken,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  params: StatsParams;
  taken: Set<string>;
  saving: boolean;
  onSave: (spec: GoalSpec, label: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<GoalSpec | null>(null);
  const [label, setLabel] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  // Fresh every time it opens — also after a save closed it from outside.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPicked(null);
      setLabel("");
    }
  }

  const close = (v: boolean) => onOpenChange(v);

  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={picked ? t("analytics.goals.nameTitle", "Name this goal") : t("analytics.goals.add", "Add a goal")}
      description={
        picked
          ? specSummary(picked, t)
          : t("analytics.goals.addDescription", "Pick what counts for you. The numbers next to each are people in the period you're looking at.")
      }
      footer={
        picked ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" className="h-11" onClick={() => setPicked(null)}>
              <ArrowLeft className="size-4" aria-hidden />
              {t("analytics.goals.back", "Back")}
            </Button>
            <Button
              className="h-11"
              disabled={saving || !label.trim()}
              onClick={() => onSave(picked, label.trim())}
            >
              {saving ? t("analytics.goals.saving", "Saving…") : t("analytics.goals.save", "Save goal")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {picked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim() && !saving) onSave(picked, label.trim());
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">
              {t("analytics.goals.nameLabel", "Name on your page")}
            </span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              className="h-11"
              autoFocus={desktopAutoFocus()}
              enterKeyHint="done"
            />
          </label>
        </form>
      ) : (
        <GoalPicker
          workspaceId={workspaceId}
          params={params}
          taken={taken}
          onPick={(spec, name) => {
            setPicked(spec);
            setLabel(name || defaultLabel(spec, t));
          }}
        />
      )}
    </BottomSheet>
  );
}

function GoalDetailsSheet({
  goal,
  onClose,
  workspaceId,
  params,
  stat,
  onFilterEvent,
}: {
  goal: WebsiteGoal | null;
  onClose: () => void;
  workspaceId: string;
  params: StatsParams;
  stat?: { visitors: number; conversion_rate: number };
  onFilterEvent: (name: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const details = useQuery({
    queryKey: goalKeys.details(workspaceId, goal?.id ?? "", params),
    queryFn: () => getGoalDetails(goal!.id, params),
    enabled: !!goal,
    staleTime: 60_000,
  });
  const match = (goal?.match ?? {}) as { name?: string; prop?: unknown };
  const plainEvent = goal?.kind === "event" && match.name && !match.prop;

  return (
    <BottomSheet
      open={!!goal}
      onOpenChange={(v) => !v && onClose()}
      title={goal?.label ?? ""}
      description={goal ? specSummary(goal, t) : undefined}
      footer={
        plainEvent ? (
          <Button variant="outline" className="h-11 w-full" onClick={() => onFilterEvent(match.name as string)}>
            {t("analytics.goalFilter", "Show only people who did this")}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <p className="flex items-baseline gap-2">
          <span className="num text-[34px] font-semibold leading-none tracking-tight">{formatNumber(stat?.visitors ?? 0)}</span>
          <span className="text-[14px] text-muted-foreground">
            {t("analytics.goals.peopleInPeriod", "people in this period", { count: stat?.visitors ?? 0 })}
          </span>
        </p>
        {details.isLoading ? (
          <Skeleton className="h-40" />
        ) : !details.data ? (
          <p className="text-[14px] text-muted-foreground">{t("analytics.loadFailed", "We couldn't load this right now. Try again in a minute.")}</p>
        ) : (
          <>
            <BarList
              title={t("analytics.goals.cameFrom", "Where they came from")}
              rows={details.data.sources.map((r) => ({
                key: r.value,
                label: valueLabel("source", r.value, t, i18n.language).text,
                value: r.visitors,
              }))}
              empty={t("analytics.goals.noneYet", "Nobody did this in this period yet.")}
            />
            <BarList
              title={
                goal?.kind === "page"
                  ? t("analytics.goals.whichPages", "Which pages")
                  : t("analytics.goals.where", "On which page")
              }
              mono
              rows={details.data.pages.map((r) => ({ key: r.value, label: r.value, value: r.visitors }))}
              empty={t("analytics.goals.noneYet", "Nobody did this in this period yet.")}
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function BarList({
  title,
  rows,
  empty,
  mono,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
  empty: string;
  mono?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="relative flex min-h-9 items-center gap-3 overflow-hidden rounded-md px-2.5">
              <span
                className="absolute inset-y-0 left-0 rounded-md bg-foreground/[0.07]"
                style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
                aria-hidden
              />
              <span className={cn("relative min-w-0 flex-1 truncate text-[14px]", mono && "font-mono text-[13px]")}>{r.label}</span>
              <span className="num relative text-[13.5px] font-semibold">{formatNumber(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RenameSheet({
  goal,
  onClose,
  onSaved,
}: {
  goal: WebsiteGoal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Fresh draft every time the sheet opens; a cancelled edit is not kept.
  const openId = goal?.id ?? null;
  useFocusOnOpen(inputRef, openId);
  if (openId !== forId) {
    setForId(openId);
    if (goal) setLabel(goal.label);
  }
  const save = useMutation({
    mutationFn: () => renameGoal(goal!.id, label.trim()),
    onSuccess: () => {
      toast.success(t("analytics.goals.renamed", "Name saved"));
      onSaved();
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
  return (
    <BottomSheet
      open={!!goal}
      onOpenChange={(v) => !v && onClose()}
      title={t("analytics.goals.renameTitle", "Rename goal")}
      footer={
        <Button className="h-11 w-full" disabled={!label.trim() || save.isPending} onClick={() => save.mutate()}>
          {t("analytics.goals.saveName", "Save name")}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim() && !save.isPending) save.mutate();
        }}
      >
        <Input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          className="h-11"
          aria-label={t("analytics.goals.nameLabel", "Name on your page")}
        />
      </form>
    </BottomSheet>
  );
}
