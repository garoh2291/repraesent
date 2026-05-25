import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface UseDocumentMetaOptions {
  titleKey: string;
  descriptionKey?: string;
  titleSuffix?: string;
}

/**
 * Patches document.title and <meta name="description"> whenever the i18next
 * language changes. Pair with the route's existing meta() export (which
 * handles first paint via React Router) for full SSR + live coverage.
 *
 * titleSuffix is appended verbatim to avoid forcing translators to repeat
 * the brand name (e.g. " - Repraesent").
 */
export function useDocumentMeta(opts: UseDocumentMetaOptions) {
  const { t, i18n } = useTranslation();
  const { titleKey, descriptionKey, titleSuffix } = opts;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = t(titleKey) + (titleSuffix ?? "");
    if (descriptionKey) {
      let tag = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      );
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "description";
        document.head.appendChild(tag);
      }
      tag.content = t(descriptionKey);
    }
  }, [t, i18n.language, titleKey, descriptionKey, titleSuffix]);
}
