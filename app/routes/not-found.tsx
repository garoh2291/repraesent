import { useTranslation } from "react-i18next";
import { ErrorCard } from "~/components/notebook/error-card";

/** An address that isn't a page, inside the app: the menu stays, one way on. */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6">
      <ErrorCard
        title={t("errors.notFoundTitle", "This page doesn't exist")}
        body={t("errors.notFoundBody", "The link may be old or mistyped. Everything else is where you left it.")}
      />
    </div>
  );
}
