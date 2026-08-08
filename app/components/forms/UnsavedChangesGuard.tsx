import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router";
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
 * Confirms before leaving the builder with unsaved edits.
 *
 * This is not just politeness: a LIVE form with blocking issues cannot be
 * saved at all (saving republishes, and republishing something broken is
 * refused), so the only way to keep that work is to stay on the page or flip
 * the form back to Draft. Losing it to a stray click would be the worst
 * outcome of the whole save/publish design.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useTranslation();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    // Registered conditionally — an unconditional beforeunload listener
    // disqualifies the page from the back/forward cache.
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  return (
    <AlertDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("forms.builder.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("forms.builder.leaveBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            {t("forms.builder.leaveStay")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.state === "blocked" && blocker.proceed()}
          >
            {t("forms.builder.leaveDiscard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
