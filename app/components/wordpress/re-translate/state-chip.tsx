import { useTranslation } from "react-i18next";
import type { ReTranslatePageState } from "~/lib/api/re-translate";

/** Live · Waiting for you · Not shown yet — all in ink, no colour: the words carry the state. */
export function StateChip({ state, compact = false }: { state: ReTranslatePageState | null | undefined; compact?: boolean }) {
  const { t } = useTranslation();
  if (!state) {
    return <span className="inline-flex h-6 items-center rounded-full px-2 text-xs text-muted-foreground">{compact ? "—" : t("wordpress.reTranslate.lp.state.none", "Not translated")}</span>;
  }
  if (state === "live") {
    return <span className="inline-flex h-6 items-center rounded-full border px-2 text-xs text-foreground">{t("wordpress.reTranslate.lp.state.live", "Live")}</span>;
  }
  if (state === "needs_you") {
    return <span className="inline-flex h-6 items-center rounded-full border px-2 text-xs font-semibold text-foreground">{t("wordpress.reTranslate.lp.state.waiting", "Waiting for you")}</span>;
  }
  return <span className="inline-flex h-6 items-center rounded-full border border-dashed px-2 text-xs text-muted-foreground">{t("wordpress.reTranslate.lp.state.draft", "Not shown yet")}</span>;
}
