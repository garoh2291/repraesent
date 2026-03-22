import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  parseLeadsCsv,
  uploadLeadsImport,
  type CsvFieldMapping,
  type LeadImportRow,
} from "~/lib/api/leads-import";
import type { TFunction } from "i18next";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { toast } from "sonner";
import { Upload, Loader2, ChevronRight, FileSpreadsheet } from "lucide-react";
import TooltipContainer from "~/components/tooltip-container";

const LEAD_FIELD_KEY_MAP: Record<string, string> = {
  first_name: "leads.columns.firstName",
  last_name: "leads.columns.lastName",
  full_name: "leads.columns.fullName",
  email: "leads.columns.email",
  phone: "leads.columns.phone",
  created_at: "leads.columns.createdAt",
  updated_at: "leads.columns.updatedAt",
  metadata: "leads.columns.metadata",
};

function getFieldLabel(field: string, t: TFunction): string {
  const key = LEAD_FIELD_KEY_MAP[field];
  return key ? t(key) : field;
}

// Returns true for both legacy "metadata" and new "metadata.xxx" leadField format
function isMetaField(m: CsvFieldMapping): boolean {
  return m.leadField === "metadata" || m.leadField.startsWith("metadata.");
}

// Extracts the metadata object key from a leadField like "metadata.consent_marketing" → "consent_marketing"
function metaKey(m: CsvFieldMapping): string {
  return m.leadField.startsWith("metadata.")
    ? m.leadField.slice("metadata.".length)
    : m.csvColumn;
}

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadImportModal({ open, onOpenChange }: LeadImportModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fieldMapping, setFieldMapping] = useState<CsvFieldMapping[]>([]);
  const [rows, setRows] = useState<LeadImportRow[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedMetadataColumns, setSelectedMetadataColumns] = useState<
    Set<string>
  >(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<"website">("website");

  const parseMutation = useMutation({
    mutationFn: parseLeadsCsv,
    onSuccess: (data) => {
      setFieldMapping(data.fieldMapping);
      setRows(data.rows);
      const leadFields = data.fieldMapping
        .filter((m) => !isMetaField(m))
        .map((m) => m.leadField);
      const metaCols = data.fieldMapping
        .filter((m) => isMetaField(m))
        .map((m) => m.csvColumn);
      setSelectedFields(new Set(leadFields));
      setSelectedMetadataColumns(new Set(metaCols));
      setSelectedRows(new Set(data.rows.map((_, i) => i)));
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadLeadsImport,
    onSuccess: (data) => {
      toast.success(t("leads.import.importedSuccess", { count: data.created }));
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadStats"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleClose = useCallback(() => {
    setStep(1);
    setFile(null);
    setFieldMapping([]);
    setRows([]);
    setSelectedFields(new Set());
    setSelectedMetadataColumns(new Set());
    setSelectedRows(new Set());
    setSource("website");
    parseMutation.reset();
    uploadMutation.reset();
    onOpenChange(false);
  }, [onOpenChange, parseMutation, uploadMutation]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast.error(t("leads.import.selectCsvError"));
        return;
      }
      setFile(f);
      parseMutation.mutate(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) {
      setFile(f);
      parseMutation.mutate(f);
    } else {
      toast.error(t("leads.import.dropCsvError"));
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const toggleField = (leadField: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(leadField)) next.delete(leadField);
      else next.add(leadField);
      return next;
    });
  };

  const metadataMappings = fieldMapping.filter(isMetaField);
  const allMetadataSelected =
    metadataMappings.length > 0 &&
    metadataMappings.every((m) => selectedMetadataColumns.has(m.csvColumn));

  const toggleMetadataColumn = (csvColumn: string) => {
    setSelectedMetadataColumns((prev) => {
      const next = new Set(prev);
      if (next.has(csvColumn)) next.delete(csvColumn);
      else next.add(csvColumn);
      return next;
    });
  };

  const toggleMetadataMaster = () => {
    if (allMetadataSelected) {
      setSelectedMetadataColumns(new Set());
    } else {
      setSelectedMetadataColumns(
        new Set(metadataMappings.map((m) => m.csvColumn))
      );
    }
  };

  const toggleRow = (index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllRows = (checked: boolean) => {
    if (checked) setSelectedRows(new Set(rows.map((_, i) => i)));
    else setSelectedRows(new Set());
  };

  const selectedRowsList = rows.filter((_, i) => selectedRows.has(i));
  const filteredRows = selectedRowsList.map((row) => {
    const filtered: LeadImportRow = {};
    if (selectedFields.has("first_name")) filtered.first_name = row.first_name;
    if (selectedFields.has("last_name")) filtered.last_name = row.last_name;
    if (selectedFields.has("full_name")) filtered.full_name = row.full_name;
    if (selectedFields.has("email")) filtered.email = row.email;
    if (selectedFields.has("phone")) filtered.phone = row.phone;
    if (selectedFields.has("created_at")) filtered.created_at = row.created_at;
    if (selectedFields.has("updated_at")) filtered.updated_at = row.updated_at;

    if (selectedMetadataColumns.size > 0 && row.metadata) {
      const meta = Object.fromEntries(
        Object.entries(row.metadata).filter(([k]) =>
          selectedMetadataColumns.has(k)
        )
      );
      if (Object.keys(meta).length > 0) filtered.metadata = meta;
    }

    return filtered;
  });

  const hasAnyFieldSelected =
    selectedFields.size > 0 || selectedMetadataColumns.size > 0;
  const canProceed =
    step === 1 &&
    !parseMutation.isPending &&
    parseMutation.data &&
    selectedRows.size > 0 &&
    hasAnyFieldSelected;

  const handleNext = () => {
    if (canProceed) setStep(2);
  };

  const handleUpload = () => {
    console.log("filteredRows", filteredRows);
    uploadMutation.mutate({ rows: filteredRows, source });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}
    >
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-6xl md:min-w-[900px] max-h-[90vh] flex flex-col"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {t("leads.import.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 1
              ? t("leads.import.step1Desc")
              : t("leads.import.step2Desc")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {!parseMutation.data ? (
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:bg-muted/40 hover:border-border/80 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {parseMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("leads.import.parseCsv")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {t("leads.import.dropCsv")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("leads.import.maxRows")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("leads.import.fileInfo", { filename: file?.name, count: rows.length })}
                </p>
                <div className="flex-1 rounded-md border border-border bg-card shadow-[var(--shadow)] overflow-auto max-h-[300px] max-w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 sticky left-0 bg-card z-10">
                          <Checkbox
                            checked={
                              selectedRows.size === rows.length &&
                              rows.length > 0
                            }
                            onCheckedChange={(c) => toggleAllRows(c === true)}
                          />
                        </TableHead>
                        {fieldMapping.map((m) => (
                          <TableHead
                            key={m.csvColumn}
                            className={`min-w-[150px] ${isMetaField(m) && metadataMappings[0]?.csvColumn === m.csvColumn ? "bg-muted/50" : ""}`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* {isMetaField(m) &&
                                metadataMappings[0]?.csvColumn ===
                                  m.csvColumn && (
                                  <Checkbox
                                    checked={allMetadataSelected}
                                    onCheckedChange={toggleMetadataMaster}
                                    title="Toggle all metadata"
                                  />
                                )} */}
                              <Checkbox
                                checked={
                                  isMetaField(m)
                                    ? selectedMetadataColumns.has(m.csvColumn)
                                    : selectedFields.has(m.leadField)
                                }
                                onCheckedChange={() =>
                                  isMetaField(m)
                                    ? toggleMetadataColumn(m.csvColumn)
                                    : toggleField(m.leadField)
                                }
                              />
                              <TooltipContainer
                                tooltipContent={
                                  isMetaField(m)
                                    ? m.csvColumn
                                    : `${m.csvColumn} → ${getFieldLabel(m.leadField, t)}`
                                }
                                showCopyButton={false}
                              >
                                <span className="text-xs truncate max-w-[100px]">
                                  {isMetaField(m)
                                    ? m.csvColumn
                                    : `${m.csvColumn} → ${getFieldLabel(m.leadField, t)}`}
                                </span>
                              </TooltipContainer>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.has(i)}
                              onCheckedChange={() => toggleRow(i)}
                            />
                          </TableCell>
                          {fieldMapping.map((m) => {
                            let val: unknown;
                            if (isMetaField(m)) {
                              // backend nests metadata by csvColumn key
                              val = (row.metadata as Record<string, unknown>)?.[
                                metaKey(m)
                              ];
                            } else {
                              val = (row as Record<string, unknown>)[
                                m.leadField
                              ];
                            }
                            return (
                              <TableCell
                                key={m.csvColumn}
                                className="max-w-[180px] truncate"
                              >
                                {val != null && val !== "" ? String(val) : "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 20 && (
                    <p className="text-xs text-muted-foreground p-2">
                      {t("leads.import.showingFirst", { count: rows.length })}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm text-foreground">
                {t("leads.import.willBeImported", { count: filteredRows.length })}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("leads.import.source")}
              </label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/25 transition-shadow"
                value={source}
                onChange={(e) => setSource(e.target.value as "website")}
              >
                <option value="website">{t("leads.filters.websiteSource")}</option>
              </select>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                className="bg-foreground text-background hover:opacity-90 transition-opacity"
                onClick={handleNext}
                disabled={!canProceed}
              >
                {t("common.next")} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button
                className="bg-foreground text-background hover:opacity-90 transition-opacity"
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t("leads.import.uploadLeads", { count: filteredRows.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
