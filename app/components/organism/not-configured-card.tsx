import type { ComponentType } from "react";
import { Link } from "react-router";
import { Settings2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface Props {
  title: string;
  body: string;
  ctaLabel: string;
  /** Where the CTA sends the user to fix it. */
  to: string;
  /** Lucide icon; defaults to Settings2. */
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * "Nothing set up here yet" panel: dashed card, one line of explanation and
 * a single CTA pointing at the place that fixes it. Used by the Stripe
 * empty states and by demo workspaces, where every page stays reachable so
 * the visitor can see what the feature is before configuring anything.
 */
export function NotConfiguredCard({
  title,
  body,
  ctaLabel,
  to,
  icon: Icon = Settings2,
  className,
}: Props) {
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
        <Link to={to}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
