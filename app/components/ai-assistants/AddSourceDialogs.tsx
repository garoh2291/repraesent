import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Textarea } from "~/components/ui/textarea";
import { FieldHint } from "~/components/wordpress/fields";

export const TEXT_MAX = 60_000;

// --- Crawl website ------------------------------------------------------------

export function CrawlWebsiteDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (input: {
    url: string;
    crawl_limit: number;
    title: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (open) {
      setUrl("");
      setLimit(25);
    }
  }, [open]);

  const normalized = normalizeUrl(url);
  const valid = !!normalized;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("aiAssistants.knowledge.crawl.title")}</DialogTitle>
          <DialogDescription>
            {t("aiAssistants.knowledge.crawl.hint")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!normalized) return;
            onSubmit({
              url: normalized,
              crawl_limit: limit,
              title: hostOf(normalized),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="crawl-url">
              {t("aiAssistants.knowledge.crawl.url")}
            </Label>
            <Input
              id="crawl-url"
              autoFocus
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="crawl-limit">
                {t("aiAssistants.knowledge.crawl.limit")}
              </Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {t("aiAssistants.knowledge.crawl.pages", { count: limit })}
              </span>
            </div>
            <Slider
              id="crawl-limit"
              min={5}
              max={200}
              step={5}
              value={[limit]}
              onValueChange={(v) => setLimit(v[0] ?? 25)}
            />
            <FieldHint>{t("aiAssistants.knowledge.crawl.limitHint")}</FieldHint>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("aiAssistants.knowledge.crawl.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// --- Add / edit text ----------------------------------------------------------

export function TextSourceDialog({
  open,
  onOpenChange,
  pending,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  /** Set when editing an existing text source. */
  initial?: { title: string; raw_text: string } | null;
  onSubmit: (input: { title: string; raw_text: string }) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setText(initial?.raw_text ?? "");
    }
  }, [open, initial]);

  const over = text.length > TEXT_MAX;
  const valid = title.trim().length > 0 && text.trim().length > 0 && !over;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t("aiAssistants.knowledge.text.editTitle")
              : t("aiAssistants.knowledge.text.title")}
          </DialogTitle>
          <DialogDescription>
            {t("aiAssistants.knowledge.text.hint")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onSubmit({ title: title.trim(), raw_text: text });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="text-title">
              {t("aiAssistants.knowledge.text.name")}
            </Label>
            <Input
              id="text-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("aiAssistants.knowledge.text.namePlaceholder")}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="text-body">
                {t("aiAssistants.knowledge.text.body")}
              </Label>
              <span
                className={
                  over
                    ? "text-xs tabular-nums text-red-600 dark:text-red-400"
                    : "text-xs tabular-nums text-muted-foreground"
                }
              >
                {text.length.toLocaleString()} / {TEXT_MAX.toLocaleString()}
              </span>
            </div>
            <Textarea
              id="text-body"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("aiAssistants.knowledge.text.bodyPlaceholder")}
              className="min-h-[260px] font-mono text-xs leading-relaxed"
              aria-invalid={over || undefined}
            />
            <FieldHint>{t("aiAssistants.knowledge.text.bodyHint")}</FieldHint>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {initial
                ? t("common.save", { defaultValue: "Save" })
                : t("aiAssistants.knowledge.text.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
