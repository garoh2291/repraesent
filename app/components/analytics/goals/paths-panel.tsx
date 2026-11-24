import { useEffect, useRef, useState } from "react";
import { useFocusOnOpen } from "./use-focus-on-open";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, MoreHorizontal, Plus, X } from "lucide-react";
import { cn } from "~/lib/utils";
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
import type { StatsParams } from "~/lib/api/website-stats";
import {
  MAX_STEPS,
  MIN_STEPS,
  createPath,
  deletePath,
  getPathStats,
  goalKeys,
  isGoalsNotReady,
  listGoals,
  listPaths,
  restorePath,
  updatePath,
  useInvalidateGoals,
  type PathStats,
  type PathStep,
  type WebsitePath,
} from "~/lib/api/website-goals";
import { GoalPicker } from "./goal-picker";

const retryUnlessNotReady = (count: number, err: unknown) => !isGoalsNotReady(err) && count < 2;

/** Fetch a path's numbers only once its card is on screen. */
function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/**
 * "Steps to your goal": the owner lists the pages/actions on the way to what
 * they want (home → prices → contact) and sees how many people got how far.
 * Counted per visitor, in order, within 24 hours; other pages in between are
 * fine (Plausible's sequential funnel).
 */
export function PathsPanel({ workspaceId, params }: { workspaceId: string; params: StatsParams }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateGoals(workspaceId);
  const [editing, setEditing] = useState<WebsitePath | "new" | null>(null);

  const paths = useQuery({
    queryKey: goalKeys.paths(workspaceId),
    queryFn: listPaths,
    staleTime: 60_000,
    retry: retryUnlessNotReady,
  });

  const remove = useMutation({
    mutationFn: (p: WebsitePath) => deletePath(p.id).then(() => p),
    onSuccess: (p) => {
      void invalidate();
      toast(t("analytics.paths.removed", "Removed: {{label}}", { label: p.label }), {
        duration: 8000, // Undo needs time on a phone (5–8 s guidance).
        action: {
          label: t("analytics.goals.undo", "Undo"),
          onClick: () => {
            restorePath(p.id)
              .then(() => invalidate())
              .catch((err) => toast.error(extractErrorMessage(err)));
          },
        },
      });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  // The goals panel already explains "not set up yet"; stay quiet here.
  if (paths.isError && isGoalsNotReady(paths.error)) return null;
  const list = paths.data ?? [];

  return (
    <Panel>
      <PanelHeader
        title={t("analytics.paths.title", "Steps to your goal")}
        hint={t("analytics.paths.subtitle", "Where people stop on the way")}
        action={
          list.length ? (
            <Button
              variant="outline"
              size="sm"
              className="max-sm:size-11 max-sm:px-0 sm:h-9"
              aria-label={t("analytics.paths.add", "Add steps")}
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4" aria-hidden />
              <span className="max-sm:sr-only">{t("analytics.paths.add", "Add steps")}</span>
            </Button>
          ) : null
        }
      />
      {paths.isLoading ? (
        <Skeleton className="m-4 h-32 sm:m-5" />
      ) : paths.isError ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-5 sm:px-5">
          <p className="text-[14px] text-muted-foreground">{t("analytics.paths.loadFailed", "Your steps didn't load.")}</p>
          <Button variant="outline" size="sm" onClick={() => paths.refetch()}>
            {t("analytics.retry", "Try again")}
          </Button>
        </div>
      ) : list.length === 0 ? (
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <div className="max-w-prose space-y-1">
            <p className="text-[15px] font-semibold text-foreground">
              {t("analytics.paths.emptyTitle", "See where people give up")}
            </p>
            <p className="text-[14px] text-muted-foreground">
              {t(
                "analytics.paths.emptyBody",
                "List the steps on the way — for example home page, prices, contact page — and see how many people get from one to the next.",
              )}
            </p>
          </div>
          {/* What it will look like — clearly marked, made-up numbers. */}
          <figure className="relative rounded-lg border border-dashed border-border p-4">
            <figcaption className="absolute -top-2.5 left-3 bg-card px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analytics.paths.example", "Example")}
            </figcaption>
            <div className="pointer-events-none opacity-60" aria-hidden>
              <StepLadder
                stats={{
                  id: "example",
                  steps: [
                    { label: t("analytics.paths.exampleHome", "Home page"), visitors: 100, conversion_rate: 100, step_rate: 100, dropoff: 0 },
                    { label: t("analytics.paths.examplePrices", "Prices"), visitors: 24, conversion_rate: 24, step_rate: 24, dropoff: 76 },
                    { label: t("analytics.paths.exampleContact", "Contact page"), visitors: 6, conversion_rate: 6, step_rate: 25, dropoff: 18 },
                  ],
                }}
              />
            </div>
          </figure>
          <Button className="min-h-11" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t("analytics.paths.add", "Add steps")}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((p) => (
            <li key={p.id}>
              <PathCard
                path={p}
                workspaceId={workspaceId}
                params={params}
                onEdit={() => setEditing(p)}
                onRemove={() => remove.mutate(p)}
              />
            </li>
          ))}
        </ul>
      )}

      <PathEditor
        workspaceId={workspaceId}
        params={params}
        path={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void invalidate();
        }}
      />
    </Panel>
  );
}

