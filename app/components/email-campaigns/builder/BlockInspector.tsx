import { Bookmark, Settings2, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cols,
  EmptyPanelState,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "~/components/organism/compose-email/rich-text-editor";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { createSavedRow, type Block } from "~/lib/api/email-templates";
import type { TemplateSettings } from "~/lib/api/email-templates";
import { BLOCK_META, newBlock } from "~/lib/email-templates/blocks";
import { VariableMenu } from "./VariableMenu";
import { PromptDialog } from "~/components/molecule/prompt-dialog";

/**
 * Right pane: settings for the selected block, or the document settings when
 * nothing is selected. Column children are edited here too — the canvas
 * selects the columns block as a whole, and each child gets a compact editor
 * below, which keeps the canvas interaction model one level deep.
 */
export function BlockInspector({
  block,
  settings,
  onChangeBlock,
  onChangeSettings,
  disabled,
  footerSelected,
  localeUnsubscribeText,
  onChangeLocaleUnsubscribeText,
}: {
  block: Block | null;
  settings: TemplateSettings;
  onChangeBlock: (block: Block) => void;
  onChangeSettings: (settings: TemplateSettings) => void;
  disabled?: boolean;
  /** The compiled unsubscribe footer is selected on the canvas. */
  footerSelected?: boolean;
  /** Wording for the language currently open in the LanguageStrip. */
  localeUnsubscribeText?: string;
  onChangeLocaleUnsubscribeText?: (text: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saveRowOpen, setSaveRowOpen] = useState(false);

  const saveRow = useMutation({
    mutationFn: createSavedRow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template-rows"] });
      toast.success(
        t("emailCampaigns.templates.savedRows.saved", {
          defaultValue: "Row saved for reuse",
        }),
      );
    },
  });

  if (footerSelected) {
    return (
      <Panel>
        <PanelHeader
          icon={<Settings2 className="h-3.5 w-3.5" />}
          title={t("emailCampaigns.templates.inspector.footerTitle", {
            defaultValue: "Unsubscribe footer",
          })}
        />
        <PanelBody>
          <FooterSettings
            settings={settings}
            onChangeSettings={onChangeSettings}
            text={localeUnsubscribeText ?? ""}
            onChangeText={onChangeLocaleUnsubscribeText}
            disabled={disabled}
          />
        </PanelBody>
      </Panel>
    );
  }

  if (!block) {
    return (
      <Panel>
        <PanelHeader
          icon={<Settings2 className="h-3.5 w-3.5" />}
          title={t("emailCampaigns.templates.inspector.documentTitle", {
            defaultValue: "Design",
          })}
        />
        <PanelBody>
          <DocumentSettings
            settings={settings}
            onChange={onChangeSettings}
            disabled={disabled}
          />
        </PanelBody>
      </Panel>
    );
  }

  const meta = BLOCK_META[block.type];

  return (
    <Panel>
      <PanelHeader
        icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        title={t(meta.labelKey, { defaultValue: meta.defaultLabel })}
        action={
          <button
            type="button"
            disabled={disabled || saveRow.isPending}
            onClick={() => setSaveRowOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
          >
            <Bookmark className="h-3 w-3" />
            {t("emailCampaigns.templates.savedRows.save", {
              defaultValue: "Save row",
            })}
          </button>
        }
      />
      <PanelBody>
        <BlockFields
          block={block}
          onChange={onChangeBlock}
          settings={settings}
          disabled={disabled}
        />
      </PanelBody>

      <PromptDialog
        open={saveRowOpen}
        onOpenChange={setSaveRowOpen}
        title={t("emailCampaigns.templates.savedRows.saveDialogTitle", {
          defaultValue: "Save this row for reuse",
        })}
        label={t("emailCampaigns.templates.savedRows.nameLabel", {
          defaultValue: "Name",
        })}
        placeholder={t("emailCampaigns.templates.savedRows.namePlaceholder", {
          defaultValue: "Hero with button",
        })}
        submitLabel={t("emailCampaigns.templates.savedRows.save", {
          defaultValue: "Save row",
        })}
        busy={saveRow.isPending}
        onSubmit={(name) => {
          saveRow.mutate({ name, blocks: [block] });
          setSaveRowOpen(false);
        }}
      />
    </Panel>
  );
}

/**
 * The unsubscribe footer: on/off for the whole template, wording per language.
 *
 * Split that way because a template either carries an opt-out or it does not —
 * one present in German and missing in French is worse than one consistently
 * absent, since nobody would notice the gap. The wording, by contrast, is read
 * by the recipient and has to match the language the rest of the email is in.
 */
function FooterSettings({
  settings,
  onChangeSettings,
  text,
  onChangeText,
  disabled,
}: {
  settings: TemplateSettings;
  onChangeSettings: (settings: TemplateSettings) => void;
  text: string;
  onChangeText?: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const enabled = settings.unsubscribe_enabled !== false;

  return (
    <>
      <PanelSection
        title={t("emailCampaigns.templates.inspector.footerShow", {
          defaultValue: "Include the footer",
        })}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t("emailCampaigns.templates.inspector.footerShowHint", {
              defaultValue:
                "Added automatically as the last thing in every email.",
            })}
          </p>
          <Switch
            checked={enabled}
            disabled={disabled}
            onCheckedChange={(next) =>
              onChangeSettings({ ...settings, unsubscribe_enabled: next })
            }
          />
        </div>

        {/* Said at the moment it is switched off, not discovered later as a
            scheduling error. The server refuses to schedule a campaign whose
            compiled email has no unsubscribe link, and that guard stays. */}
        {!enabled ? (
          <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
            {t("emailCampaigns.templates.inspector.footerOffWarning", {
              defaultValue:
                "Without an unsubscribe link this template cannot be sent as a campaign. It is still fine for transactional email, or add your own link with the {{unsubscribe_url}} variable.",
            })}
          </p>
        ) : null}
      </PanelSection>

      {enabled ? (
        <PanelSection
          title={t("emailCampaigns.templates.inspector.footerText", {
            defaultValue: "Wording in this language",
          })}
        >
          <Input
            value={text}
            disabled={disabled || !onChangeText}
            onChange={(e) => onChangeText?.(e.target.value)}
            placeholder={settings.unsubscribe_text || "Unsubscribe"}
            className="h-9"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t("emailCampaigns.templates.inspector.footerTextHint", {
              defaultValue:
                "Set per language. Left empty, the default wording is used. The link itself is always added for you.",
            })}
          </p>
        </PanelSection>
      ) : null}
    </>
  );
}

function DocumentSettings({
  settings,
  onChange,
  disabled,
}: {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<TemplateSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <>
      <EmptyPanelState
        icon={<Settings2 className="h-4 w-4" />}
        title={t("emailCampaigns.templates.inspector.noSelection", {
          defaultValue: "Select a block to edit it",
        })}
        hint={t("emailCampaigns.templates.inspector.noSelectionHint", {
          defaultValue: "These settings style the whole email.",
        })}
      />
      <PanelSection
        title={t("emailCampaigns.templates.inspector.colors", {
          defaultValue: "Colors",
        })}
      >
        <Cols>
          <ColorField
            label={t("emailCampaigns.templates.inspector.backgroundColor", {
              defaultValue: "Page background",
            })}
            value={settings.background_color ?? "#f4f4f5"}
            onChange={(value) => set({ background_color: value })}
            disabled={disabled}
          />
          <ColorField
            label={t("emailCampaigns.templates.inspector.contentBackground", {
              defaultValue: "Content background",
            })}
            value={settings.content_background_color ?? "#ffffff"}
            onChange={(value) => set({ content_background_color: value })}
            disabled={disabled}
          />
          <ColorField
            label={t("emailCampaigns.templates.inspector.textColor", {
              defaultValue: "Text",
            })}
            value={settings.text_color ?? "#18181b"}
            onChange={(value) => set({ text_color: value })}
            disabled={disabled}
          />
          <ColorField
            label={t("emailCampaigns.templates.inspector.linkColor", {
              defaultValue: "Links & buttons",
            })}
            value={settings.link_color ?? "#2563eb"}
            onChange={(value) => set({ link_color: value })}
            disabled={disabled}
          />
        </Cols>
      </PanelSection>
    </>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 font-mono text-xs"
        />
      </div>
    </div>
  );
}

/** Insert `snippet` into `value` at the input's caret. */
function insertAtCaret(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  snippet: string,
): string {
  if (!input) return value + snippet;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;
  return value.slice(0, start) + snippet + value.slice(end);
}

function BlockFields({
  block,
  onChange,
  settings,
  disabled,
}: {
  block: Block;
  onChange: (block: Block) => void;
  /** Document-level values a block can fall back to (e.g. the button colour). */
  settings: TemplateSettings;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const setAttrs = (patch: Record<string, unknown>) =>
    onChange({ ...block, attrs: { ...block.attrs, ...patch } });

  // Variables go INTO the rich-text editor, not into our copy of its HTML.
  // The editor is not re-seeded from `value` while you type, so writing the
  // snippet onto `attrs.html` put the two out of sync three ways at once: the
  // variable never appeared in the editor, it landed at the end of the block
  // instead of at the caret, and the next keystroke overwrote it.
  const richTextRef = useRef<RichTextEditorHandle>(null);

  const attrs = block.attrs as {
    html?: string;
    level?: number;
    align?: "left" | "center" | "right";
    src?: string;
    alt?: string;
    href?: string;
    width_percent?: number;
    label?: string;
    background_color?: string;
    text_color?: string;
    border_radius?: number;
    height?: number;
    color?: string;
    ratio?: number[];
    stack_on_mobile?: boolean;
  };

  switch (block.type) {
    case "heading":
    case "text":
      return (
        <>
          {block.type === "heading" ? (
            <PanelSection
              title={t("emailCampaigns.templates.inspector.level", {
                defaultValue: "Size",
              })}
            >
              <Segmented>
                {[1, 2, 3].map((level) => (
                  <SegmentedButton
                    key={level}
                    active={(attrs.level ?? 2) === level}
                    onClick={() => setAttrs({ level })}
                  >
                    H{level}
                  </SegmentedButton>
                ))}
              </Segmented>
            </PanelSection>
          ) : null}
          <PanelSection
            title={t("emailCampaigns.templates.inspector.content", {
              defaultValue: "Content",
            })}
            action={
              <VariableMenu
                disabled={disabled}
                onInsert={(snippet) => richTextRef.current?.insertText(snippet)}
              />
            }
          >
            {/* Remount per block id — RichTextEditor owns its editor state. */}
            <RichTextEditor
              key={block.id}
              ref={richTextRef}
              value={attrs.html ?? ""}
              onChange={(html) => setAttrs({ html })}
              disabled={disabled}
              minHeight="min-h-[120px]"
            />
          </PanelSection>
          <AlignSection
            value={attrs.align ?? "left"}
            onChange={(align) => setAttrs({ align })}
          />
        </>
      );

    case "image":
      return (
        <>
          <PanelSection
            title={t("emailCampaigns.templates.inspector.imageUrl", {
              defaultValue: "Image URL",
            })}
          >
            <Input
              value={attrs.src ?? ""}
              onChange={(e) => setAttrs({ src: e.target.value })}
              placeholder="https://…"
              disabled={disabled}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("emailCampaigns.templates.inspector.imageUrlHint", {
                defaultValue:
                  "Paste a public image URL — images are linked, not uploaded.",
              })}
            </p>
          </PanelSection>
          <PanelSection>
            <Cols>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t("emailCampaigns.templates.inspector.altText", {
                    defaultValue: "Alt text",
                  })}
                </Label>
                <Input
                  value={attrs.alt ?? ""}
                  onChange={(e) => setAttrs({ alt: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t("emailCampaigns.templates.inspector.linkTo", {
                    defaultValue: "Link to",
                  })}
                </Label>
                <Input
                  value={attrs.href ?? ""}
                  onChange={(e) => setAttrs({ href: e.target.value })}
                  placeholder="https://…"
                  disabled={disabled}
                />
              </div>
            </Cols>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("emailCampaigns.templates.inspector.widthPercent", {
                  defaultValue: "Width (% of email)",
                })}
              </Label>
              <Input
                type="number"
                min={10}
                max={100}
                value={attrs.width_percent ?? ""}
                onChange={(e) =>
                  setAttrs({
                    width_percent: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder={t("emailCampaigns.templates.inspector.widthAuto", {
                  defaultValue: "Auto",
                })}
                disabled={disabled}
              />
            </div>
          </PanelSection>
          <AlignSection
            value={attrs.align ?? "center"}
            onChange={(align) => setAttrs({ align })}
          />
        </>
      );

    case "button":
      return (
        <ButtonFields
          attrs={attrs}
          setAttrs={setAttrs}
          settings={settings}
          disabled={disabled}
        />
      );

    case "divider":
      return (
        <PanelSection
          title={t("emailCampaigns.templates.inspector.color", {
            defaultValue: "Color",
          })}
        >
          <ColorField
            label={t("emailCampaigns.templates.inspector.color", {
              defaultValue: "Color",
            })}
            value={attrs.color ?? "#e4e4e7"}
            onChange={(color) => setAttrs({ color })}
            disabled={disabled}
          />
        </PanelSection>
      );

    case "spacer":
      return (
        <PanelSection
          title={t("emailCampaigns.templates.inspector.height", {
            defaultValue: "Height (px)",
          })}
        >
          <Input
            type="number"
            min={4}
            max={200}
            value={attrs.height ?? 24}
            onChange={(e) => setAttrs({ height: Number(e.target.value) || 24 })}
            disabled={disabled}
          />
        </PanelSection>
      );

    case "columns":
      return (
        <ColumnsFields
          block={block}
          onChange={onChange}
          settings={settings}
          disabled={disabled}
        />
      );

    case "html":
      return (
        <PanelSection
          title={t("emailCampaigns.templates.inspector.htmlSource", {
            defaultValue: "HTML",
          })}
          action={
            <HtmlVariableInserter
              value={attrs.html ?? ""}
              onInsert={(html) => setAttrs({ html })}
              disabled={disabled}
            />
          }
        >
          <Textarea
            rows={10}
            value={attrs.html ?? ""}
            onChange={(e) => setAttrs({ html: e.target.value })}
            disabled={disabled}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </PanelSection>
      );

    default:
      return null;
  }
}

/** Variable menu wired to a textarea caret via a live element lookup. */
function HtmlVariableInserter({
  value,
  onInsert,
  disabled,
}: {
  value: string;
  onInsert: (nextValue: string) => void;
  disabled?: boolean;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={anchorRef}>
      <VariableMenu
        disabled={disabled}
        onInsert={(snippet) => {
          const textarea = anchorRef.current
            ?.closest("section")
            ?.querySelector("textarea");
          onInsert(insertAtCaret(textarea ?? null, value, snippet));
        }}
      />
    </span>
  );
}

function AlignSection({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (align: "left" | "center" | "right") => void;
}) {
  const { t } = useTranslation();
  return (
    <PanelSection
      title={t("emailCampaigns.templates.inspector.align", {
        defaultValue: "Alignment",
      })}
    >
      <Segmented>
        {(["left", "center", "right"] as const).map((align) => (
          <SegmentedButton
            key={align}
            active={value === align}
            onClick={() => onChange(align)}
          >
            {t(`emailCampaigns.templates.inspector.align_${align}`, {
              defaultValue: align,
            })}
          </SegmentedButton>
        ))}
      </Segmented>
    </PanelSection>
  );
}

function ButtonFields({
  attrs,
  setAttrs,
  settings,
  disabled,
}: {
  attrs: {
    label?: string;
    href?: string;
    align?: "left" | "center" | "right";
    background_color?: string;
    text_color?: string;
    border_radius?: number;
  };
  setAttrs: (patch: Record<string, unknown>) => void;
  /** Needed for the document colour a button falls back to. */
  settings: TemplateSettings;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const labelRef = useRef<HTMLInputElement>(null);

  /**
   * A button with no colour of its own renders in the document's
   * "Links & buttons" colour — both on the canvas and in the compiled email.
   * The panel used to show a hardcoded `#2563eb` regardless, so a new button
   * appeared pink on the canvas while the field claimed it was blue, and
   * touching the picker snapped it to a colour nobody chose.
   */
  const inheritedColor = settings.link_color ?? "#2563eb";
  const hasOwnColor = typeof attrs.background_color === "string";
  return (
    <>
      <PanelSection
        title={t("emailCampaigns.templates.inspector.content", {
          defaultValue: "Content",
        })}
        action={
          <VariableMenu
            disabled={disabled}
            onInsert={(snippet) =>
              setAttrs({
                label: insertAtCaret(
                  labelRef.current,
                  attrs.label ?? "",
                  snippet,
                ),
              })
            }
          />
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs">
            {t("emailCampaigns.templates.inspector.buttonLabel", {
              defaultValue: "Label",
            })}
          </Label>
          <Input
            ref={labelRef}
            value={attrs.label ?? ""}
            onChange={(e) => setAttrs({ label: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {t("emailCampaigns.templates.inspector.buttonHref", {
              defaultValue: "Link URL",
            })}
          </Label>
          <Input
            value={attrs.href ?? ""}
            onChange={(e) => setAttrs({ href: e.target.value })}
            placeholder="https://…"
            disabled={disabled}
          />
        </div>
      </PanelSection>
      <PanelSection
        title={t("emailCampaigns.templates.inspector.style", {
          defaultValue: "Style",
        })}
      >
        <Cols>
          {/* Its OWN key. `inspector.backgroundColor` is already translated as
              "Page background" for the document settings, so reusing it here
              labelled the button's colour as the page's. */}
          <ColorField
            label={t("emailCampaigns.templates.inspector.buttonBackground", {
              defaultValue: "Button colour",
            })}
            value={attrs.background_color ?? inheritedColor}
            onChange={(background_color) => setAttrs({ background_color })}
            disabled={disabled}
          />
          <ColorField
            label={t("emailCampaigns.templates.inspector.textColor", {
              defaultValue: "Text",
            })}
            value={attrs.text_color ?? "#ffffff"}
            onChange={(text_color) => setAttrs({ text_color })}
            disabled={disabled}
          />
        </Cols>

        {/* Says which of the two states this button is in, and makes the
            inherited one reachable again — otherwise picking a colour once is
            a one-way door. */}
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {hasOwnColor ? (
            <>
              {t("emailCampaigns.templates.inspector.buttonOwnColor", {
                defaultValue: "This button uses its own colour.",
              })}{" "}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAttrs({ background_color: undefined })}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t(
                  "emailCampaigns.templates.inspector.buttonUseDocumentColor",
                  {
                    defaultValue: "Use the document colour",
                  },
                )}
              </button>
            </>
          ) : (
            t("emailCampaigns.templates.inspector.buttonInheritsColor", {
              defaultValue:
                "Following the document’s “Links & buttons” colour.",
            })
          )}
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {t("emailCampaigns.templates.inspector.borderRadius", {
              defaultValue: "Corner radius (px)",
            })}
          </Label>
          <Input
            type="number"
            min={0}
            max={30}
            value={attrs.border_radius ?? 6}
            onChange={(e) =>
              setAttrs({ border_radius: Number(e.target.value) || 0 })
            }
            disabled={disabled}
          />
        </div>
      </PanelSection>
      <AlignSection
        value={attrs.align ?? "center"}
        onChange={(align) => setAttrs({ align })}
      />
    </>
  );
}

/**
 * Columns editing: ratio presets, mobile stacking, and a compact child editor
 * per column. Children are limited to the leaf types.
 */
function ColumnsFields({
  block,
  onChange,
  settings,
  disabled,
}: {
  block: Block;
  onChange: (block: Block) => void;
  /** Passed through to child blocks, which fall back to it (button colour). */
  settings: TemplateSettings;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const attrs = block.attrs as { ratio?: number[]; stack_on_mobile?: boolean };
  const columns = block.columns ?? [[], []];

  const setColumns = (next: Block[][], ratio?: number[]) =>
    onChange({
      ...block,
      attrs: { ...block.attrs, ...(ratio ? { ratio } : {}) },
      columns: next,
    });

  const PRESETS: { label: string; ratio: number[] }[] = [
    { label: "1 : 1", ratio: [1, 1] },
    { label: "2 : 1", ratio: [2, 1] },
    { label: "1 : 2", ratio: [1, 2] },
    { label: "1 : 1 : 1", ratio: [1, 1, 1] },
  ];

  return (
    <>
      <PanelSection
        title={t("emailCampaigns.templates.inspector.layout", {
          defaultValue: "Layout",
        })}
      >
        <Segmented>
          {PRESETS.map((preset) => (
            <SegmentedButton
              key={preset.label}
              active={
                JSON.stringify(attrs.ratio ?? [1, 1]) ===
                JSON.stringify(preset.ratio)
              }
              onClick={() => {
                const next = preset.ratio.map((_, i) => columns[i] ?? []);
                setColumns(next, preset.ratio);
              }}
            >
              {preset.label}
            </SegmentedButton>
          ))}
        </Segmented>
        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs">
            {t("emailCampaigns.templates.inspector.stackOnMobile", {
              defaultValue: "Stack on mobile",
            })}
          </Label>
          <Switch
            checked={attrs.stack_on_mobile !== false}
            onCheckedChange={(stack_on_mobile) =>
              onChange({ ...block, attrs: { ...block.attrs, stack_on_mobile } })
            }
            disabled={disabled}
          />
        </div>
      </PanelSection>

      {columns.map((column, columnIndex) => (
        <PanelSection
          key={columnIndex}
          title={`${t("emailCampaigns.templates.inspector.column", {
            defaultValue: "Column",
          })} ${columnIndex + 1}`}
          action={
            <div className="flex gap-1">
              {(["text", "image", "button"] as const).map((type) => {
                const Icon = BLOCK_META[type].icon;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = columns.map((c, i) =>
                        i === columnIndex ? [...c, newBlock(type)] : c,
                      );
                      setColumns(next);
                    }}
                    aria-label={t(BLOCK_META[type].labelKey, {
                      defaultValue: BLOCK_META[type].defaultLabel,
                    })}
                    className="rounded border border-border p-1 text-muted-foreground hover:bg-muted"
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          }
        >
          {column.length === 0 ? (
            <p className="rounded-lg border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
              {t("emailCampaigns.templates.inspector.emptyColumn", {
                defaultValue: "Add text, an image or a button.",
              })}
            </p>
          ) : (
            <div className="space-y-3">
              {column.map((child, childIndex) => (
                <div
                  key={child.id}
                  className="space-y-2 rounded-lg border border-border/70 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t(BLOCK_META[child.type].labelKey, {
                        defaultValue: BLOCK_META[child.type].defaultLabel,
                      })}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const next = columns.map((c, i) =>
                          i === columnIndex
                            ? c.filter((_, j) => j !== childIndex)
                            : c,
                        );
                        setColumns(next);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      {t("common.delete", { defaultValue: "Delete" })}
                    </button>
                  </div>
                  <BlockFields
                    block={child}
                    settings={settings}
                    disabled={disabled}
                    onChange={(updated) => {
                      const next = columns.map((c, i) =>
                        i === columnIndex
                          ? c.map((b, j) => (j === childIndex ? updated : b))
                          : c,
                      );
                      setColumns(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      ))}
    </>
  );
}
