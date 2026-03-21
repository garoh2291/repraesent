import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import TimezoneSelect from "react-timezone-select";
import {
  updateAppointmentConfigById,
  uploadAppointmentLogoByConfigId,
  type AppointmentConfig,
} from "~/lib/api/appointments";
import { buildPublicBookingUrl, getLogoFullUrl } from "~/lib/config";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Copy, Upload } from "lucide-react";

const DATE_FORMATS = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
];

interface GeneralSettingsTabProps {
  config: AppointmentConfig;
}

function SectionPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </Label>
  );
}

export function GeneralSettingsTab({ config }: GeneralSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(config.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(config.company_email ?? "");
  const [companyLink, setCompanyLink] = useState(config.company_link ?? "");
  const [companyHeadline, setCompanyHeadline] = useState(config.company_headline ?? "");
  const [companyColor, setCompanyColor] = useState(config.company_color ?? "#000000");
  const [companyTextColor, setCompanyTextColor] = useState(config.company_text_color ?? "#ffffff");
  const [timezone, setTimezone] = useState(config.timezone ?? "UTC");
  const [dateFormat, setDateFormat] = useState(config.date_format ?? "YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState(config.time_format ?? "24h");
  const [firstWeekday, setFirstWeekday] = useState(config.first_weekday ?? "monday");

  const updateMutation = useMutation({
    mutationFn: (dto: Parameters<typeof updateAppointmentConfigById>[1]) =>
      updateAppointmentConfigById(config.id, dto),
    onSuccess: () => {
      toast.success(t("appointments.general.settingsSaved"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
    },
    onError: (error) => {
      toast.error(t("common.failedToSave"), { description: extractErrorMessage(error) });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadAppointmentLogoByConfigId(config.id, file),
    onSuccess: (data) => {
      toast.success(t("appointments.general.logoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
      updateMutation.mutate({ company_logo_url: data.company_logo_url });
    },
    onError: (error) => {
      toast.error(t("appointments.general.failedToUploadLogo"), { description: extractErrorMessage(error) });
    },
  });

  const publicBookingUrl = buildPublicBookingUrl(config.id);
  const logoUrl = getLogoFullUrl(config.company_logo_url);

  const TIME_FORMATS = [
    { value: "24h", label: t("appointments.general.timeFormat24h") },
    { value: "12h", label: t("appointments.general.timeFormat12h") },
  ];

  const FIRST_WEEKDAYS = [
    { value: "monday", label: t("appointments.settings.monday") },
    { value: "sunday", label: t("appointments.settings.sunday") },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      company_name: companyName,
      company_email: companyEmail,
      company_link: companyLink,
      company_headline: companyHeadline || undefined,
      company_color: companyColor,
      company_text_color: companyTextColor,
      timezone,
      date_format: dateFormat,
      time_format: timeFormat,
      first_weekday: firstWeekday,
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Company info */}
      <SectionPanel title={t("appointments.general.section")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel htmlFor="company_name">{t("appointments.general.companyName")}</FieldLabel>
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="company_email">{t("appointments.general.companyEmail")}</FieldLabel>
            <Input
              id="company_email"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </FieldGroup>
        </div>
        <FieldGroup>
          <FieldLabel htmlFor="company_link">{t("appointments.general.companyLink")}</FieldLabel>
          <Input
            id="company_link"
            type="url"
            value={companyLink}
            onChange={(e) => setCompanyLink(e.target.value)}
            placeholder="https://example.com"
            required
            className="h-10 text-sm"
          />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel htmlFor="company_headline">{t("appointments.general.headline")}</FieldLabel>
          <Textarea
            id="company_headline"
            value={companyHeadline}
            onChange={(e) => setCompanyHeadline(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
        </FieldGroup>

        {/* Logo */}
        <FieldGroup>
          <FieldLabel>{t("appointments.general.companyLogo")}</FieldLabel>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-14 w-14 rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted text-[10px] font-medium text-muted-foreground">
                {t("appointments.general.noLogo")}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? t("appointments.general.uploading") : t("appointments.general.upload")}
            </button>
          </div>
        </FieldGroup>

        {/* Colors */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel htmlFor="company_color">{t("appointments.general.brandColor")}</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                id="company_color"
                type="color"
                value={companyColor}
                onChange={(e) => setCompanyColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-border p-1"
              />
              <Input
                value={companyColor}
                onChange={(e) => setCompanyColor(e.target.value)}
                className="font-mono text-sm h-10 w-28"
              />
            </div>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="company_text_color">{t("appointments.general.headerTextColor")}</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                id="company_text_color"
                type="color"
                value={companyTextColor}
                onChange={(e) => setCompanyTextColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-border p-1"
              />
              <Input
                value={companyTextColor}
                onChange={(e) => setCompanyTextColor(e.target.value)}
                className="font-mono text-sm h-10 w-28"
              />
            </div>
          </FieldGroup>
        </div>
      </SectionPanel>

      {/* Localization */}
      <SectionPanel title={t("appointments.general.localization")}>
        <FieldGroup>
          <FieldLabel>{t("appointments.timezone")}</FieldLabel>
          <TimezoneSelect
            value={timezone}
            onChange={(tz) => setTimezone(typeof tz === "string" ? tz : tz.value)}
            className="[&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-lg [&_.react-select__control]:border-border [&_.react-select__control]:text-sm"
          />
        </FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldGroup>
            <FieldLabel htmlFor="date_format">{t("appointments.settings.dateFormat")}</FieldLabel>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="date_format" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="time_format">{t("appointments.settings.timeFormat")}</FieldLabel>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger id="time_format" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="first_weekday">{t("appointments.general.weekStartsOn")}</FieldLabel>
            <Select value={firstWeekday} onValueChange={setFirstWeekday}>
              <SelectTrigger id="first_weekday" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIRST_WEEKDAYS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
      </SectionPanel>

      {/* Booking link */}
      <SectionPanel title={t("appointments.general.publicBookingLink")}>
        <FieldGroup>
          <div className="flex gap-2">
            <Input
              readOnly
              value={publicBookingUrl}
              className="font-mono text-sm h-10 flex-1"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicBookingUrl);
                toast.success(t("appointments.general.linkCopied"));
              }}
              className="inline-flex items-center gap-2 h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("common.copy")}
            </button>
          </div>
        </FieldGroup>
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
