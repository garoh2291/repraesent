import { useEffect } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { LogOut } from "lucide-react";

// the same but without the /api prefix

export default function BrandLayout() {
  const { user, brand, logout, isLoggingOut } = useAuthContext();
  const { i18n, t } = useTranslation();

  const BACKEND_IMG_URL =
    import.meta.env.VITE_API_URL?.replace("/api", "") ||
    "http://localhost:8000";

  useEffect(() => {
    if (!user?.locale) return;
    const locale =
      user.locale === "en" || user.locale === "de" ? user.locale : "de";
    i18n.changeLanguage(locale);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [user?.locale, i18n]);

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#111113]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {brand?.logo && (
              <img
                src={`${BACKEND_IMG_URL}${brand.logo}`}
                alt={brand.name}
                className="h-8 w-8 rounded-lg object-contain"
              />
            )}
            <div>
              <h1 className="text-sm font-semibold text-white/90">
                {brand?.name ?? "Brand"}
              </h1>
              <p className="text-xs text-white/40">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white/80 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("common.logout", "Sign out")}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
