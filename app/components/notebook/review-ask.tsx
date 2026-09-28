import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { whatsappHref } from "~/components/notebook/contact-actions";
import {
  decideReview,
  getReviewForDeal,
  getReviewStatus,
  reviewStatusKey,
  undoReview,
  type ReviewCandidate,
  type ReviewDecision,
  type ReviewMoment,
} from "~/lib/api/google-reviews";
import { extractErrorMessage, getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useCanSendEmail } from "~/lib/hooks/useCanSendEmail";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { composeInvalidateKeys } from "~/components/organism/activity-panel/shared";
import { cn } from "~/lib/utils";

/**
 * Google review asks (GOOGLE_REVIEWS_PLAN.md). Experimental — pilot only.
 *
 * The owner asks every finished customer once, the same way: no "were you
 * happy?" filter in front of Google and no reward (Google policy, EU Omnibus
 * / UWG). Nothing is sent by us — WhatsApp or the mail app opens with the
 * message ready, and the owner presses send.
 */

/** The review status for the current workspace; `enabled` false outside the pilot. */
export function useReviewStatus() {
  const pilot = usePilotFeatures().googleReviews;
  const workspaceId = getStoredWorkspaceId();
  const q = useQuery({
    queryKey: reviewStatusKey(workspaceId),
    queryFn: getReviewStatus,
    enabled: pilot && !!workspaceId,
    staleTime: 5 * 60_000,
  });
  const s = q.data;
  const on = pilot && !!s && s.enabled && s.ready;
  return {
    /** Pilot + migration applied: the feature may show at all. */
    on,
    /** …and there is a Google listing to send people to. */
    canAsk: on && !!(s && s.enabled && s.review_url),
    status: s && s.enabled ? s : null,
    isPending: q.isPending,
  };
}

function useInvalidateReviews() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["google-reviews"] });
    void qc.invalidateQueries({ queryKey: ["today"] });
  };
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The plain review message as composer HTML: escaped, blank lines → paragraphs,
 * single breaks → <br>, and web links made clickable (the review link above all).
 */
