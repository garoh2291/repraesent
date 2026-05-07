import { Trans } from "react-i18next";
import { Sparkles } from "lucide-react";

const FALLBACK_SUPPORT_EMAIL = "support@repraesent.com";

function getSupportEmail(): string {
  return (
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ??
    FALLBACK_SUPPORT_EMAIL
  );
}

interface Props {
  workspaceId: string;
}

/**
 * Always-visible advisory shown on `trial` workspaces (Doorboost-restored).
 * Cannot be dismissed — users must contact support to upgrade.
 */
export function TrialBanner({ workspaceId: _workspaceId }: Props) {
  const supportEmail = getSupportEmail();

  return (
    <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-amber-900 dark:text-amber-200">
      <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300 shrink-0">
        <Sparkles className="w-4 h-4" />
      </span>
      <p className="text-sm flex-1">
        <Trans
          i18nKey="workspace.trial_banner.message"
          values={{ supportEmail }}
          defaults="You're exploring re:praesent on a Doorboost trial — every campaign, lead and note from your Doorboost account is right here. To unlock the full platform, talk to us at <0>{{supportEmail}}</0>."
          components={[
            <a
              key="link"
              href={`mailto:${supportEmail}`}
              className="underline font-semibold hover:no-underline"
            />,
          ]}
        />
      </p>
    </div>
  );
}
