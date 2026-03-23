import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  updateAppointmentConfigById,
  type AppointmentConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";

interface ProviderTabProps {
  config: AppointmentConfig;
}

function SectionPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </Label>
  );
}

export function ProviderTab({ config }: ProviderTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [providerName, setProviderName] = useState(config.provider_name ?? "");
  const [providerEmail, setProviderEmail] = useState(
    config.provider_email ?? ""
  );

  const updateMutation = useMutation({
    mutationFn: (dto: Parameters<typeof updateAppointmentConfigById>[1]) =>
      updateAppointmentConfigById(config.id, dto),
    onSuccess: () => {
      toast.success(t("appointments.provider.saved"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
    },
    onError: (error) => {
      toast.error(t("common.failedToSave"), {
        description: extractErrorMessage(error),
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      provider_name: providerName,
      provider_email: providerEmail,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionPanel
        title={t("appointments.provider.section")}
        description={t("appointments.provider.description")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel htmlFor="provider_name">
              {t("appointments.provider.name")}
            </FieldLabel>
            <Input
              id="provider_name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder={t("appointments.provider.namePlaceholder")}
              className="h-10 text-sm"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="provider_email">
              {t("appointments.provider.email")}
            </FieldLabel>
            <Input
              id="provider_email"
              type="email"
              value={providerEmail}
              onChange={(e) => setProviderEmail(e.target.value)}
              placeholder={t("appointments.provider.emailPlaceholder")}
              className="h-10 text-sm"
            />
          </FieldGroup>
        </div>
      </SectionPanel>

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground text-background text-sm font-medium px-6 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {updateMutation.isPending ? t("common.saving") : t("common.saveChanges")}
      </button>
    </form>
  );
}
