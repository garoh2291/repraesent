import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";

/**
 * Lazy on purpose. The player pulls in the entire builder — FormCanvas,
 * dnd-kit, ThemePanel, SharePanel — and the Forms list page must not pay for
 * that on first paint. Splitting here keeps `forms._index` free of the builder
 * chunk until someone actually opens the demo.
 */
const IntroPlayer = lazy(() =>
  import("./IntroPlayer").then((m) => ({ default: m.IntroPlayer })),
);

interface Props {
  open: boolean;
  /** Called on Done, Skip, Escape and backdrop click. */
  onClose: () => void;
}

export function FormsIntroModal({ open, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#0e0e12] p-0 sm:max-w-5xl"
      >
        {/* Title and description live out here, not in the lazy player: Radix
            errors if a DialogContent renders without a title, and during the
            Suspense fallback the player isn't mounted yet. */}
        <DialogTitle className="sr-only">{t("forms.intro.title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("forms.intro.subtitle")}
        </DialogDescription>

        <Suspense
          fallback={
            <div className="grid h-[58svh] min-h-[320px] place-items-center sm:h-[560px] sm:min-h-0">
              <Spinner className="h-5 w-5 text-white/40" />
            </div>
          }
        >
          {/* Mounted only while open, so the storyboard always starts at the
              beginning and no timer survives a close. */}
          {open ? <IntroPlayer onClose={onClose} /> : null}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
