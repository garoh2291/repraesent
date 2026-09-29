import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Loader2, Printer, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { TextInput } from "~/components/onboarding-v2/primitives";
import { PlaceCard } from "~/components/onboarding-v2/steps/presence";
import { findGoogleListing } from "~/lib/api/google-reviews";
import type { PlaceCandidate } from "~/lib/api/onboarding-v2";
import { errorCodeOf } from "~/lib/api/onboarding-v2";
import { saveWorkspaceProfile, type WorkspaceProfileView } from "~/lib/api/workspace-profile";
import { useReviewStatus } from "~/components/notebook/review-ask";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Settings → Business profile → Google reviews (GOOGLE_REVIEWS_PLAN.md,
 * pilot). No listing yet: find it. Listing linked: the printable review card
 * for the counter.
 */
export function ReviewSettings({ view, queryKey }: { view: WorkspaceProfileView; queryKey: readonly unknown[] }) {
  const { t } = useTranslation();
  const { on, status } = useReviewStatus();
  if (!on || !status) return null;
  return (
    <section id="google-reviews" className="scroll-mt-24 space-y-3">
      <SectionLabel>{t("reviews.settingsLabel")}</SectionLabel>
      {status.review_url ? (
        <ReviewCard url={status.review_url} business={status.business_name || status.google_name || ""} />
      ) : (
        <FindListing
          hint={status.search_hint ?? ""}
          available={status.places_available}
          canEdit={view.can_edit}
          queryKey={queryKey}
        />
      )}
    </section>
  );
}

function FindListing({
  hint,
  available,
  canEdit,
  queryKey,
}: {
  hint: string;
  available: boolean;
  canEdit: boolean;
  queryKey: readonly unknown[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [query, setQuery] = useState(hint);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      setResults(await findGoogleListing(query));
    } catch (err) {
      setError(errorCodeOf(err) === "PLACES_NOT_CONFIGURED" ? t("reviews.findUnavailable") : t("reviews.findFailed"));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (p: PlaceCandidate) => {
    setSaving(p.place_id);
    try {
      const fresh = await saveWorkspaceProfile(
        {
          google_business: {
            status: "has",
            place_id: p.place_id,
            name: p.name,
            maps_url: p.maps_url,
            rating: p.rating,
            review_count: p.review_count,
            address: p.address,
            phone: p.phone,
            primary_type: p.primary_type,
          },
        },
        [],
      );
      qc.setQueryData(queryKey, fresh);
      await qc.invalidateQueries({ queryKey: ["google-reviews"] });
      toast.success(t("reviews.findSaved"));
    } catch {
      toast.error(t("reviews.findSaveFailed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">{t("reviews.findTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("reviews.findSub")}</p>
      </div>
      {!available ? (
        <p className="text-sm text-muted-foreground">{t("reviews.findUnavailable")}</p>
      ) : !canEdit ? (
        <p className="text-xs text-muted-foreground">{t("settings.businessProfile.adminOnly")}</p>
      ) : (
        <>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) void search();
            }}
          >
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("reviews.findPlaceholder")}
              aria-label={t("reviews.findPlaceholder")}
              className="flex-1"
            />
            <Button type="submit" variant="outline" className="h-10 gap-1.5" disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
              {t("reviews.findButton")}
            </Button>
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {results && results.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{t("reviews.findNothing")}</p>
          ) : null}
          {results && results.length > 0 ? (
            <div className="space-y-2">
              {results.map((p) => (
                <PlaceCard key={p.place_id} place={p} busy={saving === p.place_id} onPick={() => void pick(p)} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The counter card: paper, ink, one yellow marker line, a QR code to Google's
 * review form. Customer-facing text, so formal (Sie / vous / u).
 */
function ReviewCard({ url, business }: { url: string; business: string }) {
  const { t } = useTranslation();
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#141516", light: "#00000000" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [url]);

  const headline = t("reviews.card.headline");
  const line = t("reviews.card.line");
  const scan = t("reviews.card.scan");

  const print = () => {
    if (!svg) return;
    const w = window.open("", "_blank", "width=520,height=760");
    if (!w) {
      toast.error(t("reviews.card.popupBlocked"));
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(business || headline)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600&display=swap" rel="stylesheet">
<style>
@page { size: A6 portrait; margin: 0; }
html,body { margin:0; background:#f5f4f1; color:#141516; font-family: Lora, Georgia, serif; }
.card { box-sizing:border-box; width:105mm; height:148mm; padding:12mm 10mm; display:flex; flex-direction:column; align-items:center; justify-content:space-between; text-align:center; }
.biz { font-size:11pt; letter-spacing:.08em; text-transform:uppercase; font-family: system-ui, sans-serif; font-weight:600; }
h1 { font-size:24pt; font-weight:600; line-height:1.15; margin:0; }
.mark { background: linear-gradient(transparent 55%, #f5d74f 55%, #f5d74f 92%, transparent 92%); padding:0 .1em; }
.qr { width:52mm; height:52mm; } .qr svg { width:100%; height:100%; }
.line { font-size:13pt; margin:0; } .scan { font-size:9pt; font-family: system-ui, sans-serif; opacity:.7; margin:0; }
</style></head><body><div class="card">
<div class="biz">${esc(business)}</div>
<h1><span class="mark">${esc(headline)}</span></h1>
<div class="qr">${svg}</div>
<p class="line">${esc(line)}</p>
<p class="scan">${esc(scan)}</p>
</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
      {/* Preview, the same card at a glance */}
      <div className="mx-auto flex w-[180px] shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-background px-4 py-5 text-center sm:mx-0">
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">{business}</p>
        <p className="font-serif text-[15px] font-semibold leading-tight text-foreground">
          <span className="bg-[linear-gradient(transparent_55%,var(--secondary)_55%,var(--secondary)_92%,transparent_92%)] px-0.5">
            {headline}
          </span>
        </p>
        <div className="size-[92px] [&_svg]:size-full" aria-hidden dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
        <p className="text-[10.5px] leading-snug text-foreground">{line}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">{t("reviews.card.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("reviews.card.sub")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-10 gap-1.5" disabled={!svg} onClick={print}>
            <Printer className="size-4" aria-hidden />
            {t("reviews.card.print")}
          </Button>
          <Button type="button" variant="outline" className="h-10" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {t("reviews.card.test")}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
