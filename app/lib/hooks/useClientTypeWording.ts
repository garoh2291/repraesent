import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { DEFAULT_CLIENT_TYPE, normalizeClientType } from "~/lib/client-types";

export interface ClientTypeWording {
  /** singular, mid-sentence form ("partner house") */
  type: string;
  /** plural, mid-sentence form ("partner houses") */
  types: string;
  /** singular, capitalized for titles ("Partner House") */
  Type: string;
  /** plural, capitalized for titles ("Partner Houses") */
  Types: string;
  /** index signature so the object can be spread straight into t() options */
  [key: string]: string;
}

function capitalize(value: string, lng: string): string {
  if (lng.startsWith("en")) {
    // Title-case each word ("partner house" -> "Partner House")
    return value.replace(
      /(^|[\s-])(\p{Ll})/gu,
      (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
  }
  // de nouns are already capitalized; fr/nl capitalize the first letter only
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Resolve the brand client-type wording variables to spread into t() options:
 * `t("brand.workspacesTitle", { ...ctw })` with keys written as
 * `{{type}} / {{types}} / {{Type}} / {{Types}}` in the locale JSON.
 *
 * Plain function so route `meta` exports (module scope, no hooks/auth
 * context) can use it too — there it falls back to partner_house wording.
 */
export function resolveClientTypeWording(
  t: TFunction,
  lng: string,
  clientType?: string | null,
): ClientTypeWording {
  const key = normalizeClientType(clientType ?? DEFAULT_CLIENT_TYPE);
  const type = t(`clientTypes.${key}`, { count: 1 });
  const types = t(`clientTypes.${key}`, { count: 2 });
  return {
    type,
    types,
    Type: capitalize(type, lng),
    Types: capitalize(types, lng),
  };
}

/** Client-type wording for the current brand user, from auth context. */
export function useClientTypeWording(): ClientTypeWording {
  const { t, i18n } = useTranslation();
  const { brand } = useAuthContext();
  return useMemo(
    () => resolveClientTypeWording(t, i18n.language, brand?.client_type),
    [t, i18n.language, brand?.client_type],
  );
}
