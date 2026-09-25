import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, CalendarCheck, FileText, Phone, Trophy } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { DayField } from "~/components/notebook/day-field";
import { createTaskForDeal } from "~/lib/api/tasks";
import { getDeal, patchDeal, patchDealStatus } from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useInvalidateWork } from "~/lib/hooks/useToday";
import { tomorrowNineIso } from "~/components/notebook/lead-flow";

export interface FlowDeal {
  id: string;
  title: string | null;
}

type Pick = "call" | "offer" | "meeting" | "custom";

const PICKS: { key: Pick; Icon: typeof Phone }[] = [
  { key: "call", Icon: Phone },
  { key: "offer", Icon: FileText },
  { key: "meeting", Icon: CalendarCheck },
];

function toDateInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromDateInput(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0).toISOString();
}

/**
 * "What's next?" — every open deal gets a next step (NOTEBOOK_UX_PLAN.md D7).
 * Opens after the deal's last open task is completed, or from any
 * "No next step" nudge. Picking a step creates the task; the deal can also be
 * closed as won or lost from here.
 */
function WhatsNextSheet({
  deal,
  open,
  onOpenChange,
  reason,
}: {
  deal: FlowDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: "completed" | "none";
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateWork();
  // Remounted (key) on every open, so the sheet always starts fresh.
  const [pick, setPick] = useState<Pick | null>(null);
  const [custom, setCustom] = useState("");
  const [due, setDue] = useState(() => toDateInput(tomorrowNineIso()));
  // Closing a deal is a big step: the first tap arms, the second commits.
  const [armed, setArmed] = useState<"won" | "lost" | null>(null);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(null), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const taskMutation = useMutation({
    mutationFn: (title: string) =>
      createTaskForDeal(deal!.id, { title, due_date: fromDateInput(due) }),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      toast.success(t("whatsNext.saved", "Next step added"));
    },
    onError: (err) =>
      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong")),
  });
  const statusMutation = useMutation({
    mutationFn: async (status: "won" | "lost") => {
      // Remember where it was, so Undo can put it back.
      const before = await getDeal(deal!.id);
      const prevStage = (before.deal as { stage?: string }).stage ?? null;
      await patchDealStatus(deal!.id, status);
      return { prevStage };
    },
    onSuccess: ({ prevStage }, status) => {
      invalidate();
      onOpenChange(false);
      const dealId = deal!.id;
      toast.success(
        status === "won"
          ? t("whatsNext.wonToast", "Marked as a new customer")
          : t("whatsNext.lostToast", "Closed — didn't happen"),
        prevStage
          ? {
              action: {
                label: t("common.undo", "Undo"),
                onClick: () => {
                  void patchDeal(dealId, { stage: prevStage })
                    .then(() => invalidate())
                    .catch((err) =>
                      toast.error(
                        extractErrorMessage(err) ||
                          t("common.error", "Something went wrong"),
                      ),
                    );
                },
              },
            }
          : undefined,
      );
    },
    onError: (err) =>
      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong")),
  });

  if (!deal) return null;

  const title =
    pick === "custom"
      ? custom.trim()
      : pick
        ? t(`whatsNext.picks.${pick}`)
        : "";

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("whatsNext.title", "What's next?")}
      description={
        reason === "completed"
          ? t("whatsNext.subCompleted", "Done. {{name}} has no next step yet.", {
              name: deal.title?.trim() || t("today.untitledDeal", "Deal"),
            })
          : t("whatsNext.subNone", "{{name}} has no next step.", {
              name: deal.title?.trim() || t("today.untitledDeal", "Deal"),
            })
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("outcome.later", "Later")}
          </Button>
          <Button
            disabled={!title}
            loading={taskMutation.isPending}
            onClick={() => taskMutation.mutate(title)}
            className="min-w-32"
          >
            {t("whatsNext.add", "Add next step")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-2 pt-1">
        {PICKS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPick(key)}
            aria-pressed={pick === key}
            className={cn(
              "press flex h-12 items-center gap-3 rounded-xl border px-3.5 text-left text-[14.5px] font-medium transition-colors",
              pick === key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/30",
            )}
          >
            <Icon className="size-[18px]" />
            {t(`whatsNext.picks.${key}`)}
          </button>
        ))}
        <Input
          value={custom}
          onFocus={() => setPick("custom")}
          onChange={(e) => {
            setCustom(e.target.value);
            setPick("custom");
          }}
          placeholder={t("whatsNext.customPlaceholder", "Something else…")}
          className="h-12 bg-card text-[14.5px]"
        />
        <DayField
          className="mt-1"
          label={t("whatsNext.when", "When")}
          value={due}
          onChange={setDue}
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("whatsNext.orClose", "Or close it")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className={cn(
              "h-11 justify-start gap-2 text-earned",
              armed === "won" && "border-earned bg-earned-soft",
            )}
            loading={statusMutation.isPending && statusMutation.variables === "won"}
            onClick={() =>
              armed === "won" ? statusMutation.mutate("won") : setArmed("won")
            }
          >
            <Trophy className="size-4" />
            {armed === "won"
              ? t("whatsNext.confirm", "Tap again to confirm")
              : t("whatsNext.won", "New customer")}
          </Button>
          <Button
            variant="outline"
            className={cn(
              "h-11 justify-start gap-2 text-muted-foreground",
              armed === "lost" && "border-foreground/40 bg-muted text-foreground",
            )}
            loading={statusMutation.isPending && statusMutation.variables === "lost"}
            onClick={() =>
              armed === "lost" ? statusMutation.mutate("lost") : setArmed("lost")
            }
          >
            <Ban className="size-4" />
            {armed === "lost"
              ? t("whatsNext.confirm", "Tap again to confirm")
              : t("whatsNext.lost", "Didn't happen")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

interface DealFlowApi {
  whatsNext: (deal: FlowDeal, reason?: "completed" | "none") => void;
}

const DealFlowContext = createContext<DealFlowApi | null>(null);

export function DealFlowProvider({ children }: { children: React.ReactNode }) {
  const [deal, setDeal] = useState<FlowDeal | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"completed" | "none">("none");
  const [session, setSession] = useState(0);
  const api = useMemo<DealFlowApi>(
    () => ({
      whatsNext: (d, r = "none") => {
        setDeal(d);
        setReason(r);
        setSession((n) => n + 1);
        setOpen(true);
      },
    }),
    [],
  );
  return (
    <DealFlowContext.Provider value={api}>
      {children}
      <WhatsNextSheet
        key={`next-${session}`}
        deal={deal}
        open={open}
        onOpenChange={setOpen}
        reason={reason}
      />
    </DealFlowContext.Provider>
  );
}

export function useDealFlow(): DealFlowApi {
  return useContext(DealFlowContext) ?? { whatsNext: () => {} };
}
