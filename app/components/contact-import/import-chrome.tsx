import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { useTabBarHeight } from "~/components/notebook/deal-action-bar";

export type ImportStep = "file" | "match" | "check" | "done";
const ORDER: ImportStep[] = ["file", "match", "check", "done"];

/**
 * Where you are in the import. Numbered because it is a real sequence: each
 * step needs the one before it. Phones get one line ("2 of 4 · Match
 * columns") so the step names never wrap or truncate.
 */
export function ImportSteps({ current }: { current: ImportStep }) {
  const { t } = useTranslation();
  const names: Record<ImportStep, string> = {
    file: t("contacts.importV2.steps.file", "Your file"),
    match: t("contacts.importV2.steps.match", "Match columns"),
    check: t("contacts.importV2.steps.check", "Check"),
    done: t("contacts.importV2.steps.done", "Done"),
  };
  const at = ORDER.indexOf(current);
  return (
    <nav aria-label={t("contacts.importV2.steps.label", "Import steps")}>
      <p className="text-[13px] font-medium text-muted-foreground sm:hidden">
        <span className="num text-foreground">
          {t("contacts.importV2.steps.position", {
            defaultValue: "{{n}} of {{total}}",
            n: at + 1,
            total: ORDER.length,
          })}
        </span>
        {" · "}
        {names[current]}
      </p>
      <ol className="hidden flex-wrap items-center gap-x-2 gap-y-1 sm:flex">
        {ORDER.map((step, i) => {
          const done = i < at;
          const active = i === at;
          return (
            <li key={step} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              {i > 0 ? <span className="h-px w-6 bg-border" aria-hidden /> : null}
              <span
                className={cn(
                  "num flex size-6 items-center justify-center rounded-full border text-[12px] font-semibold",
                  active && "border-foreground bg-foreground text-background",
                  done && "border-foreground/30 text-foreground",
                  !active && !done && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[13px]",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {names[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The step's buttons. Desktop: a plain row under the content. Phones: pinned
 * in the thumb zone right above the tab bar, with a spacer in the flow so the
 * last line of content is never hidden behind it.
 */
export function ImportActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const bottom = useTabBarHeight();
  return (
    <>
      <div className="hidden items-center justify-between gap-4 border-t border-border pt-5 sm:flex">
        <div className="min-w-0 text-[13px] text-muted-foreground">{note}</div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
      <div className="h-24 sm:hidden" aria-hidden />
      <div
        className="fixed inset-x-0 z-30 border-t border-border bg-card/95 px-4 pt-2.5 backdrop-blur-md sm:hidden"
        style={{
          bottom: bottom == null ? "calc(4rem + env(safe-area-inset-bottom, 0px))" : bottom,
          paddingBottom: bottom ? "0.625rem" : "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {note ? <div className="pb-2 text-[13px] text-muted-foreground">{note}</div> : null}
        <div className="flex items-center gap-2 [&>*]:h-12 [&>*]:flex-1 [&>*]:text-[15px]">
          {children}
        </div>
      </div>
    </>
  );
}

/** A count with the display face, optionally under the marker ("needs you"). */
export function BigCount({
  value,
  label,
  marker,
  hint,
}: {
  value: number;
  label: ReactNode;
  marker?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="title-display num text-[34px] font-semibold text-foreground sm:text-[40px]">
        <span className={cn(marker && value > 0 && "marker")}>{value.toLocaleString()}</span>
      </p>
      <p className="mt-1 text-[14px] font-medium text-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
