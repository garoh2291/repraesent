import { ArrowLeft, Eye, Globe, Plus, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FieldInspector } from "~/components/forms/FieldInspector";
import { FieldPalette } from "~/components/forms/FieldPalette";
import { FormCanvas } from "~/components/forms/FormCanvas";
import { FormStatusBadge } from "~/components/forms/FormStatusBadge";
import { LanguageStrip } from "~/components/forms/LanguageStrip";
import { SharePanel } from "~/components/forms/SharePanel";
import { ThemePanel } from "~/components/forms/ThemePanel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getRawContent } from "~/lib/forms/content";
import { flattenFields } from "~/lib/forms/schema";
import { selectedFieldId, type InspectorTarget } from "~/lib/forms/selection";
import { DEMO_PUBLIC_URL } from "./constants";
import { DemoCelebration } from "./DemoCelebration";
import type { DemoState } from "./types";

/** No-ops: the demo cursor is decorative, so nothing here is ever really clicked. */
const noop = () => undefined;
const NO_ISSUES = new Map();
const NOT_TRANSLATING = new Set<never>();

interface Props {
  state: DemoState;
  /** The demo's form id — also the seeded react-query key for SharePanel. */
  demoId: string;
  /**
   * Stage is too narrow for the desktop three-column build tab.
   *
   * A prop rather than a Tailwind breakpoint because breakpoints key off the
   * viewport, and this renders into a fixed-width stage inside a modal — the
   * two disagree constantly.
   */
  compact?: boolean;
}

/**
 * The genuine builder, rendered against local state.
 *
 * Everything inside the Build / Design / Share tabs is the real component —
 * `FieldPalette`, `FormCanvas`, `FieldInspector`, `LanguageStrip`, `ThemePanel`
 * and `SharePanel` all take props only, so they run happily with no server, no
 * router and no auth. That is the whole reason this demo can be 1:1 instead of
 * a drawing of the product.
 *
 * The three things that are replicas — the Forms list, the create dialog and the
 * command bar — are replicas only because they live inline inside routes and
 * there is no component to import. Their markup is copied from
 * `forms._index.tsx` and `forms.$formId.tsx`, minus the sticky positioning and
 * negative margins, which assume page padding that does not exist in a modal.
 */
