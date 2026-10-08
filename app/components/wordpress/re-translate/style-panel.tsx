import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReTranslateStyle, ReTranslateTarget } from "~/lib/api/re-translate";
import { useReTranslateActions, useReTranslateStyle } from "~/lib/hooks/useReTranslate";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { CardBody, CardHeader, Field, FieldHint, SectionCard } from "~/components/wordpress/fields";
import { errorText, flash } from "~/components/wordpress/re-translate/constants";

const list = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

/** How the translations should sound: sent to the translator with every page. */
export function StylePanel({ target }: { target: ReTranslateTarget }) {
  const { t } = useTranslation();
  const { data, isLoading } = useReTranslateStyle(target);
  const { saveStyle } = useReTranslateActions(target);
  const [brand, setBrand] = useState<ReTranslateStyle["brand"]>({});
  const [keep, setKeep] = useState("");
  const [avoid, setAvoid] = useState("");

  useEffect(() => {
    if (!data) return;
    setBrand(data.brand ?? {});
    setKeep((data.brand?.dnt ?? []).join(", "));
    setAvoid((data.brand?.forbidden ?? []).join(", "));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
      </div>
    );
  }

  function save() {
    saveStyle.mutate(
      { name: brand.name, tone: brand.tone, audience: brand.audience, register: brand.register ?? "", notes: brand.notes, dnt: list(keep), forbidden: list(avoid) },
      {
        onSuccess: () => flash(t("wordpress.reTranslate.styleSaved", "Saved. The next translations follow it.")),
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );
  }

  return (
    <SectionCard>
      <CardHeader title={t("wordpress.reTranslate.styleTitle", "How your translations should sound")} subtitle={t("wordpress.reTranslate.styleHint", "The translator reads this before every page. Leave anything empty that you don't mind.")} />
      <CardBody>
        <Field>
          <Label>{t("wordpress.reTranslate.register", "How to speak to visitors")}</Label>
          <RadioGroup value={brand.register ?? ""} onValueChange={(v) => setBrand((b) => ({ ...b, register: v as "" | "formal" | "casual" }))} className="grid gap-2 sm:grid-cols-3">
            {[
              ["", t("wordpress.reTranslate.registerAuto", "As usual for the language")],
              ["formal", t("wordpress.reTranslate.registerFormal", "Formal (Sie, vous)")],
              ["casual", t("wordpress.reTranslate.registerCasual", "Casual (du, tu)")],
            ].map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm">
                <RadioGroupItem value={value} />
                {label}
              </label>
            ))}
          </RadioGroup>
        </Field>
        <Field>
          <Label htmlFor="re-translate-keep">{t("wordpress.reTranslate.keepWords", "Words to keep exactly as they are")}</Label>
          <Input id="re-translate-keep" className="h-10" value={keep} onChange={(e) => setKeep(e.target.value)} placeholder={t("wordpress.reTranslate.keepPlaceholder", "Your business name, product names…")} />
          <FieldHint>{t("wordpress.reTranslate.commaHint", "Separate with commas.")}</FieldHint>
        </Field>
        <Field>
          <Label htmlFor="re-translate-avoid">{t("wordpress.reTranslate.avoidWords", "Words never to use")}</Label>
          <Input id="re-translate-avoid" className="h-10" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="re-translate-tone">{t("wordpress.reTranslate.tone", "Tone")}</Label>
          <Input id="re-translate-tone" className="h-10" value={brand.tone ?? ""} onChange={(e) => setBrand((b) => ({ ...b, tone: e.target.value }))} placeholder={t("wordpress.reTranslate.tonePlaceholder", "e.g. warm, plain, no hype")} />
        </Field>
        <Field>
          <Label htmlFor="re-translate-notes">{t("wordpress.reTranslate.notes", "Anything else the translator should know")}</Label>
          <Textarea id="re-translate-notes" rows={3} value={brand.notes ?? ""} onChange={(e) => setBrand((b) => ({ ...b, notes: e.target.value }))} />
        </Field>
        <Button className="h-10" onClick={save} disabled={saveStyle.isPending}>
          {saveStyle.isPending ? <Spinner className="size-4" /> : null}
          {t("wordpress.reTranslate.saveStyle", "Save")}
        </Button>
      </CardBody>
    </SectionCard>
  );
}
