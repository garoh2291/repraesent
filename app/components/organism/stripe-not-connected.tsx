import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard } from "lucide-react";
import { NotConfiguredCard } from "~/components/organism/not-configured-card";

interface Props {
  title: string;
  body: string;
  /** Lucide icon; defaults to CreditCard. */
  icon?: ComponentType<{ className?: string }>;
  /** Override the button label (defaults to pipeline.stripeNotConnected.cta). */
  ctaLabel?: string;
  className?: string;
}

/**
 * "Connect Stripe first" empty state, shared by the deal-page Stripe
 * sections and the /products catalogue page. Always leads to the single
 * place that fixes it: /settings/integrations.
 */
export function StripeNotConnected({
  title,
  body,
  icon = CreditCard,
  ctaLabel,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <NotConfiguredCard
      title={title}
      body={body}
      icon={icon}
      to="/settings/integrations"
      ctaLabel={
        ctaLabel ??
        t("pipeline.stripeNotConnected.cta", { defaultValue: "Connect Stripe" })
      }
      className={className}
    />
  );
}
