import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  parseContactsCsv,
  parseContactsVcard,
  parseContactsXlsx,
  uploadContactsImport,
  type ContactCsvFieldMapping,
  type ContactImportRow,
} from "~/lib/api/contacts-import";
import type { TFunction } from "i18next";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  ChevronRight,
  FileSpreadsheet,
  IdCard,
} from "lucide-react";
import TooltipContainer from "~/components/tooltip-container";

const CONTACT_FIELD_KEY_MAP: Record<string, string> = {
  first_name: "contacts.import.columns.firstName",
  last_name: "contacts.import.columns.lastName",
  full_name: "contacts.import.columns.fullName",
  email: "contacts.import.columns.email",
  phone: "contacts.import.columns.phone",
  company_name: "contacts.import.columns.companyName",
  notes: "contacts.import.columns.notes",
  contact_type: "contacts.import.columns.contactType",
  metadata: "contacts.import.columns.metadata",
};

function getFieldLabel(field: string, t: TFunction): string {
  const key = CONTACT_FIELD_KEY_MAP[field];
  return key ? t(key) : field;
}

function isMetaField(m: ContactCsvFieldMapping): boolean {
  return (
    m.contactField === "metadata" || m.contactField.startsWith("metadata.")
  );
}

function formatImportCellValue(val: unknown): string {
  if (val == null || val === "") return "—";
  if (Array.isArray(val)) {
    const joined = val.map((v) => String(v)).join(", ");
    return joined || "—";
  }
  return String(val);
}

// vCard metadata keys that are persisted as their own entities/columns, so
// they are shown in dedicated preview columns rather than in the metadata bag.
const VCARD_ENTITY_META_KEYS = [
  "vcard_uid",
  "vcard_emails",
  "vcard_phones",
  "vcard_addresses",
] as const;

// CSV/Excel address sub-field mappings the backend assembles into row.addresses;
// shown in a single Address column rather than as separate columns.
const ADDRESS_FIELD_KEYS = [
  "address_line1",
  "address_line2",
  "address_city",
  "address_state",
  "address_postal_code",
  "address_country",
] as const;

function isAddressField(m: ContactCsvFieldMapping): boolean {
  return (ADDRESS_FIELD_KEYS as readonly string[]).includes(m.contactField);
}

