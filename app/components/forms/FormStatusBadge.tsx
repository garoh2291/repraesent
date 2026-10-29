import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { DefinitionChange } from "~/lib/forms/definition-diff";
import { cn } from "~/lib/utils";

interface Props {
  status: "draft" | "published";
  hasUnpublishedChanges?: boolean;
  /**
   * `dark` is for the builder's #111113 command bar. The light tones use
   * 50-level fills that turn to mud on dark chrome, so this switches to the
   * translucent ladder the sidebar and trial banner already use. Default is
   * unchanged, so the forms list is untouched.
   */
  tone?: "light" | "dark";
  className?: string;
  /**
   * Builder only. When set and the form has edits that are not live, the
   * badge opens a list of them with "Make live" and "Undo changes", so people
   * are never left guessing what "unpublished" refers to.
   */
  details?: {
    changes: DefinitionChange[];
    /** Some of the edits are only in the browser, not saved yet. */
    unsaved: boolean;
    canEdit: boolean;
    busy: boolean;
    onMakeLive: () => void;
    onUndo: () => void;
  };
}

/**
 * Three states, not two: a published form with edits sitting in the draft is
 * neither "live as you see it" nor "offline", and hiding that difference is how
 * people end up wondering why their change never appeared on the website.
 */
const TONES = {
  light: {
    pending:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    live: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    draft: "border-border bg-muted/50 text-muted-foreground",
  },
  dark: {
    pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    draft: "border-white/10 bg-white/5 text-white/50",
  },
} as const;

export function FormStatusBadge({
  status,
  hasUnpublishedChanges,
  tone = "light",
  details,
  className,
}: Props) {
  const { t } = useTranslation();

  const isLive = status === "published";
  const pending = isLive && hasUnpublishedChanges;

  const label = pending
    ? t("forms.status.unpublishedChanges")
    : isLive
      ? t("forms.status.published")
      : t("forms.status.draft");

  const tones = TONES[tone];

  const badge = (
    <>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          pending
            ? "bg-amber-500"
            : isLive
              ? "bg-emerald-500"
              : tone === "dark"
                ? "bg-white/40"
                : "bg-muted-foreground/50",
        )}
        aria-hidden="true"
      />
      {label}
    </>
  );
  const badgeClass = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
    pending ? tones.pending : isLive ? tones.live : tones.draft,
    className,
  );

  if (pending && details) {
    // The builder header shares one row with the form name; on a phone the
    // full "Unpublished changes" (longer still in German) squeezed the name
    // down to a letter, so phones get the popover's own short title.
    return (
      <ChangesPopover details={details} className={badgeClass}>
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        <span className="sm:hidden">{t("forms.status.changes.title")}</span>
        <span className="hidden sm:inline">{label}</span>
      </ChangesPopover>
    );
  }

  return <span className={badgeClass}>{badge}</span>;
}

function ChangesPopover({
  details,
  className,
  children,
}: {
  details: NonNullable<Props["details"]>;
  className: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // Undo throws work away, so it asks once more before it does.
  const [confirmUndo, setConfirmUndo] = useState(false);

  const languageName = (locale: string) => {
    try {
      return (
        new Intl.DisplayNames([i18n.language], { type: "language" }).of(
          locale,
        ) ?? locale
      );
    } catch {
      return locale;
    }
  };

  const line = (change: DefinitionChange): string => {
    switch (change.kind) {
      case "fieldAdded":
      case "fieldRemoved":
      case "fieldChanged":
        return t(`forms.status.changes.${change.kind}`, {
          label: change.label,
        });
      case "text":
        return t("forms.status.changes.text", {
          language: languageName(change.locale),
        });
      default:
        return t(`forms.status.changes.${change.kind}`);
    }
  };

  const { changes, unsaved, canEdit, busy, onMakeLive, onUndo } = details;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmUndo(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            className,
            "cursor-pointer transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
          )}
          aria-haspopup="dialog"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {t("forms.status.changes.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("forms.status.changes.intro")}
            </p>
          </div>

          <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
            {changes.length > 0 ? (
              changes.map((change, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{line(change)}</span>
                </li>
              ))
            ) : (
              <li className="flex gap-2">
                <span
                  className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                <span>{t("forms.status.changes.unsavedOnly")}</span>
              </li>
            )}
          </ul>

          {unsaved && changes.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("forms.status.changes.notSaved")}
            </p>
          ) : null}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="h-10 sm:h-9"
              onClick={() => {
                if (!confirmUndo) {
                  setConfirmUndo(true);
                  return;
                }
                setConfirmUndo(false);
                setOpen(false);
                onUndo();
              }}
            >
              {confirmUndo
                ? t("forms.status.changes.undoConfirm")
                : t("forms.status.changes.undo")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="h-10 sm:h-9"
              onClick={() => {
                setOpen(false);
                onMakeLive();
              }}
            >
              {t("forms.status.changes.makeLive")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
