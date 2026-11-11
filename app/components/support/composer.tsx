import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowUp, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { isMacPlatform } from "~/lib/utils/platform";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Keeps up to 3 screenshots, with previews; shared by the composer and the new-report form. */
export function useScreenshots() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const add = (incoming: File[]) => {
    const ok: File[] = [];
    for (const f of incoming) {
      if (!TYPES.includes(f.type)) {
        toast.error(t("help.files.type", "Screenshots can be PNG, JPG, WebP or GIF."));
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(t("help.files.size", "Each screenshot can be up to 5 MB."));
        continue;
      }
      ok.push(f);
    }
    setFiles((prev) => {
      const next = [...prev, ...ok];
      if (next.length > MAX_FILES) toast.error(t("help.files.count", "Add up to 3 screenshots at a time."));
      return next.slice(0, MAX_FILES);
    });
  };
  /** Pasted images (⌘V a screenshot straight from the clipboard). */
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items)
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f)
      .map((f) => (f.name && f.name !== "image.png" ? f : new File([f], `screenshot-${Date.now()}.png`, { type: f.type })));
    if (imgs.length) {
      e.preventDefault();
      add(imgs);
    }
  };
  return {
    files,
    previews,
    add,
    onPaste,
    remove: (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i)),
    clear: () => setFiles([]),
  };
}

export function ScreenshotPicker({
  shots,
  className,
  label,
}: {
  shots: ReturnType<typeof useScreenshots>;
  className?: string;
  /** Shown next to the button when there are no screenshots yet. */
  label?: ReactNode;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {shots.previews.map((src, i) => (
        <div key={src} className="group relative size-14 overflow-hidden rounded-lg border border-border bg-muted">
          <img src={src} alt="" className="size-full object-cover" />
          <button
            type="button"
            onClick={() => shots.remove(i)}
            className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-foreground/80 text-background opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={t("help.files.remove", "Remove screenshot")}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      {shots.files.length < MAX_FILES ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="press inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-foreground/25 px-3 text-[13px] font-medium text-foreground/80 transition-colors hover:border-foreground/45 hover:bg-muted/60 max-sm:h-11"
        >
          <ImagePlus className="size-4" aria-hidden />
          {shots.files.length ? t("help.files.addAnother", "Add another") : (label ?? t("help.files.add", "Add screenshot"))}
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          shots.add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

export interface ComposerHandle {
  focus: () => void;
}

/**
 * Reply box: grows with the text, Enter makes a new line (people write
 * real messages here), ⌘/Ctrl+Enter sends. Screenshots by paste, drop or
 * the picture button.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    placeholder: string;
    sending: boolean;
    /** Returns true when sent, so the box clears. */
    onSend: (body: string, files: File[], alt: boolean) => Promise<boolean>;
    /** The send button(s); receives `send(alt)` and whether there is anything to send. */
    actions?: (send: (alt: boolean) => void, canSend: boolean) => ReactNode;
    tone?: "default" | "note";
    header?: ReactNode;
    className?: string;
  }
>(function Composer({ placeholder, sending, onSend, actions, tone = "default", header, className }, ref) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [dragging, setDragging] = useState(false);
  const shots = useScreenshots();
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(isMacPlatform()), []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [body]);

  const canSend = !sending && (body.trim().length > 0 || shots.files.length > 0);
  const send = async (alt: boolean) => {
    if (!canSend) return;
    const ok = await onSend(body.trim(), shots.files, alt);
    if (ok) {
      setBody("");
      shots.clear();
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-[border-color,box-shadow] focus-within:border-foreground/40 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--foreground)_6%,transparent)]",
        tone === "note" ? "note-slip border-marker" : "border-border",
        dragging && "border-foreground/50 bg-muted/40",
        className,
      )}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        shots.add(Array.from(e.dataTransfer.files));
      }}
    >
      {header}
      <textarea
        ref={area}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={shots.onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send(e.shiftKey);
          }
        }}
        rows={2}
        maxLength={5000}
        placeholder={placeholder}
        aria-label={placeholder}
        className="block w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 max-sm:text-[16px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-1">
        <ScreenshotPicker shots={shots} label={t("help.files.addShort", "Screenshot")} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground/70 lg:inline">
            {mac ? "⌘" : "Ctrl"}+Enter
          </span>
          {actions ? (
            actions((alt) => void send(alt), canSend)
          ) : (
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void send(false)}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-semibold text-background transition-opacity disabled:opacity-35 max-sm:h-11"
            >
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
              {t("help.thread.send", "Send")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
