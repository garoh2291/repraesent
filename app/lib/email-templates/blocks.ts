import {
  Columns3,
  Code2,
  Heading1,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Type,
  type LucideIcon,
} from "lucide-react";
import type {
  Block,
  BlockType,
  TemplateDocument,
} from "~/lib/api/email-templates";

/**
 * Block factories and display metadata for the template builder. The block
 * shapes mirror nestjs-monolith/src/modules/email-templates/block.types.ts.
 */

export const BLOCK_META: Record<
  BlockType,
  { icon: LucideIcon; labelKey: string; defaultLabel: string }
> = {
  heading: {
    icon: Heading1,
    labelKey: "emailCampaigns.templates.blocks.heading",
    defaultLabel: "Heading",
  },
  text: {
    icon: Type,
    labelKey: "emailCampaigns.templates.blocks.text",
    defaultLabel: "Text",
  },
  image: {
    icon: ImageIcon,
    labelKey: "emailCampaigns.templates.blocks.image",
    defaultLabel: "Image",
  },
  button: {
    icon: MousePointerClick,
    labelKey: "emailCampaigns.templates.blocks.button",
    defaultLabel: "Button",
  },
  divider: {
    icon: Minus,
    labelKey: "emailCampaigns.templates.blocks.divider",
    defaultLabel: "Divider",
  },
  spacer: {
    icon: MoveVertical,
    labelKey: "emailCampaigns.templates.blocks.spacer",
    defaultLabel: "Spacer",
  },
  columns: {
    icon: Columns3,
    labelKey: "emailCampaigns.templates.blocks.columns",
    defaultLabel: "Columns",
  },
  html: {
    icon: Code2,
    labelKey: "emailCampaigns.templates.blocks.html",
    defaultLabel: "HTML",
  },
};

/**
 * Selection id for the unsubscribe footer.
 *
 * The footer is not a block — it is appended by the compiler so it cannot be
 * deleted, reordered, or duplicated. But it still needs to be *editable*, so it
 * gets a sentinel id that the canvas and inspector agree on. Prefixed to keep it
 * out of the namespace `blockId()` generates.
 */
export const FOOTER_SELECTION_ID = "__unsubscribe_footer__";

export function blockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "heading":
      return { id: blockId(), type, attrs: { html: "", level: 2 } };
    case "text":
      return { id: blockId(), type, attrs: { html: "" } };
    case "image":
      return {
        id: blockId(),
        type,
        attrs: { src: "", alt: "", align: "center" },
      };
    case "button":
      return {
        id: blockId(),
        type,
        attrs: { label: "", href: "", align: "center" },
      };
    case "divider":
      return { id: blockId(), type, attrs: {} };
    case "spacer":
      return { id: blockId(), type, attrs: { height: 24 } };
    case "columns":
      return {
        id: blockId(),
        type,
        attrs: { ratio: [1, 1], stack_on_mobile: true },
        columns: [[], []],
      };
    case "html":
      return { id: blockId(), type, attrs: { html: "" } };
  }
}

/** Deep copy with fresh ids — saved-row insertion and block duplication. */
export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...block,
    id: blockId(),
    attrs: { ...block.attrs },
    columns: block.columns?.map((column) => cloneBlocks(column)),
  }));
}

/**
 * The unsubscribe footer is NOT a block.
 *
 * It used to be one, seeded into every new locale — which meant `addBlock`
 * appended new content BELOW it, so the very first heading a user added
 * appeared under "Unsubscribe". It could also be deleted or duplicated. It is
 * now appended by the server at MJML compile time from
 * `settings.unsubscribe_text`, so it is structurally always last, always
 * present, and always exactly once.
 */
export function emptyLocaleContent() {
  return { subject: "", preheader: "", blocks: [] };
}

export function emptyDocument(): TemplateDocument {
  return { version: 1, locales: {} };
}

/** Detects a LEGACY footer block (templates authored before the footer moved
 * into compile-time settings) so it can be stripped on load. */
export function hasUnsubscribeUrl(blocks: Block[]): boolean {
  const inBlock = (block: Block): boolean => {
    const attrs = JSON.stringify(block.attrs);
    if (attrs.includes("unsubscribe_url")) return true;
    return (block.columns ?? []).some((column) => column.some(inBlock));
  };
  return blocks.some(inBlock);
}
