import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import type { BaikalConfig, CalendarAccount } from "~/lib/api/calendar";

const DEFAULT_DOT_COLOR = "#94a3b8";

function SourceRow({
  calendarKey,
  label,
  color,
  checked,
  hasError,
  errorTitle,
  onToggle,
}: {
  calendarKey: string;
  label: string;
  color: string | null;
  checked: boolean;
  hasError: boolean;
  errorTitle: string;
  onToggle: (key: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(calendarKey)}
        className="shrink-0"
      />
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? DEFAULT_DOT_COLOR }}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {label}
      </span>
      {hasError && (
        <TriangleAlert
          className="h-3.5 w-3.5 shrink-0 text-amber-500"
          aria-label={errorTitle}
        >
          <title>{errorTitle}</title>
        </TriangleAlert>
      )}
    </label>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}

function AccountCalendars({
  account,
  subLabel,
  hiddenKeys,
  errorKeys,
  errorTitle,
  onToggle,
}: {
  account: CalendarAccount;
  subLabel: string;
  hiddenKeys: Set<string>;
  errorKeys: Set<string>;
  errorTitle: string;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <p className="px-2 pt-1.5 pb-0.5 text-[11px] text-muted-foreground truncate">
        {subLabel}
      </p>
      {account.calendars.map((cal) => {
        const key = `google:${account.id}:${cal.id}`;
        return (
          <SourceRow
            key={key}
            calendarKey={key}
            label={cal.summary}
            color={cal.backgroundColor}
            checked={!hiddenKeys.has(key)}
            hasError={errorKeys.has(key) || account.auth_failed}
            errorTitle={errorTitle}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}

interface CalendarSourcesPanelProps {
  accounts: CalendarAccount[];
  baikalConfigs: BaikalConfig[];
  hiddenKeys: Set<string>;
  errorKeys: Set<string>;
  onToggle: (key: string) => void;
}

/**
 * The checkbox list of every calendar source on the team Calendar page.
 *
 * Placement is the route's job: it sits in a fixed left column on desktop and
 * inside a Sheet on mobile, so this stays a plain block-level component.
 */
export function CalendarSourcesPanel({
  accounts,
  baikalConfigs,
  hiddenKeys,
  errorKeys,
  onToggle,
}: CalendarSourcesPanelProps) {
  const { t } = useTranslation();
  const errorTitle = t("calendar.sourceError");

  const ownAccounts = accounts.filter((a) => a.is_own);
  const teamAccounts = accounts.filter((a) => !a.is_own);

  return (
    <div className="space-y-0.5">
      {ownAccounts.length > 0 && (
        <>
          <GroupHeader>{t("calendar.myCalendars")}</GroupHeader>
          {ownAccounts.map((account) => (
            <AccountCalendars
              key={account.id}
              account={account}
              subLabel={account.google_email}
              hiddenKeys={hiddenKeys}
              errorKeys={errorKeys}
              errorTitle={errorTitle}
              onToggle={onToggle}
            />
          ))}
        </>
      )}

      {teamAccounts.length > 0 && (
        <>
          <GroupHeader>{t("calendar.teamCalendars")}</GroupHeader>
          {teamAccounts.map((account) => (
            <AccountCalendars
              key={account.id}
              account={account}
              subLabel={`${account.user_name} · ${account.google_email}`}
              hiddenKeys={hiddenKeys}
              errorKeys={errorKeys}
              errorTitle={errorTitle}
              onToggle={onToggle}
            />
          ))}
        </>
      )}

      {baikalConfigs.length > 0 && (
        <>
          <GroupHeader>{t("calendar.bookingCalendars")}</GroupHeader>
          {baikalConfigs.map((config) => {
            const key = `baikal:${config.id}`;
            return (
              <SourceRow
                key={key}
                calendarKey={key}
                label={config.provider_name ?? config.user_name}
                color={config.company_color}
                checked={!hiddenKeys.has(key)}
                hasError={errorKeys.has(key)}
                errorTitle={errorTitle}
                onToggle={onToggle}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
