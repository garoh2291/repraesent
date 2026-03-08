import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
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
  updateAppointmentConfig,
  uploadAppointmentLogo,
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

const TIME_FORMATS = [
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour" },
];

const FIRST_WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

interface GeneralSettingsTabProps {
  config: AppointmentConfig;
}

export function GeneralSettingsTab({ config }: GeneralSettingsTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(config.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(config.company_email ?? "");
  const [companyLink, setCompanyLink] = useState(config.company_link ?? "");
  const [companyHeadline, setCompanyHeadline] = useState(
    config.company_headline ?? ""
  );
  const [companyColor, setCompanyColor] = useState(
    config.company_color ?? "#000000"
  );
  const [companyTextColor, setCompanyTextColor] = useState(
    config.company_text_color ?? "#ffffff"
  );
  const [timezone, setTimezone] = useState(config.timezone ?? "UTC");
  const [dateFormat, setDateFormat] = useState(
    config.date_format ?? "YYYY-MM-DD"
  );
  const [timeFormat, setTimeFormat] = useState(config.time_format ?? "24h");
  const [firstWeekday, setFirstWeekday] = useState(
    config.first_weekday ?? "monday"
  );

  const updateMutation = useMutation({
    mutationFn: updateAppointmentConfig,
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["appointment-config"] });
    },
    onError: (error) => {
      toast.error("Failed to save", {
        description: extractErrorMessage(error),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAppointmentLogo,
    onSuccess: (data) => {
      toast.success("Logo uploaded");
      queryClient.invalidateQueries({ queryKey: ["appointment-config"] });
      updateMutation.mutate({ company_logo_url: data.company_logo_url });
    },
    onError: (error) => {
      toast.error("Failed to upload logo", {
        description: extractErrorMessage(error),
      });
    },
  });

  const publicBookingUrl = buildPublicBookingUrl(config.id);
  const logoUrl = getLogoFullUrl(config.company_logo_url);

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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <h3 className="font-medium">Company</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_email">Company Email *</Label>
            <Input
              id="company_email"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_link">Company Link *</Label>
          <Input
            id="company_link"
            type="url"
            value={companyLink}
            onChange={(e) => setCompanyLink(e.target.value)}
            placeholder="https://example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_headline">Company Headline</Label>
          <Textarea
            id="company_headline"
            value={companyHeadline}
            onChange={(e) => setCompanyHeadline(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Company Logo (optional)</Label>
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
                className="h-16 w-16 rounded-md border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                No logo
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_color">Company Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="company_color"
              type="color"
              value={companyColor}
              onChange={(e) => setCompanyColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border p-0"
            />
            <Input
              value={companyColor}
              onChange={(e) => setCompanyColor(e.target.value)}
              className="font-mono w-24"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_text_color">Header Text Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="company_text_color"
              type="color"
              value={companyTextColor}
              onChange={(e) => setCompanyTextColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border p-0"
            />
            <Input
              value={companyTextColor}
              onChange={(e) => setCompanyTextColor(e.target.value)}
              className="font-mono w-24"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Color for header text on booking page (default white)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Localization</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <TimezoneSelect
              value={timezone}
              onChange={(tz) =>
                setTimezone(typeof tz === "string" ? tz : tz.value)
              }
              className="[&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-md [&_.react-select__control]:border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_format">Date format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="date_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time_format">Time format</Label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger id="time_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="first_weekday">First day of week</Label>
            <Select value={firstWeekday} onValueChange={setFirstWeekday}>
              <SelectTrigger id="first_weekday">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIRST_WEEKDAYS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Public Booking Link</h3>
        <div className="flex gap-2">
          <Input readOnly value={publicBookingUrl} className="font-mono text-sm" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(publicBookingUrl);
              toast.success("Link copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
