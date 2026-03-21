import { useMemo } from "react";
import { marked } from "marked";
import { useTranslation } from "react-i18next";
import { X, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/**
 * Strip outer code-fence wrappers like:
 *   ```markdown
 *   ...content...
 *   ```
 * that may be present when instructions were saved with a fence.
 */
function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^`{3,}(?:markdown)?\s*\n([\s\S]*?)\n`{3,}$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

interface InstructionsModalProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
}

export function InstructionsModal({
  open,
  onClose,
  markdown,
}: InstructionsModalProps) {
  const { t } = useTranslation();
  const html = useMemo(() => {
    const clean = stripMarkdownFence(markdown);
    return marked.parse(clean, { async: false }) as string;
  }, [markdown]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="
          max-w-3xl w-full p-0 gap-0 overflow-hidden
          bg-[#111113] border border-white/8
          shadow-[0_32px_80px_rgba(0,0,0,0.7)]
        "
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-white/6 gap-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400/10 border border-amber-400/20">
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <DialogTitle className="text-[15px] font-semibold text-white/90 tracking-tight">
              {t("instructions.title")}
            </DialogTitle>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/6 transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto max-h-[70vh] px-8 py-6">
          <div
            className="instructions-md"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
