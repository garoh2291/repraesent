import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
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
import { detailLabel } from "~/components/contact-import/labels";
import { forgetLayout, recallLayout, rememberLayout } from "~/lib/contact-import/mapping-memory";
import { BackLink } from "~/components/notebook/back-link";
import { ImportActions, ImportSteps, type ImportStep } from "~/components/contact-import/import-chrome";
import { FileStep } from "~/components/contact-import/file-step";
import { MatchStep, matchProblems, type ColumnChoice } from "~/components/contact-import/match-step";
import { CheckStep, plannedWrites } from "~/components/contact-import/check-step";
import { DoneStep } from "~/components/contact-import/done-step";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  checkContactImport,
  customFieldLabel,
  customKeyFor,
  getContactImport,
  runContactImport,
  stopContactImport,
  uploadContactImport,
  type ColumnMapping,
  type ContactImport,
  type ImportCheck,
  type ImportRunResult,
  type RowKind,
} from "~/lib/api/contact-imports";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";

export function meta() {
  return [{ title: "Import contacts - Repraesent" }];
}

function errorCode(error: unknown): string | null {
  const data = (error as { response?: { data?: { code?: unknown } } })?.response?.data;
  return typeof data?.code === "string" ? data.code : null;
}

/** The suggestion (or an earlier choice) as the owner edits it. */
function choicesFrom(imp: ContactImport): Record<number, ColumnChoice> {
  const out: Record<number, ColumnChoice> = {};
  for (const m of imp.mapping) {
    const header = imp.headers[m.column] ?? "";
    const name =
      m.target === "custom" && m.custom_key
        ? customKeyFor(header) === m.custom_key
          ? header
          : customFieldLabel(m.custom_key)
        : header;
    out[m.column] = { target: m.target, name };
  }
  for (const c of imp.columns) out[c.column] ??= { target: "skip", name: c.header };
  return out;
}

function mappingFrom(imp: ContactImport, choices: Record<number, ColumnChoice>): ColumnMapping[] {
  return imp.columns.map((c) => {
    const choice = choices[c.column] ?? { target: "skip" as const, name: "" };
    return choice.target === "custom"
      ? { column: c.column, target: "custom", custom_key: customKeyFor(choice.name) }
      : { column: c.column, target: choice.target };
  });
}

/**
 * Bring in a contact file: your file → match columns → check → done.
 * `/contacts/import` starts a new one; `/contacts/import/:importId` reopens one
 * (a refresh mid-way, an unfinished run, or a past import with its Undo).
 */
