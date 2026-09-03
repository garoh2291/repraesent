import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { extractErrorMessage } from "~/lib/api/axios-instance";

export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.md";
const ACCEPT_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

interface Item {
  id: string;
  file: File;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
}

function accepted(file: File): boolean {
  if (ACCEPT_MIME.has(file.type)) return true;
  return /\.(pdf|docx|txt|md)$/i.test(file.name);
}

/**
 * Drag-and-drop plus a file input. Files go up one at a time — presign, PUT,
 * confirm — so a batch of ten PDFs never opens ten presigned uploads at once
 * and the per-file bar always means something.
 */
export function UploadDropzone({
  disabled,
  upload,
}: {
  disabled?: boolean;
  upload: (file: File, onProgress: (f: number) => void) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const running = useRef(false);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const drain = async (queue: Item[]) => {
    if (running.current) return;
    running.current = true;
    for (const item of queue) {
      patch(item.id, { state: "uploading" });
      try {
        await upload(item.file, (f) => patch(item.id, { progress: f }));
        patch(item.id, { state: "done", progress: 1 });
      } catch (err) {
        patch(item.id, { state: "failed", error: extractErrorMessage(err) });
      }
    }
    running.current = false;
  };

  const addFiles = (list: FileList | File[]) => {
    const next: Item[] = [];
    for (const file of Array.from(list)) {
      if (!accepted(file)) {
        toast.error(
          t("aiAssistants.knowledge.upload.rejectedType", { name: file.name }),
        );
        continue;
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        toast.error(
          t("aiAssistants.knowledge.upload.rejectedSize", { name: file.name }),
        );
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        state: "waiting",
      });
    }
    if (next.length === 0) return;
    setItems((prev) => [...prev, ...next]);
    void drain(next);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          dragging
            ? "border-foreground/50 bg-muted/60"
            : "border-border bg-muted/20 hover:bg-muted/40",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {t("aiAssistants.knowledge.upload.drop")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("aiAssistants.knowledge.upload.types")}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                {item.state === "done" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : item.state === "failed" ? (
                  <X className="h-4 w-4 text-red-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.file.name}</p>
                {item.state === "failed" ? (
                  <p className="truncate text-xs text-red-600 dark:text-red-400">
                    {item.error}
                  </p>
                ) : (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground transition-transform duration-200 ease-out"
                      style={{
                        transform: `scaleX(${item.state === "done" ? 1 : item.progress})`,
                        transformOrigin: "left",
                      }}
                    />
                  </div>
                )}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {(item.file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
