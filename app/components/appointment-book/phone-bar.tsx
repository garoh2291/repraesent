import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import { useTabBarHeight } from "~/components/notebook/deal-action-bar";

const PHONE_QUERY = "(max-width: 1023.98px)";

/**
 * A bar of actions pinned right above the phone tab bar (below `lg`); on
 * desktop it is an ordinary row where it is placed.
 *
 * On phones the bar is portalled to <body>: pages fade in with a transform
 * (`app-fade-in`), and a transformed ancestor turns `position: fixed` into
 * "fixed to that ancestor", which put the bar over the page's own content.
 * It is measured, and an equally tall spacer goes to the end of the scrolling
 * <main>, so the last thing on the page can always be scrolled clear of it.
 */
export function PhoneBar({ children, className }: { children: ReactNode; className?: string }) {
  const tabBar = useTabBarHeight();
  const ref = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!phone || !el) {
      setHeight(0);
      return;
    }
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone]);

  if (!phone) {
    return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
  }

  const main = document.querySelector("main");
  return (
    <>
      {createPortal(
        <div
          ref={ref}
          className={cn(
            "fixed inset-x-0 z-30 flex flex-wrap items-center gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur",
            className,
          )}
          style={{ bottom: tabBar == null ? "calc(4rem + env(safe-area-inset-bottom))" : tabBar }}
        >
          {children}
        </div>,
        document.body,
      )}
      {main && height > 0 ? createPortal(<div aria-hidden className="shrink-0" style={{ height }} />, main) : null}
    </>
  );
}
