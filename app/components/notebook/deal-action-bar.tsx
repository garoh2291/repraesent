import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, ListPlus, Mail, MessageCircle, MoreHorizontal, Phone, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { telHref, whatsappHref } from "~/components/notebook/contact-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/** Height of the bottom tab bar (incl. safe area), so the bar sits right above it. */
export function useTabBarHeight(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-tab-bar]");
    if (!el) {
      setH(0);
      return;
    }
    const update = () => setH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/**
 * Phones only (`sm:hidden`): the deal's everyday actions in the thumb zone,
 * pinned above the tab bar (MOBILE_PACKAGE_PLAN.md B5). Call and WhatsApp use
 * the deal contact's phone; ⋯ holds the rarer Email / Photos / Delete.
 */
export function DealActionBar({
  phone,
  onNextStep,
  onEmail,
  onPhotos,
  onDelete,
}: {
  phone: string | null;
  onNextStep?: () => void;
  onEmail?: () => void;
  onPhotos?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const bottom = useTabBarHeight();
  const tel = phone ? telHref(phone) : null;
  const wa = phone ? whatsappHref(phone) : null;
  const cell =
    "press flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11.5px] font-medium";
  const off = "pointer-events-none text-muted-foreground/50";
  const hasMore = !!(onEmail || onPhotos || onDelete);

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-border bg-card/95 px-2 py-1.5 backdrop-blur-md sm:hidden"
      style={{ bottom: bottom == null ? "calc(4rem + env(safe-area-inset-bottom))" : bottom }}
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {tel ? (
          <a href={tel} className={cn(cell, "bg-foreground text-background")}>
            <Phone className="size-[18px]" aria-hidden />
            {t("outcome.call", "Call")}
          </a>
        ) : (
          <span className={cn(cell, off)} aria-disabled>
            <Phone className="size-[18px]" aria-hidden />
            {t("outcome.call", "Call")}
          </span>
        )}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(cell, "text-foreground")}>
            <MessageCircle className="size-[18px]" aria-hidden />
            {t("outcome.whatsapp", "WhatsApp")}
          </a>
        ) : (
          <span className={cn(cell, off)} aria-disabled>
            <MessageCircle className="size-[18px]" aria-hidden />
            {t("outcome.whatsapp", "WhatsApp")}
          </span>
        )}
        {onNextStep ? (
          <button type="button" onClick={onNextStep} className={cn(cell, "text-foreground")}>
            <ListPlus className="size-[18px]" aria-hidden />
            {t("nextStep.label", "Next step")}
          </button>
        ) : null}
        {hasMore ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(cell, "text-foreground")} aria-label={t("mobile.more", "More")}>
                <MoreHorizontal className="size-[18px]" aria-hidden />
                {t("mobile.more", "More")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="min-w-52">
              {onEmail ? (
                <DropdownMenuItem className="min-h-11" onSelect={onEmail}>
                  <Mail className="size-4" aria-hidden />
                  {t("compose.emailAction", "Email")}
                </DropdownMenuItem>
              ) : null}
              {onPhotos ? (
                <DropdownMenuItem className="min-h-11" onSelect={onPhotos}>
                  <Camera className="size-4" aria-hidden />
                  {t("mobile.deal.photos", "Photos")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={onDelete}>
                    <Trash2 className="size-4" aria-hidden />
                    {t("common.delete", "Delete")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
