"use client";

import { isPossiblePhoneNumber } from "react-phone-number-input";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Laptop, MapPinned, Store } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";
import { CLIENT_TYPES } from "~/lib/client-types";
import { legalFormsFor, PROFILE_ENUMS, suggestEmail } from "~/lib/onboarding/helpers";
import type { FieldSource } from "~/lib/api/onboarding-v2";
import { CountryCombobox } from "../country-combobox";
import { HoursEditor, type Hours } from "../hours-editor";
import {
  ActionBar,
  ChoiceCard,
  ChoiceGroup,
  Field,
  FormError,
  inkSwitchCls,
  Section,
  SelectInput,
  Segmented,
  TagInput,
  TextArea,
  TextInput,
} from "../primitives";
import { useWizard } from "../wizard-context";
import { focusFirstError, mapFieldErrors, useProfileDraft } from "./profile-draft";
import { StepHeading } from "../primitives";

export const DETAIL_PATHS = [
  "identity.display_name",
  "identity.legal_name",
  "identity.legal_form",
  "identity.industry",
  "identity.brand_partner",
  "identity.tagline",
  "identity.description",
  "presence.kind",
  "presence.appointment_only",
  "location.street",
  "location.postal_code",
  "location.city",
  "location.country",
  "contact.phone",
  "contact.email",
  "hours.days",
  "hours.notes",
  "offer.product_categories",
  "offer.brands_carried",
  "offer.services",
  "offer.usps",
  "offer.price_segment",
  "offer.customer_type",
  "legal.register_court",
  "legal.register_number",
  "legal.vat_id",
];

const PRESENCE_ICONS: Record<string, React.ReactNode> = {
  physical: <Store className="size-4" />,
  online: <Laptop className="size-4" />,
  service_area: <MapPinned className="size-4" />,
  hybrid: <Building2 className="size-4" />,
};

