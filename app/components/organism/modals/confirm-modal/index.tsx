import { Button } from "~/components/ui/button";
import {
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";

export default function ConfirmationModal({
  setIsOpen,
  onConfirm,
  title = "Confirm Action",
  description = "Are you sure you want to confirm this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
}: {
  setIsOpen?: (isOpen: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}) {
  async function handleConfirm() {
    await onConfirm();
    setIsOpen?.(false);
  }

  function handleCancel() {
    setIsOpen?.(false);
  }

  return (
    <DialogContent className="flex min-w-[528px] flex-col gap-0">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold text-foreground">
          {title}
        </DialogTitle>
      </DialogHeader>
      <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground leading-relaxed">
        {description}
      </DialogDescription>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={handleCancel}>
          {cancelText}
        </Button>
        <Button
          className="bg-foreground text-background hover:opacity-90 transition-opacity"
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
