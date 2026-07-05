import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  putDealEmailSegment,
  type DealEmailSegment,
  type SegmentCondition,
} from "~/lib/api/bcc-logs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { dealEmailSegmentQuery } from "./shared";

type Field = "subject" | "body";

/**
 * Edit a deal's email segment (inclusion filter): a Match all/any mode + a list
 * of "subject/body contains" conditions. Changes save live (PUT whole segment).
 */
export function DealEmailSegmentEditor({ dealId }: { dealId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sq = dealEmailSegmentQuery(dealId);
  const { data: server } = useQuery({ queryKey: sq.key, queryFn: sq.fn });

  const [mode, setMode] = useState<"all" | "any">("any");
  const [conditions, setConditions] = useState<SegmentCondition[]>([]);

  // Sync local draft from server once loaded / when it changes.
  useEffect(() => {
    if (server) {
      setMode(server.match_mode);
      setConditions(server.conditions);
    }
  }, [server]);

  const save = useMutation({
    mutationFn: (segment: DealEmailSegment) =>
      putDealEmailSegment(dealId, segment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sq.key });
      queryClient.invalidateQueries({ queryKey: ["deal-emails", dealId] });
    },
    onError: (e) =>
      toast.error(
        t("dealEmails.updateFailed", { defaultValue: "Could not update." }),
        { description: extractErrorMessage(e) },
      ),
  });

  const commit = (nextMode: "all" | "any", next: SegmentCondition[]) =>
    save.mutate({
      match_mode: nextMode,
      conditions: next.filter((c) => c.value.trim()),
    });

  const setModeAndSave = (m: "all" | "any") => {
    setMode(m);
    commit(m, conditions);
  };

  const updateCondition = (i: number, patch: Partial<SegmentCondition>) =>
    setConditions((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  const removeCondition = (i: number) => {
    const next = conditions.filter((_, idx) => idx !== i);
    setConditions(next);
    commit(mode, next);
  };

  const addCondition = () =>
    setConditions((prev) => [...prev, { field: "subject", value: "" }]);

  const fieldLabel = (f: Field) =>
    f === "subject"
      ? t("dealEmails.subjectContains", { defaultValue: "Subject contains" })
      : t("dealEmails.bodyContains", { defaultValue: "Body contains" });

  return (
    <div className="space-y-3">
      {/* Match mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("dealEmails.matchLabel", { defaultValue: "Match" })}
        </span>
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {(["all", "any"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeAndSave(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "all"
                ? t("dealEmails.matchAll", { defaultValue: "All" })
                : t("dealEmails.matchAny", { defaultValue: "Any" })}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      {conditions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("dealEmails.noConditions", {
            defaultValue: "No conditions — all emails show in Pipeline.",
          })}
        </p>
      ) : (
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={c.field}
                onValueChange={(v) => {
                  updateCondition(i, { field: v as Field });
                  commit(
                    mode,
                    conditions.map((x, idx) =>
                      idx === i ? { ...x, field: v as Field } : x,
                    ),
                  );
                }}
              >
                <SelectTrigger className="h-8 w-[150px] shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">
                    {fieldLabel("subject")}
                  </SelectItem>
                  <SelectItem value="body">{fieldLabel("body")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                onBlur={() => commit(mode, conditions)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit(mode, conditions);
                  }
                }}
                placeholder={t("dealEmails.ruleValuePlaceholder", {
                  defaultValue: "text to match…",
                })}
                className="h-8 min-w-[140px] flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeCondition(i)}
                aria-label={t("common.delete", { defaultValue: "Delete" })}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={addCondition}
      >
        <Plus className="size-3.5" />
        {t("dealEmails.addCondition", { defaultValue: "Add condition" })}
      </Button>
    </div>
  );
}
