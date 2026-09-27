import { useEffect, useRef, useState } from "react";
import { clearOnboardingSession } from "~/lib/onboarding/session-draft";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  verifyMagicLink,
  getUserContextWithRetry,
  isAuthRejection,
  MagicLinkError,
  MAGIC_LINK_USED,
  type UserContextResponse,
} from "~/lib/api/auth";
import {
  setStoredToken,
  clearStoredToken,
  clearStoredWorkspaceId,
  getStoredToken,
} from "~/lib/api/axios-instance";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { routeAfterAuth } from "~/lib/auth/route-after-auth";

export function meta() {
  return [
    { title: i18n.t("auth.callback.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("auth.callback.metaDescription") },
  ];
}

export default function AuthCallback() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "auth.callback.metaTitle",
    descriptionKey: "auth.callback.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /** stalled = signed in, but the workspace could not be opened yet (server busy). */
  const [status, setStatus] = useState<"loading" | "error" | "stalled">("loading");
  const [slow, setSlow] = useState(false);
  const retryOpenRef = useRef<(() => void) | null>(null);
  /**
   * Which thing went wrong, so the screen can say it.
   *
   * Every failure used to render "Link expired", including the two that were
   * not expiry — which is why people reported being told a link had expired
   * seconds after receiving it. They were reading the only sentence the page
   * knew how to say.
   */
  const [failure, setFailure] = useState<string | null>(null);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/login?error=missing_token", { replace: true });
      return;
    }

    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    const run = async () => {
      const workspaceParam = searchParams.get("workspace");
      const redirectParam = searchParams.get("redirect");

      // Where to land — shared with the 6-digit code on the login page.
      const route = (context: UserContextResponse) =>
        routeAfterAuth(context, { navigate, queryClient, workspaceParam, redirectParam });

      /**
       * Open the workspace for a session we already hold. Never throws, and
       * never discards the token on a transient failure: the one-time link is
       * spent by now, so dropping the token would strand the user — a demo
       * account has no password to come back with.
       */
      const openWorkspace = async () => {
        try {
          const context: UserContextResponse = await getUserContextWithRetry(undefined, () => setSlow(true));
          route(context);
        } catch (err) {
          if (isAuthRejection(err)) {
            setFailure(null);
            setStatus("error");
            clearStoredToken();
            clearStoredWorkspaceId();
          } else {
            setStatus("stalled");
          }
        }
      };
      retryOpenRef.current = () => {
        setStatus("loading");
        void openWorkspace();
      };

      try {
        const auth = await verifyMagicLink(token);
        setStoredToken(auth.access_token);
        // A fresh sign-in may be a different person than whoever used this tab before
        // (magic link opened while another account was signed in, or a new account after
        // sign-out): drop their onboarding draft and every cached answer.
        clearOnboardingSession();
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
        queryClient.invalidateQueries({ queryKey: ["auth"] });
        await openWorkspace();
      } catch (err) {
        // The code, not the sentence. Substring-matching English in a
        // four-language app only ever worked by accident.
        const code = err instanceof MagicLinkError ? err.code : null;
        const isAlreadyUsed = code === MAGIC_LINK_USED && !!getStoredToken();

        if (isAlreadyUsed) {
          // Token was consumed by a prior render; user is already authenticated
          queryClient.invalidateQueries({ queryKey: ["auth"] });
          await openWorkspace();
          return;
        }

        setFailure(code);
        setStatus("error");
        clearStoredToken();
        clearStoredWorkspaceId();
      } finally {
        // Take the live credential out of the address bar, browser history and
        // document.referrer. Done after the request settles, not before: a
        // remount mid-flight would otherwise find no token and bounce to the
        // login page. React Router does not observe replaceState, so this does
        // not re-run the effect. Same pattern as settings.integrations.tsx.
        if (typeof window !== "undefined") {
          window.history.replaceState(
            window.history.state,
            "",
            window.location.pathname,
          );
        }
      }
    };

    run();
  }, [searchParams, navigate, queryClient]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-8">
        <div className="w-full max-w-sm text-center space-y-6 app-fade-up">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/5 border border-white/10 mx-auto">
            <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white">
              {t(
                `auth.callback.failure.${failure ?? "fallback"}.title`,
                { defaultValue: t("auth.callback.linkExpired") },
              )}
            </h1>
            <p className="text-sm text-white/45 leading-relaxed">
              {t(
                `auth.callback.failure.${failure ?? "fallback"}.detail`,
                { defaultValue: t("auth.callback.linkExpiredDetail") },
              )}
            </p>
          </div>
          <a
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 bg-white/8 px-6 text-sm font-medium text-white/80 hover:bg-white/12 hover:text-white transition-all duration-150"
          >
            {t("auth.callback.backToSignIn")}
          </a>
        </div>
      </div>
    );
  }

  if (status === "stalled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-8">
        <div className="w-full max-w-sm text-center space-y-6 app-fade-up">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white">{t("auth.callback.stalledTitle", "Taking longer than usual")}</h1>
            <p className="text-sm text-white/45 leading-relaxed">
              {t("auth.callback.stalledDetail", "You're signed in — the server is busy and couldn't open your workspace just now.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => retryOpenRef.current?.()}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-[#141516] hover:bg-white/90 transition-all duration-150"
          >
            {t("auth.callback.tryAgain", "Try again")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] pt-safe">
      <div className="flex flex-col items-center gap-5 app-fade-up">
        <div className="relative">
          <div className="h-10 w-10 app-spin rounded-full border-2 border-white/10 border-t-white/50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-white/70">{t("auth.callback.signingIn")}</p>
          <p className="text-xs text-white/30">
            {slow ? t("auth.callback.slow", "Opening your workspace — the server is busy, still trying…") : t("auth.callback.moment")}
          </p>
        </div>
      </div>
    </div>
  );
}
