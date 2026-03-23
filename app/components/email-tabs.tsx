import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

export function EmailTabs() {
  const { t } = useTranslation();
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex">
        <NavLink
          to="/email"
          end
          className={({ isActive }) =>
            cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          {t("email.tabConfig")}
        </NavLink>
        <NavLink
          to="/email/confirmation"
          className={({ isActive }) =>
            cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          {t("email.tabConfirmation")}
        </NavLink>
      </nav>
    </div>
  );
}
