import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";

interface Props {
  /** ISO timestamp from demo_workspaces.expires_at. */
  expiresAt: string | null | undefined;
}

function minutesLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000),
  );
}

/**
 * Always-visible advisory on "Try a live demo" workspaces: counts down to
 * the purge deadline and offers the way out. The CTA logs the demo session
 * out first (clears tokens + query cache) — a plain link to /login would
 * bounce straight back because the visitor is still authenticated.
 * Rendered by _dashboard-layout instead of TrialBanner (demo workspaces are
 * status "trial", so both would match otherwise).
 */
export function DemoBanner({ expiresAt }: Props) {
  const { t } = useTranslation();
  const { logout } = useAuthContext();
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? minutesLeft(expiresAt) : null,
  );

  useEffect(() => {
    if (!expiresAt) return;
    setRemaining(minutesLeft(expiresAt));
    const interval = setInterval(
      () => setRemaining(minutesLeft(expiresAt)),
      60_000,
    );
    return () => clearInterval(interval);
  }, [expiresAt]);

  const expired = remaining !== null && remaining <= 0;
  const timeLabel =
    remaining === null
      ? null
      : remaining >= 60
        ? t("demo.banner.hoursMinutes", {
            hours: Math.floor(remaining / 60),
            minutes: remaining % 60,
          })
        : t("demo.banner.minutes", { minutes: remaining });

  const exitLink = (
    <button
      key="link"
      type="button"
      onClick={() => logout()}
      className="underline font-semibold hover:no-underline"
    />
  );

  return (
    <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-amber-900 dark:text-amber-200">
      <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300 shrink-0">
        <FlaskConical className="w-4 h-4" />
      </span>
      <p className="text-sm flex-1">
        {expired ? (
          <Trans i18nKey="demo.banner.expired" components={[exitLink]} />
        ) : (
          <Trans
            i18nKey="demo.banner.message"
            values={{ time: timeLabel ?? "" }}
            components={[exitLink]}
          />
        )}
      </p>
    </div>
  );
}
