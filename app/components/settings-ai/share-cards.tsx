import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { getIntlLocale } from "~/lib/utils/format";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getAiShares, setAiShare, type AiShareRow, type WorkspaceAiStatus } from "~/lib/api/workspace-ai";
import { useAuthContext } from "~/providers/auth-provider";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const usd = (n: number) =>
  new Intl.NumberFormat(getIntlLocale(), { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * A business that uses its agency's AI (AGENCY_MODE_PLAN.md §6): who
 * provides it and what this business used this month. Never the agency's
 * key, account or balance. When the monthly amount is used up, a calm line
 * says AI is paused and who to ask — no alerts, no warnings before that.
 */
export function SharedByAgencyCard({ shared }: { shared: NonNullable<WorkspaceAiStatus["shared_by"]> }) {
  const { t } = useTranslation();
  return (
    <div className={cn("rounded-2xl border bg-card p-5 sm:p-6", shared.paused ? "border-marker" : "border-border")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden>
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t("settings.ai.shared.title", { agency: shared.agency_name })}
          </h3>
          <p className="text-[13px] text-muted-foreground">
            {shared.limit_usd == null
              ? t("settings.ai.shared.used", { amount: usd(shared.used_usd) })
              : t("settings.ai.shared.usedOf", { amount: usd(shared.used_usd), limit: usd(shared.limit_usd) })}
          </p>
          {shared.paused ? (
            <p className="text-[13px] font-medium text-foreground">
              {t("settings.ai.shared.paused", { agency: shared.agency_name })}
            </p>
          ) : null}
          <p className="text-[12.5px] text-muted-foreground">{t("settings.ai.shared.ownKeyHint")}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The agency's own admins: share the agency's AI with chosen businesses, an
 * optional monthly amount each, and see what each one used this month.
 */
export function ShareWithBusinessesCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const key = ["ai-shares", currentWorkspace?.id] as const;
  const q = useQuery({ queryKey: key, queryFn: getAiShares, retry: false });
  const save = useMutation({
    mutationFn: (v: { id: string; enabled: boolean; limit: number | null }) =>
      setAiShare(v.id, { enabled: v.enabled, monthly_limit_usd: v.limit }),
    onSuccess: (rows) => {
      qc.setQueryData(key, rows);
      toast.success(t("settings.ai.share.saved"));
    },
    onError: (e) => {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
      toast.error(code === "AI_SHARE_NO_KEY" ? t("settings.ai.share.needKey") : extractErrorMessage(e));
    },
  });

  const rows = q.data ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-foreground">{t("settings.ai.share.title")}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.ai.share.subtitle")}</p>
      {q.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("settings.ai.share.none")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <ShareRow key={r.workspace_id} r={r} busy={save.isPending} onSave={(enabled, limit) => save.mutate({ id: r.workspace_id, enabled, limit })} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareRow({ r, busy, onSave }: { r: AiShareRow; busy: boolean; onSave: (enabled: boolean, limit: number | null) => void }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(r.monthly_limit_usd == null ? "" : String(r.monthly_limit_usd));
  const parsed = limit.trim() === "" ? null : Number(limit.replace(",", "."));
  const limitValid = parsed === null || (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100000);
  const limitChanged = (parsed ?? null) !== (r.monthly_limit_usd ?? null);

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {r.own_key
              ? t("settings.ai.share.ownKey")
              : r.shared
                ? r.paused
                  ? t("settings.ai.share.paused", { amount: usd(r.used_this_month_usd) })
                  : t("settings.ai.share.usedThisMonth", { amount: usd(r.used_this_month_usd) })
                : t("settings.ai.share.off")}
          </span>
        </span>
        <Switch
          checked={r.shared}
          disabled={busy || !limitValid}
          aria-label={t("settings.ai.share.toggle", { business: r.name })}
          onCheckedChange={(on) => onSave(on, on ? parsed : r.monthly_limit_usd)}
        />
      </div>
      {r.shared ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block space-y-1">
            <span className="block text-[12px] text-muted-foreground">{t("settings.ai.share.limitLabel")}</span>
            <Input
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t("settings.ai.share.noLimit")}
              className="h-10 w-36"
              aria-invalid={!limitValid}
            />
          </label>
          {limitChanged ? (
            <Button size="sm" variant="outline" className="h-10" disabled={busy || !limitValid} onClick={() => onSave(true, parsed)}>
              {t("settings.ai.share.saveLimit")}
            </Button>
          ) : null}
          {!limitValid ? <span className="text-[12px] text-overdue">{t("settings.ai.share.limitInvalid")}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
