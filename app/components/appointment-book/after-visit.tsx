import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, CalendarPlus, ListTodo } from "lucide-react";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import type { Appointment } from "~/lib/api/appointment-book";
import { whoOf } from "./format";

/**
 * After "Came": what's next? A visit is a step in the loop, never the end of
 * it. With a deal, the deal's own "what's next" takes over (QuickCreate wires
 * that); without one: book the next visit, add a task, or start a deal.
 */

export interface AfterVisitApi {
  open: (appointment: Appointment) => void;
}

export const AfterVisitContext = createContext<AfterVisitApi | null>(null);

export function useAfterVisit(): AfterVisitApi {
  return useContext(AfterVisitContext) ?? { open: () => {} };
}

export function AfterVisitSheet({
  appointment,
  onOpenChange,
  onBookAgain,
  onTask,
  onDeal,
}: {
  appointment: Appointment;
  onOpenChange: (open: boolean) => void;
  onBookAgain: () => void;
  onTask: () => void;
  onDeal: () => void;
}) {
  const { t } = useTranslation();
  const who = whoOf(appointment, t("appointmentBook.someone", "Someone"));
  const choices = [
    { key: "again", Icon: CalendarPlus, label: t("appointmentBook.after.bookAgain", "Book the next visit"), onClick: onBookAgain },
    { key: "task", Icon: ListTodo, label: t("appointmentBook.after.task", "Add a task"), onClick: onTask },
    { key: "deal", Icon: Briefcase, label: t("appointmentBook.after.deal", "Start a deal"), onClick: onDeal },
  ];
  return (
    <BottomSheet
      open
      onOpenChange={onOpenChange}
      title={t("whatsNext.title", "What's next?")}
      description={t("appointmentBook.after.sub", "{{name}} came. What happens next?", { name: who })}
    >
      <div className="grid gap-2">
        {choices.map(({ key, Icon, label, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className="press flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Icon className="size-[18px] text-muted-foreground" aria-hidden />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-1 h-11 text-[14px] text-muted-foreground hover:text-foreground"
        >
          {t("appointmentBook.after.nothing", "Nothing for now")}
        </button>
      </div>
    </BottomSheet>
  );
}
