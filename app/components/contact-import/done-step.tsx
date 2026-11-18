import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getImportLeftOut,
  undoContactImport,
  type ContactImport,
  type ImportUndoResult,
} from "~/lib/api/contact-imports";
import { createSegment } from "~/lib/api/segments";
import { BigCount } from "./import-chrome";
import { detailLabel, fileLine, reasonText } from "./labels";

function csvCell(v: string): string {
  return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function DoneStep({ imp, canEdit }: { imp: ContactImport; canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undone, setUndone] = useState<ImportUndoResult | null>(null);
  const [undoLeft, setUndoLeft] = useState<number | null>(null);
  const c = imp.counts;
  const leftOut = c.skipped + c.failed;
  const isUndone = imp.status === "undone";

  const leftOutQuery = useQuery({
    queryKey: ["contact-import-left-out", imp.id],
    queryFn: () => getImportLeftOut(imp.id),
    enabled: leftOut > 0,
  });

  const download = () => {
    const data = leftOutQuery.data;
    if (!data) return;
    const header = [
      t("contacts.importV2.done.csvLine", "Line"),
      t("contacts.importV2.done.csvReason", "Why it was left out"),
      ...data.headers,
    ];
    const lines = [
      header,
      ...data.rows.map((r) => [
        String(fileLine(r.row_index)),
        reasonText(t, r.reason_code, r.reason_detail),
        ...data.headers.map((_, i) => r.cells[i] ?? ""),
      ]),
    ].map((row) => row.map(csvCell).join(","));
    // BOM so Excel opens umlauts correctly.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = imp.file_name.replace(/\.[^.]+$/, "") + "-left-out.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const undo = useMutation({
    mutationFn: () => undoContactImport(imp.id, setUndoLeft),
    onSuccess: (res) => {
      setUndone(res);
      void queryClient.invalidateQueries({ queryKey: ["contact-import", imp.id] });
      void queryClient.invalidateQueries({ queryKey: ["contact-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("contacts.importV2.done.undoDone", "Import undone."));
    },
    onError: (error) => {
      toast.error(t("contacts.importV2.done.undoFailed", "The import could not be undone."), {
        description: extractErrorMessage(error),
      });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="title-display text-[24px] font-semibold text-foreground sm:text-[28px]">
          {isUndone
            ? t("contacts.importV2.done.titleUndone", "This import was undone")
            : t("contacts.importV2.done.title", "Your contacts are in")}
        </h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{imp.file_name}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <BigCount value={c.added} label={t("contacts.importV2.done.added", { defaultValue: "added", count: c.added })} />
        <BigCount value={c.updated} label={t("contacts.importV2.done.updated", { defaultValue: "updated", count: c.updated })} />
        <BigCount
          value={c.unchanged}
          label={t("contacts.importV2.done.unchanged", { defaultValue: "already up to date", count: c.unchanged })}
        />
        <BigCount
          marker
          value={leftOut}
          label={t("contacts.importV2.done.leftOut", { defaultValue: "left out", count: leftOut })}
        />
      </div>

      {c.companies_added > 0 ? (
        <p className="text-[13.5px] text-muted-foreground">
          {t("contacts.importV2.done.companiesAdded", {
            defaultValue: "{{count}} companies were added for the people who work there.",
            count: c.companies_added,
          })}
        </p>
      ) : null}

      {undone ? (
        <section className="rounded-xl border border-border bg-card px-4 py-4 text-[14px] sm:px-5">
          <p className="font-medium text-foreground">
            {t("contacts.importV2.done.undoSummary", {
              defaultValue: "{{removed}} contacts removed, {{restored}} put back as they were.",
              removed: undone.removed,
              restored: undone.restored,
            })}
          </p>
          {undone.kept_total > 0 ? (
            <>
              <p className="mt-2 text-muted-foreground">
                {t("contacts.importV2.done.undoKept", {
                  defaultValue:
                    "{{count}} were changed after the import or already have deals or tasks, so they were kept:",
                  count: undone.kept_total,
                })}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {undone.kept.slice(0, 20).map((k) => (
                  <li key={k.contact_id}>
                    <Link to={`/contacts/${k.contact_id}`} className="underline underline-offset-2">
                      {k.name || t("contacts.importV2.done.unnamed", "Contact without a name")}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {leftOut > 0 ? (
        <section className="space-y-2" aria-labelledby="import-left-out">
          <h2 id="import-left-out" className="text-[15px] font-semibold text-foreground">
            {t("contacts.importV2.done.leftOutTitle", "Lines that were left out")}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-[13.5px]">
            {(leftOutQuery.data?.rows ?? []).slice(0, 8).map((r) => (
              <li key={r.row_index} className="break-words px-4 py-2.5 sm:px-5">
                <span className="num font-medium text-foreground">
                  {t("contacts.importV2.check.line", { defaultValue: "Line {{n}}", n: fileLine(r.row_index) })}
                </span>
                <span className="text-muted-foreground">
                  {r.cells.find((cell) => cell.trim() !== "") ? ` · ${r.cells.find((cell) => cell.trim() !== "")}` : ""}
                  {" · "}
                  {reasonText(t, r.reason_code, r.reason_detail)}
                </span>
              </li>
            ))}
          </ul>
          {!imp.cells_available ? (
            <p className="text-[13px] text-muted-foreground">
              {t(
                "contacts.importV2.done.cellsGone",
                "The file's lines are kept for 30 days and are no longer stored, so they can't be downloaded any more.",
              )}
            </p>
          ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 text-xs max-sm:h-11 max-sm:w-full max-sm:text-sm"
              disabled={!leftOutQuery.data}
              onClick={download}
            >
              <Download className="size-3.5" aria-hidden />
              {t("contacts.importV2.done.download", {
                defaultValue: "Download all {{count}} with the reason",
                count: leftOut,
              })}
            </Button>
            <p className="text-[13px] text-muted-foreground">
              {t(
                "contacts.importV2.done.downloadHint",
                "Fix them in that file and bring it in again. Available for 30 days.",
              )}
            </p>
          </div>
          )}
        </section>
      ) : null}

      {!isUndone && canEdit ? <SegmentsFromColumn imp={imp} /> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        <Button asChild className="h-9 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm">
          <Link to="/contacts">{t("contacts.importV2.done.seeContacts", "See your contacts")}</Link>
        </Button>
        <Button asChild variant="outline" className="h-9 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm">
          <Link to="/contacts/import">{t("contacts.importV2.done.another", "Bring in another file")}</Link>
        </Button>
        <span className="flex-1 max-sm:hidden" />
        {!isUndone && canEdit && c.added + c.updated > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1.5 text-xs text-muted-foreground max-sm:h-11 max-sm:w-full max-sm:text-sm"
            disabled={undo.isPending}
            onClick={() => setConfirmUndo(true)}
          >
            {undo.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="size-3.5" aria-hidden />
            )}
            {undo.isPending && undoLeft != null
              ? t("contacts.importV2.done.undoing", {
                  defaultValue: "Undoing… {{count}} to go",
                  count: undoLeft,
                })
              : t("contacts.importV2.done.undo", "Undo this import")}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmUndo} onOpenChange={setConfirmUndo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contacts.importV2.done.undoConfirmTitle", "Undo this import?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.importV2.done.undoConfirmBody", {
                defaultValue:
                  "The {{added}} contacts it added are removed and the {{updated}} it changed go back to how they were. Contacts you changed since, or that have deals or tasks, are kept.",
                added: c.added,
                updated: c.updated,
              })}
            </AlertDialogDescription>
            {imp.workflows && imp.workflows.length > 0 ? (
              <p className="text-[13.5px] text-foreground">
                {t("contacts.importV2.done.undoWorkflows", {
                  defaultValue:
                    "Taking it back changes these contacts, so {{count}} turned-on workflows start for them: {{names}}.",
                  count: imp.workflows.length,
                  names: imp.workflows.map((w) => w.name).join(", "),
                })}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("contacts.importV2.done.undoKeep", "Keep the import")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => undo.mutate()}>
              {t("contacts.importV2.done.undo", "Undo this import")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * One segment per value of a column ("Version" → A, B, Hold), ready for a
 * newsletter or a workflow. Offered for columns kept as a detail that hold
 * only a handful of different values.
 */
function SegmentsFromColumn({ imp }: { imp: ContactImport }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const candidates = useMemo(
    () =>
      imp.mapping
        .filter((m) => m.target === "custom" && m.custom_key)
        .map((m) => ({ key: m.custom_key!, column: imp.columns.find((c) => c.column === m.column) }))
        .filter(
          (x): x is { key: string; column: NonNullable<typeof x.column> } =>
            !!x.column && x.column.top_values.length >= 2 && x.column.top_values.length <= 12,
        )
        // Yes/no style columns are rarely what a mailing is split by: fewest-first, but 3+ before 2.
        .sort((a, b) => {
          const score = (n: number) => (n === 2 ? 99 : n);
          return score(a.column.top_values.length) - score(b.column.top_values.length);
        }),
    [imp],
  );
  const [key, setKey] = useState<string>(candidates[0]?.key ?? "");
  const [made, setMade] = useState<Array<{ id: string; name: string }> | null>(null);
  const picked = candidates.find((x) => x.key === key);

  const make = useMutation({
    mutationFn: async () => {
      if (!picked) return [];
      const label = detailLabel(t, picked.key);
      const out: Array<{ id: string; name: string }> = [];
      for (const v of picked.column.top_values) {
        const name = `${label}: ${v.value}`.slice(0, 200);
        const seg = await createSegment({
          name,
          kind: "dynamic",
          definition: {
            match: "all",
            conditions: [{ path: `metadata.${picked.key}`, operator: "eq", value: v.value }],
          },
        });
        out.push({ id: seg.id, name });
      }
      return out;
    },
    onSuccess: (out) => {
      setMade(out);
      void queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (error) => {
      toast.error(t("contacts.importV2.segments.failed", "The segments could not be made."), {
        description: extractErrorMessage(error),
      });
    },
  });

  if (candidates.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5" aria-labelledby="import-segments">
      <h2 id="import-segments" className="text-[15px] font-semibold text-foreground">
        {t("contacts.importV2.segments.title", "Make segments from a column")}
      </h2>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        {t(
          "contacts.importV2.segments.lead",
          "One segment for each value, ready to pick as the audience of a newsletter or a workflow. A segment holds every contact with that value, also ones you add later.",
        )}
      </p>
      {made ? (
        <ul className="mt-3 space-y-1 text-[14px]">
          {made.map((s) => (
            <li key={s.id}>
              <Link to={`/segments/${s.id}`} className="font-medium text-foreground underline underline-offset-2">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-3">
          <Select value={key} onValueChange={setKey}>
            <SelectTrigger
              className="h-9 w-full max-sm:h-11 sm:w-72"
              aria-label={t("contacts.importV2.segments.column", "Column")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((x) => (
                <SelectItem key={x.key} value={x.key}>
                  {detailLabel(t, x.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {picked ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              {picked.column.top_values.map((v) => (
                <li key={v.value}>
                  <span className="font-medium text-foreground">{v.value}</span>{" "}
                  <span className="num">
                    {t("contacts.importV2.segments.lines", { defaultValue: "{{count}} lines", count: v.count })}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5 text-xs max-sm:h-11 max-sm:w-full max-sm:text-sm"
            disabled={!picked || make.isPending}
            onClick={() => make.mutate()}
          >
            {make.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {t("contacts.importV2.segments.make", {
              defaultValue: "Make {{count}} segments",
              count: picked?.column.top_values.length ?? 0,
            })}
          </Button>
        </div>
      )}
    </section>
  );
}