/** The editable business-profile fields — shared by the wizard and Settings → Business profile. */
export function ProfileFields({
  draft,
  sources,
  errors,
}: {
  draft: ReturnType<typeof useProfileDraft>;
  sources: Record<string, FieldSource> | undefined;
  errors: Record<string, string>;
}) {
  const { t } = useTranslation();
  const country = (draft.get<string>("location.country") ?? null) as string | null;
  const legalForms = legalFormsFor(country);
  const emailSuggestion = suggestEmail(draft.get<string>("contact.email") ?? "");
  const industries = useMemo(
    () =>
      CLIENT_TYPES.map((k) => {
        const label = t(`clientTypes.${k}`, { count: 1 });
        return { k, label: label.charAt(0).toUpperCase() + label.slice(1) };
      }).sort((a, b) => a.label.localeCompare(b.label)),
    [t],
  );
  const src = (p: string) => sources?.[p] ?? null;
  const err = (p: string) => errors[p] ?? null;
  const str = (p: string) => (draft.get<string>(p) ?? "") as string;

  return (
    <div className="space-y-4">
      <Section title={t("onb.details.about")}>
        <Field label={t("onb.f.display_name")} source={src("identity.display_name")} error={err("identity.display_name")}>
          {(a) => (
            <TextInput id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={str("identity.display_name")} onChange={(e) => draft.set("identity.display_name", e.target.value)} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label={t("onb.f.legal_name")} hint={t("onb.f.legal_name_hint")} optional source={src("identity.legal_name")} error={err("identity.legal_name")}>
            {(a) => (
              <TextInput id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={str("identity.legal_name")} onChange={(e) => draft.set("identity.legal_name", e.target.value)} />
            )}
          </Field>
          <Field label={t("onb.f.legal_form")} optional source={src("identity.legal_form")}>
            {(a) => (
              <SelectInput id={a.id} value={str("identity.legal_form")} onChange={(e) => draft.set("identity.legal_form", e.target.value || null)}>
                <option value="">{t("onb.choose")}</option>
                {[...new Set([...legalForms, str("identity.legal_form")].filter(Boolean))].map((f) => (
                  <option key={f} value={f}>
                    {t(`onb.legalForms.${f}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onb.f.industry")} optional source={src("identity.industry")}>
            {(a) => (
              <SelectInput id={a.id} value={str("identity.industry")} onChange={(e) => draft.set("identity.industry", e.target.value || null)}>
                <option value="">{t("onb.choose")}</option>
                {industries.map((i) => (
                  <option key={i.k} value={i.k}>
                    {i.label}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("onb.f.brand_partner")} hint={t("onb.f.brand_partner_hint")} optional source={src("identity.brand_partner")}>
            {(a) => (
              <TextInput id={a.id} aria-describedby={a.describedBy} value={str("identity.brand_partner")} onChange={(e) => draft.set("identity.brand_partner", e.target.value)} />
            )}
          </Field>
        </div>
        <Field label={t("onb.f.description")} optional source={src("identity.description")}>
          {(a) => (
            <TextArea id={a.id} rows={3} maxLength={2000} value={str("identity.description")} onChange={(e) => draft.set("identity.description", e.target.value)} />
          )}
        </Field>
      </Section>

      <Section title={t("onb.details.how")}>
        <ChoiceGroup label={t("onb.details.how")} columns={2}>
          {PROFILE_ENUMS.presenceKind.map((k) => (
            <ChoiceCard
              key={k}
              selected={draft.get("presence.kind") === k}
              onSelect={() => draft.set("presence.kind", k)}
              icon={PRESENCE_ICONS[k]}
              title={t(`onb.presence.${k}.title`)}
              description={t(`onb.presence.${k}.desc`)}
            />
          ))}
        </ChoiceGroup>
        {draft.get("presence.kind") !== "online" ? (
          <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <span>{t("onb.f.appointment_only")}</span>
            <Switch className={inkSwitchCls} checked={!!draft.get("presence.appointment_only")} onCheckedChange={(v) => draft.set("presence.appointment_only", v)} />
          </label>
        ) : null}
      </Section>

      <Section title={t("onb.details.where")}>
        <Field label={t("onb.f.street")} optional source={src("location.street")} error={err("location.street")}>
          {(a) => (
            <TextInput id={a.id} autoComplete="street-address" aria-invalid={a.invalid} value={str("location.street")} onChange={(e) => draft.set("location.street", e.target.value)} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label={t("onb.f.postal_code")} optional source={src("location.postal_code")}>
            {(a) => (
              <TextInput id={a.id} autoComplete="postal-code" value={str("location.postal_code")} onChange={(e) => draft.set("location.postal_code", e.target.value)} />
            )}
          </Field>
          <Field label={t("onb.f.city")} optional source={src("location.city")}>
            {(a) => (
              <TextInput id={a.id} autoComplete="address-level2" value={str("location.city")} onChange={(e) => draft.set("location.city", e.target.value)} />
            )}
          </Field>
        </div>
        <Field label={t("onb.f.country")} optional source={src("location.country")}>
          {(a) => <CountryCombobox id={a.id} value={country} onChange={(c) => draft.set("location.country", c)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onb.f.phone")} optional source={src("contact.phone")} error={err("contact.phone")}>
            {(a) => (
              <PhoneNumberInput className="crm-phone-input--control"
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                value={str("contact.phone")}
                defaultCountry={(country as never) || "DE"}
                onChange={(v) => draft.set("contact.phone", v)}
              />
            )}
          </Field>
          <Field
            label={t("onb.f.email")}
            optional
            source={src("contact.email")}
            error={err("contact.email")}
            hint={
              emailSuggestion ? (
                <button type="button" className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground" onClick={() => draft.set("contact.email", emailSuggestion)}>
                  {t("onb.didYouMean", { email: emailSuggestion })}
                </button>
              ) : undefined
            }
          >
            {(a) => (
              <TextInput id={a.id} type="email" inputMode="email" autoComplete="email" aria-describedby={a.describedBy} aria-invalid={a.invalid} value={str("contact.email")} onChange={(e) => draft.set("contact.email", e.target.value)} />
            )}
          </Field>
        </div>
      </Section>

      <Section title={t("onb.details.hours")} aside={src("hours.days") ? <span className="text-[11px] text-muted-foreground">{t(`onb.source.${src("hours.days")!.source}`)}</span> : null}>
        <HoursEditor value={draft.get<Hours>("hours.days")} onChange={(v) => draft.set("hours.days", v)} />
        {err("hours.days") ? <p className="text-[13px] font-medium text-destructive">{err("hours.days")}</p> : null}
        <Field label={t("onb.f.hours_notes")} optional source={src("hours.notes")}>
          {(a) => (
            <TextInput id={a.id} placeholder={t("onb.f.hours_notes_placeholder")} value={str("hours.notes")} onChange={(e) => draft.set("hours.notes", e.target.value)} />
          )}
        </Field>
      </Section>

      <Section title={t("onb.details.offer")}>
        <Field label={t("onb.f.product_categories")} optional source={src("offer.product_categories")}>
          {(a) => (
            <TagInput id={a.id} value={draft.get<string[]>("offer.product_categories") ?? []} onChange={(v) => draft.set("offer.product_categories", v)} placeholder={t("onb.f.product_categories_placeholder")} />
          )}
        </Field>
        <Field label={t("onb.f.brands_carried")} optional source={src("offer.brands_carried")}>
          {(a) => (
            <TagInput id={a.id} max={50} value={draft.get<string[]>("offer.brands_carried") ?? []} onChange={(v) => draft.set("offer.brands_carried", v)} placeholder={t("onb.f.brands_carried_placeholder")} />
          )}
        </Field>
        <Field label={t("onb.f.services")} optional source={src("offer.services")}>
          {(a) => (
            <TagInput
              id={a.id}
              value={draft.get<string[]>("offer.services") ?? []}
              onChange={(v) => draft.set("offer.services", v)}
              suggestions={t("onb.f.services_suggestions").split("|")}
            />
          )}
        </Field>
        <Field label={t("onb.f.usps")} hint={t("onb.f.usps_hint")} optional source={src("offer.usps")}>
          {(a) => <TagInput id={a.id} max={10} describedBy={a.describedBy} value={draft.get<string[]>("offer.usps") ?? []} onChange={(v) => draft.set("offer.usps", v)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">{t("onb.f.price_segment")}</p>
            <Segmented
              label={t("onb.f.price_segment")}
              value={draft.get<string>("offer.price_segment")}
              onChange={(v) => draft.set("offer.price_segment", v)}
              options={PROFILE_ENUMS.priceSegment.map((v) => ({ value: v, label: t(`onb.priceSegment.${v}`) }))}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">{t("onb.f.customer_type")}</p>
            <Segmented
              label={t("onb.f.customer_type")}
              value={draft.get<string>("offer.customer_type")}
              onChange={(v) => draft.set("offer.customer_type", v)}
              options={PROFILE_ENUMS.customerType.map((v) => ({ value: v, label: t(`onb.customerType.${v}`) }))}
            />
          </div>
        </div>
      </Section>

      <Section title={t("onb.details.legal")} aside={<span className="text-[12px] text-muted-foreground">{t("onb.details.legalWhy")}</span>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onb.f.register_court")} optional source={src("legal.register_court")}>
            {(a) => <TextInput id={a.id} value={str("legal.register_court")} onChange={(e) => draft.set("legal.register_court", e.target.value)} />}
          </Field>
          <Field label={t("onb.f.register_number")} optional source={src("legal.register_number")}>
            {(a) => <TextInput id={a.id} value={str("legal.register_number")} onChange={(e) => draft.set("legal.register_number", e.target.value)} />}
          </Field>
        </div>
        <Field label={t("onb.f.vat_id")} optional source={src("legal.vat_id")}>
          {(a) => <TextInput id={a.id} autoCapitalize="characters" value={str("legal.vat_id")} onChange={(e) => draft.set("legal.vat_id", e.target.value)} />}
        </Field>
      </Section>
    </div>
  );
}

export function StepDetails() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const data = state?.profile?.data;
  const sources = state?.profile?.field_sources as Record<string, FieldSource> | undefined;
  const draft = useProfileDraft(data, sources, DETAIL_PATHS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fromWebsite = !!state?.workspace?.website && Object.values(sources ?? {}).some((s) => s.source === "website");
  const str = (p: string) => (draft.get<string>(p) ?? "") as string;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!str("identity.display_name").trim()) local["identity.display_name"] = t("onb.fieldErrors.required");
    const hours = draft.get<Hours>("hours.days");
    if (hours && Object.values(hours).some((rs) => rs.some((r) => r.open >= r.close))) {
      local["hours.days"] = t("onb.fieldErrors.hours");
    }
    if (Object.keys(local).length) {
      setErrors(local);
      focusFirstError();
      return;
    }
    setErrors({});
    setFormError(null);
    try {
      await save({ step: "details", profile: draft.patch(), confirm_paths: draft.confirmPaths() });
    } catch (error) {
      const mapped = mapFieldErrors(error, t);
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setFormError(t("onb.errors.fixFields"));
        focusFirstError();
      } else setFormError(t("onb.errors.generic"));
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading
        title={fromWebsite ? t("onb.details.titleFound") : t("onb.details.title")}
        sub={fromWebsite ? t("onb.details.subFound") : t("onb.details.sub")}
      />
      <FormError message={formError} />
      <ProfileFields draft={draft} sources={sources} errors={errors} />
      <ActionBar onBack={back} primaryLabel={fromWebsite ? t("onb.details.looksRight") : t("onb.continue")} busy={saving} />
    </form>
  );
}

// ── You ──────────────────────────────────────────────────────────────────────

export function StepYou() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const person = (state?.profile?.data?.contact?.contact_person ?? {}) as Record<string, string | undefined>;
  const country = (state?.profile?.data?.location?.country as string | undefined) ?? "DE";
  const [first, setFirst] = useState(person.first_name ?? state?.user.first_name ?? "");
  const [last, setLast] = useState(person.last_name ?? state?.user.last_name ?? "");
  const [role, setRole] = useState(person.role ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!first.trim()) local.first = t("onb.fieldErrors.required");
    // The input holds just the dial code ("+49") until something is typed.
    const digits = phone.replace(/\D/g, "");
    if (!phone || digits.length <= 3) local.phone = t("onb.you.phoneRequired");
    else if (!isPossiblePhoneNumber(phone)) local.phone = t("onb.you.phoneInvalid");
    if (Object.keys(local).length) {
      setErrors(local);
      focusFirstError();
      return;
    }
    setErrors({});
    try {
      await save({
        step: "you",
        profile: {
          contact: {
            contact_person: {
              first_name: first.trim(),
              last_name: last.trim() || null,
              role: role.trim() || null,
              phone,
              email: state?.user.email,
            },
          },
        },
      });
    } catch (error) {
      const mapped = mapFieldErrors(error, t);
      if (mapped["contact.contact_person.phone"]) setErrors({ phone: mapped["contact.contact_person.phone"] });
      setFormError(Object.keys(mapped).length ? t("onb.errors.fixFields") : t("onb.errors.generic"));
      focusFirstError();
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.you.title")} sub={t("onb.you.sub")} />
      <FormError message={formError} />
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onb.f.first_name")} error={errors.first}>
            {(a) => <TextInput id={a.id} autoFocus autoComplete="given-name" aria-invalid={a.invalid} aria-describedby={a.describedBy} value={first} onChange={(e) => setFirst(e.target.value)} />}
          </Field>
          <Field label={t("onb.f.last_name")}>
            {(a) => <TextInput id={a.id} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />}
          </Field>
        </div>
        <Field label={t("onb.f.role")} optional hint={t("onb.f.role_hint")}>
          {(a) => <TextInput id={a.id} autoComplete="organization-title" aria-describedby={a.describedBy} value={role} onChange={(e) => setRole(e.target.value)} />}
        </Field>
        <Field label={t("onb.f.your_phone")} error={errors.phone} hint={t("onb.you.phoneWhy")}>
          {(a) => (
            <PhoneNumberInput className="crm-phone-input--control"
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              value={phone}
              defaultCountry={country as never}
              onChange={setPhone}
            />
          )}
        </Field>
        <p className="text-[13px] text-muted-foreground">{t("onb.you.emailNote", { email: state?.user.email ?? "" })}</p>
      </div>
      <ActionBar onBack={back} primaryLabel={t("onb.continue")} busy={saving} />
    </form>
  );
}
