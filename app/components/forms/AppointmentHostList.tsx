import { AlertTriangle, GripVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MemberPicker,
  NO_MEMBER,
  memberLabel,
} from "~/components/molecule/member-picker";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BaikalConfig, CalendarAccount } from "~/lib/api/calendar";
import type { WorkspaceMemberOption } from "~/lib/hooks/useWorkspaceMembers";
import type { AppointmentHost } from "~/lib/forms/schema";

/** Booking every host's calendar means N writes and N possible rollbacks. */
export const MAX_APPOINTMENT_HOSTS = 10;

interface Props {
  hosts: AppointmentHost[];
  accounts: CalendarAccount[];
  baikalConfigs: BaikalConfig[];
  members: WorkspaceMemberOption[];
  /**
   * The calendar picker's <SelectItem>s. A function, not a node, so each row
   * can grey out the calendars the OTHER rows already use — booking one
   * calendar twice would double-book one person while telling the visitor they
   * are meeting two.
   */
  calendarItems: (disabledKeys: Set<string>) => React.ReactNode;
  disabled?: boolean;
  onChange: (hosts: AppointmentHost[]) => void;
}

/**
 * The ordered list of calendars an appointment field books.
 *
 * Order IS primacy: `hosts[0]` organises the meeting and is the only host that
 * creates the video link, so it is dragged into place rather than picked with a
 * separate "primary" radio that could disagree with the order shown.
 *
 * Never call `onChange` from outside this component without going through
 * `patchHosts` in FieldInspector — `targetKey` has to keep mirroring
 * `hosts[0].targetKey` or an older backend books nothing.
 */
