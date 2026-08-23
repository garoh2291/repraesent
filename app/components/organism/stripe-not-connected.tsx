import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CreditCard } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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
 * sections and the /products catalogue page. Dashed card + one CTA that
 * always leads to the single place that fixes it: /settings/integrations.
 */
export function StripeNotConnected({
  title,
  body,
  icon: Icon = CreditCard,
  ctaLabel,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border p-6 text-center",
        className,
      )}
    >
      <Icon className="mx-auto h-8 w-8 text-muted-foreground/40" />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link to="/settings/integrations">
          {ctaLabel ??
            t("pipeline.stripeNotConnected.cta", {
              defaultValue: "Connect Stripe",
            })}
        </Link>
      </Button>
    </div>
  );
}
