import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import { MicrosoftIcon } from "~/components/icons/MicrosoftIcon";
import { Checkbox } from "~/components/ui/checkbox";
import {
  calendarKeyFor,
  type BaikalConfig,
  type CalendarAccount,
} from "~/lib/api/calendar";

/**
 * Which calendars block a slot, beyond the ones being booked.
 *
 * The host calendars are shown here too, checked and uninteractive. They are
 * NOT stored in `busyCalendarKeys` — the availability engine unions the write
 * targets into the busy sources itself (`resolveSources`), so writing them here
 * would duplicate a fact the server already enforces and would go stale the
 * moment a host is swapped. Deriving the locked state from the host list costs
 * nothing and cannot drift.
 *
 * A locked row has no change handler at all rather than one that refuses: a
 * control that ignores a click is worse than one that plainly cannot be
 * clicked.
 */
export function BusyCalendarPicker({
  accounts,
  baikalConfigs,
  busyKeys,
  lockedKeys,
  disabled,
  onToggle,
}: {
  accounts: CalendarAccount[];
  baikalConfigs: BaikalConfig[];
  busyKeys: string[];
  /** Host calendars — always busy, never written to `busyCalendarKeys`. */
  lockedKeys: Set<string>;
  disabled?: boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5 pt-1">
      {accounts.flatMap((a) =>
        a.calendars.map((c) => {
          // calendarKeyFor percent-encodes caldav calendar URLs — these keys
          // are stored in the form definition and parsed server-side.
          //
          // Plain string equality against a host's targetKey is enough HERE,
          // and only here: both sides are produced by calendarKeyFor, and the
          // one other path (a legacy accountId/calendarId pair rendered as
          // `google:acc:cal`) is unencoded and matches exactly. Importing the
          // backend's identity function would ship a second key parser to the
          // browser — the precise drift appointment-target.util.ts exists to end.
          const key = calendarKeyFor(a, c.id);
          return (
            <CalendarRow
              key={key}
              // Ordered like the target picker — the distinguishing token
              // first, so one calendar reads the same in both lists.
              label={`${c.summary} · ${a.google_email || a.user_name}`}
              provider={a.provider}
              authFailed={a.auth_failed}
              locked={lockedKeys.has(key)}
              checked={lockedKeys.has(key) || busyKeys.includes(key)}
              disabled={disabled}
              lockedHint={t("forms.inspector.appointment.hostAlwaysBusy")}
              reconnectHint={t(
                "forms.inspector.appointment.accountNeedsReconnect",
              )}
              onToggle={(v) => onToggle(key, v)}
            />
          );
        }),
      )}
      {baikalConfigs.map((b) => {
        const key = `baikal:${b.id}`;
        return (
          <CalendarRow
            key={key}
            label={b.provider_name ?? b.user_name}
            provider="caldav"
            // Admin-provisioned; there is no grant to break.
            authFailed={false}
            locked={lockedKeys.has(key)}
            checked={lockedKeys.has(key) || busyKeys.includes(key)}
            disabled={disabled}
            lockedHint={t("forms.inspector.appointment.hostAlwaysBusy")}
            reconnectHint=""
            onToggle={(v) => onToggle(key, v)}
          />
        );
      })}
    </div>
  );
}

function CalendarRow({
  label,
  provider,
  authFailed,
  locked,
  checked,
  disabled,
  lockedHint,
  reconnectHint,
  onToggle,
}: {
  label: string;
  provider: CalendarAccount["provider"];
  authFailed: boolean;
  locked: boolean;
  checked: boolean;
  disabled?: boolean;
  lockedHint: string;
  reconnectHint: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox
        disabled={disabled || locked}
        checked={checked}
        // No handler at all when locked — see the note on the component.
        onCheckedChange={locked ? undefined : (v) => onToggle(v === true)}
      />
      {/* A calendar name and colour alone cannot tell a Google calendar from a
          CalDAV one, and this list has no other marker. */}
      {provider === "google" ? <GoogleIcon className="h-3 w-3 shrink-0" /> : null}
      {provider === "microsoft" ? (
        <MicrosoftIcon className="h-3 w-3 shrink-0" />
      ) : null}
      {provider === "caldav" ? <CalDavIcon className="h-3 w-3 shrink-0" /> : null}
      <span className="min-w-0 truncate">
        {label}
        {locked ? (
          <span className="text-muted-foreground"> · {lockedHint}</span>
        ) : null}
      </span>
      {authFailed ? (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {reconnectHint}
        </span>
      ) : null}
    </label>
  );
}
