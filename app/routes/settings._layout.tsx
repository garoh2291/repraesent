import { Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const tab =
    location.pathname.includes("/settings/team") ? "team" : "profile";

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      <div className="app-fade-up">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("settings.subtitle")}
        </p>
      </div>

      <div className="border-t border-border" />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate(v === "team" ? "/settings/team" : "/settings/profile")
        }
        className="w-full app-fade-up app-fade-up-d1"
      >
        <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList
            variant="line"
            className="w-full mb-4 sm:mb-6 min-w-max sm:min-w-0"
          >
            <TabsTrigger value="profile" className="cursor-pointer">
              {t("settings.tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="team" className="cursor-pointer">
              {t("settings.tabs.areaSettings")}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <Outlet />
    </div>
  );
}
