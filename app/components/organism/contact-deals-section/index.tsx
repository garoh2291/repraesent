import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { getDealsForContact } from "~/lib/api/deals";
import { formatCurrency } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";

interface ContactDealsSectionProps {
  contactRouteId: string;
  /** Shown immediately in the create-deal dialog while the contact list loads in the background. */
  contactDisplayName?: string | null;
  canEdit?: boolean;
}

export function ContactDealsSection({
  contactRouteId,
  contactDisplayName,
  canEdit = false,
}: ContactDealsSectionProps) {
  const { t } = useTranslation();
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["contact-deals", contactRouteId],
    queryFn: () => getDealsForContact(contactRouteId),
    enabled: !!contactRouteId,
  });

  const headerActions = canEdit ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 shrink-0 text-xs"
      onClick={() => setCreateDealOpen(true)}
    >
      {t("pipeline.create", { defaultValue: "Create" })}
    </Button>
  ) : null;

  return (
    <>
      <CreateDealDialog
        open={createDealOpen}
        onOpenChange={setCreateDealOpen}
        prefillContactId={contactRouteId}
        prefillContactLabel={contactDisplayName}
        canCreate={canEdit}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        {isLoading ? (
          <>
            <header className="flex flex-row items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h3>
              </div>
              {headerActions}
            </header>
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              {t("contacts.dealsPanel.loading", { defaultValue: "Loading deals…" })}
            </div>
          </>
        ) : deals.length === 0 ? (
          <>
            <header className="flex flex-row items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {t("contacts.dealsPanel.emptyHint", {
                    defaultValue:
                      "No deals linked yet. Use Create or add one from the pipeline.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("contacts.dealsPanel.empty", {
                defaultValue: "No deals for this contact.",
              })}
            </div>
          </>
        ) : (
          <>
            <header className="flex flex-row items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {t("contacts.dealsPanel.subtitle", {
                    defaultValue:
                      "Open a deal in the pipeline to edit stage and value.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <ul className="divide-y divide-border">
              {deals.map((d) => {
                const title =
                  d.title?.trim() ||
                  d.contact_full_name?.trim() ||
                  t("contacts.dealsPanel.untitled", { defaultValue: "Untitled deal" });
                const val =
                  d.value != null && d.value !== ""
                    ? formatCurrency(Number(d.value))
                    : null;
                return (
                  <li key={d.id}>
                    <Link
                      to={`/pipeline/${d.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(`pipeline.stages.${d.stage}`, {
                            defaultValue: d.stage,
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {val ? (
                          <span className="text-xs font-semibold tabular-nums">{val}</span>
                        ) : null}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
