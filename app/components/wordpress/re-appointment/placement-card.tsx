import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2, MousePointerClick, Trash2 } from "lucide-react";
import { useReAppointmentPickerUrl } from "~/lib/hooks/useWorkspaceReAppointment";
import type {
  ReAppointmentButtonConfig,
  ReAppointmentSlot,
  ReAppointmentTarget,
  ReAppointmentTargetPosition,
} from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { TARGET_POSITIONS, type SetConfig } from "./constants";
import { CardHeader, Field, FieldHint, SectionCard } from "~/components/wordpress/fields";
import {
  LivePlacementPicker,
  type PickerFailure,
} from "./live-placement-picker";

export function PlacementCard({
  draft,
  slots,
  onSet,
  buttonId,
}: {
  draft: ReAppointmentButtonConfig;
  slots: ReAppointmentSlot[];
  onSet: SetConfig;
  buttonId: number | null;
}) {
  const { t } = useTranslation();
  const { pluginUuid } = useParams<{ pluginUuid: string }>();

  // The live picker loads the customer's own front end in an iframe via a
  // short-lived signed URL — no WordPress login. It falls back to the manual
  // list below when the site isn't SSO-connected (or the request fails).
  const pickerQuery = useReAppointmentPickerUrl(pluginUuid, buttonId ?? 0, true);
  const pickerUrl = pickerQuery.data?.picker_url ?? null;
  const [pickMode, setPickMode] = useState(false);

  // The live iframe only works when the customer's site runs a plugin version
  // that speaks the picker protocol and can be framed. If it never signals
  // "ready", fall back to the manual list so the tab is never stuck loading.
  const [pickerFailure, setPickerFailure] = useState<PickerFailure | null>(null);
  useEffect(() => {
    setPickerFailure(null);
  }, [pickerUrl]);

  const showLivePicker = Boolean(pickerUrl) && !pickerFailure;

  // The fallback is otherwise indistinguishable from "this site has no live
  // preview", which hides real breakage (an out-of-date plugin, framing blocked
  // upstream). Leave a breadcrumb naming the URL that went quiet.
  const handlePickerUnavailable = useCallback(
    (reason: PickerFailure) => {
      console.warn(
        `[re:appointment] Live placement picker unavailable (${reason}): ${pickerUrl}. ` +
          "The framed site never sent `reappt-picker-ready` — check that it runs " +
          "re:appointment ≥ 1.3.0 and that the frame isn't blocked.",
      );
      setPickerFailure(reason);
    },
    [pickerUrl],
  );

  const slotLabels = useMemo(
    () => new Map(slots.map((s) => [s.key, s.label])),
    [slots],
  );

  const groups = useMemo(() => {
    const out = new Map<string, ReAppointmentSlot[]>();
    for (const slot of slots) {
      const list = out.get(slot.group) ?? [];
      list.push(slot);
      out.set(slot.group, list);
    }
    return [...out.entries()];
  }, [slots]);

  const readout =
    draft.placement_slots
      .map((k) => slotLabels.get(k))
      .filter(Boolean)
      .join(", ") ||
    t("wordpress.reAppointment.shortcodeOnly", "Shortcode only");

  function toggleSlot(key: string) {
    onSet(
      "placement_slots",
      draft.placement_slots.includes(key)
        ? draft.placement_slots.filter((s) => s !== key)
        : [...draft.placement_slots, key],
    );
  }

  function updateTarget(idx: number, patch: Partial<ReAppointmentTarget>) {
    onSet(
      "placement_targets",
      draft.placement_targets.map((it, i) =>
        i === idx ? { ...it, ...patch } : it,
      ),
    );
  }

  // A custom element was clicked in the live picker: append it and leave pick
  // mode (one pick per click, matching the WordPress admin picker).
  function handlePickTarget(target: ReAppointmentTarget) {
    if (
      draft.placement_targets.some(
        (it) => it.sel === target.sel && it.pos === target.pos,
      )
    ) {
      setPickMode(false);
      return;
    }
    onSet("placement_targets", [...draft.placement_targets, target]);
    setPickMode(false);
  }

  const mobilePositions: {
    key: ReAppointmentButtonConfig["mobile_position"];
    label: string;
  }[] = [
    {
      key: "left",
      label: t(
        "wordpress.reAppointment.mobileLeft",
        "Left — after the menu button",
      ),
    },
    {
      key: "center",
      label: t("wordpress.reAppointment.mobileCenter", "Center"),
    },
    {
      key: "right",
      label: t(
        "wordpress.reAppointment.mobileRight",
        "Right — next to the logo",
      ),
    },
  ];

  const visibilities: {
    key: ReAppointmentButtonConfig["placement_visibility"];
    label: string;
  }[] = [
    { key: "all", label: t("wordpress.reAppointment.visAll", "All pages") },
    {
      key: "homepage",
      label: t("wordpress.reAppointment.visHome", "Homepage only"),
    },
  ];

  return (
    <SectionCard>
      <CardHeader
        title={t("wordpress.reAppointment.tabPlacement", "Placement")}
        subtitle={t(
          "wordpress.reAppointment.placementSubtitle",
          "Drop this button into your header or footer — no shortcode needed. You can pick more than one spot; each spot holds one button.",
        )}
      />
      <div className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(
                "wordpress.reAppointment.selectedPositions",
                "Selected positions",
              )}
            </p>
            <p className="mt-1 truncate text-sm font-medium">{readout}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onSet("placement_slots", [])}
          >
            {t("wordpress.reAppointment.clearPositions", "Clear all positions")}
          </Button>
        </div>

        {pickerQuery.isPending ? (
          <div className="flex h-24 items-center justify-center gap-2 rounded-xl border bg-muted/30 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "wordpress.reAppointment.pickerLoading",
              "Loading the live preview of your site…",
            )}
          </div>
        ) : showLivePicker && pickerUrl ? (
          <LivePlacementPicker
            key={pickerUrl}
            pickerUrl={pickerUrl}
            selectedSlots={draft.placement_slots}
            onSlotsChange={(next) => onSet("placement_slots", next)}
            onPickTarget={handlePickTarget}
            onUnavailable={handlePickerUnavailable}
            pickMode={pickMode}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pickerFailure
                ? t(
                    "wordpress.reAppointment.pickerFailed",
                    "The live preview loaded but never connected — this site is probably running an older re:appointment plugin. Choose positions from the list below.",
                  )
                : t(
                    "wordpress.reAppointment.pickerUnavailable",
                    "Live preview isn’t available for this site yet — choose positions from the list below.",
                  )}
            </p>
            {groups.map(([group, groupSlots]) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groupSlots.map((slot) => {
                    const checked = draft.placement_slots.includes(slot.key);
                    const slotId = `slot-${slot.key}`;
                    return (
                      <label
                        key={slot.key}
                        htmlFor={slotId}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-primary/40 bg-primary/5"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          id={slotId}
                          checked={checked}
                          onCheckedChange={() => toggleSlot(slot.key)}
                        />
                        <span>{slot.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <div className="space-y-4 border-t pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {t(
                  "wordpress.reAppointment.customTitle",
                  "Custom positions — works on any theme",
                )}
              </p>
              <FieldHint>
                {t(
                  "wordpress.reAppointment.customHint",
                  "No header/footer spots needed. Give a CSS selector from your site and the button is dropped next to it. Great when the plugin runs on a theme without built-in positions.",
                )}
              </FieldHint>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {showLivePicker ? (
                <Button
                  type="button"
                  variant={pickMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPickMode((on) => !on)}
                >
                  <MousePointerClick className="h-4 w-4" />
                  {pickMode
                    ? t(
                        "wordpress.reAppointment.pickActive",
                        "Click an element in the preview…",
                      )
                    : t(
                        "wordpress.reAppointment.pickCustom",
                        "Pick a custom spot",
                      )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onSet("placement_targets", [
                    ...draft.placement_targets,
                    { sel: "", pos: "after" },
                  ])
                }
              >
                {t("wordpress.reAppointment.addCustom", "Add a custom spot")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {draft.placement_targets.map((target, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  type="text"
                  className="min-w-0 flex-1 font-mono text-sm"
                  value={target.sel}
                  placeholder=".site-header .nav"
                  onChange={(e) => updateTarget(idx, { sel: e.target.value })}
                />
                <NativeSelect
                  className="w-full sm:w-36"
                  value={target.pos}
                  onChange={(e) =>
                    updateTarget(idx, {
                      pos: e.target.value as ReAppointmentTargetPosition,
                    })
                  }
                >
                  {TARGET_POSITIONS.map((pos) => (
                    <NativeSelectOption key={pos} value={pos}>
                      {pos}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("wordpress.reAppointment.removeTarget", "Remove")}
                  onClick={() =>
                    onSet(
                      "placement_targets",
                      draft.placement_targets.filter((_, i) => i !== idx),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {draft.placement_targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reAppointment.noTargets",
                "No custom positions yet.",
              )}
            </p>
          ) : null}
        </div>

        <div className="space-y-5 border-t pt-6">
          <Field>
            <Label>
              {t("wordpress.reAppointment.mobilePosition", "Mobile position")}
            </Label>
            <RadioGroup
              value={draft.mobile_position}
              onValueChange={(v) =>
                onSet(
                  "mobile_position",
                  v as ReAppointmentButtonConfig["mobile_position"],
                )
              }
              className="grid gap-2"
            >
              {mobilePositions.map((it) => (
                <label
                  key={it.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    draft.mobile_position === it.key
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={it.key} />
                  <span>{it.label}</span>
                </label>
              ))}
            </RadioGroup>
            <FieldHint>
              {t(
                "wordpress.reAppointment.mobileHint",
                "Where the button sits in the mobile header bar. Only applies when placed in the “mobile area” slot.",
              )}
            </FieldHint>
          </Field>

          <Field>
            <Label>{t("wordpress.reAppointment.showOn", "Show on")}</Label>
            <RadioGroup
              value={draft.placement_visibility}
              onValueChange={(v) =>
                onSet(
                  "placement_visibility",
                  v as ReAppointmentButtonConfig["placement_visibility"],
                )
              }
              className="grid gap-2 sm:grid-cols-2"
            >
              {visibilities.map((it) => (
                <label
                  key={it.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    draft.placement_visibility === it.key
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={it.key} />
                  <span>{it.label}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}