export default function ContactImportPage() {
  const { t } = useTranslation();
  const { importId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditLeads();

  const importQuery = useQuery({
    queryKey: ["contact-import", importId],
    queryFn: () => getContactImport(importId!),
    enabled: !!importId,
  });
  const imp = importQuery.data ?? null;

  const [choices, setChoices] = useState<Record<number, ColumnChoice>>({});
  const [rowKind, setRowKind] = useState<RowKind>("auto");
  const [existingMode, setExistingMode] = useState<"update" | "skip">("update");
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [rowChoices, setRowChoices] = useState<Record<string, "update" | "skip">>({});
  const [workflowsAck, setWorkflowsAck] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [fromMemory, setFromMemory] = useState(false);
  const [saving, setSaving] = useState(false);
  const running = useRef(false);

  // Take the server's suggestion once per import; later edits are the owner's.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    if (!imp || seeded.current === imp.id) return;
    seeded.current = imp.id;
    // A layout matched before (this browser) wins over the fresh suggestion,
    // but only for an upload nobody has touched yet.
    const remembered = imp.status === "draft" ? recallLayout(imp.headers) : null;
    if (remembered) {
      setChoices(Object.fromEntries(remembered.choices.map((c, i) => [i, c])));
      setRowKind(remembered.rowKind);
      setFromMemory(true);
    } else {
      setChoices(choicesFrom(imp));
      setRowKind(imp.options.row_kind);
      setFromMemory(false);
    }
    setExistingMode(imp.options.existing);
    setCheck(null);
    setRowChoices({});
    setWorkflowsAck(false);
    setProgress(null);
    setRunError(null);
  }, [imp]);

  const upload = useMutation({
    mutationFn: uploadContactImport,
    onSuccess: (created) => {
      setUploadError(null);
      queryClient.setQueryData(["contact-import", created.id], created);
      navigate(`/contacts/import/${created.id}`, { replace: true });
    },
    onError: (error) => {
      const code = errorCode(error);
      const known: Record<string, string> = {
        IMPORT_FILE_EMPTY: t("contacts.importV2.file.errEmpty", "That file is empty. Choose the file with your contacts."),
        IMPORT_FILE_NO_ROWS: t(
          "contacts.importV2.file.errNoRows",
          "That file only has a header line. Add your contacts below it and choose it again.",
        ),
        IMPORT_FILE_TOO_MANY_ROWS: t(
          "contacts.importV2.file.errTooManyRows",
          "That file has more than 5,000 lines. Split it into smaller files and bring them in one by one.",
        ),
        IMPORT_FILE_TOO_MANY_COLUMNS: t(
          "contacts.importV2.file.errTooManyColumns",
          "That file has more than 100 columns. Remove the ones you don't need and choose it again.",
        ),
        IMPORT_FILE_UNREADABLE: t(
          "contacts.importV2.file.errUnreadable",
          "That file could not be read. Save it again as CSV or Excel (.xlsx) and choose the new file.",
        ),
      };
      setUploadError(
        (code && known[code]) ||
          (error instanceof Error && error.message === "xlsx_empty"
            ? known.IMPORT_FILE_EMPTY
            : extractErrorMessage(error)),
      );
    },
  });

  const runCheck = useMutation({
    mutationFn: (mode: "update" | "skip") =>
      checkContactImport(imp!.id, {
        mapping: mappingFrom(imp!, choices),
        options: { row_kind: rowKind, existing: mode },
      }),
    onSuccess: (result) => {
      if (imp) {
        rememberLayout(imp.headers, {
          choices: imp.columns.map((c) => choices[c.column] ?? { target: "skip", name: c.header }),
          rowKind,
        });
      }
      setCheck(result);
      setRowChoices({});
      window.scrollTo?.({ top: 0 });
      document.querySelector("main")?.scrollTo?.({ top: 0 });
    },
    onError: (error) => {
      toast.error(t("contacts.importV2.check.failed", "The file could not be checked."), {
        description: extractErrorMessage(error),
      });
    },
  });

  /** Calls the server slice by slice until nothing is left. Safe to call again after an error. */
  const runAll = useCallback(
    async (id: string, firstChoices?: Record<string, "update" | "skip">) => {
      if (running.current) return;
      running.current = true;
      setRunError(null);
      setSaving(true);
      try {
        let choicesToSend = firstChoices;
        for (;;) {
          const res = await runContactImport(id, choicesToSend);
          choicesToSend = undefined;
          setProgress(res);
          if (res.remaining === 0 || res.status === "done" || res.status === "undone") break;
        }
        await queryClient.invalidateQueries({ queryKey: ["contact-import", id] });
        void queryClient.invalidateQueries({ queryKey: ["contact-imports"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      } catch (error) {
        setRunError(extractErrorMessage(error));
        void queryClient.invalidateQueries({ queryKey: ["contact-import", id] });
      } finally {
        running.current = false;
        setSaving(false);
      }
    },
    [queryClient],
  );

  const stop = useMutation({
    mutationFn: () => stopContactImport(imp!.id),
    onSuccess: async (res) => {
      setRunError(null);
      setProgress(res);
      await queryClient.invalidateQueries({ queryKey: ["contact-import", imp!.id] });
      void queryClient.invalidateQueries({ queryKey: ["contact-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error) => {
      toast.error(t("contacts.importV2.run.stopFailed", "The import could not be stopped."), {
        description: extractErrorMessage(error),
      });
    },
  });

  const problems = useMemo(() => (imp ? matchProblems(imp.columns, choices) : {}), [imp, choices]);
  const customLabel = useCallback(
    (key: string) => {
      if (imp) {
        for (const c of imp.columns) {
          const choice = choices[c.column];
          if (choice?.target === "custom" && customKeyFor(choice.name) === key) return choice.name;
        }
      }
      return detailLabel(t, key);
    },
    [imp, choices, t],
  );

  const status = progress?.status ?? imp?.status;
  const isRunning = !!imp && (status === "running" || running.current) && status !== "done" && status !== "undone";
  const step: ImportStep = !importId
    ? "file"
    : !imp
      ? "file"
      : status === "done" || status === "undone"
        ? "done"
        : isRunning
          ? "check"
          : check
            ? "check"
            : "match";

  // Leaving mid-save pauses the import (the page drives it), so ask first.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      saving && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!saving) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saving]);

  const planned = check ? plannedWrites(check, existingMode, rowChoices) : { add: 0, update: 0 };
  const writes = planned.add + planned.update;
  const total = imp?.total_rows ?? 0;
  const doneRows = progress ? progress.total_rows - progress.remaining : imp ? total - imp.remaining : 0;

  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 p-4 py-8 sm:space-y-8 sm:p-6 sm:py-10 app-fade-in",
        step === "check" && check && !isRunning ? "max-w-[1120px]" : "max-w-[920px]",
      )}
    >
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contacts.importV2.run.leaveTitle", "Leave while it is saving?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "contacts.importV2.run.leaveBody",
                "The import pauses when you leave. What is saved stays saved, and you can carry on later from “Past imports”.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.state === "blocked" && blocker.reset()}>
              {t("contacts.importV2.run.leaveStay", "Stay on this page")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.state === "blocked" && blocker.proceed()}>
              {t("contacts.importV2.run.leaveGo", "Leave and pause")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="space-y-3">
        <BackLink to="/contacts">{t("contacts.importV2.back", "Contacts")}</BackLink>
        {/* Title first, the step rail under it: the step names are long in
            French and German and must never squeeze the title. */}
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[32px]">
              {t("contacts.importV2.title", "Bring in contacts")}
            </h1>
            {imp && step !== "file" ? (
              <p className="mt-1 truncate text-[14px] text-muted-foreground">
                {t("contacts.importV2.fileLine", {
                  defaultValue: "{{name}} · {{rows}} lines, {{columns}} columns",
                  name: imp.file_name,
                  rows: imp.total_rows.toLocaleString(),
                  columns: imp.headers.length,
                })}
              </p>
            ) : null}
          </div>
          <ImportSteps current={step} />
        </div>
      </div>

      {importId && importQuery.isLoading ? (
        <div className="flex items-center gap-2 py-16 text-[14px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("contacts.importV2.loading", "Opening the import…")}
        </div>
      ) : importId && importQuery.isError ? (
        <div className="space-y-3 py-10">
          <p className="text-[15px] font-medium text-foreground">
            {t("contacts.importV2.notFound", "This import could not be opened. It may belong to another business.")}
          </p>
          <Button onClick={() => navigate("/contacts/import")}>
            {t("contacts.importV2.startNew", "Start a new import")}
          </Button>
        </div>
      ) : step === "file" ? (
        canEdit ? (
          <FileStep uploading={upload.isPending} error={uploadError} onFile={(f) => upload.mutate(f)} />
        ) : (
          <p className="py-10 text-[15px] text-foreground">
            {t("contacts.importV2.viewerOnly", "You can look at contacts but not add them. Ask an admin of your business to bring the file in.")}
          </p>
        )
      ) : step === "done" && imp ? (
        <DoneStep
          imp={progress ? { ...imp, status: progress.status, counts: progress.counts } : imp}
          canEdit={canEdit}
        />
      ) : isRunning && imp ? (
        <section className="space-y-4 py-6" aria-live="polite">
          <h2 className="title-display text-[22px] font-semibold text-foreground">
            {runError
              ? t("contacts.importV2.run.stopped", "The import stopped")
              : t("contacts.importV2.run.title", "Saving your contacts…")}
          </h2>
          <Progress value={total ? (doneRows / total) * 100 : 0} />
          <p className="num text-[14px] text-foreground">
            {t("contacts.importV2.run.progress", {
              defaultValue: "{{done}} of {{total}} lines done",
              done: doneRows.toLocaleString(),
              total: total.toLocaleString(),
            })}
          </p>
          {runError ? (
            <>
              <p role="alert" className="text-[14px] text-destructive">
                {t("contacts.importV2.run.stoppedHint", {
                  defaultValue:
                    "Nothing is lost and nothing will be saved twice. Check your connection and carry on. ({{detail}})",
                  detail: runError,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="h-11 max-sm:w-full" onClick={() => void runAll(imp.id)}>
                  {t("contacts.importV2.run.resume", "Carry on")}
                </Button>
              <Button
                variant="outline"
                className="h-11 max-sm:w-full"
                disabled={stop.isPending}
                onClick={() => stop.mutate()}
              >
                {t("contacts.importV2.run.stopHere", "Stop here")}
              </Button>
              </div>
              <p className="text-[13px] text-muted-foreground">
                {t(
                  "contacts.importV2.run.stopHint",
                  "“Stop here” keeps what is saved and leaves the rest out. You can then undo the import if you want none of it.",
                )}
              </p>
            </>
          ) : running.current ? (
            <p className="text-[13.5px] text-muted-foreground">
              {t(
                "contacts.importV2.run.keepOpen",
                "Keep this page open until it is finished. If it gets closed, open the import again from “Past imports” and it carries on where it stopped.",
              )}
            </p>
          ) : (
            <>
              <p className="text-[14px] text-muted-foreground">
                {t("contacts.importV2.run.unfinished", "This import was not finished. Carry on to save the rest.")}
              </p>
              {canEdit ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-11 max-sm:w-full" onClick={() => void runAll(imp.id)}>
                      {t("contacts.importV2.run.resume", "Carry on")}
                    </Button>
              <Button
                    variant="outline"
                    className="h-11 max-sm:w-full"
                    disabled={stop.isPending}
                    onClick={() => stop.mutate()}
                  >
                    {t("contacts.importV2.run.stopHere", "Stop here")}
                  </Button>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {t(
                      "contacts.importV2.run.stopHint",
                      "“Stop here” keeps what is saved and leaves the rest out. You can then undo the import if you want none of it.",
                    )}
                  </p>
                </>
              ) : null}
            </>
          )}
        </section>
      ) : step === "check" && imp && check ? (
        <>
          <CheckStep
            check={check}
            existingMode={existingMode}
            onExistingMode={(mode) => {
              setExistingMode(mode);
              runCheck.mutate(mode);
            }}
            rowChoices={rowChoices}
            onRowChoices={setRowChoices}
            workflowsAck={workflowsAck}
            onWorkflowsAck={setWorkflowsAck}
            customLabel={customLabel}
            busy={runCheck.isPending}
          />
          <ImportActions
            note={
              writes === 0
                ? t("contacts.importV2.check.nothingToDo", "There is nothing to save with these choices.")
                : check.workflows.length > 0 && !workflowsAck
                  ? t("contacts.importV2.check.ackFirst", "Tick the box about your workflows to go on.")
                  : undefined
            }
          >
            <Button variant="outline" onClick={() => setCheck(null)}>
              {t("contacts.importV2.backToMatch", "Back")}
            </Button>
            <Button
              disabled={writes === 0 || runCheck.isPending || (check.workflows.length > 0 && !workflowsAck)}
              onClick={() => {
                setProgress({
                  id: imp.id,
                  status: "running",
                  total_rows: imp.total_rows,
                  remaining: imp.total_rows,
                  counts: imp.counts,
                });
                void runAll(imp.id, rowChoices);
              }}
            >
              {t("contacts.importV2.check.save", {
                defaultValue: "Save {{count}} contacts",
                count: writes,
              })}
            </Button>
          </ImportActions>
        </>
      ) : imp ? (
        <>
          {fromMemory ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
              {t(
                "contacts.importV2.match.fromMemory",
                "Matched like last time. Change anything that's different.",
              )}
              <button
                type="button"
                className="press min-h-11 select-none font-medium text-foreground underline underline-offset-2 sm:min-h-0"
                onClick={() => {
                  forgetLayout(imp.headers);
                  setChoices(choicesFrom(imp));
                  setRowKind(imp.options.row_kind);
                  setFromMemory(false);
                }}
              >
                {t("contacts.importV2.match.useSuggestion", "Use the suggestion instead")}
              </button>
            </p>
          ) : null}
          <MatchStep
            imp={imp}
            choices={choices}
            onChoices={setChoices}
            rowKind={rowKind}
            onRowKind={setRowKind}
          />
          <ImportActions
            note={
              Object.keys(problems).length > 0
                ? t("contacts.importV2.match.fixFirst", {
                    defaultValue: "{{count}} columns still need a name.",
                    count: Object.keys(problems).length,
                  })
                : undefined
            }
          >
            <Button variant="outline" onClick={() => navigate("/contacts/import")}>
              {t("contacts.importV2.otherFile", "Other file")}
            </Button>
            <Button
              disabled={!canEdit || Object.keys(problems).length > 0 || runCheck.isPending}
              onClick={() => runCheck.mutate(existingMode)}
            >
              {runCheck.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("contacts.importV2.match.check", {
                defaultValue: "Check {{count}} lines",
                count: imp.total_rows,
              })}
            </Button>
          </ImportActions>
        </>
      ) : null}
    </div>
  );
}
