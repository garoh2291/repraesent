import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Radar, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
  TwoCol,
} from "~/components/wordpress/fields";
import { VISIBILITY_ENGINES } from "~/lib/api/re-visible";
import { engineLabel } from "./constants";

/**
 * First run.
 *
 * Deliberately three fields. Everything else — the domains, the engines, the
 * caps — has a sensible default, and the domains are read from the site itself
 * server-side. Asking for more up front is the surest way to have a client
 * abandon setup and never see a number.
 */
export function SetupWizard({
  defaultBrandName,
  defaultLocale,
  onCreate,
  creating,
}: {
  defaultBrandName: string;
  defaultLocale: string;
  onCreate: (input: {
    brand_name: string;
    country: string;
    competitors: { name: string; domains: string[] }[];
    locale: string;
  }) => void;
  creating: boolean;
}) {
  const { t } = useTranslation();
  const [brandName, setBrandName] = useState(defaultBrandName);
  const [country, setCountry] = useState("");
  const [competitors, setCompetitors] = useState("");

  return (
    <SectionCard>
      <CardHeader
        icon={<Radar className="size-4" aria-hidden />}
        title={t("wordpress.reVisible.setupTitle", "Start tracking AI answers")}
        subtitle={t(
          "wordpress.reVisible.setupSubtitle",
          "We ask ChatGPT, Claude, Perplexity and Gemini the questions your buyers ask, then report whether they name you, cite your pages, or recommend someone else.",
        )}
      />
      <CardBody>
        <TwoCol>
          <Field>
            <Label htmlFor="rv-setup-brand">
              {t("wordpress.reVisible.brandName", "Brand name")}
            </Label>
            <Input
              id="rv-setup-brand"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder={t(
                "wordpress.reVisible.brandNamePlaceholder",
                "The name a customer would say",
              )}
            />
            <FieldHint>
              {t(
                "wordpress.reVisible.brandNameHint",
                "Exactly as the engines would write it. Other spellings can be added later.",
              )}
            </FieldHint>
          </Field>

          <Field>
            <Label htmlFor="rv-setup-country">
              {t("wordpress.reVisible.market", "Market")}
            </Label>
            <Input
              id="rv-setup-country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder={t("wordpress.reVisible.marketPlaceholder", "Germany")}
            />
            <FieldHint>
              {t(
                "wordpress.reVisible.marketSetupHint",
                "Optional. With it we also track local questions like “near me” searches.",
              )}
            </FieldHint>
          </Field>
        </TwoCol>

        <Field>
          <Label htmlFor="rv-setup-competitors">
            {t("wordpress.reVisible.competitorsOptional", "Competitors (optional)")}
          </Label>
          <Input
            id="rv-setup-competitors"
            value={competitors}
            onChange={(event) => setCompetitors(event.target.value)}
            placeholder={t(
              "wordpress.reVisible.competitorsPlaceholder",
              "Two or three names, comma separated",
            )}
          />
          <FieldHint>
            {t(
              "wordpress.reVisible.competitorsHint",
              "You do not have to guess — we report every brand the engines name, and you can add them afterwards.",
            )}
          </FieldHint>
        </Field>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t("wordpress.reVisible.willAsk", "We will ask:")}</span>
          {VISIBILITY_ENGINES.map((engine) => (
            <span key={engine} className="rounded-full border px-2 py-0.5">
              {engineLabel(engine)}
            </span>
          ))}
        </div>

        <Button
          disabled={!brandName.trim() || creating}
          onClick={() =>
            onCreate({
              brand_name: brandName.trim(),
              country: country.trim(),
              competitors: splitNames(competitors),
              locale: defaultLocale,
            })
          }
        >
          {creating ? (
            <>
              <Spinner className="size-3.5" />
              {t("wordpress.reVisible.settingUp", "Setting up…")}
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" aria-hidden />
              {t("wordpress.reVisible.setupCta", "Set up and suggest questions")}
            </>
          )}
        </Button>

        <InfoNote>
          {t(
            "wordpress.reVisible.setupNote",
            "The engines are asked once a week, several times per question, because the same question gets a different answer each time. Nothing is asked until you have added questions.",
          )}
        </InfoNote>
      </CardBody>
    </SectionCard>
  );
}

function splitNames(value: string): { name: string; domains: string[] }[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ name, domains: [] }));
}
