import type { FormLocale } from "~/lib/forms/schema";

/**
 * Every language a customer can be written to in, by its own name — the app's
 * four plus Armenian, which forms and appointment emails also speak.
 */
export const LANGUAGE_NAMES: Record<FormLocale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  hy: "Հայերեն",
};
