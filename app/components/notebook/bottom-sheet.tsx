import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "~/lib/utils";

/** True from the `sm` breakpoint up. False during SSR and the first paint. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * One focused question at a time (outcome, make a deal, what's next).
 *
 * Phones: a sheet from the bottom — one thumb, drag down to dismiss (vaul,
 * with velocity and rubber-banding). Desktop: a centred modal, because a
 * drawer rising from the bottom of a 1440px screen reads as a toast, not a
 * question. Same content and footer in both.
 */
export function BottomSheet(props: SheetProps) {
  const desktop = useIsDesktop();
  return desktop ? <CenteredModal {...props} /> : <MobileSheet {...props} />;
}

function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[#141516]/40" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] w-full flex-col rounded-t-2xl border-t border-border bg-card outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-foreground/15" aria-hidden />
          <div className="px-5 pb-3 pt-4">
            <Drawer.Title className="title-display text-[22px] font-semibold leading-tight text-foreground">
              {title}
            </Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
                {description}
              </Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer ? (
            <div className="border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CenteredModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#141516]/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-20px_rgba(20,21,22,0.35)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-2 duration-200 motion-reduce:animate-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="title-display text-[24px] font-semibold leading-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="-mr-2 -mt-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer ? (
            <div className="border-t border-border bg-background/40 px-6 py-3.5">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
