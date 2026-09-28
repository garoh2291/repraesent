import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FlaskConical, Mail } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  authErrorKind,
  authErrorMessage,
  register,
  type AuthRequestErrorKind,
} from "~/lib/api/auth";
import i18n from "~/i18n";
import { normalizeLocale } from "~/i18n/locales";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { LegalFooter } from "~/components/molecule/legal-footer";
import { AuthErrorBox } from "~/components/molecule/auth-error-box";

export function meta() {
  return [
    { title: i18n.t("auth.register.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("auth.register.metaDescription") },
  ];
}

const BENEFITS = [
  { key: "auth.register.benefit1", defaultValue: undefined },
  { key: "auth.register.benefitNoPassword", defaultValue: "No password — a link by email" },
  { key: "auth.register.benefit3", defaultValue: undefined },
] as const;

export default function Register() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "auth.register.metaTitle",
    descriptionKey: "auth.register.metaDescription",
    titleSuffix: " - Repraesent",
  });
  // Sent here from the sign-in page ("no account yet") with the email filled in.
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthRequestErrorKind | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorKind(null);
    setSuccess(false);

    if (!email) {
      setError(t("auth.register.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("auth.register.emailInvalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Send the visitor's current UI language so the magic-link/welcome email
      // is in that language and the new user's locale is set to it.
      await register(email, normalizeLocale(i18n.language));
      setSuccess(true);
    } catch (err) {
      setError(authErrorMessage(err, t, "auth.register.somethingWrong"));
      setErrorKind(authErrorKind(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen pt-safe">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col bg-[#141516] p-10 border-r border-white/5 relative overflow-hidden">
        {/* Background image — fades up from the bottom, grayscale to keep black theme */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "url(/register-bg.png)",
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
                {t("auth.register.brandLine1")}
                <br />
                {t("auth.register.brandLine2")}
              </h2>
              <p
                className="app-fade-up text-sm text-white/45 leading-relaxed max-w-[260px]"
                style={{ animationDelay: "0.25s" }}
              >
                {t("auth.register.brandSubtitle")}
              </p>
            </div>

            <div className="space-y-2.5">
              {BENEFITS.map(({ key, defaultValue }, i) => (
                <div
                  key={key}
                  className="app-fade-up flex items-center gap-3"
                  style={{ animationDelay: `${0.35 + i * 0.1}s` }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-marker shrink-0" />
                  <span className="text-sm text-white/50">
                    {defaultValue ? t(key, defaultValue) : t(key)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="app-fade-in flex items-center justify-between gap-3"
            style={{ animationDelay: "0.7s" }}
          >
            <p className="text-[11px] text-white/15">
              © {new Date().getFullYear()} Repraesent
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-background relative">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
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
                {t("auth.register.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("auth.register.subtitle")}
              </p>
            </div>

            {success ? (
              <div className="space-y-5 app-fade-up">
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-marker bg-marker-soft px-4 py-4 text-sm text-marker-ink leading-relaxed"
                >
                  <Mail className="size-4 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0 break-words">
                    <p className="font-medium">{t("auth.login.checkInbox")}</p>
                    <p className="mt-0.5">
                      {t("auth.register.checkInboxDetail", { email })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.login.didntReceive")}{" "}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center px-1 text-primary font-medium hover:underline"
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
                {error && <AuthErrorBox message={error} />}

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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorKind === "accountExists") {
                        setError(null);
                        setErrorKind(null);
                      }
                    }}
                    disabled={isSubmitting}
                    required
                    autoComplete="email"
                    autoFocus
                    className="h-11 border-border bg-card focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 app-spin rounded-full border-2 border-background/30 border-t-background" />
                      {t("auth.register.submittingButton")}
                    </>
                  ) : (
                    t("auth.register.submitButton")
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("auth.register.hasAccount")}{" "}
                  {/* "This email already has an account" → the existing
                      Sign in link wears the marker, with the email carried over. */}
                  <Link
                    to={
                      errorKind === "accountExists"
                        ? `/login?email=${encodeURIComponent(email)}`
                        : "/login"
                    }
                    className={cn(
                      "text-primary font-medium hover:underline",
                      errorKind === "accountExists" &&
                        "marker px-1 font-semibold text-foreground"
                    )}
                  >
                    {t("auth.register.signIn")}
                  </Link>
                </p>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                      {t("auth.login.tryDemo")}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Link
                    to="/demo"
                    className="w-full h-11 rounded-lg border border-border bg-card text-foreground text-sm font-medium transition-colors duration-150 hover:bg-muted flex items-center justify-center gap-2"
                  >
                    <FlaskConical className="h-4 w-4 text-foreground" />
                    {t("auth.login.tryDemoLink")}
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Legal links */}
        <LegalFooter />
      </div>
    </div>
  );
}
