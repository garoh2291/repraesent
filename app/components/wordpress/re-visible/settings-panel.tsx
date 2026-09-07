import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Building2, FileCode2, Radar, Send, Shield } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
  ToggleField,
  TwoCol,
} from "~/components/wordpress/fields";
import type { VisibilityProject } from "~/lib/api/re-visible";
import { VISIBILITY_ENGINES } from "~/lib/api/re-visible";
import {
  ENTITY_TYPES,
  TRACKING_LOCALES,
  engineLabel,
  formatMicroUsd,
  type ReVisibleSettings,
} from "./constants";

/**
 * Everything configurable, in two groups.
 *
 * WordPress options (what the plugin does on the site) and tracking config
 * (which questions get asked, of which engines, at what cost). They save through
 * different endpoints, so they are visually separated rather than pretending to
 * be one form.
 */
export function SettingsPanel({
  settings,
  onSettingsChange,
  project,
  onProjectChange,
  isAdmin,
  schemaConflictHint,
}: {
  settings: ReVisibleSettings;
  onSettingsChange: (
    updater: (prev: ReVisibleSettings) => ReVisibleSettings,
  ) => void;
  project: VisibilityProject | null;
  onProjectChange: (patch: Record<string, unknown>) => void;
  isAdmin: boolean;
  schemaConflictHint?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* --- Tracking ------------------------------------------------- */}
      {project ? (
        <SectionCard>
          <CardHeader
            icon={<Radar className="size-4" aria-hidden />}
            title={t("wordpress.reVisible.trackingTitle", "What we track")}
            subtitle={t(
              "wordpress.reVisible.trackingSubtitle",
              "Your brand as the engines would write it, and who you are measured against.",
            )}
          />
          <CardBody>
            <TwoCol>
              <Field>
                <Label htmlFor="rv-brand">
                  {t("wordpress.reVisible.brandName", "Brand name")}
                </Label>
                <Input
                  id="rv-brand"
                  defaultValue={project.brand_name}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== project.brand_name) {
                      onProjectChange({ brand_name: value });
                    }
                  }}
                />
              </Field>
              <Field>
                <Label htmlFor="rv-country">
                  {t("wordpress.reVisible.market", "Market")}
                </Label>
                <Input
                  id="rv-country"
                  defaultValue={project.country ?? ""}
                  placeholder={t("wordpress.reVisible.marketPlaceholder", "Germany")}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (project.country ?? "")) {
                      onProjectChange({ country: value });
                    }
                  }}
                />
                <FieldHint>
                  {t(
                    "wordpress.reVisible.marketHint",
                    "Used to write local questions and to tell the engines where the person asking is.",
                  )}
                </FieldHint>
              </Field>
            </TwoCol>

            <Field>
              <Label htmlFor="rv-aliases">
                {t("wordpress.reVisible.aliases", "Other spellings")}
              </Label>
              <Input
                id="rv-aliases"
                defaultValue={project.brand_aliases.join(", ")}
                placeholder={t(
                  "wordpress.reVisible.aliasesPlaceholder",
                  "Legal name, abbreviation, common misspelling",
                )}
                onBlur={(event) =>
                  onProjectChange({
                    brand_aliases: splitList(event.target.value),
                  })
                }
              />
              <FieldHint>
                {t(
                  "wordpress.reVisible.aliasesHint",
                  "An answer that names you any of these ways counts as naming you.",
                )}
              </FieldHint>
            </Field>

            <Field>
              <Label htmlFor="rv-domains">
                {t("wordpress.reVisible.siteDomains", "Your domains")}
              </Label>
              <Input
                id="rv-domains"
                defaultValue={project.site_domains.join(", ")}
                onBlur={(event) =>
                  onProjectChange({ site_domains: splitList(event.target.value) })
                }
              />
              <FieldHint>
                {t(
                  "wordpress.reVisible.siteDomainsHint",
                  "A citation of any of these counts as citing you. Add campaign or landing-page domains too.",
                )}
              </FieldHint>
            </Field>

            <CompetitorEditor project={project} onChange={onProjectChange} />

            <Field>
              <Label>{t("wordpress.reVisible.engines", "Engines")}</Label>
              <div className="flex flex-wrap gap-2">
                {VISIBILITY_ENGINES.map((engine) => {
                  const on = project.engines.includes(engine);

                  return (
                    <Button
                      key={engine}
                      type="button"
                      variant={on ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const next = on
                          ? project.engines.filter((e) => e !== engine)
                          : [...project.engines, engine];

                        // An empty selection would silently produce a project
                        // that never runs; the server would fall back to all
                        // four, which is worse than refusing the click.
                        if (next.length === 0) return;

                        onProjectChange({ engines: next });
                      }}
                    >
                      {engineLabel(engine)}
                    </Button>
                  );
                })}
              </div>
              <FieldHint>
                {t(
                  "wordpress.reVisible.enginesHint",
                  "Google's AI Overviews cannot be tracked without a separate search-results provider, so it is not offered.",
                )}
              </FieldHint>
            </Field>

            {isAdmin ? (
              <Field>
                <Label htmlFor="rv-samples">
                  {t("wordpress.reVisible.samplesPerQuestion", "Samples per question, per engine")}
                </Label>
                <Input
                  id="rv-samples"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={project.runs_per_prompt}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 1 && value !== project.runs_per_prompt) {
                      onProjectChange({ runs_per_prompt: value });
                    }
                  }}
                  className="sm:max-w-32"
                />
                <FieldHint>
                  {t(
                    "wordpress.reVisible.samplesHint",
                    "The biggest cost lever: every question is asked this many times on every engine, each week. Three turns a coin flip into a rate; one is cheap but noisy.",
                  )}
                </FieldHint>
              </Field>
            ) : null}

            {isAdmin ? (
              <TwoCol>
                <Field>
                  <Label htmlFor="rv-weekly-cap">
                    {t("wordpress.reVisible.weeklyCap", "Answers per week, at most")}
                  </Label>
                  <Input
                    id="rv-weekly-cap"
                    type="number"
                    min={1}
                    max={5000}
                    defaultValue={project.weekly_run_cap}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (value > 0 && value !== project.weekly_run_cap) {
                        onProjectChange({ weekly_run_cap: value });
                      }
                    }}
                  />
                </Field>
                <Field>
                  <Label htmlFor="rv-monthly-cap">
                    {t("wordpress.reVisible.monthlyCap", "Budget per month")}
                  </Label>
                  <Input
                    id="rv-monthly-cap"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={Math.round(
                      project.monthly_cost_cap_micro_usd / 1_000_000,
                    )}
                    onBlur={(event) => {
                      const dollars = Number(event.target.value);
                      if (dollars > 0) {
                        onProjectChange({
                          monthly_cost_cap_micro_usd: Math.round(
                            dollars * 1_000_000,
                          ),
                        });
                      }
                    }}
                  />
                  <FieldHint>
                    {t("wordpress.reVisible.currentCap", "Currently {{amount}}", {
                      amount: formatMicroUsd(project.monthly_cost_cap_micro_usd),
                    })}
                  </FieldHint>
                </Field>
              </TwoCol>
            ) : null}

            {isAdmin ? (
              <ToggleField
                checked={project.status === "active"}
                onChange={(active) =>
                  onProjectChange({ status: active ? "active" : "paused" })
                }
                label={t(
                  "wordpress.reVisible.trackingActive",
                  "Keep checking the engines every week",
                )}
              />
            ) : null}
          </CardBody>
        </SectionCard>
      ) : null}

      {/* --- Business entity ------------------------------------------ */}
      <SectionCard>
        <CardHeader
          icon={<Building2 className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.entityTitle", "Business entity")}
          subtitle={t(
            "wordpress.reVisible.entitySubtitle",
            "Published on the site as structured data so the engines resolve you as a real business. Pages with it are cited 41% of the time against 15% without.",
          )}
        />
        <CardBody>
          <TwoCol>
            <Field>
              <Label htmlFor="rv-entity-name">
                {t("wordpress.reVisible.entityName", "Name")}
              </Label>
              <Input
                id="rv-entity-name"
                value={settings.entity.name}
                onChange={(event) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    entity: { ...prev.entity, name: event.target.value },
                  }))
                }
              />
            </Field>
            <Field>
              <Label htmlFor="rv-entity-type">
                {t("wordpress.reVisible.entityType", "Type")}
              </Label>
              <Select
                value={settings.entity.type}
                onValueChange={(value) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    entity: { ...prev.entity, type: value },
                  }))
                }
              >
                <SelectTrigger id="rv-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>
                {t(
                  "wordpress.reVisible.entityTypeHint",
                  "Pick a LocalBusiness type only if customers visit a physical address.",
                )}
              </FieldHint>
            </Field>
          </TwoCol>

          <TwoCol>
            <Field>
              <Label htmlFor="rv-entity-address">
                {t("wordpress.reVisible.entityAddress", "Address")}
              </Label>
              <Textarea
                id="rv-entity-address"
                rows={3}
                value={settings.entity.address}
                onChange={(event) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    entity: { ...prev.entity, address: event.target.value },
                  }))
                }
              />
            </Field>
            <Field>
              <Label htmlFor="rv-entity-phone">
                {t("wordpress.reVisible.entityPhone", "Phone")}
              </Label>
              <Input
                id="rv-entity-phone"
                value={settings.entity.phone}
                onChange={(event) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    entity: { ...prev.entity, phone: event.target.value },
                  }))
                }
              />
            </Field>
          </TwoCol>

          <Field>
            <Label htmlFor="rv-entity-sameas">
              {t("wordpress.reVisible.profiles", "Profiles")}
            </Label>
            <Textarea
              id="rv-entity-sameas"
              rows={4}
              value={settings.entity.same_as.join("\n")}
              onChange={(event) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  entity: {
                    ...prev.entity,
                    same_as: event.target.value
                      .split(/[\r\n]+/)
                      .map((line) => line.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="https://www.linkedin.com/company/…"
            />
            <FieldHint>
              {t(
                "wordpress.reVisible.profilesHint",
                "One URL per line — LinkedIn, Wikipedia, Google Business Profile, review sites. Third-party corroboration matters far more for AI citations than backlinks do.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      {/* --- Crawlers -------------------------------------------------- */}
      <SectionCard>
        <CardHeader
          icon={<Bot className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.crawlerAccess", "Crawler access")}
          subtitle={t(
            "wordpress.reVisible.crawlerAccessSubtitle",
            "Which AI crawlers may read the site.",
          )}
        />
        <CardBody>
          <ToggleField
            checked={settings.crawlers.allow_search}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                crawlers: { ...prev.crawlers, allow_search: value },
              }))
            }
            label={t(
              "wordpress.reVisible.allowSearch",
              "Allow AI search crawlers (recommended)",
            )}
          />
          <FieldHint>
            {t(
              "wordpress.reVisible.allowSearchHint",
              "Blocking these removes the site from AI answers entirely. There is no partial version of this.",
            )}
          </FieldHint>

          <ToggleField
            checked={settings.crawlers.allow_training}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                crawlers: { ...prev.crawlers, allow_training: value },
              }))
            }
            label={t(
              "wordpress.reVisible.allowTraining",
              "Allow the content to be used for model training",
            )}
          />
          <FieldHint>
            {t(
              "wordpress.reVisible.allowTrainingHint",
              "Separate crawlers from the ones above — opting out costs no visibility.",
            )}
          </FieldHint>

          <ToggleField
            checked={settings.crawlers.block_ccbot}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                crawlers: { ...prev.crawlers, block_ccbot: value },
              }))
            }
            label={t("wordpress.reVisible.blockCcbot", "Block Common Crawl")}
          />
        </CardBody>
      </SectionCard>

      {/* --- Structured data ------------------------------------------ */}
      <SectionCard>
        <CardHeader
          icon={<Shield className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.schemaTitle", "Structured data")}
          subtitle={t(
            "wordpress.reVisible.schemaSubtitle",
            "What the site publishes for machines to read.",
          )}
        />
        <CardBody>
          {schemaConflictHint ? <InfoNote>{schemaConflictHint}</InfoNote> : null}

          {(
            [
              ["org", t("wordpress.reVisible.schemaOrg", "Business entity")],
              ["website", t("wordpress.reVisible.schemaWebsite", "Website")],
              [
                "article",
                t("wordpress.reVisible.schemaArticle", "Articles (author, dates)"),
              ],
              ["faq", t("wordpress.reVisible.schemaFaq", "FAQ")],
              [
                "breadcrumb",
                t("wordpress.reVisible.schemaBreadcrumb", "Breadcrumbs"),
              ],
            ] as const
          ).map(([key, label]) => (
            <ToggleField
              key={key}
              checked={settings.schema[key]}
              onChange={(value) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  schema: { ...prev.schema, [key]: value },
                }))
              }
              label={label}
            />
          ))}

          <Field>
            <Label htmlFor="rv-answer-position">
              {t("wordpress.reVisible.answerPosition", "Answer block position")}
            </Label>
            <Select
              value={settings.answer_block.position}
              onValueChange={(value) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  answer_block: {
                    position: value as ReVisibleSettings["answer_block"]["position"],
                  },
                }))
              }
            >
              <SelectTrigger id="rv-answer-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">
                  {t("wordpress.reVisible.positionTop", "Above the content")}
                </SelectItem>
                <SelectItem value="bottom">
                  {t("wordpress.reVisible.positionBottom", "Below the content")}
                </SelectItem>
                <SelectItem value="manual">
                  {t(
                    "wordpress.reVisible.positionManual",
                    "Only where the shortcode is placed",
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldHint>
              {t(
                "wordpress.reVisible.answerPositionHint",
                "Above the content is the default: answer-first sections earn roughly 70% more citations.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      {/* --- IndexNow -------------------------------------------------- */}
      <SectionCard>
        <CardHeader
          icon={<Send className="size-4" aria-hidden />}
          title="IndexNow"
          subtitle={t(
            "wordpress.reVisible.indexnowSubtitle",
            "Tells Bing the moment a page changes. ChatGPT search retrieves from Bing, so Bing indexation is the floor for being cited at all.",
          )}
        />
        <CardBody>
          <ToggleField
            checked={settings.indexnow.enabled}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                indexnow: { ...prev.indexnow, enabled: value },
              }))
            }
            label={t(
              "wordpress.reVisible.indexnowEnabled",
              "Submit pages when they are published or updated",
            )}
          />
          {settings.indexnow.key ? (
            <FieldHint>
              {t("wordpress.reVisible.indexnowKey", "Key file:")}{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                /{settings.indexnow.key}.txt
              </code>
            </FieldHint>
          ) : null}
        </CardBody>
      </SectionCard>

      {/* --- llms.txt --------------------------------------------------- */}
      <SectionCard>
        <CardHeader
          icon={<FileCode2 className="size-4" aria-hidden />}
          title="llms.txt"
          subtitle={t(
            "wordpress.reVisible.llmsSubtitle",
            "A plain-text index of the site for AI agents.",
          )}
        />
        <CardBody>
          <InfoNote>
            <strong>
              {t("wordpress.reVisible.honestNote", "Worth being straight about:")}
            </strong>{" "}
            {t(
              "wordpress.reVisible.llmsHonest",
              "llms.txt does not improve citations. A 300,000-domain study found removing it improved the model, one of 94,614 cited URLs was an llms.txt, and server logs show AI crawlers never fetching it. It is published because agent tooling and Lighthouse's agentic audit look for it — not as an SEO measure.",
            )}
          </InfoNote>

          <ToggleField
            checked={settings.llms.enabled}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                llms: { ...prev.llms, enabled: value },
              }))
            }
            label={t("wordpress.reVisible.llmsEnabled", "Publish /llms.txt")}
          />

          <Field>
            <Label htmlFor="rv-llms-intro">
              {t("wordpress.reVisible.llmsIntro", "Intro")}
            </Label>
            <Textarea
              id="rv-llms-intro"
              rows={3}
              value={settings.llms.intro}
              onChange={(event) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  llms: { ...prev.llms, intro: event.target.value },
                }))
              }
            />
            <FieldHint>
              {t(
                "wordpress.reVisible.llmsIntroHint",
                "One or two sentences describing the business. Falls back to the site tagline.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      {/* --- Tracking on the site -------------------------------------- */}
      <SectionCard>
        <CardHeader
          title={t("wordpress.reVisible.telemetryTitle", "Crawler tracking")}
          subtitle={t(
            "wordpress.reVisible.telemetrySubtitle",
            "Counts AI crawler visits and visits arriving from AI answers. Daily counters only — no IP addresses and nothing that identifies a visitor.",
          )}
        />
        <CardBody>
          <ToggleField
            checked={settings.telemetry.enabled}
            onChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                telemetry: { ...prev.telemetry, enabled: value },
              }))
            }
            label={t(
              "wordpress.reVisible.telemetryEnabled",
              "Count AI crawler visits and AI referrals",
            )}
          />
        </CardBody>
      </SectionCard>
    </div>
  );
}

