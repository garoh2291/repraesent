/**
 * The services of an appointment field, in the form builder.
 *
 * A service is something a visitor can book under its own name — "Showroom
 * visit", "Phone call" — and each one fills its own calendar. The name and
 * the description are form content (one per language, translated with the
 * rest); the calendar is picked with the same control a field without
 * services uses, passed in as `renderTarget` so there is one calendar picker
 * in the builder, not two.
 */

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AutoGrowTextarea } from "~/components/forms/AutoGrowTextarea";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { newServiceId } from "~/lib/forms/appointment-services";
import { contentKey, type AppointmentService } from "~/lib/forms/schema";

interface Props {
  fieldId: string;
  services: AppointmentService[];
  disabled?: boolean;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
  onChange: (services: AppointmentService[]) => void;
  /** The calendar picker for one service. */
  renderTarget: (service: AppointmentService, index: number) => ReactNode;
}

export function AppointmentServiceList({
  fieldId,
  services,
  disabled,
  getText,
  setText,
  onChange,
  renderTarget,
}: Props) {
  const { t } = useTranslation();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= services.length) return;
    const next = [...services];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {services.map((service, index) => {
        const nameKey = contentKey.fieldServiceName(fieldId, service.id);
        const descKey = contentKey.fieldServiceDescription(fieldId, service.id);
        const nameId = `fi-svc-name-${service.id}`;
        const descId = `fi-svc-desc-${service.id}`;
        return (
          <div
            key={service.id}
            className="space-y-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("forms.inspector.appointment.services.item", {
                  n: index + 1,
                })}
              </p>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 max-sm:size-11"
                  disabled={disabled || index === 0}
                  aria-label={t("forms.inspector.appointment.services.moveUp")}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 max-sm:size-11"
                  disabled={disabled || index === services.length - 1}
                  aria-label={t("forms.inspector.appointment.services.moveDown")}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 max-sm:size-11"
                  // The last one is removed by switching services off, which
                  // says what happens to the calendar.
                  disabled={disabled || services.length === 1}
                  aria-label={t("forms.inspector.appointment.services.remove")}
                  onClick={() =>
                    onChange(services.filter((s) => s.id !== service.id))
                  }
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={nameId}>
                {t("forms.inspector.appointment.services.name")}
              </Label>
              <Input
                id={nameId}
                disabled={disabled}
                value={getText(nameKey)}
                placeholder={t(
                  "forms.inspector.appointment.services.namePlaceholder",
                )}
                onChange={(e) => setText(nameKey, e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={descId}>
                {t("forms.inspector.appointment.services.description")}
              </Label>
              <AutoGrowTextarea
                id={descId}
                disabled={disabled}
                value={getText(descKey)}
                placeholder={t(
                  "forms.inspector.appointment.services.descriptionPlaceholder",
                )}
                // The same box as the name above it: same fill, same inset.
                className="min-h-9 px-3 py-2 text-sm"
                onChange={(value) => setText(descKey, value)}
              />
            </div>

            {renderTarget(service, index)}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full max-sm:h-11"
        disabled={disabled || services.length >= 12}
        onClick={() =>
          onChange([...services, { id: newServiceId(), targetKey: "" }])
        }
      >
        <Plus className="size-4" aria-hidden />
        {t("forms.inspector.appointment.services.add")}
      </Button>
    </div>
  );
}
