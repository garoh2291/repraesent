import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { calendarKeyFor, type BaikalConfig, type CalendarAccount } from "~/lib/api/calendar";
import type { SalesHost } from "~/lib/api/root-onboarding";
import type { WorkspaceMemberOption } from "~/lib/hooks/useWorkspaceMembers";
import { MemberPicker, NO_MEMBER, memberLabel } from "~/components/molecule/member-picker";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

/** Calendars a member connected that calls can be written to. */
export function calendarsOf(
  userId: string | undefined,
  accounts: CalendarAccount[],
  baikal: BaikalConfig[],
): Array<{ key: string; label: string; sub: string; broken: boolean }> {
  if (!userId) return [];
  const out: Array<{ key: string; label: string; sub: string; broken: boolean }> = [];
  for (const account of accounts) {
    if (account.user_id !== userId) continue;
    const usable =
      account.provider === "caldav"
        ? account.calendars
        : account.calendars.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");
    for (const c of usable) {
      out.push({
        key: calendarKeyFor(account, c.id),
        label: c.summary || c.id,
        sub: account.google_email || account.display_name,
        broken: account.auth_failed,
      });
    }
  }
  for (const b of baikal) {
    if (b.user_id !== userId) continue;
    out.push({ key: `baikal:${b.id}`, label: b.provider_name || "Booking calendar", sub: b.provider_email ?? "Baikal", broken: false });
  }
  return out;
}

/** A host chosen for `member` — their first usable calendar pre-selected. */
export function hostForMember(member: WorkspaceMemberOption, accounts: CalendarAccount[], baikal: BaikalConfig[]): SalesHost {
  const first = calendarsOf(member.user_id, accounts, baikal)[0];
  return {
    userId: member.user_id,
    targetKey: first?.key ?? "",
    label: memberLabel(member),
    avatarUrl: member.user_avatar_thumb_url ?? member.user_avatar_url ?? undefined,
  };
}

/**
 * One person + the calendar their calls are written to. Used for the sales
 * team (per region) and for a workspace's support person. `calendarOptional`:
 * a person without a calendar is fine (they answer messages only).
 */
export function HostRow({
  host,
  members,
  accounts,
  baikal,
  onChange,
  onRemove,
  calendarOptional = false,
}: {
  host: SalesHost;
  members: WorkspaceMemberOption[];
  accounts: CalendarAccount[];
  baikal: BaikalConfig[];
  onChange: (host: SalesHost) => void;
  onRemove?: () => void;
  calendarOptional?: boolean;
}) {
  const { t } = useTranslation();
  const cals = calendarsOf(host.userId, accounts, baikal);
  const current = cals.find((c) => c.key === host.targetKey);
  const setMember = (id: string) => {
    const member = id === NO_MEMBER ? null : members.find((m) => m.user_id === id);
    onChange(member ? hostForMember(member, accounts, baikal) : { targetKey: "", userId: "" });
  };
  return (
    <div
      className={
        onRemove
          ? "grid grid-cols-1 gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
          : "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center"
      }
    >
      <MemberPicker
        members={members}
        value={host.userId || undefined}
        placeholder={t("settings.onboarding.pickPerson")}
        searchPlaceholder={t("settings.onboarding.searchPeople")}
        emptyText={t("settings.onboarding.noPeople")}
        noneLabel={t("settings.onboarding.nobody")}
        onChange={setMember}
      />
      {host.userId && cals.length === 0 ? (
        <p className={`flex items-center gap-1.5 px-1 text-xs ${calendarOptional ? "text-muted-foreground" : "text-destructive"}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {calendarOptional ? t("settings.support.noCalendarMessagesOnly") : t("settings.onboarding.noCalendar")}{" "}
            <Link to="/settings/calendars" className="underline">
              {t("settings.onboarding.connectCalendar")}
            </Link>
          </span>
        </p>
      ) : (
        <Select
          value={host.targetKey || undefined}
          disabled={!host.userId}
          onValueChange={(key) => onChange({ ...host, targetKey: key })}
        >
          <SelectTrigger className="h-9 w-full min-w-0 text-sm">
            <SelectValue placeholder={t("settings.onboarding.pickCalendar")} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[min(26rem,90vw)]">
            {cals.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{c.label}</span>
                  {c.sub && c.sub !== c.label ? <span className="truncate text-[11px] text-muted-foreground">{c.sub}</span> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {onRemove ? (
        <Button type="button" variant="ghost" size="icon" className="justify-self-end" aria-label={t("settings.onboarding.removePerson")} onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}
      {current?.broken ? (
        <p className="flex items-center gap-1.5 px-1 text-xs text-destructive sm:col-span-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("settings.onboarding.calendarBroken")}
        </p>
      ) : null}
    </div>
  );
}
