import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  verifyMagicLink,
  getUserContext,
  type UserContextResponse,
} from "~/lib/api/auth";
import {
  setStoredToken,
  setStoredWorkspaceId,
  clearStoredToken,
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
} from "~/lib/api/axios-instance";

export function meta() {
  return [
    { title: "Signing in - Repraesent" },
    { name: "description", content: "Completing sign in" },
  ];
}

export default function AuthCallback() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/login?error=missing_token", { replace: true });
      return;
    }

    const run = async () => {
      try {
        const auth = await verifyMagicLink(token);
        setStoredToken(auth.access_token);
        queryClient.invalidateQueries({ queryKey: ["auth"] });

        const context: UserContextResponse = await getUserContext();

        if (!context.workspaces?.length) {
          navigate("/onboarding/profile", { replace: true });
          return;
        }

        if (context.workspaces.length === 1) {
          const ws = context.workspaces[0];
          setStoredWorkspaceId(ws.id);
          const status = ws.status ?? "active";
          const hasStripeCustomer = !!(ws as { stripe_customer_id?: string | null })
            ?.stripe_customer_id;
          const hasProducts = (ws.products?.length ?? 0) > 0;
          if (status === "pending" && !hasStripeCustomer) {
            navigate("/onboarding/billing", { replace: true });
            return;
          }
          if (status === "pending" && hasStripeCustomer && !hasProducts) {
            navigate("/onboarding/products", { replace: true });
            return;
          }
          navigate("/", { replace: true });
          return;
        }

        if (context.workspaces.length > 1) {
          const stored = getStoredWorkspaceId();
          const hasValidStored = stored && context.workspaces.some((w) => w.id === stored);
          if (hasValidStored) {
            navigate("/", { replace: true });
            return;
          }
          navigate("/auth/workspace-picker", { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch {
        setStatus("error");
        clearStoredToken();
        clearStoredWorkspaceId();
      }
    };

    run();
  }, [searchParams, navigate, queryClient]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] p-8">
        <div className="w-full max-w-sm text-center space-y-6 app-fade-up">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/5 border border-white/10 mx-auto">
            <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white">
              {t("auth.callback.linkExpired")}
            </h1>
            <p className="text-sm text-white/45 leading-relaxed">
              {t("auth.callback.linkExpiredDetail")}
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f11]">
      <div className="flex flex-col items-center gap-5 app-fade-up">
        <div className="relative">
          <div className="h-10 w-10 app-spin rounded-full border-2 border-white/10 border-t-white/50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-white/70">{t("auth.callback.signingIn")}</p>
          <p className="text-xs text-white/30">{t("auth.callback.moment")}</p>
        </div>
      </div>
    </div>
  );
}
