import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";

export function meta() {
  return [
    { title: i18n.t("noWorkspace.metaTitle") },
    {
      name: "description",
      content: i18n.t("noWorkspace.metaDescription"),
    },
  ];
}

export default function NoWorkspace() {
  const { t } = useTranslation();
  const { logout, isLoggingOut } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] p-8">
      <div className="w-full max-w-sm text-center space-y-8 app-fade-up">
        {/* Icon */}
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/8 mx-auto">
          <svg
            className="h-7 w-7 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-white">
            {t("noWorkspace.title")}
          </h1>
          <p className="text-sm text-white/40 leading-relaxed">
            {t("noWorkspace.description")}
          </p>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-white/8 bg-white/4 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-2">
            {t("noWorkspace.needHelp")}
          </p>
          <a
            href="mailto:support@repraesent.com"
            className="text-sm text-amber-400/80 hover:text-amber-400 transition-colors"
          >
            support@repraesent.com
          </a>
        </div>

        {/* Sign out */}
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/6 px-6 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-all duration-150 disabled:opacity-40"
        >
          {isLoggingOut ? t("noWorkspace.signingOut") : t("noWorkspace.signOut")}
        </button>
      </div>
    </div>
  );
}
