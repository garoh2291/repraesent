import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { useAuthContext } from "~/providers/auth-provider";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Sign in - Repraesent" },
    { name: "description", content: "Sign in to your account" },
  ];
}

const FEATURE_KEYS = [
  "auth.login.feature1",
  "auth.login.feature2",
  "auth.login.feature3",
] as const;

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    requestMagicLinkAsync,
    isAuthenticated,
    isLoading: isAuthLoading,
    isRequestingMagicLink,
    magicLinkError,
  } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      navigate(returnUrl || "/", { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError(t("auth.login.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("auth.login.emailInvalid"));
      return;
    }

    try {
      await requestMagicLinkAsync(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : magicLinkError?.message || t("auth.login.somethingWrong"),
      );
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f11]">
        <div className="h-5 w-5 app-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col bg-[#111113] p-10 border-r border-white/5 relative overflow-hidden">
        {/* Background image — fades up from the bottom, grayscale to keep black theme */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "url(/auth-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            filter: "grayscale(100%) brightness(0.35) contrast(1.1)",
            maskImage:
              "linear-gradient(to top, black 0%, black 35%, transparent 72%)",
            WebkitMaskImage:
              "linear-gradient(to top, black 0%, black 35%, transparent 72%)",
          }}
        />

        {/* Subtle noise grain overlay for texture */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="app-fade-down h-7 w-auto max-w-[120px] brightness-0 invert opacity-85"
              style={{ animationDelay: "0s" }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div className="space-y-3">
              <h2
                className="app-fade-up text-[28px] font-semibold text-white leading-tight"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  animationDelay: "0.15s",
                }}
              >
                {t("auth.login.brandLine1")}
                <br />
                {t("auth.login.brandLine2")}
              </h2>
              <p
                className="app-fade-up text-sm text-white/45 leading-relaxed max-w-[260px]"
                style={{ animationDelay: "0.25s" }}
              >
                {t("auth.login.brandSubtitle")}
              </p>
            </div>

            <div className="space-y-2.5">
              {FEATURE_KEYS.map((key, i) => (
                <div
                  key={key}
                  className="app-fade-up flex items-center gap-3"
                  style={{ animationDelay: `${0.35 + i * 0.1}s` }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-sm text-white/50">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>

          <p
            className="app-fade-in text-[11px] text-white/15"
            style={{ animationDelay: "0.7s" }}
          >
            © {new Date().getFullYear()} Repraesent
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-stone-50 p-8">
        <div className="w-full max-w-sm space-y-8 app-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-7 w-auto max-w-[120px]"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              {t("auth.login.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.login.subtitle")}
            </p>
          </div>

          {success ? (
            <div className="space-y-5 app-fade-up">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 leading-relaxed">
                <p className="font-medium">{t("auth.login.checkInbox")}</p>
                <p className="text-emerald-700/80 mt-0.5">
                  {t("auth.login.checkInboxDetail", { email })}
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t("auth.login.didntReceive")}{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setSuccess(false)}
                >
                  {t("auth.login.tryAgain")}
                </button>
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 app-fade-up app-fade-up-d1"
            >
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {t("auth.login.emailLabel")}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isRequestingMagicLink}
                  required
                  autoComplete="email"
                  autoFocus
                  className="h-11 border-stone-200 bg-white focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
                />
              </div>

              <button
                type="submit"
                disabled={isRequestingMagicLink}
                className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRequestingMagicLink ? (
                  <>
                    <div className="h-4 w-4 app-spin rounded-full border-2 border-background/30 border-t-background" />
                    {t("auth.login.submittingButton")}
                  </>
                ) : (
                  t("auth.login.submitButton")
                )}
              </button>

              <p className="text-center text-sm text-muted-foreground">
                {t("auth.login.noAccount")}{" "}
                <Link
                  to="/register"
                  className="text-primary font-medium hover:underline"
                >
                  {t("auth.login.createOne")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