export function AppointmentHostList({
  hosts,
  accounts,
  baikalConfigs,
  members,
  calendarItems,
  disabled,
  onChange,
}: Props) {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = hosts.findIndex((h) => h.targetKey === active.id);
    const to = hosts.findIndex((h) => h.targetKey === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(hosts, from, to));
  };

  const accountFor = (targetKey: string) =>
    targetKey.startsWith("baikal:")
      ? undefined
      : accounts.find((a) => a.id === targetKey.split(":")[1]);

  /**
   * Re-point a row at a different calendar, keeping whoever hosts it.
   *
   * Nothing is inferred from the calendar account — that is what used to fill
   * in a name the user never chose. The person is picked explicitly and
   * survives a calendar change, because "Diana's other calendar" is still
   * Diana.
   */
  const setTargetAt = (index: number, targetKey: string) => {
    // Unreachable: the picker disables a calendar another row already uses, so
    // onValueChange cannot fire for one. Kept because it is the invariant, not
    // because it is expected to run.
    if (hosts.some((h, i) => i !== index && h.targetKey === targetKey)) return;
    onChange(hosts.map((h, i) => (i === index ? { ...h, targetKey } : h)));
  };

  /** Attach a workspace member to a row, or detach one. */
  const setMemberAt = (index: number, userId: string) => {
    const member =
      userId === NO_MEMBER ? null : members.find((m) => m.user_id === userId);
    onChange(
      hosts.map((h, i) => {
        if (i !== index) return h;
        if (!member) {
          // Detached: booked and blocking time, but no longer shown to anyone.
          const { userId: _u, label: _l, avatarUrl: _a, email: _e, ...rest } = h;
          return rest;
        }
        return {
          ...h,
          userId: member.user_id,
          label: memberLabel(member),
          avatarUrl:
            member.user_avatar_thumb_url ?? member.user_avatar_url ?? undefined,
          // Deliberately NOT member.user_email. That is their login for this
          // workspace, not the mailbox that owns the calendar on this row — and
          // using it as an invite address put a personal address on the guest
          // list while the calendar itself was invited nowhere. The server
          // resolves who to invite from the calendar account. Any address left
          // on an older definition is ignored.
          email: undefined,
        };
      }),
    );
  };

  const addHost = () => {
    // An empty targetKey is not a valid dnd id and would collide with a second
    // empty row, so a new host has to name a calendar immediately. The first
    // calendar not already taken is a better default than nothing.
    //
    // No person is attached: who hosts a calendar is not something we can infer
    // from the calendar, and guessing produced names nobody chose.
    const taken = new Set(hosts.map((h) => h.targetKey));
    const candidate = firstFreeKey(accounts, baikalConfigs, taken);
    if (!candidate) return;
    onChange([...hosts, { targetKey: candidate }]);
  };

  const canAdd =
    hosts.length < MAX_APPOINTMENT_HOSTS &&
    !!firstFreeKey(accounts, baikalConfigs, new Set(hosts.map((h) => h.targetKey)));

  const brokenHosts = hosts.filter((h) => accountFor(h.targetKey)?.auth_failed);

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={hosts.map((h) => h.targetKey)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {hosts.map((host, index) => (
              <HostRow
                key={host.targetKey}
                host={host}
                isPrimary={index === 0}
                authFailed={!!accountFor(host.targetKey)?.auth_failed}
                members={members}
                calendarItems={calendarItems}
                // Every other row's calendar, so this one cannot pick it.
                takenKeys={
                  new Set(
                    hosts.filter((_, i) => i !== index).map((h) => h.targetKey),
                  )
                }
                disabled={disabled}
                canRemove={hosts.length > 1}
                onTargetChange={(key) => setTargetAt(index, key)}
                onMemberChange={(userId) => setMemberAt(index, userId)}
                onRemove={() =>
                  onChange(hosts.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !canAdd}
        onClick={addHost}
        className="w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("forms.inspector.appointment.addHost")}
      </Button>

      {/* The consequence nobody expects, said in the only place it can be
          said. With co-hosts the availability fetch fails CLOSED: rather than
          risk offering a time a host is not actually free at, the form offers
          nothing at all until the calendar is reconnected. */}
      {hosts.length > 1 && brokenHosts.length > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {t("forms.inspector.appointment.coHostDisconnected")}{" "}
            <Link to="/settings/calendars" className="underline">
              {t("forms.inspector.appointment.openCalendarSettings")}
            </Link>
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** First calendar in the workspace that is not already a host, or null. */
function firstFreeKey(
  accounts: CalendarAccount[],
  baikalConfigs: BaikalConfig[],
  taken: Set<string>,
): string | null {
  for (const account of accounts) {
    const usable =
      account.provider === "caldav"
        ? account.calendars
        : account.calendars.filter(
            (c) => c.accessRole === "owner" || c.accessRole === "writer",
          );
    for (const calendar of usable) {
      const key =
        account.provider === "google"
          ? `google:${account.id}:${calendar.id}`
          : `${account.provider}:${account.id}:${encodeURIComponent(calendar.id)}`;
      if (!taken.has(key)) return key;
    }
  }
  for (const config of baikalConfigs) {
    const key = `baikal:${config.id}`;
    if (!taken.has(key)) return key;
  }
  return null;
}

function HostRow({
  host,
  isPrimary,
  authFailed,
  members,
  calendarItems,
  takenKeys,
  disabled,
  canRemove,
  onTargetChange,
  onMemberChange,
  onRemove,
}: {
  host: AppointmentHost;
  isPrimary: boolean;
  authFailed: boolean;
  members: WorkspaceMemberOption[];
  calendarItems: (disabledKeys: Set<string>) => React.ReactNode;
  takenKeys: Set<string>;
  disabled?: boolean;
  canRemove: boolean;
  onTargetChange: (targetKey: string) => void;
  onMemberChange: (userId: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: host.targetKey, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="space-y-1.5 rounded-lg border bg-card p-1.5"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="cursor-grab touch-none p-1 text-muted-foreground/60 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t("forms.inspector.appointment.reorderHost")}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <Select
          disabled={disabled}
          value={host.targetKey}
          onValueChange={onTargetChange}
        >
          <SelectTrigger className="h-8 min-w-0 flex-1 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="max-w-[min(24rem,90vw)]"
          >
            {calendarItems(takenKeys)}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={disabled || !canRemove}
          onClick={onRemove}
          aria-label={t("forms.inspector.appointment.removeHost")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Who the visitor is meeting. Not a text box: a host is a person, and
          the name and picture come from them. Leaving it empty is a real
          choice — the calendar is still booked and still blocks time, the
          visitor is simply never told it exists (a room, a shared inbox). */}
      <div className="flex items-center gap-1.5 pl-7">
        <div className="min-w-0 flex-1">
          <MemberPicker
            members={members}
            value={host.userId}
            disabled={disabled}
            placeholder={t("forms.inspector.appointment.hostNone")}
            searchPlaceholder={t("forms.inspector.appointment.hostSearch")}
            emptyText={t("forms.inspector.appointment.hostEmpty")}
            noneLabel={t("forms.inspector.appointment.hostNone")}
            onChange={onMemberChange}
          />
        </div>
        {isPrimary ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {t("forms.inspector.appointment.primaryHost")}
          </Badge>
        ) : null}
      </div>

      {authFailed ? (
        <p className="flex items-center gap-1.5 pl-7 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("forms.inspector.appointment.accountNeedsReconnect")}
        </p>
      ) : null}
    </div>
  );
}
