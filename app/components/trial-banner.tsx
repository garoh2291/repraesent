import { Trans } from "react-i18next";
import { Link } from "react-router";
import { Sparkles } from "lucide-react";

interface Props {
  workspaceId: string;
}

/**
 * Always-visible advisory shown on workspaces restored from Doorboost.
 * The Doorboost data is free to use forever; the link points users to the
 * products page where they can see what extra modules they can unlock.
 */
export function TrialBanner({ workspaceId: _workspaceId }: Props) {
  return (
    <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-amber-900 dark:text-amber-200">
      <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300 shrink-0">
        <Sparkles className="w-4 h-4" />
      </span>
      <p className="text-sm flex-1">
        <Trans
          i18nKey="workspace.trial_banner.message"
          components={[
            <Link
              key="link"
              to="/billing"
              className="underline font-semibold hover:no-underline"
            />,
          ]}
        />
      </p>
    </div>
  );
}
