import { useTranslation } from "react-i18next";
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
  title,
  description,
  confirmText,
  cancelText,
}: {
  setIsOpen?: (isOpen: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}) {
  const { t } = useTranslation();
  const displayTitle = title ?? t("confirmModal.defaultTitle");
  const displayDescription = description ?? t("confirmModal.defaultDescription");
  const displayConfirm = confirmText ?? t("confirmModal.defaultConfirm");
  const displayCancel = cancelText ?? t("confirmModal.defaultCancel");

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
          {displayTitle}
        </DialogTitle>
      </DialogHeader>
      <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground leading-relaxed">
        {displayDescription}
      </DialogDescription>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={handleCancel}>
          {displayCancel}
        </Button>
        <Button
          className="bg-foreground text-background hover:opacity-90 transition-opacity"
          onClick={handleConfirm}
        >
          {displayConfirm}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
