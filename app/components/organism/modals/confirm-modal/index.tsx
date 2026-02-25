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
    <DialogContent className="flex min-w-[528px] flex-col gap-0 font-sans">
      <DialogHeader>
        <DialogTitle className="text-[25px] font-bold leading-8 text-[#333]">
          {title}
        </DialogTitle>
      </DialogHeader>
      <DialogDescription className="mb-6 mt-4 text-base font-normal leading-[25px] text-black">
        <span>{description}</span>
      </DialogDescription>

      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          className="text-[11px] font-bold leading-5"
        >
          {cancelText}
        </Button>
        <Button
          className="bg-black text-white text-[11px] font-bold leading-5 hover:bg-black/90"
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
