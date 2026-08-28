import { useTranslation } from "react-i18next";
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

/**
 * The app's own confirmation for a destructive action.
 *
 * Replaces `window.confirm`, which the list pages were using. That dialog is
 * safe but wrong in two ways: it is unstyled OS chrome dropped into the middle
 * of a designed product, and its one line of text has nowhere to say what the
 * deletion actually costs.
 *
 * Naming the thing being deleted and stating the consequence is the whole
 * point — a confirmation that only asks "are you sure?" trains people to click
 * through it without reading.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  name,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being deleted, shown in the title so the target is unambiguous. */
  name: string | null;
  /**
   * Overrides the "Delete …?" title, for a destructive action that is not a
   * deletion — replacing one language's structure with another's, say. The
   * consequence is still spelled out, and the button below still names the
   * action rather than saying "OK".
   */
  title?: string;
  /** What confirming costs. One sentence, plain. */
  description: string;
  /** The action's own name; must match the control that opened this dialog. */
  confirmLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title ??
              t("common.deleteNamed", {
                defaultValue: 'Delete "{{name}}"?',
                name: name ?? "",
              })}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </AlertDialogCancel>
          {/* The action keeps the name of what it does, rather than "OK". */}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {confirmLabel ?? t("common.delete", { defaultValue: "Delete" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
