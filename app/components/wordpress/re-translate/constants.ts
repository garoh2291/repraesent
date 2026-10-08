import axios from "axios";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}

/** The API's refusals these screens can meet, by its English wording (re-translate.service.ts), and the key that says it in the reader's language. */
const REFUSALS: Record<string, string> = {
  "The original language cannot also be a translation.": "wordpress.reTranslate.error.sourceIsTarget",
  "Add this language first.": "wordpress.reTranslate.error.addFirst",
  "Unknown language.": "wordpress.reTranslate.error.unknownLanguage",
  "Nothing changed since the last translation.": "wordpress.reTranslate.error.nothingChanged",
  "No pages to translate.": "wordpress.reTranslate.error.noPages",
  "This sentence is not on the page any more.": "wordpress.reTranslate.error.sentenceGone",
  "Keep every link and formatting marker exactly once.": "wordpress.reTranslate.keepMarkers",
  "re:translate (v1) is still active on this site. Deactivate it first.": "wordpress.reTranslate.v1Active",
  "No WordPress site for this workspace": "wordpress.reTranslate.error.noSite",
};

/**
 * An error as the customer reads it. The API answers in English, and much of
 * what reaches it from the website is technical, so only the refusals above
 * keep their meaning; the rest says what happened in plain words.
 */
export function errorText(t: (key: string) => string, error: unknown): string {
  const message = extractErrorMessage(error);
  if (REFUSALS[message]) return t(REFUSALS[message]);
  if (/is not a language the translator knows\.$/.test(message)) return t("wordpress.reTranslate.error.unknownLanguage");
  if (axios.isAxiosError(error)) {
    if (!error.response) return t("wordpress.reTranslate.error.offline");
    if (error.response.status >= 500) return t("wordpress.reTranslate.error.siteSilent");
  }
  return t("wordpress.reTranslate.error.generic");
}
