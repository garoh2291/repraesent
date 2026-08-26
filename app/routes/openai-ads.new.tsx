import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Info,
  Megaphone,
  Rocket,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createOpenaiAd,
  createOpenaiAdGroup,
  createOpenaiCampaign,
  openaiEntityAction,
  uploadOpenaiFile,
  type OpenaiAd,
  type OpenaiAdGroup,
  type OpenaiCampaign,
} from "~/lib/api/openai-ads";
import { useCanManageOpenaiAds } from "~/lib/hooks/useOpenaiAds";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { toMicros } from "~/components/openai-ads/micros";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export function meta() {
  return [
    { title: `${i18n.t("openaiAds.create.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("openaiAds.metaDescription") },
  ];
}

type BiddingType = "impressions" | "clicks" | "conversions";
type BillingEventType = "impression" | "click";

const STEPS = ["campaign", "adGroup", "ad"] as const;
type Step = (typeof STEPS)[number] | "done";

/**
 * Three-step creation flow mirroring the API's hierarchy. Every entity is
 * created paused; the closing screen offers one explicit "activate" that
 * flips campaign, ad group and ad together — matching OpenAI's own partner
 * guidance of never letting anything serve before the whole chain exists.
 */
export default function OpenaiAdsNew() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "openaiAds.create.metaTitle",
    descriptionKey: "openaiAds.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const canManage = useCanManageOpenaiAds();
  const [step, setStep] = useState<Step>("campaign");
  const [campaign, setCampaign] = useState<OpenaiCampaign | null>(null);
  const [adGroup, setAdGroup] = useState<OpenaiAdGroup | null>(null);
  const [ad, setAd] = useState<OpenaiAd | null>(null);

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-[720px] p-4 py-10! sm:p-6">
        <p className="text-sm text-muted-foreground">
          {t("openaiAds.create.adminOnly", {
            defaultValue: "Only workspace admins can create campaigns.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 p-4 py-10! sm:p-6 app-fade-in">
      <div className="space-y-1">
        <Link
          to="/openai-ads"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("openaiAds.create.back", { defaultValue: "Back to campaigns" })}
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          {t("openaiAds.create.title", { defaultValue: "New campaign" })}
        </h1>
      </div>

      {step !== "done" ? <Stepper current={step} /> : null}

      {step === "campaign" ? (
        <CampaignStep
          onCreated={(c) => {
            setCampaign(c);
            setStep("adGroup");
          }}
        />
      ) : null}
      {step === "adGroup" && campaign ? (
        <AdGroupStep
          campaign={campaign}
          onCreated={(g) => {
            setAdGroup(g);
            setStep("ad");
          }}
        />
      ) : null}
      {step === "ad" && adGroup ? (
        <AdStep
          adGroup={adGroup}
          onCreated={(a) => {
            setAd(a);
            setStep("done");
          }}
        />
      ) : null}
      {step === "done" && campaign && adGroup && ad ? (
        <DoneStep campaign={campaign} adGroup={adGroup} ad={ad} />
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: (typeof STEPS)[number] }) {
  const { t } = useTranslation();
  const idx = STEPS.indexOf(current);

  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
              i < idx
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : i === idx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < idx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span
            className={
              i === idx
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {t(`openaiAds.create.steps.${s}`, {
              defaultValue:
                s === "campaign"
                  ? "Campaign"
                  : s === "adGroup"
                    ? "Ad group"
                    : "Ad",
            })}
          </span>
          {i < STEPS.length - 1 ? (
            <span className="h-px w-6 bg-border" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — campaign
// ---------------------------------------------------------------------------

function CampaignStep({
  onCreated,
}: {
  onCreated: (campaign: OpenaiCampaign) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [bidding, setBidding] = useState<BiddingType>("impressions");

  const mutation = useMutation({
    mutationFn: createOpenaiCampaign,
    onSuccess: onCreated,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const budgetMicros = toMicros(budget);
  const valid =
    name.trim().length >= 3 &&
    budgetMicros != null &&
    budgetMicros >= 1_000_000;

  return (
    <Card>
      <div className="space-y-1.5">
        <Label htmlFor="c-name">
          {t("openaiAds.create.campaignName", {
            defaultValue: "Campaign name",
          })}
        </Label>
        <Input
          id="c-name"
          value={name}
          maxLength={1000}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("openaiAds.create.campaignNamePlaceholder", {
            defaultValue: "e.g. Autumn lead push",
          })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-budget">
          {t("openaiAds.create.budget", {
            defaultValue: "Lifetime budget",
          })}
        </Label>
        <Input
          id="c-budget"
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="500"
        />
        <p className="text-xs text-muted-foreground">
          {t("openaiAds.create.budgetHelp", {
            defaultValue:
              "The total the campaign may spend across its whole life. You can raise it later.",
          })}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          {t("openaiAds.create.bidding", { defaultValue: "Optimize for" })}
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(["impressions", "clicks", "conversions"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBidding(b)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                bidding === b
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              {t(`openaiAds.bidding.${b}`, { defaultValue: b })}
            </button>
          ))}
        </div>
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {t("openaiAds.create.biddingImmutable", {
            defaultValue:
              "This cannot be changed after the campaign is created. Conversions bidding needs conversion tracking turned on in settings first.",
          })}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              name: name.trim(),
              lifetime_spend_limit_micros: budgetMicros!,
              bidding_type: bidding,
            })
          }
        >
          {mutation.isPending
            ? t("common.loading", { defaultValue: "Loading…" })
            : t("openaiAds.create.next", { defaultValue: "Continue" })}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — ad group
// ---------------------------------------------------------------------------

function AdGroupStep({
  campaign,
  onCreated,
}: {
  campaign: OpenaiCampaign;
  onCreated: (group: OpenaiAdGroup) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(
    t("openaiAds.create.adGroupDefaultName", {
      defaultValue: "{{campaign}} — ad group 1",
      campaign: campaign.name,
    }),
  );
  const [billing, setBilling] = useState<BillingEventType>("impression");
  const [maxBid, setMaxBid] = useState("");
  const [hints, setHints] = useState("");

  const mutation = useMutation({
    mutationFn: createOpenaiAdGroup,
    onSuccess: onCreated,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const bidMicros = toMicros(maxBid);
  const valid = name.trim().length >= 3 && bidMicros != null && bidMicros >= 1;

  return (
    <Card>
      <div className="space-y-1.5">
        <Label htmlFor="g-name">
          {t("openaiAds.create.adGroupName", { defaultValue: "Ad group name" })}
        </Label>
        <Input
          id="g-name"
          value={name}
          maxLength={1000}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          {t("openaiAds.create.billingEvent", { defaultValue: "Pay per" })}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(["impression", "click"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                billing === b
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              {t(`openaiAds.billing.${b}`, { defaultValue: b })}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="g-bid">
          {t("openaiAds.create.maxBid", { defaultValue: "Maximum bid" })}
        </Label>
        <Input
          id="g-bid"
          inputMode="decimal"
          value={maxBid}
          onChange={(e) => setMaxBid(e.target.value)}
          placeholder={billing === "impression" ? "0.06" : "0.50"}
        />
        <p className="text-xs text-muted-foreground">
          {billing === "impression"
            ? t("openaiAds.create.maxBidHelpImpression", {
                defaultValue: "The most you pay per single impression.",
              })
            : t("openaiAds.create.maxBidHelpClick", {
                defaultValue: "The most you pay per click.",
              })}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="g-hints">
          {t("openaiAds.create.hints", {
            defaultValue: "Audience hints (optional)",
          })}
        </Label>
        <Textarea
          id="g-hints"
          value={hints}
          rows={2}
          onChange={(e) => setHints(e.target.value)}
          placeholder={t("openaiAds.create.hintsPlaceholder", {
            defaultValue:
              "Free text, one hint per line — e.g. small business owners in Germany",
          })}
        />
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              campaign_id: campaign.id,
              name: name.trim(),
              billing_event_type: billing,
              max_bid_micros: bidMicros!,
              context_hints: hints
                .split("\n")
                .map((h) => h.trim())
                .filter(Boolean),
            })
          }
        >
          {mutation.isPending
            ? t("common.loading", { defaultValue: "Loading…" })
            : t("openaiAds.create.next", { defaultValue: "Continue" })}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — ad
// ---------------------------------------------------------------------------

function AdStep({
  adGroup,
  onCreated,
}: {
  adGroup: OpenaiAdGroup;
  onCreated: (ad: OpenaiAd) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(adGroup.name);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [price, setPrice] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadOpenaiFile,
    onSuccess: (result, file) => {
      setFileId(result.file_id);
      setFileName(file.name);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: createOpenaiAd,
    onSuccess: onCreated,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const valid =
    name.trim().length >= 3 &&
    title.trim().length >= 3 &&
    title.trim().length <= 50 &&
    body.trim().length > 0 &&
    body.trim().length <= 100 &&
    /^https?:\/\//.test(targetUrl.trim());

  return (
    <Card>
      <div className="space-y-1.5">
        <Label htmlFor="a-name">
          {t("openaiAds.create.adName", { defaultValue: "Ad name (internal)" })}
        </Label>
        <Input
          id="a-name"
          value={name}
          maxLength={1000}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="a-title">
            {t("openaiAds.create.adTitle", { defaultValue: "Title" })}
          </Label>
          <span
            className={`text-[11px] tabular-nums ${
              title.length > 50 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {title.length}/50
          </span>
        </div>
        <Input
          id="a-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("openaiAds.create.adTitlePlaceholder", {
            defaultValue: "Shown as the card headline in ChatGPT",
          })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="a-body">
            {t("openaiAds.create.adBody", { defaultValue: "Description" })}
          </Label>
          <span
            className={`text-[11px] tabular-nums ${
              body.length > 100 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {body.length}/100
          </span>
        </div>
        <Textarea
          id="a-body"
          value={body}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="a-url">
          {t("openaiAds.create.targetUrl", {
            defaultValue: "Landing page URL",
          })}
        </Label>
        <Input
          id="a-url"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://"
        />
        <p className="text-xs text-muted-foreground">
          {t("openaiAds.create.targetUrlHelp", {
            defaultValue:
              "OpenAI adds ?oppref=… to this URL. With conversion tracking on, leads from this page are attributed automatically.",
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-image">
            {t("openaiAds.create.image", { defaultValue: "Image (optional)" })}
          </Label>
          <label
            htmlFor="a-image"
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-border/80"
          >
            <ImagePlus className="h-4 w-4" />
            {uploadMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : (fileName ??
                t("openaiAds.create.imageChoose", {
                  defaultValue: "Choose PNG or JPEG",
                }))}
          </label>
          <input
            id="a-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-price">
            {t("openaiAds.create.price", {
              defaultValue: "Price text (optional)",
            })}
          </Label>
          <Input
            id="a-price"
            value={price}
            maxLength={50}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("openaiAds.create.pricePlaceholder", {
              defaultValue: "e.g. from €29/month",
            })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={
            !valid || createMutation.isPending || uploadMutation.isPending
          }
          onClick={() =>
            createMutation.mutate({
              ad_group_id: adGroup.id,
              name: name.trim(),
              creative_type: "chat_card",
              title: title.trim(),
              body: body.trim(),
              target_url: targetUrl.trim(),
              file_id: fileId ?? undefined,
              price: price.trim() || undefined,
            })
          }
        >
          {createMutation.isPending
            ? t("common.loading", { defaultValue: "Loading…" })
            : t("openaiAds.create.createAd", { defaultValue: "Create ad" })}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

function DoneStep({
  campaign,
  adGroup,
  ad,
}: {
  campaign: OpenaiCampaign;
  adGroup: OpenaiAdGroup;
  ad: OpenaiAd;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: async () => {
      // Bottom-up so nothing is active while its children are still paused.
      await openaiEntityAction("ads", ad.id, "activate");
      await openaiEntityAction("ad-groups", adGroup.id, "activate");
      await openaiEntityAction("campaigns", campaign.id, "activate");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("openai-ads"),
      });
      toast.success(
        t("openaiAds.create.activated", {
          defaultValue:
            "Campaign activated — it serves once the ad passes review",
        }),
      );
      void navigate("/openai-ads");
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <Card>
      <div className="space-y-2 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500/10">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {t("openaiAds.create.doneTitle", {
            defaultValue: "“{{name}}” is ready",
            name: campaign.name,
          })}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t("openaiAds.create.doneBody", {
            defaultValue:
              "Everything was created paused, and the ad goes through OpenAI's review first. Activate now, or keep it paused and activate later from the campaign list.",
          })}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" asChild>
          <Link to="/openai-ads">
            {t("openaiAds.create.keepPaused", {
              defaultValue: "Keep paused",
            })}
          </Link>
        </Button>
        <Button
          disabled={activateMutation.isPending}
          onClick={() => activateMutation.mutate()}
        >
          <Rocket className="mr-1.5 h-4 w-4" />
          {activateMutation.isPending
            ? t("common.loading", { defaultValue: "Loading…" })
            : t("openaiAds.create.activateNow", {
                defaultValue: "Activate now",
              })}
        </Button>
      </div>
    </Card>
  );
}
