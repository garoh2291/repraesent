import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";
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
import { Button } from "~/components/ui/button";
import type { HideChoice } from "~/lib/leads/hide-choice";

/**
 * "Hide Anna?" — asked when a lead is moved to Hidden (dropdown or drag).
 * Two honest outcomes: just put it away, or put it away AND stop the sender's
 * next enquiries. The block is the likely intent (people hide spam), so it is
 * the focused default and Enter picks it; the card waits until they choose.
 */
export function HideLeadDialog({
  open,
  name,
  email,
  phone,
  onChoose,
  onCancel,
}: {
  open: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  onChoose: (choice: HideChoice) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const blockRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent
        className="gap-5 sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          blockRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">{t("leads.hide.title", { name })}</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">{t("leads.hide.body")}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/40 text-sm" aria-label={t("leads.hide.senderLabel")}>
          {email ? (
            <li className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{email}</span>
            </li>
          ) : null}
          {phone ? (
            <li className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
              <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate tabular-nums">{phone}</span>
            </li>
          ) : null}
        </ul>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="sm:mr-auto">{t("common.cancel")}</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={() => onChoose("hide")}>
            {t("leads.hide.justHide")}
          </Button>
          <AlertDialogAction ref={blockRef} onClick={() => onChoose("block")}>
            {t("leads.hide.hideAndBlock")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
