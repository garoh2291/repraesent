import { useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  listContactImports,
  type ContactImportListItem,
} from "~/lib/api/contact-imports";

const ACCEPT = ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,text/csv";
const ACCEPTED = /\.(csv|tsv|txt|xlsx|xls|xlsm|xlsb)$/i;
const MAX_BYTES = 20 * 1024 * 1024;

export function FileStep({
  uploading,
  error,
  onFile,
}: {
  uploading: boolean;
  /** What went wrong with the last file, already in the owner's words. */
  error: string | null;
  onFile: (file: File) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const take = (file: File | undefined) => {
    if (!file || uploading) return;
    if (!ACCEPTED.test(file.name)) {
      setLocalError(
        t(
          "contacts.importV2.file.wrongType",
          "That file type can't be read. Save your list as CSV or Excel (.xlsx) and choose it again.",
        ),
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(
        t(
          "contacts.importV2.file.tooBig",
          "That file is larger than 20 MB. Split it into smaller files and bring them in one by one.",
        ),
      );
      return;
    }
    setLocalError(null);
    onFile(file);
  };

  const shown = localError ?? error;

  return (
    <div className="space-y-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-2xl border border-dashed border-foreground/25 bg-card px-5 py-10 text-center transition-colors sm:px-8 sm:py-14",
          dragging && "border-foreground bg-muted/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <FileSpreadsheet className="mx-auto size-8 text-foreground/70" aria-hidden />
        <h2 className="title-display mt-4 text-[22px] font-semibold text-foreground sm:text-[26px]">
          {t("contacts.importV2.file.title", "Bring in your list of contacts")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          {t(
            "contacts.importV2.file.lead",
            "A CSV or Excel file with one contact per line. Next you choose where each column goes. Nothing is saved until you have checked it.",
          )}
        </p>
        <Button
          type="button"
          className="mt-6 h-11 gap-2 px-5 text-[15px] max-sm:w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {uploading
            ? t("contacts.importV2.file.reading", "Reading your file…")
            : t("contacts.importV2.file.choose", "Choose a file")}
        </Button>
        <p className="mt-3 hidden text-[13px] text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:block">
          {t("contacts.importV2.file.orDrop", "or drop it here")}
        </p>
        <p className="mt-4 text-[12.5px] text-muted-foreground">
          {t("contacts.importV2.file.limits", "Up to 5,000 lines and 100 columns per file.")}
        </p>
        {shown ? (
          <p role="alert" className="mx-auto mt-4 max-w-md text-[14px] font-medium text-destructive">
            {shown}
          </p>
        ) : null}
      </div>

      <PastImports />
    </div>
  );
}

function PastImports() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["contact-imports"],
    queryFn: listContactImports,
  });
  if (!data || data.length === 0) return null;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section aria-labelledby="past-imports">
      <h2 id="past-imports" className="text-[15px] font-semibold text-foreground">
        {t("contacts.importV2.past.title", "Past imports")}
      </h2>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {data.map((imp) => (
          <li key={imp.id}>
            <Link
              to={`/contacts/import/${imp.id}`}
              className="press flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-foreground">
                  {imp.file_name}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {date.format(new Date(imp.created_at))}
                </span>
              </span>
              <span className="shrink-0 text-right text-[13px] text-muted-foreground">
                {pastSummary(t, imp)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function pastSummary(
  t: ReturnType<typeof useTranslation>["t"],
  imp: ContactImportListItem,
): string {
  if (imp.status === "undone") return t("contacts.importV2.past.undone", "Undone");
  if (imp.status === "running") return t("contacts.importV2.past.unfinished", "Not finished");
  return t("contacts.importV2.past.summary", {
    defaultValue: "{{added}} added · {{updated}} updated",
    added: imp.counts.added,
    updated: imp.counts.updated,
  });
}
