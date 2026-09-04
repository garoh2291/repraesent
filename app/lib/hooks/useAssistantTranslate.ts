import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { AiLocale } from "~/lib/api/ai-assistants";
import {
  translateAssistant,
  type TranslateAssistantRequest,
  type TranslateAssistantResponse,
} from "~/lib/api/assistant-translate";

/**
 * Ref-counted spinner state around the assistant translate endpoint, plus the
 * three toasts every caller needs. Copied from the forms builder, which learned
 * these the hard way:
 *
 * - counts, not a Set: one user action can fire more than one request per
 *   locale, and the first to settle would otherwise clear the spinner early;
 * - the caller merges inside its own closure after `await`, so a response can
 *   never be dropped by a stale render;
 * - a locale that failed merges NOTHING — the panel must not paste the source
 *   text in as if it had been translated.
 */
export function useAssistantTranslate(assistantId: string | undefined) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const mutation = useMutation({
    mutationFn: (body: TranslateAssistantRequest) =>
      translateAssistant(assistantId!, body),
  });

  const translating = useMemo(
    () =>
      new Set(
        Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([locale]) => locale as AiLocale),
      ),
    [counts],
  );

  const bump = useCallback((locales: AiLocale[], delta: 1 | -1) => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const locale of locales) {
        next[locale] = Math.max(0, (next[locale] ?? 0) + delta);
      }
      return next;
    });
  }, []);

  /**
   * Resolves with the response, or `null` when the request failed (already
   * toasted). Never rejects, so callers can merge without a try/catch.
   */
  const run = useCallback(
    async (
      body: TranslateAssistantRequest,
    ): Promise<TranslateAssistantResponse | null> => {
      if (!assistantId || body.targets.length === 0) return null;
      const inFlight = body.targets.map((target) => target.locale);
      bump(inFlight, 1);
      try {
        const response = await mutation.mutateAsync(body);
        const failed = response.results.filter((r) => !r.ok);
        if (failed.length === 0) {
          toast.success(t("aiAssistants.translate.done"));
        } else {
          toast.warning(
            t("aiAssistants.translate.partial", {
              locales: failed.map((r) => r.locale.toUpperCase()).join(", "),
            }),
          );
        }
        return response;
      } catch (error) {
        const code = (error as { response?: { data?: { code?: string } } })
          ?.response?.data?.code;
        toast.error(
          code === "AI_UNAVAILABLE" || code === "workspace_ai_not_configured"
            ? t("aiAssistants.translate.unavailable")
            : t("aiAssistants.translate.failed"),
          { description: extractErrorMessage(error) },
        );
        return null;
      } finally {
        bump(inFlight, -1);
      }
    },
    [assistantId, bump, mutation, t],
  );

  return {
    /** Locales with at least one request in flight. */
    translating,
    anyTranslating: translating.size > 0,
    run,
  };
}
