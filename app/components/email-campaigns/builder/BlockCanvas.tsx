import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { BLOCK_META, FOOTER_SELECTION_ID } from "~/lib/email-templates/blocks";
import { useAuthContext } from "~/providers/auth-provider";
import type {
  Block,
  TemplateLocaleContent,
  TemplateSettings,
} from "~/lib/api/email-templates";

/**
 * Middle pane: the email being assembled, one card per block, in an email-width
 * frame. Vertical sortable list (FormCanvas pattern) — and every card also
 * carries move up/down buttons, so dragging is never the only way to reorder
 * (WCAG 2.2 dragging-movements).
 */
export function BlockCanvas({
  content,
  settings,
  locale,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  disabled,
}: {
  content: TemplateLocaleContent;
  settings: TemplateSettings;
  locale: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (orderedIds: string[]) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [activeId, setActiveId] = useState<string | null>(null);

  // The compiler substitutes {{workspace.name}}; showing the real name here is
  // what the preview already does. The bracket form is the same convention the
  // preview uses for a value it cannot resolve.
  const workspaceName = currentWorkspace?.name || "[workspace_name]";

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const blocks = content.blocks;

  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  const activeBlock = activeId
    ? (blocks.find((b) => b.id === activeId) ?? null)
    : null;

  return (
    <Panel>
      <PanelHeader
        icon={<Eye className="h-3.5 w-3.5" />}
        title={t("emailCampaigns.templates.canvas.title", {
          defaultValue: "Email",
        })}
        meta={
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
            {locale}
          </span>
        }
      />
      <PanelBody className="bg-muted/20">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              // `[&_a]` colours the author's links the way the compiled email
              // does (`a { color: … }` in the MJML head). Without it the canvas
              // ignored the document's "Links & buttons" colour entirely and
              // showed every link in the app's default blue — so the preview
              // disagreed with the email that actually went out.
              className="mx-auto w-full max-w-[600px] space-y-1 rounded-xl border border-border p-3 [&_a]:[color:var(--tpl-link-color)]"
              style={
                {
                  backgroundColor:
                    settings.content_background_color ?? "#ffffff",
                  "--tpl-link-color": settings.link_color ?? "#2563eb",
                } as React.CSSProperties
              }
              onClick={() => onSelect(null)}
            >
              {blocks.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                  {t("emailCampaigns.templates.canvas.empty", {
                    defaultValue: "Add blocks from the left to start.",
                  })}
                </p>
              ) : (
                blocks.map((block, index) => (
                  <SortableBlockCard
                    key={block.id}
                    block={block}
                    settings={settings}
                    selected={selectedId === block.id}
                    first={index === 0}
                    last={index === blocks.length - 1}
                    disabled={disabled}
                    onSelect={() => onSelect(block.id)}
                    onMoveUp={() => {
                      const ids = blocks.map((b) => b.id);
                      onReorder(arrayMove(ids, index, index - 1));
                    }}
                    onMoveDown={() => {
                      const ids = blocks.map((b) => b.id);
                      onReorder(arrayMove(ids, index, index + 1));
                    }}
                    onDuplicate={() => onDuplicate(block.id)}
                    onDelete={() => onDelete(block.id)}
                  />
                ))
              )}

              {/* The unsubscribe line. Appended by the compiler, so it cannot
                  be deleted, reordered or duplicated — but it IS selectable, so
                  its wording (per language) and its on/off switch are editable
                  in the inspector. Shows the real workspace name rather than the
                  word "Workspace name", which made the canvas disagree with the
                  preview for no reason. */}
              {settings.unsubscribe_enabled !== false ? (
                <button
                  type="button"
                  // The canvas container deselects on click; without this the
                  // footer would select itself and be cleared again on bubble.
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(FOOTER_SELECTION_ID);
                  }}
                  className={`mt-2 w-full border-t border-dashed px-2 pt-3 text-center text-[11px] transition-colors ${
                    selectedId === FOOTER_SELECTION_ID
                      ? "border-primary/60 text-foreground"
                      : "border-border/70 text-muted-foreground/70 hover:text-foreground"
                  }`}
                  title={t("emailCampaigns.templates.canvas.footerHint", {
                    defaultValue:
                      "Added automatically, always last. Click to edit the wording or remove it.",
                  })}
                >
                  {workspaceName} ·{" "}
                  <span className="underline">
                    {content.unsubscribe_text?.trim() ||
                      settings.unsubscribe_text ||
                      t("emailCampaigns.templates.canvas.unsubscribe", {
                        defaultValue: "Unsubscribe",
                      })}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  // The canvas container deselects on click; without this the
                  // footer would select itself and be cleared again on bubble.
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(FOOTER_SELECTION_ID);
                  }}
                  className={`mt-2 w-full rounded-lg border border-dashed px-2 py-2 text-center text-[11px] transition-colors ${
                    selectedId === FOOTER_SELECTION_ID
                      ? "border-primary/60 text-foreground"
                      : "border-border/70 text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  {t("emailCampaigns.templates.canvas.footerOff", {
                    defaultValue: "No unsubscribe footer — click to add one",
                  })}
                </button>
              )}
            </div>
          </SortableContext>

          {/* Portalled: DragOverlay resolves fixed coordinates against its
              containing block, and this panel sits in a grid column — same
              reasoning as FormCanvas. */}
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay dropAnimation={null}>
                  {activeBlock ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      {t(BLOCK_META[activeBlock.type].labelKey, {
                        defaultValue: BLOCK_META[activeBlock.type].defaultLabel,
                      })}
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body,
              )
            : null}
        </DndContext>
      </PanelBody>
    </Panel>
  );
}

function SortableBlockCard(props: {
  block: Block;
  settings: TemplateSettings;
  selected: boolean;
  first: boolean;
  last: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const {
    block,
    settings,
    selected,
    first,
    last,
    disabled,
    onSelect,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onDelete,
  } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled });

  const meta = BLOCK_META[block.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={`group relative rounded-lg outline-offset-2 transition-[outline-color] ${
        selected
          ? "outline outline-2 outline-primary"
          : "outline outline-1 outline-transparent hover:outline-dashed hover:outline-border"
      }`}
    >
      <BlockVisual block={block} settings={settings} />

      {/* Floating toolbar: drag handle plus single-pointer alternatives. */}
      <div
        className={`absolute -right-2 -top-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label={t("emailCampaigns.templates.canvas.dragBlock", {
            defaultValue: "Drag to reorder",
          })}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled || first}
          onClick={onMoveUp}
          aria-label={t("emailCampaigns.templates.canvas.moveUp", {
            defaultValue: "Move up",
          })}
          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled || last}
          onClick={onMoveDown}
          aria-label={t("emailCampaigns.templates.canvas.moveDown", {
            defaultValue: "Move down",
          })}
          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDuplicate}
          aria-label={t("emailCampaigns.templates.canvas.duplicate", {
            defaultValue: "Duplicate",
          })}
          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          aria-label={t("emailCampaigns.templates.canvas.delete", {
            defaultValue: "Delete",
          })}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tiny type tag so an empty block is still identifiable. */}
      <span className="pointer-events-none absolute -left-1 -top-2.5 rounded bg-muted px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {t(meta.labelKey, { defaultValue: meta.defaultLabel })}
      </span>
    </div>
  );
}

