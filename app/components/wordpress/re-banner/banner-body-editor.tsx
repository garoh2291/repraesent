import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { cn } from "~/lib/utils";
import { PromptDialog } from "~/components/molecule/prompt-dialog";

/**
 * The banner's body, written as rich text — for every variant.
 *
 * Same Tiptap setup as the email composer's `RichTextEditor`, with the toolbar
 * kept inside the field rather than handed to a footer — this one lives in a
 * form, not next to a Send button.
 *
 * Two things make it specific to banners, and both are the same idea:
 *
 * 1. **The schema is the plugin's `wp_kses()` allowlist.** Anything this editor
 *    can produce, the plugin can store. Code blocks are off because `<pre>` is
 *    not on that list; images are off because the image is its own field;
 *    link protocols are the four the plugin accepts. A toolbar button for
 *    something that vanishes on save is worse than no button.
 * 2. **No colour, no font size, no alignment in the content.** Those are
 *    per-element overrides in the Design card, stored beside the content and
 *    emitted as a scoped stylesheet — never as `style=""` in the HTML, which
 *    the allowlist strips and which, for a text banner, would defeat
 *    inheriting the theme.
 */
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];

/**
 * Drop the empty paragraphs a visual editor leaves at either end of the
 * content — the caret's resting place after the last line, serialised as
 * `<p></p>`. Mirrors `Re_Banner_Text::strip_edge_paragraphs()`: the plugin
 * does this on save too, and doing it here as well means the preview, the
 * override inspector's "elements in use" and the stored value all agree while
 * typing. Empty paragraphs between real ones are somebody's blank line and
 * are left alone.
 */
const EMPTY_P = "<p>(?:\\s|&nbsp;|&#160;|\u00a0|<br\\s*/?>)*</p>";
const LEADING_EMPTY = new RegExp(`^(?:\\s*${EMPTY_P})+`, "i");
const TRAILING_EMPTY = new RegExp(`(?:${EMPTY_P}\\s*)+$`, "i");

export function stripEdgeParagraphs(html: string): string {
  return html.replace(LEADING_EMPTY, "").replace(TRAILING_EMPTY, "");
}

export function BannerBodyEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [linkOpen, setLinkOpen] = useState(false);

  /**
   * The last HTML this editor emitted.
   *
   * Without it, the re-seed below cannot tell "the server sent back something
   * different" from "this is the echo of my own last keystroke", and re-seeding
   * on the echo drops the caret to the start of the document mid-word.
   */
  const emitted = useRef(value);

  const editor = useEditor({
    // The app renders on the server; letting Tiptap paint during SSR produces a
    // hydration mismatch on every open.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // <pre> is not on the plugin's allowlist, so a code block would come
        // back as bare text after the first save.
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // Exactly `Re_Banner_Text::allowed_protocols()`.
          protocols: ["http", "https", "mailto", "tel"],
        },
      }),
      Placeholder.configure({
        placeholder: t(
          "wordpress.reBanner.bodyPlaceholder",
          "Doors open Friday…",
        ),
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        // The app's shared prose styling. Note that this is the *dashboard's*
        // typography, not the site's — see the preview's note.
        class: "compose-prose focus:outline-none min-h-[140px] px-3 py-2",
        "aria-label": t("wordpress.reBanner.bodyHtml", "Banner text"),
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = stripEdgeParagraphs(e.getHTML());
      emitted.current = html;
      onChange(html);
    },
  });

  /**
   * Re-seed only from an externally-driven change.
   *
   * The one that matters is the save: the API answers with the HTML the plugin
   * actually stored, which may be shorter than what was typed if the allowlist
   * stripped something. Re-seeding from that makes the loss visible immediately
   * rather than on the next page load, when nobody would connect it to the save.
   */
  useEffect(() => {
    if (!editor) return;
    if (value === emitted.current) return;
    // The plugin strips the same edge paragraphs on save, so a saved body can
    // come back equal to what was typed minus the caret's empty line. That is
    // not an external change worth moving the caret for.
    if (stripEdgeParagraphs(value) === stripEdgeParagraphs(emitted.current)) {
      emitted.current = value;
      return;
    }

    emitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const existingHref = (editor?.getAttributes("link").href as string) || "";

  const activeLevel = HEADING_LEVELS.find((level) =>
    editor?.isActive("heading", { level }),
  );
  const blockType = activeLevel ? `h${activeLevel}` : "p";

  return (
    <div className="overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {/* One picker for the block type: six heading levels as buttons would
            crowd out everything else, and the Design card can style each. */}
        <NativeSelect
          aria-label={t("wordpress.reBanner.blockType", "Block type")}
          value={blockType}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor?.chain().focus().setParagraph().run();
            else
              editor
                ?.chain()
                .focus()
                .setHeading({ level: Number(v.slice(1)) as HeadingLevel })
                .run();
          }}
          size="sm"
          className="text-xs"
        >
          <NativeSelectOption value="p">
            {t("wordpress.reBanner.paragraph", "Paragraph")}
          </NativeSelectOption>
          {HEADING_LEVELS.map((level) => (
            <NativeSelectOption key={level} value={`h${level}`}>
              {t(`wordpress.reBanner.heading${level}`, `Heading ${level}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <span aria-hidden className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          label={t("wordpress.reBanner.bold", "Bold")}
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label={t("wordpress.reBanner.italic", "Italic")}
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label={t("wordpress.reBanner.underline", "Underline")}
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>

        <span aria-hidden className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          label={t("wordpress.reBanner.bulletList", "Bulleted list")}
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label={t("wordpress.reBanner.numberedList", "Numbered list")}
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>

        <span aria-hidden className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          label={
            editor?.isActive("link")
              ? t("wordpress.reBanner.editLink", "Edit link")
              : t("wordpress.reBanner.addLink", "Add link")
          }
          active={editor?.isActive("link")}
          onClick={() => setLinkOpen(true)}
        >
          {editor?.isActive("link") ? (
            <Link2Off className="size-3.5" />
          ) : (
            <Link2 className="size-3.5" />
          )}
        </ToolbarButton>
        <ToolbarButton
          label={t("wordpress.reBanner.clearFormatting", "Clear formatting")}
          onClick={() =>
            editor?.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting className="size-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <PromptDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title={
          existingHref
            ? t("wordpress.reBanner.editLink", "Edit link")
            : t("wordpress.reBanner.addLink", "Add link")
        }
        label={t("wordpress.reBanner.linkPrompt", "Link URL")}
        placeholder="https://example.com"
        defaultValue={existingHref || "https://"}
        inputType="url"
        submitLabel={t("common.apply", { defaultValue: "Apply" })}
        onSubmit={(url) => {
          editor
            ?.chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
          setLinkOpen(false);
        }}
        secondaryAction={
          existingHref
            ? {
                label: t("wordpress.reBanner.removeLink", "Remove link"),
                onClick: () => {
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                  setLinkOpen(false);
                },
              }
            : undefined
        }
      />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      // An icon-only control needs both the accessible name and the pressed
      // state, or a screen reader announces "button" and nothing else.
      aria-label={label}
      aria-pressed={active ?? false}
      title={label}
      onClick={onClick}
      className={cn("size-8 p-0", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}