/**
 * Competitors, as a list of name + domains.
 *
 * Domains matter: an answer often cites a competitor's site while describing
 * them generically, and without the domain that win is invisible.
 */
function CompetitorEditor({
  project,
  onChange,
}: {
  project: VisibilityProject;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");

  return (
    <Field>
      <Label>{t("wordpress.reVisible.competitors", "Competitors")}</Label>

      {project.competitors.length > 0 ? (
        <ul className="space-y-1.5">
          {project.competitors.map((competitor) => (
            <li
              key={competitor.name}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{competitor.name}</span>
                {competitor.domains.length > 0 ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {competitor.domains.join(", ")}
                  </span>
                ) : (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {t("wordpress.reVisible.noDomain", "no domain")}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    competitors: project.competitors.filter(
                      (c) => c.name !== competitor.name,
                    ),
                  })
                }
              >
                {t("wordpress.reVisible.remove", "Remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("wordpress.reVisible.competitorName", "Name")}
          className="sm:max-w-48"
        />
        <Input
          value={domains}
          onChange={(event) => setDomains(event.target.value)}
          placeholder={t(
            "wordpress.reVisible.competitorDomains",
            "their-site.com, othersite.de",
          )}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!name.trim()}
          onClick={() => {
            onChange({
              competitors: [
                ...project.competitors,
                { name: name.trim(), domains: splitList(domains) },
              ],
            });
            setName("");
            setDomains("");
          }}
        >
          {t("wordpress.reVisible.add", "Add")}
        </Button>
      </div>
    </Field>
  );
}

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
