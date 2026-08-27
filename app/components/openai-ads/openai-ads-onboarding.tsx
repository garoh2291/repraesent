import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ExternalLink,
  KeyRound,
  PlusCircle,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { useCanManageOpenaiAds } from "~/lib/hooks/useOpenaiAds";
import { OpenAiMark } from "~/components/icons/openai-mark";
import { Button } from "~/components/ui/button";

/**
 * First-run state of /openai-ads: what the feature is, the four OpenAI-side
 * steps to an API key, and where to paste it. Everything a workspace needs to
 * get from "never heard of ChatGPT ads" to connected, without leaving to ask.
 *
 * The numbered steps are a real sequence — account before setup before key
 * before paste — so the numbering carries information, mirroring the campaign
 * wizard's stepper language.
 */

const RESOURCES = [
  {
    key: "adsManager",
    href: "https://ads.openai.com",
    fallback: "OpenAI Ads Manager",
  },
  {
    key: "helpCenter",
    href: "https://help.openai.com/en/articles/20001206-ads-manager-beta-overview",
    fallback: "Ads Manager overview (Help Center)",
  },
  {
    key: "devDocs",
    href: "https://developers.openai.com/ads/api-quickstart",
    fallback: "API quickstart (OpenAI Developers)",
  },
] as const;

const STEP_KEYS = ["createAccount", "setup", "issueKey", "paste"] as const;

export function OpenaiAdsOnboarding() {
  const { t } = useTranslation();
  const canManage = useCanManageOpenaiAds();

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <OpenAiMark className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {t("openaiAds.onboarding.heroTitle", {
                defaultValue: "Advertise inside ChatGPT",
              })}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("openaiAds.onboarding.heroBody", {
                defaultValue:
                  "OpenAI Ads places your campaigns in ChatGPT answers. Connect your ad account and this page becomes your dashboard — and every lead your forms capture is reported back to OpenAI automatically, so your campaigns learn what works.",
              })}
            </p>
            <div className="pt-1">
              {canManage ? (
                <Button asChild>
                  <Link to="/settings/openai-ads">
                    <KeyRound className="mr-1.5 h-4 w-4" />
                    {t("openaiAds.onboarding.connectCta", {
                      defaultValue: "Connect OpenAI Ads",
                    })}
                  </Link>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("openaiAds.onboarding.adminOnly", {
                    defaultValue:
                      "Ask a workspace admin to connect the account in Settings → OpenAI Ads.",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("openaiAds.onboarding.stepsTitle", {
            defaultValue: "How to get set up",
          })}
        </p>
        <ol className="mt-5 space-y-0">
          {STEP_KEYS.map((key, i) => (
            <li key={key} className="relative flex gap-4 pb-6 last:pb-0">
              {/* connector line, stopping at the last step */}
              {i < STEP_KEYS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border"
                />
              ) : null}
              <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-foreground">
                  {t(`openaiAds.onboarding.steps.${key}.title`)}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`openaiAds.onboarding.steps.${key}.body`)}
                </p>
                {key === "createAccount" ? (
                  <a
                    href="https://ads.openai.com"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2"
                  >
                    ads.openai.com
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {key === "paste" && canManage ? (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link to="/settings/openai-ads">
                      {t("openaiAds.onboarding.pasteCta", {
                        defaultValue: "Open settings",
                      })}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* What you get */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("openaiAds.onboarding.featuresTitle", {
            defaultValue: "What you get once connected",
          })}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Feature
            icon={BarChart3}
            text={t("openaiAds.onboarding.features.metrics", {
              defaultValue:
                "Live spend, clicks and conversions for every campaign, right here.",
            })}
          />
          <Feature
            icon={SlidersHorizontal}
            text={t("openaiAds.onboarding.features.control", {
              defaultValue:
                "Pause, activate and adjust budgets without opening Ads Manager.",
            })}
          />
          <Feature
            icon={PlusCircle}
            text={t("openaiAds.onboarding.features.create", {
              defaultValue:
                "Create campaigns, ad groups and ads from a guided flow.",
            })}
          />
          <Feature
            icon={Target}
            text={t("openaiAds.onboarding.features.conversions", {
              defaultValue:
                "Leads and bookings report back automatically, so OpenAI optimizes toward them.",
            })}
          />
        </div>
      </div>

      {/* Resources */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("openaiAds.onboarding.resourcesTitle", {
            defaultValue: "From OpenAI",
          })}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {RESOURCES.map((r) => (
            <a
              key={r.key}
              href={r.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-3 text-sm font-medium text-foreground transition hover:border-border/60 hover:bg-muted/40"
            >
              <span className="min-w-0 truncate">
                {t(`openaiAds.onboarding.resources.${r.key}`, {
                  defaultValue: r.fallback,
                })}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
