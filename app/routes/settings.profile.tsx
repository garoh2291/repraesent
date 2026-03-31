import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { updateOnboardingProfile } from "~/lib/api/onboarding";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";

export function meta() {
  return [
    { title: `${i18n.t("settings.profile.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.profile.metaDescription"),
    },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function SettingsSection({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <SectionLabel>{label}</SectionLabel>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>;

function createProfileSchema(t: (key: string) => string) {
  return z.object({
    first_name: z
      .string()
      .refine((s) => s.trim().length > 0, {
        message: t("settings.profile.required"),
      }),
    last_name: z
      .string()
      .refine((s) => s.trim().length > 0, {
        message: t("settings.profile.required"),
      }),
  });
}

export default function SettingsProfile() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const profileSchema = useMemo(() => createProfileSchema(t), [t]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset({
      first_name: user?.first_name?.trim() ?? "",
      last_name: user?.last_name?.trim() ?? "",
    });
  }, [user?.first_name, user?.last_name, form]);

  const saveMutation = useMutation({
    mutationFn: (data: { first_name: string; last_name: string }) =>
      updateOnboardingProfile(data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      toast.success(t("settings.profile.saved"));
      form.reset({
        first_name: variables.first_name,
        last_name: variables.last_name,
      });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      <SettingsSection
        label={t("settings.profile.sectionTitle")}
        description={t("settings.profile.sectionDescription")}
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutate({
                first_name: values.first_name.trim(),
                last_name: values.last_name.trim(),
              })
            )}
            className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("settings.profile.firstName")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("onboarding.profile.placeholderFirstName")}
                        autoComplete="given-name"
                        disabled={saveMutation.isPending}
                        className="h-10 bg-background border-border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("settings.profile.lastName")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("onboarding.profile.placeholderLastName")}
                        autoComplete="family-name"
                        disabled={saveMutation.isPending}
                        className="h-10 bg-background border-border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={
                  saveMutation.isPending || !form.formState.isDirty
                }
                className="h-10 px-6 bg-foreground text-background hover:bg-foreground/90 hover:text-background transition-colors"
              >
                {saveMutation.isPending
                  ? t("common.saving")
                  : t("settings.profile.save")}
              </Button>
            </div>
          </form>
        </Form>
      </SettingsSection>
    </div>
  );
}
