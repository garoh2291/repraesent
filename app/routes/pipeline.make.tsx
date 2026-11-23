import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
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
import { BackLink } from "~/components/notebook/back-link";
import { BigCount, ImportActions } from "~/components/contact-import/import-chrome";
import { ContactPicker, EMPTY_FILTER, matchesFilter, type PickerFilter } from "~/components/deal-batch/contact-picker";
import { BatchSettings, tomorrow, type BatchForm } from "~/components/deal-batch/batch-settings";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { parseDealValue } from "~/lib/api/deals";
import {
  createDealBatch,
  dealBatchKeys,
  getBatchCandidates,
  getDealBatch,
  recallSelection,
  runDealBatch,
  undoDealBatch,
  type BatchRunResult,
  type BatchSource,
  type BatchSummary,
} from "~/lib/api/deal-batches";


/** Everything a batch touches, so lists, boards, contact totals and Today agree. */
function refreshAfterBatch(qc: QueryClient) {
  for (const key of ["deals", "deals-pipeline", "contact-deals", "deal", "contacts", "contact", "pipeline-stages", "today", "tasks"]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

function errorText(t: (k: string, d: string) => string, err: unknown): string {
  const data = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
  switch (data?.code) {
    case "DEAL_BATCHES_NOT_READY":
      return t("dealBatch.errors.notReady", "Making deals in bulk isn't switched on for your business yet. Please ask support.");
    case "OWNER_NOT_MEMBER":
      return t("dealBatch.errors.owner", "That person is no longer on your team. Pick someone else to look after the deals.");
    case "NO_CONTACTS":
      return t("dealBatch.errors.noContacts", "None of these contacts are here any more. Go back and pick contacts again.");
    case "BATCH_STILL_RUNNING":
      return t("dealBatch.errors.stillRunning", "The deals are still being made. Undo once that has finished.");
    default:
      return t("dealBatch.errors.generic", "That didn't work. Check your connection and try again.");
  }
}

/**
 * Make deals from many contacts at once: `/pipeline/make?from=import|segment|selection&id=…`.
 * Pick who (everyone ticked, people with an open deal left out) → the same
 * value / stage / owner / first task for all → the server makes them in
 * slices (`&batch=` keeps a refresh on track) → counts, who was left out,
 * undo. Phones: who first, then the settings, each with its button in the
 * thumb zone.
 */
export default function MakeDealsPage() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "dealBatch.title", titleSuffix: " - Repraesent" });
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { currentWorkspace, user } = useAuthContext();
  const wsId = currentWorkspace?.id ?? null;
  const canEdit = useCanEditLeads();
  const { currency: wsCurrency } = useWorkspaceCurrency();

  const from = (params.get("from") ?? "selection") as BatchSource;
  const sourceId = params.get("id");
  const batchId = params.get("batch");
  const [selection] = useState<string[]>(() => (from === "selection" ? recallSelection() : []));
  const back =
    from === "import" && sourceId
      ? { to: `/contacts/import/${sourceId}`, label: t("dealBatch.back.import", "The import") }
      : from === "segment" && sourceId
        ? { to: `/segments/${sourceId}`, label: t("dealBatch.back.segment", "The segment") }
        : { to: "/contacts", label: t("dealBatch.back.contacts", "Contacts") };

  // ── who ──────────────────────────────────────────────────────────────────
  const candidates = useQuery({
    queryKey: dealBatchKeys.candidates(wsId, from, sourceId, selection.join(",")),
    queryFn: () =>
      getBatchCandidates(
        from === "selection" ? { source: "selection", contact_ids: selection } : { source: from, source_id: sourceId ?? undefined },
      ),
    enabled: !!wsId && !batchId && canEdit && (from === "selection" ? selection.length > 0 : !!sourceId),
    staleTime: 60_000,
    retry: false,
  });
  const rows = candidates.data?.rows ?? [];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PickerFilter>(EMPTY_FILTER);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !candidates.data) return;
    seeded.current = true;
    setPicked(new Set(candidates.data.rows.filter((r) => !r.open_deal).map((r) => r.contact_id)));
  }, [candidates.data]);
  // A deal for whoever is ticked AND shown: filtering to "Region: Süd" means only them,
  // without un-ticking everyone else (clear the filter and they are back).
  const pickedRows = useMemo(
    () => rows.filter((r) => picked.has(r.contact_id) && matchesFilter(r, filter)),
    [rows, picked, filter],
  );
  const pickedWithOpen = pickedRows.filter((r) => r.open_deal).length;

  // ── same for every deal ─────────────────────────────────────────────────
  const [form, setForm] = useState<BatchForm>({
    titleExtra: "",
    value: "",
    currency: null,
    pipelineId: "",
    stage: "",
    owner: "",
    withTask: true,
    taskTitle: t("dealBatch.settings.taskDefault", "Call them"),
    taskDue: tomorrow(),
    runAutomations: false,
  });
  const ownerSeeded = useRef(false);
  useEffect(() => {
    if (ownerSeeded.current || !user?.id) return;
    ownerSeeded.current = true;
    setForm((f) => ({ ...f, owner: user.id }));
  }, [user?.id]);
  const currency = form.currency ?? wsCurrency;
  const [phoneStep, setPhoneStep] = useState<"who" | "deal">("who");

  // ── making them ─────────────────────────────────────────────────────────
  const [progress, setProgress] = useState<BatchRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const summary = useQuery({
    queryKey: dealBatchKeys.batch(wsId, batchId ?? ""),
    queryFn: () => getDealBatch(batchId!),
    enabled: !!wsId && !!batchId,
    retry: false,
  });

  const drive = async (id: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setRunError(null);
    try {
      const done = await runDealBatch(id, setProgress);
      setProgress(done);
      refreshAfterBatch(qc);
      await qc.invalidateQueries({ queryKey: dealBatchKeys.batch(wsId, id) });
    } catch (err) {
      setRunError(errorText(t, err));
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  // A batch opened mid-way (refresh, came back) carries on by itself.
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    const s = summary.data;
    if (!s || !batchId || resumed.current === batchId) return;
    resumed.current = batchId;
    if ((s.status === "ready" || s.status === "running") && canEdit) void drive(batchId);
  }, [summary.data, batchId]);

  const create = useMutation({
    mutationFn: () =>
      createDealBatch({
        source: from,
        source_id: from === "selection" ? undefined : (sourceId ?? undefined),
        contact_ids: pickedRows.map((r) => r.contact_id),
        include_open_ids: pickedRows.filter((r) => r.open_deal).map((r) => r.contact_id),
        title_extra: form.titleExtra.trim() || null,
        value: form.value ? parseDealValue(form.value) : null,
        currency,
        pipeline_id: form.pipelineId || null,
        stage: form.stage || null,
        assigned_to: form.owner || null,
        task: form.withTask ? { title: form.taskTitle.trim(), due_date: form.taskDue || null } : null,
        run_automations: form.runAutomations,
      }),
    onSuccess: (b) => {
      const next = new URLSearchParams(params);
      next.set("batch", b.id);
      setParams(next, { replace: true });
      setProgress({ status: "running", counts: { created: 0, skipped_open: 0, skipped_gone: 0, failed: 0, tasks: 0 }, total: b.total, remaining: b.total });
      resumed.current = b.id;
      void drive(b.id);
    },
    onError: (err) => toast.error(errorText(t, err)),
  });

  // Leaving pauses the run (the page drives it): ask first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => running && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const taskMissing = form.withTask && !form.taskTitle.trim();
  const canMake = pickedRows.length > 0 && !taskMissing && !create.isPending;
  const makeLabel = t("dealBatch.make", { defaultValue: "Make {{count}} deals", count: pickedRows.length });

  // ── render ──────────────────────────────────────────────────────────────
  const header = (
    <div className="space-y-3">
      <BackLink to={back.to}>{back.label}</BackLink>
      <div className="min-w-0">
        <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[32px]">
          {t("dealBatch.title", "Make deals")}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {candidates.data?.source_name
            ? t("dealBatch.subtitleFrom", { defaultValue: "From {{name}}: one deal per contact you tick.", name: candidates.data.source_name })
            : t("dealBatch.subtitle", "One deal per contact you tick, all with the same value and stage.")}
        </p>
      </div>
    </div>
  );

  const leaveDialog = (
    <AlertDialog open={blocker.state === "blocked"} onOpenChange={(o) => !o && blocker.state === "blocked" && blocker.reset()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dealBatch.leave.title", "Leave while deals are being made?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dealBatch.leave.body", "It pauses when you leave. The deals made so far stay, and it carries on when you open this page again.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.state === "blocked" && blocker.reset()}>
            {t("dealBatch.leave.stay", "Stay on this page")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.state === "blocked" && blocker.proceed()}>
            {t("dealBatch.leave.go", "Leave and pause")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!canEdit) {
    return (
      <Shell>
        {header}
        <p className="py-10 text-[15px] text-foreground">
          {t("dealBatch.viewerOnly", "You can look at deals but not make them. Ask an admin of your business.")}
        </p>
      </Shell>
    );
  }

  // A batch: running, finished or undone.
  if (batchId) {
    const s = summary.data;
    const live = progress ?? (s ? { status: s.status, counts: s.counts, total: s.total, remaining: s.remaining } : null);
    if (summary.isLoading && !progress) return <Shell>{header}<Waiting text={t("dealBatch.loading", "Opening…")} /></Shell>;
    if (summary.isError && !progress) {
      return (
        <Shell>
          {header}
          <p className="py-10 text-[15px] text-foreground">
            {t("dealBatch.notFound", "This could not be opened. It may belong to another business.")}
          </p>
        </Shell>
      );
    }
    if (live && (running || live.remaining > 0 || runError)) {
      const doneN = live.total - live.remaining;
      return (
        <Shell>
          {leaveDialog}
          {header}
          <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6" aria-live="polite">
            <h2 className="title-display text-[22px] font-semibold text-foreground">
              {runError ? t("dealBatch.run.stopped", "It stopped") : t("dealBatch.run.title", "Making deals…")}
            </h2>
            <Progress value={live.total ? (doneN / live.total) * 100 : 0} />
            <p className="num text-[14px] text-foreground">
              {t("dealBatch.run.progress", { defaultValue: "{{done}} of {{total}} done", done: doneN.toLocaleString(), total: live.total.toLocaleString() })}
            </p>
            {runError ? (
              <>
                <p role="alert" className="text-[14px] text-destructive">
                  {t("dealBatch.run.stoppedHint", { defaultValue: "Nothing is made twice. {{detail}}", detail: runError })}
                </p>
                <Button className="h-11 max-sm:w-full" onClick={() => void drive(batchId)}>
                  {t("dealBatch.run.resume", "Carry on")}
                </Button>
              </>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">
                {t("dealBatch.run.keepOpen", "Keep this page open until it is finished. If it gets closed, it carries on when you open it again.")}
              </p>
            )}
          </section>
        </Shell>
      );
    }
    if (s) return <Shell>{header}<BatchDone summary={s} live={live} /></Shell>;
    return <Shell>{header}<Waiting text={t("dealBatch.loading", "Opening…")} /></Shell>;
  }

  // Picking.
  if (from === "selection" && selection.length === 0) {
    return (
      <Shell>
        {header}
        <div className="space-y-3 py-10">
          <p className="text-[15px] text-foreground">
            {t("dealBatch.selectionGone", "There is no selection any more. Tick contacts on the contacts list and choose “Make deals”.")}
          </p>
          <Button asChild className="h-11">
            <Link to="/contacts">{t("dealBatch.toContacts", "Go to contacts")}</Link>
          </Button>
        </div>
      </Shell>
    );
  }
  if (candidates.isLoading) return <Shell>{header}<Waiting text={t("dealBatch.loadingContacts", "Getting the contacts…")} /></Shell>;
  if (candidates.isError || !candidates.data) {
    return (
      <Shell>
        {header}
        <div className="space-y-3 py-10">
          <p className="text-[15px] text-foreground">{errorText(t, candidates.error)}</p>
          <Button variant="outline" className="h-11" onClick={() => void candidates.refetch()}>
            {t("dealBatch.retry", "Try again")}
          </Button>
        </div>
      </Shell>
    );
  }

  const note = (
    <span className="num">
      {t("dealBatch.pickedCount", { defaultValue: "{{count}} ticked", count: pickedRows.length })}
      {pickedWithOpen
        ? ` · ${t("dealBatch.pickedWithOpen", { defaultValue: "{{count}} of them already have a deal", count: pickedWithOpen })}`
        : ""}
    </span>
  );

  return (
    <Shell wide>
      {header}
      {candidates.data.truncated ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-[14px] text-foreground">
          {t("dealBatch.truncated", "Showing the first 5,000. Narrow it down with a segment to reach the others.")}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className={cn("min-w-0", phoneStep === "deal" && "max-lg:hidden")}>
          <ContactPicker data={candidates.data} picked={picked} onPicked={setPicked} filter={filter} onFilter={setFilter} />
        </div>
        <div className={cn("min-w-0 lg:sticky lg:top-6", phoneStep === "who" && "max-lg:hidden")}>
          <div className="lg:rounded-2xl lg:border lg:border-border lg:bg-background lg:p-5">
            <BatchSettings
              form={form}
              onForm={setForm}
              sampleNames={pickedRows.map((r) => r.name)}
              count={pickedRows.length}
              currency={currency}
            />
            <div className="mt-6 hidden lg:block">
              <Button className="h-11 w-full text-[15px]" disabled={!canMake} onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {makeLabel}
              </Button>
              <p className="mt-2 text-center text-[13px] text-muted-foreground">{note}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <ImportActions note={note}>
          {phoneStep === "who" ? (
            <Button disabled={pickedRows.length === 0} onClick={() => { setPhoneStep("deal"); window.scrollTo({ top: 0 }); }}>
              {t("dealBatch.next", "Next: the deals")}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="!flex-none px-4" onClick={() => { setPhoneStep("who"); window.scrollTo({ top: 0 }); }}>
                {t("dealBatch.backToWho", "Back")}
              </Button>
              <Button disabled={!canMake} onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {makeLabel}
              </Button>
            </>
          )}
        </ImportActions>
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("mx-auto w-full space-y-6 p-4 py-8 sm:space-y-8 sm:p-6 sm:py-10 app-fade-in", wide ? "max-w-[1120px]" : "max-w-[760px]")}>
      {children}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-[14px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {text}
    </div>
  );
}

/** Counts, who was left out and why, and the way back. */
function BatchDone({ summary: s, live }: { summary: BatchSummary; live: BatchRunResult | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const [confirm, setConfirm] = useState(false);
  const [undoLeft, setUndoLeft] = useState<number | null>(null);
  const c = { ...s.counts, ...(live?.counts ?? {}) };
  const isUndone = s.status === "undone";

  const undo = useMutation({
    mutationFn: () => undoDealBatch(s.id, setUndoLeft),
    onSuccess: (r) => {
      setUndoLeft(null);
      refreshAfterBatch(qc);
      void qc.invalidateQueries({ queryKey: dealBatchKeys.batch(currentWorkspace?.id, s.id) });
      toast.success(
        r.kept_total
          ? t("dealBatch.undo.doneKept", { defaultValue: "{{removed}} deals taken back, {{kept}} kept because someone worked on them.", removed: r.removed, kept: r.kept_total })
          : t("dealBatch.undo.done", { defaultValue: "{{count}} deals taken back.", count: r.removed }),
      );
    },
    onError: (err) => {
      setUndoLeft(null);
      toast.error(errorText(t, err));
    },
  });

  const reason = (o: string) =>
    o === "skipped_open"
      ? t("dealBatch.reason.open", "Already has a deal")
      : o === "skipped_gone"
        ? t("dealBatch.reason.gone", "Contact was deleted meanwhile")
        : t("dealBatch.reason.failed", "Could not be made. Try this one by hand.");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="title-display text-[24px] font-semibold text-foreground">
          {isUndone ? t("dealBatch.done.undoneTitle", "These deals were taken back") : t("dealBatch.done.title", "Your deals are made")}
        </h2>
        {!isUndone && s.owner ? (
          <p className="mt-1 text-[14px] text-muted-foreground">
            {t("dealBatch.done.owner", { defaultValue: "{{name}} looks after them.", name: s.owner.name })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {isUndone ? (
          <>
            <BigCount value={c.removed ?? 0} label={t("dealBatch.done.removed", "Taken back")} />
            <BigCount value={c.kept ?? s.kept_total} label={t("dealBatch.done.kept", "Kept")} hint={t("dealBatch.done.keptHint", "Someone worked on them.")} />
          </>
        ) : (
          <>
            <BigCount value={c.created} label={t("dealBatch.done.created", "New deals")} hint={c.tasks ? t("dealBatch.done.tasks", { defaultValue: "{{count}} with a first task", count: c.tasks }) : undefined} />
            <BigCount value={c.skipped_open} label={t("dealBatch.done.skippedOpen", "Already had a deal")} />
            {c.skipped_gone + c.failed > 0 ? (
              <BigCount value={c.skipped_gone + c.failed} label={t("dealBatch.done.notMade", "Not made")} marker />
            ) : null}
          </>
        )}
      </div>

      {s.left_out.length && !isUndone ? (
        <section className="space-y-3">
          <h3 className="text-[15px] font-semibold text-foreground">{t("dealBatch.done.leftOut", "Who didn't get a new deal")}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {s.left_out.map((r) => (
              <li key={r.contact_id} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <Link to={`/contacts/${r.contact_id}`} className="min-w-0 truncate text-[14px] font-medium text-foreground hover:underline">
                  {r.name ?? t("dealBatch.done.noName", "No name")}
                </Link>
                {r.open_deal ? (
                  <Link to={`/pipeline/${r.open_deal.id}`} className="min-w-0 truncate text-[13px] text-muted-foreground hover:underline">
                    {t("dealBatch.pick.hasOpenDeal", { defaultValue: "Already has a deal: {{title}}", title: r.open_deal.title })}
                  </Link>
                ) : (
                  <span className="text-[13px] text-muted-foreground">{reason(r.outcome)}</span>
                )}
              </li>
            ))}
          </ul>
          {s.left_out_total > s.left_out.length ? (
            <p className="num text-[13px] text-muted-foreground">
              {t("dealBatch.done.leftOutMore", { defaultValue: "and {{count}} more", count: s.left_out_total - s.left_out.length })}
            </p>
          ) : null}
        </section>
      ) : null}

      {isUndone && s.kept.length ? (
        <section className="space-y-3">
          <h3 className="text-[15px] font-semibold text-foreground">{t("dealBatch.done.keptList", "Kept, because someone worked on them")}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {s.kept.map((k) => (
              <li key={k.deal_id} className="px-4 py-2.5">
                <Link to={`/pipeline/${k.deal_id}`} className="text-[14px] font-medium text-foreground hover:underline">
                  {k.title ?? "—"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        <Button asChild className="h-9 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm">
          <Link to={`/pipeline?p=${s.settings.pipeline_id}`}>{t("dealBatch.done.seeDeals", "See them in Deals")}</Link>
        </Button>
        <span className="flex-1 max-sm:hidden" />
        {!isUndone && c.created > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1.5 text-xs text-muted-foreground max-sm:h-11 max-sm:w-full max-sm:text-sm"
            disabled={undo.isPending}
            onClick={() => setConfirm(true)}
          >
            {undo.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Undo2 className="size-3.5" aria-hidden />}
            {undo.isPending && undoLeft != null
              ? t("dealBatch.undo.going", { defaultValue: "Taking back… {{count}} to go", count: undoLeft })
              : t("dealBatch.undo.button", "Undo these deals")}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dealBatch.undo.title", "Undo these deals?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dealBatch.undo.body", {
                defaultValue:
                  "The {{count}} deals made here are removed, with their first task. Deals someone has moved, noted or added tasks to since are kept.",
                count: c.created,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dealBatch.undo.keep", "Keep the deals")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => undo.mutate()}>{t("dealBatch.undo.button", "Undo these deals")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
