import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { FlaskConical, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredSelectedView, BRAND_VIEW } from "~/lib/api/axios-instance";
import {
  authErrorKind,
  authErrorMessage,
  type AuthRequestErrorKind,
} from "~/lib/api/auth";
import i18n from "~/i18n";
import { normalizeLocale } from "~/i18n/locales";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { LegalFooter } from "~/components/molecule/legal-footer";
import { LoginCodeBox } from "~/components/molecule/login-code-box";
import { AuthErrorBox } from "~/components/molecule/auth-error-box";

export function meta() {
  return [
    { title: i18n.t("auth.login.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("auth.login.metaDescription") },
  ];
}

const FEATURE_KEYS = [
  "auth.login.feature1",
  "auth.login.feature2",
  "auth.login.feature3",
] as const;

export default function Login() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "auth.login.metaTitle",
    descriptionKey: "auth.login.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthRequestErrorKind | null>(null);
  const [success, setSuccess] = useState(false);
  // Masked sign-in copy address ("g•••@gmail.com") when the account has one.
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const {
    user,
    workspaces,
    brand,
    requestMagicLinkAsync,
    isAuthenticated,
    isLoading: isAuthLoading,
    isRequestingMagicLink,
  } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Sent here from the register page ("already has an account") with the email filled in.
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  // While a typed code signs in, the shared routeAfterAuth decides where to
  // go; this page's own "already signed in" redirect must not race it.
  const codeSignIn = useRef(false);
  const [codeSigningIn, setCodeSigningIn] = useState(false);

  // A sign-in link that couldn't be used sends people here with ?error=…
  // (auth.callback.tsx). Say what happened in their language, once; a new
  // submit clears it like any other error.
  const linkErrorParam = searchParams.get("error");
  useEffect(() => {
    if (!linkErrorParam) return;
    setError(
      linkErrorParam === "missing_token"
        ? t(
            "auth.errors.linkIncomplete",
            "That sign-in link was incomplete. Send a new one below."
          )
        : t("auth.login.somethingWrong")
    );
  }, [linkErrorParam, t]);

  useEffect(() => {
    if (isAuthLoading || codeSignIn.current) return;
    if (isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      // Brand users: prefer explicit returnUrl, otherwise the last-selected
      // view (brand vs. a workspace), otherwise fall through to picker / brand.
      if (user?.user_type === "brand") {
        const wsList = workspaces ?? [];
        // Brand was revoked → /brand isn't an option anymore.
        if (!brand) {
          if (wsList.length === 0) {
            navigate("/no-workspace", { replace: true });
            return;
          }
          if (
            returnUrl &&
            returnUrl.startsWith("/") &&
            !returnUrl.startsWith("/brand")
          ) {
            navigate(returnUrl, { replace: true });
            return;
          }
          if (wsList.length === 1) {
            navigate("/", { replace: true });
            return;
          }
          navigate("/auth/workspace-picker", { replace: true });
          return;
        }
        if (returnUrl && returnUrl.startsWith("/")) {
          navigate(returnUrl, { replace: true });
          return;
        }
        const stored = getStoredSelectedView();
        if (stored === BRAND_VIEW) {
          navigate("/brand", { replace: true });
          return;
        }
        if (stored && wsList.some((w) => w.id === stored)) {
          navigate("/", { replace: true });
          return;
        }
        if (wsList.length === 0) {
          navigate("/brand", { replace: true });
          return;
        }
        navigate("/auth/workspace-picker", { replace: true });
        return;
      }
      navigate(returnUrl || "/", { replace: true });
    }
  }, [
    isAuthenticated,
    isAuthLoading,
    navigate,
    searchParams,
    user,
    workspaces,
    brand,
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorKind(null);
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
      // Send the visitor's current UI language so the magic-link email is in
      // that language and their saved locale is synced to it.
      const sent = await requestMagicLinkAsync({
        email,
        locale: normalizeLocale(i18n.language),
      });
      setCopyHint(sent?.copy_hint ?? null);
      setSuccess(true);
    } catch (err) {
      setError(authErrorMessage(err, t));
      setErrorKind(authErrorKind(err));
    }
  };

  // "No account" / "didn't finish signing up" → the existing Create link
  // wears the marker, with the email carried over.
  const highlightRegister =
    errorKind === "accountNotFound" || errorKind === "signupUnfinished";

  // Keep the code box mounted while its own sign-in loads the account.
  if (isAuthLoading && !codeSigningIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141516] pt-safe">
        <div className="h-5 w-5 app-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pt-safe">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col bg-[#141516] p-10 border-r border-white/5 relative overflow-hidden">
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
                  <div className="h-1.5 w-1.5 rounded-full bg-marker shrink-0" />
                  <span className="text-sm text-white/50">{t(key)}</span>
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
                {t("auth.login.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t(
                  "auth.login.subtitleCode",
                  "We'll email you a link and a 6-digit code."
                )}
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
                      {t("auth.login.checkInboxDetailCode", {
                        email,
                        defaultValue:
                          "We sent a link and a 6-digit code to {{email}}.",
                      })}
                    </p>
                    {copyHint && (
                      <p className="mt-0.5">
                        {t("auth.login.copySent", {
                          hint: copyHint,
                          defaultValue: "We also sent a copy to {{hint}}.",
                        })}
                      </p>
                    )}
                    <p className="mt-0.5 opacity-80">
                      {t(
                        "auth.login.checkInboxExpiry",
                        "The link works for 30 minutes, the code for 10."
                      )}
                    </p>
                  </div>
                </div>
                <LoginCodeBox
                  email={email}
                  returnUrl={searchParams.get("returnUrl")}
                  onResend={async () => {
                    const sent = await requestMagicLinkAsync({
                      email,
                      locale: normalizeLocale(i18n.language),
                    });
                    setCopyHint(sent?.copy_hint ?? null);
                  }}
                  onSigningIn={(active) => {
                    codeSignIn.current = active;
                    setCodeSigningIn(active);
                  }}
                />
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
                      if (highlightRegister) {
                        setError(null);
                        setErrorKind(null);
                      }
                    }}
                    disabled={isRequestingMagicLink}
                    required
                    autoComplete="email"
                    autoFocus
                    className="h-11 border-border bg-card focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
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
                    t("auth.login.sendButton", "Send sign-in email →")
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("auth.login.noAccount")}{" "}
                  <Link
                    to={
                      highlightRegister
                        ? `/register?email=${encodeURIComponent(email)}`
                        : "/register"
                    }
                    className={cn(
                      "text-primary font-medium hover:underline",
                      highlightRegister && "marker px-1 font-semibold text-foreground"
                    )}
                  >
                    {errorKind === "signupUnfinished"
                      ? t("auth.errors.finishSignup", "Finish signing up")
                      : t("auth.login.createOne")}
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
