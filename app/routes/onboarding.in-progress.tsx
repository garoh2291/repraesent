import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Hourglass } from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { OnbLanguageSwitcher, OnboardingStyles } from "~/components/onboarding-v2/shell";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

/**
 * Someone else (the person who signed up) is still setting this workspace up,
 * or this member can't — e.g. an invitee who arrives before it's finished.
 * Never a dead end: switch workspace or sign out.
 */
export default function OnboardingInProgressRoute() {
  const { t } = useTranslation();
  const { currentWorkspace, workspaces, logout } = useAuthContext();
  useDocumentMeta({ titleKey: "onb.inProgress.title", descriptionKey: "onb.inProgress.sub", titleSuffix: " - re:praesent" });

  return (
    <div className="min-h-dvh bg-background pt-safe">
      <OnboardingStyles />
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <img src={logoUrl} alt="re:praesent" className="h-6 w-auto" />
        <OnbLanguageSwitcher />
      </div>
      <main className="mx-auto max-w-xl px-5 pt-16 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary/40 text-foreground">
          <Hourglass className="size-6" />
        </span>
        <h1 className="ob2-heading mt-6 text-balance text-3xl leading-tight tracking-[-0.02em]">
          {t("onb.inProgress.title", { name: currentWorkspace?.name ?? "" })}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("onb.inProgress.sub")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {(workspaces?.length ?? 0) > 1 ? (
            <Link to="/auth/workspace-picker" className="inline-flex h-10 items-center rounded-lg bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 active:scale-[0.97]">
              {t("onb.switchWorkspace")}
            </Link>
          ) : null}
          <button type="button" onClick={() => logout()} className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:border-foreground/25 active:scale-[0.97]">
            {t("onb.signOut")}
          </button>
        </div>
      </main>
    </div>
  );
}
