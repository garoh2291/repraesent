import { useTranslation } from "react-i18next";
import { ErrorCard } from "~/components/notebook/error-card";

/**
 * A list or panel whose data couldn't be fetched: say so plainly and offer to
 * try again (refetch). No home button: the page itself is fine.
 */
export function LoadError({ what, onRetry, className }: { what: string; onRetry: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <ErrorCard
      compact
      showHome={false}
      className={className}
      title={t("errors.loadTitle", "We couldn't load {{what}}", { what })}
      body={t("errors.loadBody", "Check your connection and try again.")}
      onRetry={onRetry}
    />
  );
}
