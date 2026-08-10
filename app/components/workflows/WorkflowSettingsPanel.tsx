import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { SUPPORTED_LOCALES } from "~/i18n/locales";
import {
  deleteWorkflow,
  updateWorkflow,
  type CatalogField,
  type ConditionGroup,
  type SendWindow,
  type WorkflowDetail,
} from "~/lib/api/workflows";
import { ConditionBuilder } from "./ConditionBuilder";

/** A short, curated list — a full IANA picker is noise for this decision. */
const TIMEZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Europe/London",
  "UTC",
];

const DEFAULT_WINDOW: SendWindow = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
};

export function WorkflowSettingsPanel({
  workflow,
  fields,
  disabled,
  onSaved,
  onDeleted,
}: {
  workflow: WorkflowDetail;
  fields: CatalogField[];
  disabled?: boolean;
  onSaved: () => Promise<void> | void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(workflow.description ?? "");
  const [reentry, setReentry] = useState(workflow.reentry);
  const [timezone, setTimezone] = useState(workflow.timezone);
  const [defaultLocale, setDefaultLocale] = useState(workflow.default_locale);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exit, setExit] = useState<ConditionGroup>(
    workflow.exit_conditions ?? { match: "any", conditions: [] },
  );
  const [window, setWindow] = useState<SendWindow>(
    workflow.send_window ?? DEFAULT_WINDOW,
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      updateWorkflow(workflow.id, {
        description,
        reentry,
        timezone,
        default_locale: defaultLocale,
        // An empty group would evaluate to TRUE and cancel every run the
        // instant anything changed, so store null rather than an empty shell.
        exit_conditions:
          exit.conditions.length || exit.groups?.length ? exit : null,
        send_window: window,
      }),
    onSuccess: async () => {
      await onSaved();
      toast.success(t("workflows.saved"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(workflow.id),
    onSuccess: () => {
      toast.success(t("workflows.deleted"));
      onDeleted();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Field>
          <Label htmlFor="wf-desc">{t("workflows.settings.description")}</Label>
          <Textarea
            id="wf-desc"
            rows={2}
            disabled={disabled}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <Label>{t("workflows.settings.reentry")}</Label>
            <Select
              value={reentry}
              disabled={disabled}
              onValueChange={(v) => setReentry(v as "block" | "allow")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">
                  {t("workflows.settings.reentryBlock")}
                </SelectItem>
                <SelectItem value="allow">
                  {t("workflows.settings.reentryAllow")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldHint>{t("workflows.settings.reentryHint")}</FieldHint>
          </Field>

          <Field>
            <Label>{t("workflows.settings.timezone")}</Label>
            <Select value={timezone} disabled={disabled} onValueChange={setTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <Label>{t("workflows.settings.defaultLocale")}</Label>
            <Select
              value={defaultLocale}
              disabled={disabled}
              onValueChange={setDefaultLocale}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHint>{t("workflows.settings.defaultLocaleHint")}</FieldHint>
          </Field>
        </div>

        {!disabled ? (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {saveMutation.isPending ? t("common.saving") : t("workflows.save")}
          </Button>
        ) : null}
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("workflows.settings.exitTitle")}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("workflows.settings.exitHint")}
          </p>
        </div>
        <ConditionBuilder
          group={exit}
          fields={fields}
          disabled={disabled}
          onChange={setExit}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("workflows.settings.windowTitle")}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("workflows.settings.windowHint")}
            </p>
          </div>
          <Switch
            checked={window.enabled}
            disabled={disabled}
            aria-label={t("workflows.settings.windowOn")}
            onCheckedChange={(enabled) => setWindow({ ...window, enabled })}
          />
        </div>

        {window.enabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const on = window.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setWindow({
                        ...window,
                        days: on
                          ? window.days.filter((d) => d !== day)
                          : [...window.days, day].sort(),
                      })
                    }
                    className={`h-8 w-11 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(`workflows.weekday.${day}`)}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("workflows.settings.from")}
              </span>
              <Input
                type="time"
                disabled={disabled}
                value={window.start}
                onChange={(e) => setWindow({ ...window, start: e.target.value })}
                className="h-9 w-32"
              />
              <span className="text-muted-foreground">
                {t("workflows.settings.to")}
              </span>
              <Input
                type="time"
                disabled={disabled}
                value={window.end}
                onChange={(e) => setWindow({ ...window, end: e.target.value })}
                className="h-9 w-32"
              />
              <span className="text-xs text-muted-foreground">{timezone}</span>
            </div>
          </div>
        ) : null}
      </section>

      {!disabled ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{t("workflows.settings.dangerTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("workflows.settings.dangerHint")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("workflows.settings.delete")}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workflows.settings.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflows.settings.deleteBody", { name: workflow.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending
                ? t("common.saving")
                : t("workflows.settings.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
