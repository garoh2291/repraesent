import { ArrowRightLeft, Tag } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  CONTACT_SOURCE_DEFAULT_PILL,
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCE_PILL,
} from "~/lib/contacts/constants";
import {
  CONTACT_TYPE_PILL,
  CONTACT_TYPES,
  type ContactType,
} from "~/lib/contacts/contact-types";
import { useTranslation } from "react-i18next";

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

interface ContactSourceBadgeProps {
  source: string | null | undefined;
  className?: string;
}

interface ContactTypeBadgeProps {
  contactType: string | null | undefined;
  className?: string;
  trailing?: React.ReactNode;
}

export function ContactTypeBadge({
  contactType,
  className,
  trailing,
}: ContactTypeBadgeProps) {
  const { t } = useTranslation();
  const raw = contactType?.trim() ?? "";
  if (!raw) {
    return (
      <span
        className={cn(
          PILL_BASE,
          "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
          className,
        )}
      >
        —
        {trailing}
      </span>
    );
  }
  const key = CONTACT_TYPES.includes(raw as ContactType)
    ? (raw as ContactType)
    : null;
  const pill = key ? CONTACT_TYPE_PILL[key] : CONTACT_SOURCE_DEFAULT_PILL;
  const label = key
    ? t(`contacts.contactTypes.${key}`, {
        defaultValue: raw.replace(/_/g, " "),
      })
    : raw.replace(/_/g, " ");

  return (
    <span className={cn(PILL_BASE, pill, "capitalize", className)}>
      {label}
      {trailing}
    </span>
  );
}

export function ContactSourceBadge({
  source,
  className,
}: ContactSourceBadgeProps) {
  const { t } = useTranslation();
  const raw = source?.trim() ?? "";
  const fallback =
    CONTACT_SOURCE_LABELS[raw] ??
    (raw
      ? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null) ??
    "—";
  const pill = CONTACT_SOURCE_PILL[raw] ?? CONTACT_SOURCE_DEFAULT_PILL;
  const label = raw
    ? t(`contacts.sources.${raw}`, { defaultValue: fallback })
    : fallback;
  const Icon = raw === "lead_conversion" ? ArrowRightLeft : Tag;

  return (
    <span className={cn(PILL_BASE, pill, className)}>
      <Icon className="h-3 w-3 opacity-70" aria-hidden />
      {label}
    </span>
  );
}
