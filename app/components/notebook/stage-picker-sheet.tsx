import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/notebook/bottom-sheet";

export interface StagePickerStage {
  key: string;
  label: string;
  color?: string | null;
  category?: string | null;
}

/**
 * "Move to…": the stage list as one-tap rows (MOBILE_PACKAGE_PLAN.md B4) —
 * the single-pointer alternative to dragging a card (WCAG 2.5.7). Tapping a
 * stage closes the sheet and hands the key to the caller, which reuses its
 * own move (guards, Undo toast). The current stage is ticked and inert.
 */
export function StagePickerSheet({
  open,
  onOpenChange,
  stages,
  current,
  onPick,
  title,
  description,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: StagePickerStage[];
  current: string | null;
  onPick: (key: string) => void;
  title?: string;
  description?: string;
  /** Optional section under the stages (e.g. "Move to another pipeline"). */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t("mobile.stagePicker.title", "Move to…")}
      description={description}
    >
      <ul className="-mx-2 space-y-0.5" role="listbox" aria-label={title ?? t("mobile.stagePicker.title", "Move to…")}>
        {stages.map((s) => {
          const selected = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={selected}
                onClick={() => {
                  onOpenChange(false);
                  onPick(s.key);
                }}
                className={cn(
                  "press flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors",
                  selected
                    ? "cursor-default bg-accent font-semibold text-foreground"
                    : "text-foreground hover:bg-accent/60",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color || "var(--muted-foreground)" }}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {extra}
    </BottomSheet>
  );
}
