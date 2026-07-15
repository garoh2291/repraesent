import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Copy, LayoutTemplate, Pencil, Save, Zap } from "lucide-react";
import type {
  ReAppointmentActionType,
  ReAppointmentButtonConfig,
  ReAppointmentPage,
  ReAppointmentSlot,
} from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { ACTION_TYPES, ACTION_TYPE_I18N, shortcodeFor, type SetConfig } from "./constants";
import {
  CardHeader,
  ColorInput,
  Field,
  FieldHint,
  PageShell,
  SectionCard,
  ToggleField,
  TwoCol,
} from "~/components/wordpress/fields";
import { PlacementCard } from "./placement-card";
import { PreviewButton } from "./preview-button";

type TabId = "action" | "design" | "placement";

export function ButtonEditor({
  draft,
  buttonId,
  pages,
  slots,
  saving,
  onSet,
  onSave,
  onCancel,
  onCopied,
}: {
  draft: ReAppointmentButtonConfig;
  buttonId: number;
  pages: ReAppointmentPage[];
  slots: ReAppointmentSlot[];
  saving: boolean;
  onSet: SetConfig;
  onSave: () => void;
  onCancel: () => void;
  onCopied: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("action");

  const action = draft.action_type;
  const showUrl = action === "modal-iframe" || action === "url";
  const showModalSize = action === "modal-iframe" || action === "modal-html";

  const shortcode = buttonId ? shortcodeFor(buttonId) : "";

  async function copyShortcode() {
    try {
      await navigator.clipboard.writeText(shortcode);
      onCopied();
    } catch {
      /* clipboard blocked; the code is on screen */
    }
  }

  return (
    <PageShell id="reappt-editor">
      <div className="app-fade-up">
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("wordpress.reAppointment.allButtons", "All buttons")}
        </button>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {buttonId
            ? t("wordpress.reAppointment.editButton", "Edit button")
            : t("wordpress.reAppointment.newButton", "New button")}
        </h1>
      </div>

      {shortcode ? (
        <SectionCard className="app-fade-up">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("wordpress.reAppointment.shortcode", "Shortcode")}
              </p>
              <code
                id="reappt-shortcode-text"
                className="block truncate font-mono text-sm"
              >
                {shortcode}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={copyShortcode}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("wordpress.reAppointment.copy", "Copy")}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        className="app-fade-up app-fade-up-d1 gap-4"
      >
        <TabsList
          aria-label={t(
            "wordpress.reAppointment.buttonSettings",
            "Button settings",
          )}
          className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit"
        >
          <TabsTrigger value="action" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {t("wordpress.reAppointment.tabAction", "Action settings")}
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            {t("wordpress.reAppointment.tabDesign", "Button design")}
          </TabsTrigger>
          <TabsTrigger value="placement" className="gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            {t("wordpress.reAppointment.tabPlacement", "Placement")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="action" className="mt-0">
          <SectionCard>
            <CardHeader
              title={t("wordpress.reAppointment.tabAction", "Action settings")}
              subtitle={t(
                "wordpress.reAppointment.actionSubtitle",
                "What happens when the button is clicked.",
              )}
            />
            <div className="space-y-5 p-5 sm:p-6">
              <Field>
                <Label>
                  {t("wordpress.reAppointment.actionType", "Action type")}
                </Label>
                <RadioGroup
                  value={action}
                  onValueChange={(v) =>
                    onSet("action_type", v as ReAppointmentActionType)
                  }
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {ACTION_TYPES.map((it) => (
                    <label
                      key={it.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        action === it.key
                          ? "border-primary/40 bg-primary/5"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value={it.key} />
                      <span>
                        {t(ACTION_TYPE_I18N[it.key], it.label)}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>

              {showUrl ? (
                <Field>
                  <Label htmlFor="reappt-url">
                    {t("wordpress.reAppointment.urlLabel", "URL / Embed source")}
                  </Label>
                  <Input
                    type="text"
                    id="reappt-url"
                    value={draft.url}
                    placeholder="https://"
                    onChange={(e) => onSet("url", e.target.value)}
                  />
                  <FieldHint>
                    {t(
                      "wordpress.reAppointment.urlHint",
                      "The page to load in the modal iframe, or the link to open.",
                    )}
                  </FieldHint>
                </Field>
              ) : null}

              {action === "modal-html" ? (
                <Field>
                  <Label htmlFor="reappt-html">
                    {t("wordpress.reAppointment.htmlLabel", "HTML content")}
                  </Label>
                  <Textarea
                    id="reappt-html"
                    rows={6}
                    value={draft.html_content}
                    placeholder={t(
                      "wordpress.reAppointment.htmlPlaceholder",
                      "Paste embed code or custom HTML…",
                    )}
                    onChange={(e) => onSet("html_content", e.target.value)}
                  />
                </Field>
              ) : null}

              {action === "page" ? (
                <Field>
                  <Label htmlFor="reappt-page">
                    {t("wordpress.reAppointment.pageLabel", "WordPress page")}
                  </Label>
                  <NativeSelect
                    id="reappt-page"
                    className="w-full max-w-full"
                    value={draft.wp_page_id}
                    onChange={(e) => onSet("wp_page_id", Number(e.target.value))}
                  >
                    <NativeSelectOption value={0}>
                      {t(
                        "wordpress.reAppointment.selectPage",
                        "— Select a page —",
                      )}
                    </NativeSelectOption>
                    {pages.map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              {action === "url" ? (
                <Field>
                  <ToggleField
                    id="reappt-new-tab"
                    checked={draft.new_tab}
                    onChange={(v) => onSet("new_tab", v)}
                    label={t("wordpress.reAppointment.newTab", "Open in new tab")}
                  />
                </Field>
              ) : null}

              {showModalSize ? (
                <div className="space-y-2">
                  <TwoCol>
                    <Field>
                      <Label htmlFor="reappt-mw">
                        {t("wordpress.reAppointment.modalWidth", "Modal width")}
                      </Label>
                      <Input
                        type="text"
                        id="reappt-mw"
                        value={draft.modal_width}
                        placeholder="900px"
                        onChange={(e) => onSet("modal_width", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="reappt-mh">
                        {t("wordpress.reAppointment.modalHeight", "Modal height")}
                      </Label>
                      <Input
                        type="text"
                        id="reappt-mh"
                        value={draft.modal_height}
                        placeholder="700px"
                        onChange={(e) => onSet("modal_height", e.target.value)}
                      />
                    </Field>
                  </TwoCol>
                  <FieldHint>
                    {t(
                      "wordpress.reAppointment.modalHint",
                      "Accepts px or %. On small screens the modal fills the viewport.",
                    )}
                  </FieldHint>
                </div>
              ) : null}

              <div className="space-y-2 border-t pt-5">
                <ToggleField
                  id="reappt-status"
                  checked={draft.status === "active"}
                  onChange={(v) => onSet("status", v ? "active" : "inactive")}
                  label={t("wordpress.reAppointment.active", "Active")}
                />
                <FieldHint>
                  {t(
                    "wordpress.reAppointment.statusHint",
                    "Inactive buttons render nothing on the frontend.",
                  )}
                </FieldHint>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="design" className="mt-0">
          <SectionCard>
            <CardHeader
              title={t("wordpress.reAppointment.tabDesign", "Button design")}
              subtitle={t(
                "wordpress.reAppointment.designSubtitle",
                "Appearance updates live in the preview below.",
              )}
            />
            <div className="space-y-5 p-5 sm:p-6">
              <Field>
                <Label htmlFor="reappt-label">
                  {t("wordpress.reAppointment.labelText", "Label text")}
                </Label>
                <Input
                  type="text"
                  id="reappt-label"
                  value={draft.label}
                  onChange={(e) => onSet("label", e.target.value)}
                />
              </Field>

              <Field>
                <Label htmlFor="reappt-icon">
                  {t(
                    "wordpress.reAppointment.iconLabel",
                    "Icon / prefix (optional)",
                  )}
                </Label>
                <Input
                  type="text"
                  id="reappt-icon"
                  value={draft.icon}
                  placeholder="📅"
                  onChange={(e) => onSet("icon", e.target.value)}
                />
              </Field>

              <TwoCol>
                <Field>
                  <Label htmlFor="reappt-fs">
                    {t("wordpress.reAppointment.fontSize", "Font size (px)")}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-fs"
                    min={8}
                    max={80}
                    value={draft.font_size}
                    onChange={(e) => onSet("font_size", Number(e.target.value))}
                  />
                </Field>
                <Field>
                  <Label htmlFor="reappt-br">
                    {t(
                      "wordpress.reAppointment.borderRadius",
                      "Border radius (px)",
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-br"
                    min={0}
                    max={100}
                    value={draft.border_radius}
                    onChange={(e) =>
                      onSet("border_radius", Number(e.target.value))
                    }
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field>
                  <Label htmlFor="reappt-fc">
                    {t("wordpress.reAppointment.fontColor", "Font color")}
                  </Label>
                  <ColorInput
                    id="reappt-fc"
                    value={draft.font_color}
                    onChange={(v) => onSet("font_color", v)}
                  />
                </Field>
                <Field>
                  <Label htmlFor="reappt-bg">
                    {t("wordpress.reAppointment.bgColor", "Background color")}
                  </Label>
                  <ColorInput
                    id="reappt-bg"
                    value={draft.bg_color}
                    onChange={(v) => onSet("bg_color", v)}
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field>
                  <Label htmlFor="reappt-hbg">
                    {t("wordpress.reAppointment.hoverBg", "Hover background")}
                  </Label>
                  <ColorInput
                    id="reappt-hbg"
                    value={draft.hover_bg}
                    onChange={(v) => onSet("hover_bg", v)}
                  />
                </Field>
                <Field>
                  <Label htmlFor="reappt-bc">
                    {t("wordpress.reAppointment.borderColor", "Border color")}
                  </Label>
                  <ColorInput
                    id="reappt-bc"
                    value={draft.border_color}
                    onChange={(v) => onSet("border_color", v)}
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field>
                  <Label htmlFor="reappt-py">
                    {t(
                      "wordpress.reAppointment.paddingY",
                      "Padding top/bottom (px)",
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-py"
                    min={0}
                    max={100}
                    value={draft.padding_y}
                    onChange={(e) => onSet("padding_y", Number(e.target.value))}
                  />
                </Field>
                <Field>
                  <Label htmlFor="reappt-px">
                    {t(
                      "wordpress.reAppointment.paddingX",
                      "Padding left/right (px)",
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-px"
                    min={0}
                    max={200}
                    value={draft.padding_x}
                    onChange={(e) => onSet("padding_x", Number(e.target.value))}
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field>
                  <Label htmlFor="reappt-my">
                    {t(
                      "wordpress.reAppointment.marginY",
                      "Margin top/bottom (px)",
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-my"
                    min={-100}
                    max={100}
                    value={draft.margin_y}
                    onChange={(e) => onSet("margin_y", Number(e.target.value))}
                  />
                </Field>
                <Field>
                  <Label htmlFor="reappt-mx">
                    {t(
                      "wordpress.reAppointment.marginX",
                      "Margin left/right (px)",
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="reappt-mx"
                    min={-200}
                    max={200}
                    value={draft.margin_x}
                    onChange={(e) => onSet("margin_x", Number(e.target.value))}
                  />
                </Field>
              </TwoCol>

              <Field>
                <Label htmlFor="reappt-bw">
                  {t("wordpress.reAppointment.borderWidth", "Border width (px)")}
                </Label>
                <Input
                  type="number"
                  id="reappt-bw"
                  min={0}
                  max={20}
                  value={draft.border_width}
                  onChange={(e) => onSet("border_width", Number(e.target.value))}
                />
              </Field>

              <Field>
                <ToggleField
                  id="reappt-full-width"
                  checked={draft.full_width}
                  onChange={(v) => onSet("full_width", v)}
                  label={t("wordpress.reAppointment.fullWidth", "Full width")}
                />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="placement" className="mt-0">
          <PlacementCard
            draft={draft}
            slots={slots}
            onSet={onSet}
            buttonId={buttonId}
          />
        </TabsContent>
      </Tabs>

      <SectionCard className="app-fade-up app-fade-up-d2">
        <CardHeader
          title={t("wordpress.reAppointment.livePreview", "Live preview")}
          subtitle={t(
            "wordpress.reAppointment.previewSubtitle",
            "A working preview. Hover to test the hover color.",
          )}
        />
        <div className="flex min-h-[120px] items-center justify-center bg-muted/40 p-8">
          <PreviewButton config={draft} />
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("wordpress.reAppointment.cancel", "Cancel")}
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          <Save className="h-4 w-4" />
          {saving
            ? t("wordpress.reAppointment.saving", "Saving…")
            : buttonId
              ? t("wordpress.reAppointment.saveChanges", "Save changes")
              : t("wordpress.reAppointment.createButton", "Create button")}
        </Button>
      </div>
    </PageShell>
  );
}