/** Formats a list of address objects into a readable "line1, city, …" cell. */
function formatAddressList(addrs: unknown): string {
  if (!Array.isArray(addrs) || addrs.length === 0) return "—";
  const lines = addrs
    .map((a) => {
      if (!a || typeof a !== "object") return "";
      const o = a as Record<string, unknown>;
      return [o.line1, o.line2, o.city, o.state, o.postal_code, o.country]
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join(" · ") : "—";
}

/** Pulls the address list for a row: vCard stores it in metadata, CSV in addresses. */
function getRowAddresses(
  row: ContactImportRow,
  importMode: "csv" | "vcard" | "xlsx",
): unknown {
  if (importMode === "vcard") {
    return (row.metadata as Record<string, unknown> | undefined)
      ?.vcard_addresses;
  }
  return row.addresses;
}

/** Renders the metadata bag as a single "key: value · key: value" cell. */
function formatMetadataPreview(
  metadata: unknown,
  excludeKeys: readonly string[] = [],
): string {
  if (!metadata || typeof metadata !== "object") return "—";
  const entries = Object.entries(metadata as Record<string, unknown>).filter(
    ([k, v]) => !excludeKeys.includes(k) && v != null && v !== "",
  );
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${k}: ${formatImportCellValue(v)}`)
    .join(" · ");
}

function isDuplicateUidReason(reason: string): boolean {
  return reason.includes("vCard UID already exists");
}

function isParseFailReason(reason: string): boolean {
  return reason.includes("Could not parse vCard");
}

function isUnusableVcardReason(reason: string): boolean {
  return reason.includes("no usable name");
}

/** Groups vCard preview skips for toast + banner (no per-card spam). */
function buildVcardPreviewSkipCopy(
  errors: Array<{ index: number; reason: string }>,
  readyCount: number,
  t: TFunction,
): { toast: string; bannerTitle: string; bannerReasonOnce?: string } {
  const total = errors.length;
  if (total === 0) {
    return { toast: "", bannerTitle: "" };
  }

  const dup = errors.filter((e) => isDuplicateUidReason(e.reason)).length;
  const parse = errors.filter((e) => isParseFailReason(e.reason)).length;
  const unusable = errors.filter((e) => isUnusableVcardReason(e.reason)).length;
  const other = total - dup - parse - unusable;

  const uniqueMessages = new Set(errors.map((e) => e.reason));
  const allDuplicates = dup === total;
  const allSameMessage = uniqueMessages.size === 1;

  if (allDuplicates) {
    return {
      toast: t(
        readyCount > 0
          ? "contacts.import.vcardToastDuplicatesWithReady"
          : "contacts.import.vcardToastAllDuplicatesNoImport",
        readyCount > 0
          ? { skipped: total, ready: readyCount }
          : { count: total },
      ),
      bannerTitle: t(
        readyCount > 0
          ? "contacts.import.vcardBannerDuplicatesWithReady"
          : "contacts.import.vcardBannerAllDuplicatesNoImport",
        readyCount > 0
          ? { skipped: total, ready: readyCount }
          : { count: total },
      ),
    };
  }

  if (allSameMessage) {
    const reason = errors[0]!.reason;
    return {
      toast: t("contacts.import.vcardToastAllSameIssue", { count: total }),
      bannerTitle: t("contacts.import.vcardBannerAllSameIssue", {
        count: total,
      }),
      bannerReasonOnce: reason,
    };
  }

  const parts: string[] = [];
  if (dup > 0) {
    parts.push(t("contacts.import.vcardSkipPartDuplicates", { count: dup }));
  }
  if (parse > 0) {
    parts.push(t("contacts.import.vcardSkipPartParse", { count: parse }));
  }
  if (unusable > 0) {
    parts.push(
      t("contacts.import.vcardSkipPartUnusable", { count: unusable }),
    );
  }
  if (other > 0) {
    parts.push(t("contacts.import.vcardSkipPartOther", { count: other }));
  }

  const breakdown = parts.join(", ");

  return {
    toast: t("contacts.import.vcardToastMixed", {
      skipped: total,
      ready: readyCount,
    }),
    bannerTitle: t(
      readyCount > 0
        ? "contacts.import.vcardBannerMixedWithReady"
        : "contacts.import.vcardBannerMixedNoneReady",
      readyCount > 0
        ? { ready: readyCount, skipped: total, breakdown }
        : { skipped: total, breakdown },
    ),
  };
}

const NON_META_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "company_name",
  "notes",
  "contact_type",
] as const;

interface ContactImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importMode?: "csv" | "vcard" | "xlsx";
}

export function ContactImportModal({
  open,
  onOpenChange,
  importMode = "csv",
}: ContactImportModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fieldMapping, setFieldMapping] = useState<ContactCsvFieldMapping[]>(
    [],
  );
  const [rows, setRows] = useState<ContactImportRow[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeAddresses, setIncludeAddresses] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const parseMutation = useMutation({
    mutationKey: ["parse-contact-import", importMode],
    mutationFn: (f: File) =>
      importMode === "csv"
        ? parseContactsCsv(f)
        : importMode === "xlsx"
          ? parseContactsXlsx(f)
          : parseContactsVcard(f),
    onSuccess: (data) => {
      setFieldMapping(data.fieldMapping);
      setRows(data.rows);
      const fields = data.fieldMapping
        .filter((m) => !isMetaField(m))
        .map((m) => m.contactField);
      setSelectedFields(new Set(fields));
      setIncludeMetadata(true);
      setIncludeAddresses(true);
      setSelectedRows(new Set(data.rows.map((_, i) => i)));
      const vcardErrors =
        "errors" in data && Array.isArray(data.errors) ? data.errors : [];
      if (vcardErrors.length > 0) {
        const { toast: toastMsg } = buildVcardPreviewSkipCopy(
          vcardErrors,
          data.rows.length,
          t,
        );
        if (toastMsg) toast.warning(toastMsg);
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: {
      rows: ContactImportRow[];
      source?: "csv_import" | "vcard_import" | "xlsx_import";
    }) => uploadContactsImport(payload),
    onSuccess: (data) => {
      toast.success(
        t("contacts.import.importedSuccess", { count: data.created }),
      );
      if (data.skipped > 0) {
        toast.warning(
          t("contacts.import.skippedSome", {
            count: data.skipped,
            defaultValue: "{{count}} rows skipped",
          }),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const vcardPreviewSkipBanner = useMemo(() => {
    if (
      importMode !== "vcard" ||
      !parseMutation.data ||
      !("errors" in parseMutation.data)
    ) {
      return null;
    }
    const errs = parseMutation.data.errors;
    if (!Array.isArray(errs) || errs.length === 0) return null;
    const ready = Array.isArray(parseMutation.data.rows)
      ? parseMutation.data.rows.length
      : 0;
    return buildVcardPreviewSkipCopy(errs, ready, t);
  }, [importMode, parseMutation.data, t]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFile(null);
    setFieldMapping([]);
    setRows([]);
    setSelectedFields(new Set());
    setIncludeMetadata(true);
    setIncludeAddresses(true);
    setSelectedRows(new Set());
    parseMutation.reset();
    uploadMutation.reset();
    // Intentionally omit parseMutation/uploadMutation: their identities can
    // change after reset(), which would retrigger this effect infinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when dialog opens or mode changes
  }, [open, importMode]);

  const handleClose = useCallback(() => {
    setStep(1);
    setFile(null);
    setFieldMapping([]);
    setRows([]);
    setSelectedFields(new Set());
    setIncludeMetadata(true);
    setIncludeAddresses(true);
    setSelectedRows(new Set());
    parseMutation.reset();
    uploadMutation.reset();
    onOpenChange(false);
  }, [onOpenChange, parseMutation, uploadMutation]);

  const isXlsxName = (name: string) =>
    /\.(xlsx|xlsm|xlsb|xls)$/i.test(name);

  const xlsxWrongTypeMsg = () =>
    t("contacts.import.xlsxWrongType", {
      defaultValue: "Please select an Excel file (.xlsx, .xls).",
    });

  const validateFileForMode = (f: File): boolean => {
    const lower = f.name.toLowerCase();
    if (importMode === "csv") {
      if (!lower.endsWith(".csv")) {
        toast.error(t("contacts.import.selectCsvError"));
        return false;
      }
    } else if (importMode === "xlsx") {
      if (!isXlsxName(lower)) {
        toast.error(xlsxWrongTypeMsg());
        return false;
      }
    } else if (!lower.endsWith(".vcf") && !lower.endsWith(".vcard")) {
      toast.error(t("contacts.import.vcardWrongType"));
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && validateFileForMode(f)) {
      setFile(f);
      parseMutation.mutate(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) {
      toast.error(
        importMode === "csv"
          ? t("contacts.import.dropCsvError")
          : importMode === "xlsx"
            ? xlsxWrongTypeMsg()
            : t("contacts.import.vcardWrongType"),
      );
      return;
    }
    if (!validateFileForMode(f)) return;
    setFile(f);
    parseMutation.mutate(f);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const toggleField = (contactField: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(contactField)) next.delete(contactField);
      else next.add(contactField);
      return next;
    });
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

  const metadataMappings = fieldMapping.filter(isMetaField);
  const nonMetaMappings = fieldMapping.filter(
    (m) => !isMetaField(m) && !isAddressField(m),
  );
  const hasMetadata = metadataMappings.length > 0;
  // Show the Address column for vCard (always) or when CSV/Excel mapped any
  // address sub-field column.
  const hasAddresses =
    importMode === "vcard" || fieldMapping.some(isAddressField);

  const selectedRowsList = rows.filter((_, i) => selectedRows.has(i));
  const filteredRows = selectedRowsList.map((row) => {
    const filtered: ContactImportRow = {};
    for (const field of NON_META_FIELDS) {
      if (selectedFields.has(field)) {
        (filtered as Record<string, unknown>)[field] = (
          row as Record<string, unknown>
        )[field];
      }
    }

    const srcMeta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const meta: Record<string, unknown> = {};

    // vCard rows must always carry their UID (dedup) plus the email / phone /
    // address arrays — the backend turns these into their own entities and
    // strips them back out of the stored metadata. They go regardless of the
    // metadata toggle.
    if (importMode === "vcard") {
      if (typeof srcMeta.vcard_uid === "string" && srcMeta.vcard_uid.trim()) {
        meta.vcard_uid = srcMeta.vcard_uid.trim();
      }
      if (Array.isArray(srcMeta.vcard_emails)) {
        meta.vcard_emails = srcMeta.vcard_emails;
      }
      if (Array.isArray(srcMeta.vcard_phones)) {
        meta.vcard_phones = srcMeta.vcard_phones;
      }
      if (includeAddresses && Array.isArray(srcMeta.vcard_addresses)) {
        meta.vcard_addresses = srcMeta.vcard_addresses;
      }
    }

    // CSV/Excel addresses ride on row.addresses (assembled by the backend) and
    // are imported into the addresses entity when the toggle is on.
    if (
      importMode !== "vcard" &&
      includeAddresses &&
      Array.isArray(row.addresses) &&
      row.addresses.length > 0
    ) {
      filtered.addresses = row.addresses;
    }

    // Everything else that isn't a name / email / phone / address column is
    // folded into the single metadata object — there is no per-column selection.
    if (includeMetadata) {
      for (const [k, v] of Object.entries(srcMeta)) {
        if (meta[k] != null) continue;
        meta[k] = v;
      }
    }

    if (Object.keys(meta).length > 0) filtered.metadata = meta;
    return filtered;
  });

  const hasAnyFieldSelected =
    selectedFields.size > 0 || (includeMetadata && hasMetadata);
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
    uploadMutation.mutate({
      rows: filteredRows,
      source:
        importMode === "vcard"
          ? "vcard_import"
          : importMode === "xlsx"
            ? "xlsx_import"
            : "csv_import",
    });
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
            {importMode === "csv"
              ? t("contacts.import.titleCsv", {
                  defaultValue: t("contacts.import.title"),
                })
              : importMode === "xlsx"
                ? t("contacts.import.titleXlsx", {
                    defaultValue: "Import contacts from Excel",
                  })
                : t("contacts.import.titleVcard")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 1
              ? importMode === "csv"
                ? t("contacts.import.step1DescCsv", {
                    defaultValue: t("contacts.import.step1Desc"),
                  })
                : importMode === "xlsx"
                  ? t("contacts.import.step1DescXlsx", {
                      defaultValue:
                        "Upload an .xlsx file. The first sheet will be imported.",
                    })
                  : t("contacts.import.step1DescVcard")
              : t("contacts.import.step2Desc")}
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
                  accept={
                    importMode === "csv"
                      ? ".csv"
                      : importMode === "xlsx"
                        ? ".xlsx,.xlsm,.xlsb,.xls"
                        : ".vcf,.vcard"
                  }
                  className="hidden"
                  onChange={handleFileChange}
                />
                {parseMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {importMode === "csv"
                        ? t("contacts.import.parseCsv")
                        : importMode === "xlsx"
                          ? t("contacts.import.parseXlsx", {
                              defaultValue: "Parsing Excel file…",
                            })
                          : t("contacts.import.parseVcard")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {importMode === "vcard" ? (
                      <IdCard className="h-10 w-10 text-muted-foreground" />
                    ) : (
                      <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">
                      {importMode === "csv"
                        ? t("contacts.import.dropCsv")
                        : importMode === "xlsx"
                          ? t("contacts.import.dropXlsx", {
                              defaultValue:
                                "Drop your .xlsx file here or click to browse",
                            })
                          : t("contacts.import.dropVcard")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {importMode === "vcard"
                        ? t("contacts.import.maxVcards")
                        : t("contacts.import.maxRows")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {importMode === "vcard"
                    ? t("contacts.import.fileInfoVcard", {
                        filename: file?.name,
                        count: rows.length,
                      })
                    : t("contacts.import.fileInfo", {
                        filename: file?.name,
                        count: rows.length,
                      })}
                </p>
                {vcardPreviewSkipBanner && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground space-y-1">
                      <p className="font-medium leading-snug">
                        {vcardPreviewSkipBanner.bannerTitle}
                      </p>
                      {vcardPreviewSkipBanner.bannerReasonOnce ? (
                        <p className="text-muted-foreground leading-snug whitespace-pre-wrap break-words">
                          {vcardPreviewSkipBanner.bannerReasonOnce}
                        </p>
                      ) : null}
                    </div>
                  )}
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
                        {nonMetaMappings.map((m) => (
                          <TableHead
                            key={`${m.contactField}:${m.csvColumn}`}
                            className="min-w-[150px]"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Checkbox
                                checked={selectedFields.has(m.contactField)}
                                onCheckedChange={() =>
                                  toggleField(m.contactField)
                                }
                              />
                              <TooltipContainer
                                tooltipContent={`${m.csvColumn} → ${getFieldLabel(m.contactField, t)}`}
                                showCopyButton={false}
                              >
                                <span className="text-xs truncate max-w-[100px]">
                                  {`${m.csvColumn} → ${getFieldLabel(m.contactField, t)}`}
                                </span>
                              </TooltipContainer>
                            </div>
                          </TableHead>
                        ))}
                        {hasAddresses && (
                          <TableHead className="min-w-[180px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Checkbox
                                checked={includeAddresses}
                                onCheckedChange={() =>
                                  setIncludeAddresses((v) => !v)
                                }
                              />
                              <span className="text-xs">
                                {t("contacts.import.columns.address", {
                                  defaultValue: "Address",
                                })}
                              </span>
                            </div>
                          </TableHead>
                        )}
                        {hasMetadata && (
                          <TableHead className="min-w-[200px] bg-muted/50">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Checkbox
                                checked={includeMetadata}
                                onCheckedChange={() =>
                                  setIncludeMetadata((v) => !v)
                                }
                              />
                              <span className="text-xs">
                                {t("contacts.import.columns.metadata", {
                                  defaultValue: "Metadata",
                                })}
                              </span>
                            </div>
                          </TableHead>
                        )}
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
                          {nonMetaMappings.map((m) => (
                            <TableCell
                              key={`${m.contactField}:${m.csvColumn}`}
                              className="max-w-[180px] truncate"
                            >
                              {formatImportCellValue(
                                (row as Record<string, unknown>)[
                                  m.contactField
                                ],
                              )}
                            </TableCell>
                          ))}
                          {hasAddresses && (
                            <TableCell className="max-w-[220px] truncate">
                              {includeAddresses
                                ? formatAddressList(
                                    getRowAddresses(row, importMode),
                                  )
                                : "—"}
                            </TableCell>
                          )}
                          {hasMetadata && (
                            <TableCell className="max-w-[260px] truncate text-muted-foreground">
                              {includeMetadata
                                ? formatMetadataPreview(
                                    row.metadata,
                                    importMode === "vcard"
                                      ? VCARD_ENTITY_META_KEYS
                                      : [],
                                  )
                                : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 20 && (
                    <p className="text-xs text-muted-foreground p-2">
                      {t("contacts.import.showingFirst", {
                        count: rows.length,
                      })}
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
                {t("contacts.import.willBeImported", {
                  count: filteredRows.length,
                })}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("contacts.import.source")}:{" "}
              {t(
                importMode === "vcard"
                  ? "contacts.sources.vcard_import"
                  : importMode === "xlsx"
                    ? "contacts.sources.xlsx_import"
                    : "contacts.sources.csv_import",
                {
                  defaultValue:
                    importMode === "vcard"
                      ? "vCard import"
                      : importMode === "xlsx"
                        ? "Excel import"
                        : "CSV import",
                },
              )}
            </p>
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
                {t("contacts.import.uploadContacts", {
                  count: filteredRows.length,
                })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
