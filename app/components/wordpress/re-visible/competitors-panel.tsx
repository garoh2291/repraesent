import { useTranslation } from "react-i18next";
import { Plus, Users } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import type { CompetitorsResponse } from "~/lib/api/re-visible";
import { engineColor, engineLabel, formatPercent } from "./constants";

/**
 * Who the engines name instead.
 *
 * The discovered list is the point of this tab. A client can name the three
 * rivals they think about; the engines routinely name others, and that is
 * information they cannot get anywhere else.
 */
export function CompetitorsPanel({
  data,
  loading,
  configured,
  onAddCompetitor,
  saving,
}: {
  data: CompetitorsResponse | undefined;
  loading: boolean;
  configured: string[];
  onAddCompetitor: (name: string) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  const perEngine = data?.per_engine ?? [];
  const discovered = data?.discovered ?? [];
  const configuredSet = new Set(configured.map((name) => name.toLowerCase()));

  const hasData = perEngine.some((engine) => engine.brands.length > 0);

  return (
    <div className="space-y-6">
      {discovered.length > 0 ? (
        <SectionCard>
          <CardHeader
            icon={<Users className="size-4" aria-hidden />}
            title={t(
              "wordpress.reVisible.discoveredTitle",
              "Named by the engines, not on your list",
            )}
            subtitle={t(
              "wordpress.reVisible.discoveredSubtitle",
              "Add one as a competitor to track its share of the answers alongside yours.",
            )}
          />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {discovered.map((brand) => (
                <li key={brand.name}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || configuredSet.has(brand.name.toLowerCase())}
                    onClick={() => onAddCompetitor(brand.name)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {brand.name}
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      {brand.mentions}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </SectionCard>
      ) : null}

      <SectionCard>
        <CardHeader
          title={t("wordpress.reVisible.shareTitle", "Share of the answers")}
          subtitle={t(
            "wordpress.reVisible.shareSubtitle",
            "Of every brand named across your tracked questions, how often each one was named.",
          )}
        />
        <CardBody>
          {!hasData ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reVisible.shareEmpty",
                "Run a check to see who the engines name.",
              )}
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {perEngine
                .filter((engine) => engine.brands.length > 0)
                .map((engine) => {
                  const max = engine.brands[0]?.mentions ?? 1;

                  return (
                    <div key={engine.engine}>
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: engineColor(engine.engine) }}
                        />
                        <h3 className="text-sm font-semibold">
                          {engineLabel(engine.engine)}
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {engine.brands.slice(0, 10).map((brand) => (
                          <li key={brand.name} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span
                                className={
                                  brand.is_self
                                    ? "truncate font-semibold"
                                    : "truncate text-muted-foreground"
                                }
                              >
                                {brand.name}
                                {brand.is_self ? (
                                  <Badge
                                    variant="secondary"
                                    className="ml-1.5 text-[10px]"
                                  >
                                    {t("wordpress.reVisible.you", "you")}
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formatPercent(brand.share)}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round((brand.mentions / max) * 100)}%`,
                                  // Your own bar carries the engine colour; the
                                  // rivals stay neutral, so the comparison reads
                                  // at a glance.
                                  background: brand.is_self
                                    ? engineColor(engine.engine)
                                    : "var(--muted-foreground)",
                                  opacity: brand.is_self ? 1 : 0.35,
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
            </div>
          )}
        </CardBody>
      </SectionCard>

      <InfoNote>
        {t(
          "wordpress.reVisible.competitorNote",
          "A competitor counts as named when the answer uses their name, or when it cites one of their domains without naming them. Add their domains under Settings so both count.",
        )}
      </InfoNote>
    </div>
  );
}
