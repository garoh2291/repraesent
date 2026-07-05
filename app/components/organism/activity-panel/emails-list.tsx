import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Mail, Inbox, ArrowRight } from "lucide-react";
import { EmailCard } from "~/components/organism/email-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { emailsQuery, type ActivityContext, type Variant } from "./shared";
import { DealEmailsPanel } from "./deal-emails-panel";

export function ActivityEmailsList({
  ctx,
  variant,
}: {
  ctx: ActivityContext;
  variant: Variant;
}) {
  const { t, i18n } = useTranslation();

  // Deal context gets the segment/hide UI (rules bar + Pipeline/Hidden sub-tabs).
  if (variant === "deal") {
    return <DealEmailsPanel ctx={ctx} />;
  }

  const q = emailsQuery(ctx, variant);

  const { data, isLoading, isError } = useQuery({
    queryKey: q.key,
    queryFn: q.fn,
    enabled: !!q.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[76px] w-full rounded-xl" />
        <Skeleton className="h-[76px] w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-destructive">{t("leadEmails.loadError")}</p>
    );
  }

  const messages = data?.data ?? [];
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">
          {t("leadEmails.emptyTitle")}
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {t("leadEmails.emptyDescription")}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
          <Link to="/settings/bcc">
            <Mail className="size-3.5" />
            {t("leadEmails.emptyCta")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <EmailCard key={m.id} message={m} locale={i18n.language} />
      ))}
    </div>
  );
}
