import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** A card section of Settings → Onboarding (both tabs). */
export function Section({
  icon,
  title,
  hint,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Floats at the bottom of the content column (never over the sidebar), and
 * only while there is something to save.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "pointer-events-none sticky bottom-4 z-30 transition-all duration-300 motion-reduce:transition-none",
        dirty ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      aria-hidden={!dirty}
    >
      <div
        className={cn(
          "flex items-center justify-end gap-3 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-lg backdrop-blur-md",
          dirty && "pointer-events-auto",
        )}
      >
        <span className="mr-auto hidden text-sm text-muted-foreground sm:inline">{t("settings.onboarding.unsaved")}</span>
        <Button variant="ghost" onClick={onDiscard} disabled={saving || !dirty} tabIndex={dirty ? 0 : -1} className="max-sm:h-11 max-sm:flex-1">
          {t("settings.onboarding.discard")}
        </Button>
        <Button onClick={onSave} disabled={saving || !dirty} tabIndex={dirty ? 0 : -1} className="max-sm:h-11 max-sm:flex-1">
          {saving ? t("settings.onboarding.saving") : t("settings.onboarding.save")}
        </Button>
      </div>
    </div>
  );
}