function PathCard({
  path,
  workspaceId,
  params,
  onEdit,
  onRemove,
}: {
  path: WebsitePath;
  workspaceId: string;
  params: StatsParams;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [ref, seen] = useInView<HTMLDivElement>();
  const stats = useQuery({
    queryKey: goalKeys.pathStats(workspaceId, path.id, params),
    queryFn: () => getPathStats(path.id, params),
    enabled: seen,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return (
    <div ref={ref} className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="min-w-0 pt-2 text-[15px] font-semibold leading-snug text-foreground">{path.label}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("analytics.goals.more", "More for {{label}}", { label: path.label })}
              className="press -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="max-sm:min-h-11" onSelect={onEdit}>{t("analytics.paths.edit", "Change steps")}</DropdownMenuItem>
            <DropdownMenuItem className="max-sm:min-h-11" onSelect={onRemove}>{t("analytics.goals.remove", "Remove")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!seen || (stats.isLoading && !stats.data) ? (
        <Skeleton className="h-32" />
      ) : !stats.data ? (
        <p className="text-[14px] text-muted-foreground">
          {t("analytics.loadFailed", "We couldn't load this right now. Try again in a minute.")}
        </p>
      ) : (
        <StepLadder stats={stats.data} />
      )}
    </div>
  );
}

/**
 * The ladder: one ink bar per step, its width = share of the people who
 * started. Between steps, how many stopped — the biggest drop gets the
 * marker, because that's the step that needs the owner.
 */
function StepLadder({ stats }: { stats: PathStats }) {
  const { t, i18n } = useTranslation();
  const steps = stats.steps;
  const first = steps[0]?.visitors ?? 0;
  const pct = (n: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  // "1.6%" / "1,6 %": the locale decides the spacing.
  const share = (n: number) =>
    (n / 100).toLocaleString(i18n.language, { style: "percent", maximumFractionDigits: 1 });
  let worst = -1;
  let worstDrop = 0;
  steps.forEach((s, i) => {
    if (i > 0 && s.dropoff > worstDrop) {
      worstDrop = s.dropoff;
      worst = i;
    }
  });
  const last = steps[steps.length - 1];

  if (first === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        {t("analytics.paths.nobody", "Nobody did the first step in this period. Try a longer period or a different first step.")}
      </p>
    );
  }

  return (
    <div>
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={i}>
            {i > 0 ? (
              <p className="py-1.5 pl-9 text-[12.5px] leading-5 text-muted-foreground">
                <ArrowDown className="mr-1.5 inline-block size-3.5 align-[-2px]" aria-hidden />
                {/* Inline + cloned decoration: on a phone the marker follows each wrapped line. */}
                <span
                  className={cn(
                    i === worst &&
                      "marker font-semibold text-foreground [-webkit-box-decoration-break:clone] [box-decoration-break:clone]",
                  )}
                >
                  {t("analytics.paths.stopped", "{{n}} stopped here", { count: s.dropoff, n: formatNumber(s.dropoff) })}
                  {" · "}
                  {t("analytics.paths.wentOn", "{{pct}} % went on", { pct: pct(s.step_rate) })}
                </span>
              </p>
            ) : null}
            <div className="flex items-start gap-3">
              <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground/25 text-[12px] font-semibold text-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] text-foreground" title={s.label}>
                    {s.label}
                  </span>
                  <span className="shrink-0 text-[13px]">
                    <span className="num font-semibold text-foreground">{formatNumber(s.visitors)}</span>
                    {i > 0 ? <span className="num ml-1.5 text-muted-foreground">{share(s.conversion_rate)}</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-foreground/[0.07]" aria-hidden>
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${first ? Math.max(s.visitors ? 1.5 : 0, (s.visitors / first) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13.5px] text-foreground">
        {t("analytics.paths.summary", "{{done}} of {{start}} people did every step ({{pct}} %).", {
          done: formatNumber(last?.visitors ?? 0),
          start: formatNumber(first),
          pct: pct(last?.conversion_rate ?? 0),
        })}
      </p>
    </div>
  );
}

function PathEditor({
  workspaceId,
  params,
  path,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  params: StatsParams;
  path: WebsitePath | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [picking, setPicking] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const key = path === "new" ? "new" : path?.id ?? null;
  useFocusOnOpen(nameRef, key);
  if (key !== loadedFor) {
    setLoadedFor(key);
    setPicking(false);
    if (path && path !== "new") {
      setLabel(path.label);
      setSteps(path.steps);
    } else {
      setLabel("");
      setSteps([{ kind: "page", match: { path: "/" }, label: t("analytics.goals.summary.home", "Visited the home page") }]);
    }
  }

  const goals = useQuery({
    queryKey: goalKeys.list(workspaceId),
    queryFn: listGoals,
    enabled: !!path,
    staleTime: 60_000,
    retry: retryUnlessNotReady,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { label: label.trim(), steps };
      return path && path !== "new" ? updatePath(path.id, body) : createPath(body);
    },
    onSuccess: () => {
      toast.success(t("analytics.paths.saved", "Steps saved"));
      onSaved();
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const move = (i: number, d: -1 | 1) =>
    setSteps((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const canSave = label.trim().length > 0 && steps.length >= MIN_STEPS && !save.isPending;

  return (
    <BottomSheet
      open={!!path}
      onOpenChange={(v) => !v && onClose()}
      title={
        picking
          ? t("analytics.paths.pickTitle", "Add a step")
          : path === "new"
            ? t("analytics.paths.newTitle", "Steps to your goal")
            : t("analytics.paths.editTitle", "Change steps")
      }
      description={
        picking
          ? t("analytics.paths.pickDescription", "What do people do next on the way?")
          : t("analytics.paths.editDescription", "People may visit other pages in between. A step counts when it happens within a day.")
      }
      footer={
        picking ? (
          <Button variant="ghost" className="h-11" onClick={() => setPicking(false)}>
            <ArrowLeft className="size-4" aria-hidden />
            {t("analytics.goals.back", "Back")}
          </Button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted-foreground">
              {steps.length < MIN_STEPS
                ? t("analytics.paths.needTwo", "Add at least 2 steps")
                : t("analytics.paths.count", "{{n}} of {{max}} steps", { n: steps.length, max: MAX_STEPS })}
            </span>
            <Button className="h-11" disabled={!canSave} onClick={() => save.mutate()}>
              {save.isPending ? t("analytics.goals.saving", "Saving…") : t("analytics.paths.save", "Save steps")}
            </Button>
          </div>
        )
      }
    >
      {picking ? (
        <GoalPicker
          workspaceId={workspaceId}
          params={params}
          savedGoals={goals.data}
          onPick={(spec, name) => {
            setSteps((list) => [...list, { ...spec, label: name.slice(0, 80) }]);
            setPicking(false);
          }}
        />
      ) : (
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">{t("analytics.paths.nameLabel", "Name")}</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder={t("analytics.paths.namePlaceholder", "From home page to contact")}
              className="h-11"
              ref={nameRef}
            />
          </label>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={`${i}:${s.label}`} className="flex items-center gap-1 rounded-lg border border-border bg-background/60 py-1 pl-3 pr-1">
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground/25 text-[12px] font-semibold">
                  {i + 1}
                </span>
                <span className="ml-2 min-w-0 flex-1 truncate text-[14px]">{s.label}</span>
                <IconButton label={t("analytics.paths.up", "Move up")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={t("analytics.paths.down", "Move down")} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={t("analytics.paths.removeStep", "Remove step {{n}}", { n: i + 1 })}
                  onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}
                >
                  <X className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={steps.length >= MAX_STEPS}
            onClick={() => setPicking(true)}
          >
            <Plus className="size-4" aria-hidden />
            {steps.length >= MAX_STEPS
              ? t("analytics.paths.full", "That's the most steps")
              : t("analytics.paths.addStep", "Add a step")}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
