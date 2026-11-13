import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Wrench, MessageCircleQuestion } from "lucide-react";
import { cn } from "~/lib/utils";
import { fetchAttachmentBlob, type ShotSize, type Severity, type Side, type TicketStatus } from "~/lib/api/support-tickets";

/**
 * Small pieces shared by both sides of Help & changes.
 *
 * The signature is the ticket stub: the number printed in mono on a paper
 * stub with punched notches, like the tear-off tickets on a repair counter.
 * Everything else stays quiet.
 */

export function TicketStub({ number, className, size = "sm" }: { number: number; className?: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "ticket-stub num inline-flex shrink-0 items-center font-mono font-semibold tracking-tight text-foreground",
        size === "lg" ? "h-7 px-3 text-[13px]" : "h-5 px-2 text-[11px]",
        className,
      )}
    >
      #{number}
    </span>
  );
}

/** Urgent = filled red, normal = ink ring, low = faint ring. Never colour alone: a label sits next to it where it matters. */
export function SeverityMark({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        severity === "urgent" && "bg-destructive shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_18%,transparent)]",
        severity === "normal" && "border-[1.5px] border-foreground/70",
        severity === "low" && "border-[1.5px] border-foreground/25",
        className,
      )}
    />
  );
}

export const SEVERITY_ICON: Record<Severity, typeof AlertOctagon> = {
  urgent: AlertOctagon,
  normal: Wrench,
  low: MessageCircleQuestion,
};

/** The words for a severity, per side: customers get the plain sentence. */
export function useSeverityLabel(side: Side) {
  const { t } = useTranslation();
  return (s: Severity) =>
    side === "client"
      ? t(`help.severity.${s}`, { urgent: "Site is down or broken", normal: "Something isn't working right", low: "Small change or question" }[s])
      : t(`support.severity.${s}`, { urgent: "Urgent", normal: "Normal", low: "Low" }[s]);
}

export function useStatusLabel(side: Side) {
  const { t } = useTranslation();
  return (s: TicketStatus) =>
    side === "client"
      ? t(`help.status.${s}`, { open: "We're on it", waiting_on_client: "Waiting for your reply", resolved: "Done" }[s])
      : t(`support.status.${s}`, { open: "Open", waiting_on_client: "Waiting on client", resolved: "Resolved" }[s]);
}

/**
 * The marker means "this needs you": on the customer's side that is
 * "waiting for your reply"; on the team's side it is "open".
 */
export function StatusPill({ status, side, className }: { status: TicketStatus; side: Side; className?: string }) {
  const label = useStatusLabel(side)(status);
  const needsViewer = side === "client" ? status === "waiting_on_client" : status === "open";
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium",
        needsViewer
          ? "bg-marker text-foreground"
          : status === "resolved"
            ? "bg-transparent text-muted-foreground ring-1 ring-inset ring-border"
            : "bg-muted text-foreground/80",
        className,
      )}
    >
      {status === "resolved" ? <span aria-hidden>✓</span> : null}
      {label}
    </span>
  );
}

/**
 * A private screenshot: fetched with the session and kept in the query cache
 * (as a Blob — it never changes), so polling, re-renders and reopening a ticket
 * don't download it again. `thumb` is the small preview; `enabled: false`
 * waits (the full image loads only when the lightbox opens).
 */
export function useAttachmentUrl(
  side: Side,
  id: string,
  size: ShotSize = "full",
  enabled = true,
): { url: string | null; failed: boolean } {
  const q = useQuery({
    queryKey: ["support-shot", side, id, size],
    queryFn: () => fetchAttachmentBlob(side, id, size),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
  const blob = q.data ?? null;
  // Made and revoked in the same effect, so a remount never shows a revoked URL.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return { url, failed: q.isError };
}

/** Warm the full image (hover / press) so the lightbox opens sharp. */
export function usePrefetchShot() {
  const qc = useQueryClient();
  return (side: Side, id: string) =>
    void qc.prefetchQuery({
      queryKey: ["support-shot", side, id, "full"],
      queryFn: () => fetchAttachmentBlob(side, id, "full"),
      staleTime: Infinity,
      gcTime: 30 * 60_000,
    });
}

/** "anna@x" → "A", "Anna Weber" → "AW". */
export function initials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "·";
  const parts = n.split(/[\s@.]+/).filter(Boolean);
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}