/**
 * Canvas approximation of a block. Not the MJML output — the Preview dialog
 * shows that — but close enough to design against.
 */
function BlockVisual({
  block,
  settings,
  compact,
}: {
  block: Block;
  settings: TemplateSettings;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const attrs = block.attrs as Record<string, never> & {
    html?: string;
    level?: number;
    align?: string;
    src?: string;
    alt?: string;
    label?: string;
    background_color?: string;
    text_color?: string;
    border_radius?: number;
    height?: number;
    color?: string;
    ratio?: number[];
  };
  const align = (attrs.align as "left" | "center" | "right") ?? "left";
  const alignClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  switch (block.type) {
    case "heading": {
      const sizes: Record<number, string> = {
        1: "text-2xl",
        2: "text-xl",
        3: "text-lg",
      };
      return (
        <div
          className={`px-2 py-1.5 font-bold ${sizes[attrs.level ?? 2] ?? "text-xl"} ${alignClass} [&_p]:m-0`}
          style={{ color: settings.text_color }}
          dangerouslySetInnerHTML={{
            __html:
              attrs.html ||
              `<p class="opacity-30">${t("emailCampaigns.templates.canvas.headingPlaceholder", { defaultValue: "Heading…" })}</p>`,
          }}
        />
      );
    }
    case "text":
      return (
        <div
          className={`px-2 py-1.5 text-sm leading-relaxed ${alignClass} [&_p]:m-0 [&_p+p]:mt-2`}
          style={{ color: settings.text_color }}
          dangerouslySetInnerHTML={{
            __html:
              attrs.html ||
              `<p class="opacity-30">${t("emailCampaigns.templates.canvas.textPlaceholder", { defaultValue: "Write something…" })}</p>`,
          }}
        />
      );
    case "image":
      return attrs.src ? (
        <div className={`px-2 py-1.5 ${alignClass}`}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={attrs.src}
            alt={attrs.alt ?? ""}
            className="inline-block max-w-full rounded"
            style={{
              width: attrs.width_percent
                ? `${attrs.width_percent as unknown as number}%`
                : undefined,
            }}
          />
        </div>
      ) : (
        <div className="mx-2 my-1.5 flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          {t("emailCampaigns.templates.canvas.imagePlaceholder", {
            defaultValue: "Choose an image from the library in the inspector",
          })}
        </div>
      );
    case "button":
      return (
        <div className={`px-2 py-2 ${alignClass}`}>
          <span
            className="inline-block rounded-md px-6 py-2.5 text-sm font-semibold"
            style={{
              backgroundColor:
                attrs.background_color || settings.link_color || "#2563eb",
              color: attrs.text_color || "#ffffff",
              borderRadius: attrs.border_radius ?? 6,
            }}
          >
            {attrs.label || (
              <span className="opacity-60">
                {t("emailCampaigns.templates.canvas.buttonPlaceholder", {
                  defaultValue: "Button",
                })}
              </span>
            )}
          </span>
        </div>
      );
    case "divider":
      return (
        <div className="px-2 py-2.5">
          <hr style={{ borderColor: attrs.color || "#e4e4e7" }} />
        </div>
      );
    case "spacer":
      return (
        <div
          className="mx-2 rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_7px)]"
          style={{ height: Math.min(attrs.height ?? 24, 200) }}
        />
      );
    case "columns": {
      const columns = block.columns ?? [];
      const ratio =
        attrs.ratio && attrs.ratio.length === columns.length
          ? attrs.ratio
          : columns.map(() => 1);
      return (
        <div className="flex gap-2 px-2 py-1.5">
          {columns.map((column, i) => (
            <div
              key={i}
              className="min-w-0 space-y-1 rounded border border-dashed border-border/60 p-1"
              style={{ flex: ratio[i] > 0 ? ratio[i] : 1 }}
            >
              {column.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-muted-foreground/60">
                  {t("emailCampaigns.templates.canvas.emptyColumn", {
                    defaultValue: "Empty",
                  })}
                </p>
              ) : (
                column.map((child) => (
                  <BlockVisual
                    key={child.id}
                    block={child}
                    settings={settings}
                    compact
                  />
                ))
              )}
            </div>
          ))}
        </div>
      );
    }
    case "html":
      // Rendered, not shown as source: the point of the canvas is to look like
      // the email. Same treatment the heading and text blocks above already
      // get, and the compile-time sanitizer is what protects recipients.
      return attrs.html?.trim() ? (
        <div
          className={`overflow-x-auto px-2 py-1.5 text-sm ${compact ? "max-h-16" : "max-h-40"}`}
          style={{ color: settings.text_color }}
          dangerouslySetInnerHTML={{ __html: attrs.html }}
        />
      ) : (
        <p className="px-2 py-1.5 text-sm opacity-30">
          {t("emailCampaigns.templates.canvas.htmlPlaceholder", {
            defaultValue: "Paste HTML…",
          })}
        </p>
      );
    default:
      return null;
  }
}