export function reviewTextToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) =>
      `<p>${escHtml(para)
        .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
        .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function ReviewAskSheet({
  candidate,
  open,
  onOpenChange,
}: {
  candidate: ReviewCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { status } = useReviewStatus();
  const invalidate = useInvalidateReviews();
  const canSendEmail = useCanSendEmail();
  const { openCompose } = useComposeEmail();
  const link = status?.review_url ?? "";
  const business = status?.business_name?.trim() || status?.google_name?.trim() || "";
  const first = candidate?.first_name?.trim() || "";

  // Remounted per open (key), so the text starts fresh for each customer.
  const [text, setText] = useState(() =>
    first
      ? t("reviews.message", { name: first, business, link })
      : t("reviews.messageNoName", { business, link }),
  );
  const [busy, setBusy] = useState<ReviewDecision | null>(null);

  if (!candidate || !link) return null;

  const name = candidate.name || t("reviews.thisCustomer", "this customer");
  const wa = candidate.phone ? whatsappHref(candidate.phone) : null;
  const waHref = wa ? `${wa}?text=${encodeURIComponent(text)}` : null;
  const mailHref = candidate.email
    ? `mailto:${candidate.email}?subject=${encodeURIComponent(
        t("reviews.emailSubject", { business: business || "…" }),
      )}&body=${encodeURIComponent(text)}`
    : null;

  const decide = async (channel: ReviewDecision) => {
    setBusy(channel);
    try {
      await decideReview({ contact_id: candidate.contact_id, deal_id: candidate.deal_id, channel });
      invalidate();
      onOpenChange(false);
      const message =
        channel === "later"
          ? t("reviews.laterToast", { name })
          : channel === "skipped"
            ? t("reviews.skippedToast", { name })
            : channel === "copy"
              ? t("reviews.copiedToast")
              : t("reviews.askedToast", { name });
      toast.success(
        message,
        channel === "later"
          ? undefined
          : {
              action: {
                label: t("common.undo", "Undo"),
                onClick: () =>
                  void undoReview(candidate.contact_id)
                    .then(invalidate)
                    .catch((err) =>
                      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong")),
                    ),
              },
            },
      );
    } catch (err) {
      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  /**
   * A mailbox is connected: send from it, like Email on the lead page. The
   * ask is recorded only once the email actually went out; closing the
   * composer without sending leaves the customer on "Ask for a review".
   * The composer's "Email sent" card is the confirmation, so no toast here.
   */
  const composeEmail = () => {
    const c = candidate;
    onOpenChange(false);
    openCompose({
      to: [{ email: c.email!, name: c.name || undefined }],
      subject: t("reviews.emailSubject", { business: business || "…" }),
      html: reviewTextToHtml(text),
      contactId: c.contact_id,
      dealId: c.deal_id,
      contextLabel: t("reviews.composeContext", { name }),
      invalidateKeys: [
        ["google-reviews"],
        ["today"],
        ...composeInvalidateKeys({ dealId: c.deal_id, emailContactId: c.contact_id }, "deal"),
      ],
      onSent: () => {
        void decideReview({ contact_id: c.contact_id, deal_id: c.deal_id, channel: "email" })
          .then(invalidate)
          .catch((err) =>
            toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong")),
          );
      },
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (http, old browser): the text is still on screen to select.
    }
    await decide("copy");
  };

  const channelClass =
    "press flex h-12 w-full items-center gap-3 rounded-xl border px-3.5 text-left text-[14.5px] font-medium transition-colors";

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("reviews.sheetTitle", { name })}
      description={t("reviews.sheetSub")}
      footer={
        <div className="flex items-center justify-between gap-2">
          {status?.can_skip ? (
            <Button variant="ghost" disabled={!!busy} onClick={() => void decide("skipped")}>
              {t("reviews.skip")}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" loading={busy === "later"} onClick={() => void decide("later")}>
            {t("reviews.later")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-2 pt-1">
        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="review-message">
          {t("reviews.messageLabel")}
        </label>
        <Textarea
          id="review-message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="bg-card text-[14.5px] leading-relaxed"
        />
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void decide("whatsapp")}
            className={cn(channelClass, "border-foreground bg-foreground text-background hover:bg-foreground/90")}
          >
            <MessageCircle className="size-[18px] shrink-0" aria-hidden />
            {/* Where it goes, so nobody sends to the wrong number. */}
            <span className="min-w-0 truncate">
              {t("reviews.whatsapp")}
              <span className="num font-normal opacity-65"> · {candidate.phone}</span>
            </span>
          </a>
        ) : null}
        {mailHref && canSendEmail ? (
          <button
            type="button"
            onClick={composeEmail}
            disabled={!!busy}
            className={cn(channelClass, "border-border bg-card hover:border-foreground/30")}
          >
            <Mail className="size-[18px] shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              {t("reviews.email")}
              <span className="font-normal text-muted-foreground"> · {candidate.email}</span>
            </span>
          </button>
        ) : mailHref ? (
          <a
            href={mailHref}
            onClick={() => void decide("email")}
            className={cn(channelClass, "border-border bg-card hover:border-foreground/30")}
          >
            <Mail className="size-[18px] shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              {t("reviews.email")}
              <span className="font-normal text-muted-foreground"> · {candidate.email}</span>
            </span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!!busy}
          className={cn(channelClass, "border-border bg-card hover:border-foreground/30")}
        >
          <Copy className="size-[18px]" aria-hidden />
          {t("reviews.copy")}
        </button>
        {!waHref ? (
          <p className="text-[13px] text-muted-foreground">
            {mailHref ? t("reviews.noPhone") : t("reviews.noPhoneNoEmail")}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

interface ReviewAskApi {
  /** Open the sheet for a customer from the Today list. */
  ask: (candidate: ReviewCandidate) => void;
  /**
   * After a deal was won or paid: open the sheet when this is the moment the
   * business asks (visit → won, project → paid) and the customer is due.
   */
  afterDeal: (dealId: string, moment: ReviewMoment) => void;
}

const ReviewAskContext = createContext<ReviewAskApi | null>(null);

export function ReviewAskProvider({ children }: { children: React.ReactNode }) {
  const { canAsk, status } = useReviewStatus();
  const [candidate, setCandidate] = useState<ReviewCandidate | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  const show = useCallback((c: ReviewCandidate) => {
    setCandidate(c);
    setSession((n) => n + 1);
    setOpen(true);
  }, []);

  const moment = status?.moment ?? null;
  const api = useMemo<ReviewAskApi>(
    () => ({
      ask: (c) => {
        if (canAsk) show(c);
      },
      afterDeal: (dealId, happened) => {
        if (!canAsk || happened !== moment) return;
        // Let the win / paid toast land first; the sheet follows it.
        void getReviewForDeal(dealId)
          .then((c) => {
            if (c && !c.snoozed) window.setTimeout(() => show(c), 450);
          })
          .catch(() => {});
      },
    }),
    [canAsk, moment, show],
  );

  return (
    <ReviewAskContext.Provider value={api}>
      {children}
      <ReviewAskSheet key={`review-${session}`} candidate={candidate} open={open} onOpenChange={setOpen} />
    </ReviewAskContext.Provider>
  );
}

export function useReviewAsk(): ReviewAskApi {
  return useContext(ReviewAskContext) ?? { ask: () => {}, afterDeal: () => {} };
}