export function DemoBuilder({ state, demoId, compact = false }: Props) {
  const { t } = useTranslation();
  const { definition, activeLocale, defaultLocale } = state;

  const fields = flattenFields(definition);
  const activeFieldId = selectedFieldId(state.selection);
  const activeField = fields.find((f) => f.id === activeFieldId) ?? null;

  const inspectorTarget: InspectorTarget | null = !state.selection
    ? null
    : state.selection.kind === "header"
      ? { kind: "header", showFormTitle: definition.theme.showFormTitle }
      : state.selection.kind === "submit"
        ? { kind: "submit" }
        : activeField
          ? { kind: "field", field: activeField }
          : null;

  const getText = (key: string) =>
    getRawContent(definition, activeLocale, key);

  if (state.screen === "done") {
    return <DemoCelebration compact={compact} />;
  }

  if (state.screen === "list" || state.screen === "dialog") {
    return <DemoList state={state} compact={compact} />;
  }

  return (
    <div className={compact ? "space-y-4 p-4" : "space-y-5 p-6"}>
      {/* --- command bar (replica of forms.$formId.tsx:786) ---------------- */}
      <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
        <div
          className={`gap-3 ${
            compact
              ? "flex flex-col items-stretch px-4 py-3"
              : "flex items-center justify-between px-5 py-3.5"
          }`}
        >
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
              <ArrowLeft className="h-3 w-3" />
              {t("forms.builder.back")}
            </span>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className={`font-semibold tracking-tight text-white ${
                  compact ? "text-lg" : "text-[22px]"
                }`}
              >
                {state.name}
              </span>
              <FormStatusBadge
                tone="dark"
                status={state.live ? "published" : "draft"}
                hasUnpublishedChanges={false}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {state.live ? (
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70">
                <Eye className="h-3.5 w-3.5" />
                {t("forms.share.open")}
              </span>
            ) : null}
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#131515]">
              <Save className="h-4 w-4" />
              {t("forms.builder.save")}
            </span>
            <span
              data-demo="live"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3"
            >
              <Globe
                className={`h-3.5 w-3.5 ${state.live ? "text-emerald-400" : "text-white/40"}`}
                aria-hidden="true"
              />
              <Label className="text-sm font-medium text-white/70">
                {t("forms.builder.liveToggle")}
              </Label>
              <Switch checked={state.live} aria-label={t("forms.builder.liveToggle")} />
            </span>
          </div>
        </div>

        <div data-demo="strip" className="border-t border-white/5 px-5 py-2">
          <LanguageStrip
            locales={state.locales}
            defaultLocale={defaultLocale}
            activeLocale={activeLocale}
            onSelect={noop}
            issuesByLocale={NO_ISSUES}
            totalIssues={0}
            onFocusIssues={noop}
            translating={NOT_TRANSLATING}
            onAddLocale={noop}
            onRemoveLocale={noop}
            onMakeDefault={noop}
            onTranslateLocale={noop}
          />
        </div>
      </div>

      {/* --- tabs + panels: all real ------------------------------------- */}
      <Tabs value={state.tab}>
        <div className="border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger value="build">{t("forms.builder.tabBuild")}</TabsTrigger>
            <TabsTrigger value="design">{t("forms.builder.tabDesign")}</TabsTrigger>
            <TabsTrigger value="share">{t("forms.builder.tabShare")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="build" className={compact ? "pt-4" : "pt-5"}>
          {/* Fixed columns, not the route's responsive grid: Tailwind
              breakpoints key off the viewport, and this lives in a modal — so
              the switch is driven by the measured stage width instead.
              The compact order (canvas, palette, inspector) is the same order
              forms.$formId.tsx uses below `lg`, so a phone user sees the layout
              they'd actually get. */}
          <div
            className={
              compact
                ? "flex flex-col gap-4"
                : "grid grid-cols-[220px_minmax(0,1fr)_340px] gap-5"
            }
          >
            <aside className={compact ? "order-2" : undefined}>
              <FieldPalette onAdd={noop} />
            </aside>
            <div className={`min-w-0 ${compact ? "order-1" : ""}`}>
              <FormCanvas
                definition={definition}
                locale={activeLocale}
                fallbackLocale={defaultLocale}
                selection={state.selection}
                onSelect={noop}
                onReorder={noop}
                onDuplicateField={noop}
                onDeleteField={noop}
              />
            </div>
            <aside className={compact ? "order-3" : undefined}>
              <FieldInspector
                target={inspectorTarget}
                otherKeys={new Set()}
                otherMappings={new Set()}
                getText={getText}
                setText={noop}
                onChange={noop}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="design" className={compact ? "pt-4" : "pt-5"}>
          <ThemePanel
            definition={definition}
            locale={activeLocale}
            fallbackLocale={defaultLocale}
            getText={getText}
            setText={noop}
            onChange={noop}
          />
        </TabsContent>

        <TabsContent value="share" className={compact ? "pt-4" : "pt-5"}>
          <div data-demo="share">
            <SharePanel
              formId={demoId}
              status="published"
              hasUnpublishedChanges={false}
              defaultLocale={defaultLocale}
              publicUrl={DEMO_PUBLIC_URL}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Replica of the Forms index header + create dialog (forms._index.tsx:170). */
function DemoList({
  state,
  compact,
}: {
  state: DemoState;
  compact: boolean;
}) {
  const { t } = useTranslation();

  return (
    // min-h must exceed the stage's visible height in LAYOUT px, not screen px:
    // the stage is 560 screen px but the builder is scaled down to fit, so the
    // visible slice is ~600 layout px. At 560 the dialog's dim layer stopped
    // short and left a pale strip along the bottom of the stage.
    <div
      className={`relative min-h-[640px] ${
        compact ? "space-y-5 p-4" : "space-y-6 p-6"
      }`}
    >
      <div
        className={`gap-4 ${
          compact
            ? "flex flex-col items-start"
            : "flex items-start justify-between"
        }`}
      >
        <div className="space-y-1">
          <h1
            className={`font-semibold tracking-tight ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {t("forms.list.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("forms.list.hint")}
          </p>
        </div>
        <Button data-demo="new-form" className="shrink-0" tabIndex={-1}>
          <Plus className="h-4 w-4" />
          {t("forms.list.newForm")}
        </Button>
      </div>

      <div className="border-t" />

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <p className="font-medium">{t("forms.list.empty")}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {t("forms.list.emptyHint")}
        </p>
      </div>

      {/* The create dialog, inlined rather than portalled: a Radix portal
          renders at document.body, outside the camera's coordinate space, so
          the cursor could never be measured against it. */}
      {state.screen === "dialog" ? (
        <div
          className={`absolute inset-0 z-10 flex items-start justify-center bg-black/50 ${
            compact ? "px-4 pt-10" : "pt-20"
          }`}
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 text-foreground shadow-lg">
            <h2 className="text-lg font-semibold">{t("forms.list.newForm")}</h2>
            <div className="space-y-2">
              <label htmlFor="demo-form-name" className="text-sm font-medium">
                {t("forms.list.nameLabel")}
              </label>
              <Input
                id="demo-form-name"
                data-demo="dialog-name"
                readOnly
                value={state.name}
                tabIndex={-1}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" tabIndex={-1}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button data-demo="dialog-create" tabIndex={-1}>
                {t("forms.list.newForm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
