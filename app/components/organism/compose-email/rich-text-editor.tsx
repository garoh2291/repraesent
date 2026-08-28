import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
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
import { cn } from "~/lib/utils";
import { PromptDialog } from "~/components/molecule/prompt-dialog";

export interface RichTextEditorHandle {
  focus: () => void;
  /**
   * Insert literal text where the caret is, replacing any selection.
   *
   * Needed because this editor is deliberately NOT re-seeded from `value` while
   * you are typing (see the effect below) — so a caller that wants to add
   * something has to go through the editor rather than through its own copy of
   * the HTML. Writing to that copy instead leaves the two out of sync, and the
   * next keystroke overwrites whatever was added.
   */
  insertText: (text: string) => void;
}

export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  disabled,
  allowImages,
  minHeight = "min-h-[220px]",
  ref,
  toolbarRef,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Cmd/Ctrl+Enter sends, the way every mail client does. */
  onSubmit?: () => void;
  disabled?: boolean;
  /**
   * Signature editing only. The composer stays image-free: an inline image in a
   * one-off email has nowhere to live, while a signature image is stored once
   * and reused.
   */
  allowImages?: boolean;
  minHeight?: string;
  ref?: Ref<RichTextEditorHandle>;
  /**
   * Where to render the toolbar. The composer puts it in the footer next to
   * Send, so it has to leave the editor's own subtree.
   */
  toolbarRef?: (editor: Editor | null) => void;
}) {
  const { t } = useTranslation();

  const editor = useEditor({
    // The app renders on the server; letting Tiptap paint during SSR produces a
    // hydration mismatch on every open.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // A horizontal rule and code blocks are noise in an email body.
        horizontalRule: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
      }),
      ...(allowImages
        ? [
            Image.configure({
              // Sizing is decided at insert time by actually resizing the
              // pixels, so the node only has to carry the result.
              inline: false,
              allowBase64: true,
              HTMLAttributes: { style: "max-width:100%;height:auto" },
            }),
          ]
        : []),
      Placeholder.configure({
        placeholder: t("compose.bodyPlaceholder", {
          defaultValue: "Write your message…",
        }),
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        // The visible focus ring lives on the wrapper, so the content area does
        // not draw a second one inside it.
        class: `compose-prose focus:outline-none ${minHeight} px-1 py-2`,
        "aria-label": t("compose.body", { defaultValue: "Message" }),
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      insertText: (text: string) => {
        // `focus()` first: reaching for a menu moves DOM focus out of the
        // editor, and without this the insert lands at the start of the
        // document instead of where the author actually was. Tiptap remembers
        // the selection, so focusing restores it.
        //
        // Inserted as an explicit text node, not parsed as HTML — a variable
        // like {{contact.first_name | default: "there"}} must survive exactly
        // as typed.
        editor?.chain().focus().insertContent({ type: "text", text }).run();
      },
    }),
    [editor],
  );

  useEffect(() => {
    toolbarRef?.(editor);
    return () => toolbarRef?.(null);
  }, [editor, toolbarRef]);

  // Re-seed when the composer is reopened for a different reply.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // Only on an externally-driven value change; typing must not round-trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value === ""]);

  return (
    <div
      className={cn(
        "rounded-xl border border-transparent px-2 transition-colors",
        "focus-within:border-border focus-within:bg-muted/20",
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

/** The formatting controls, rendered by the composer next to Send. */
export function RichTextToolbar({
  editor,
  className,
}: {
  editor: Editor | null;
  className?: string;
}) {
  const { t } = useTranslation();
  // Declared above the early return — hooks cannot sit behind a conditional.
  const [linkOpen, setLinkOpen] = useState(false);
  if (!editor) return null;

  const existingHref = (editor.getAttributes("link").href as string) || "";

  const applyLink = (url: string) => {
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      <ToolbarButton
        label={t("compose.bold", { defaultValue: "Bold" })}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("compose.italic", { defaultValue: "Italic" })}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("compose.underline", { defaultValue: "Underline" })}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label={t("compose.bulletList", { defaultValue: "Bulleted list" })}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("compose.numberedList", { defaultValue: "Numbered list" })}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label={
          editor.isActive("link")
            ? t("compose.removeLink", { defaultValue: "Remove link" })
            : t("compose.addLink", { defaultValue: "Add link" })
        }
        active={editor.isActive("link")}
        onClick={() => setLinkOpen(true)}
      >
        {editor.isActive("link") ? (
          <Link2Off className="size-3.5" />
        ) : (
          <Link2 className="size-3.5" />
        )}
      </ToolbarButton>
      <ToolbarButton
        label={t("compose.clearFormatting", {
          defaultValue: "Clear formatting",
        })}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <RemoveFormatting className="size-3.5" />
      </ToolbarButton>

      {/*
        Removing a link used to mean clearing the prompt's text and pressing OK
        — a behaviour with nowhere to be documented. It is a button now, shown
        only when there is a link to remove.
      */}
      <PromptDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title={
          existingHref
            ? t("compose.editLink", { defaultValue: "Edit link" })
            : t("compose.addLink", { defaultValue: "Add link" })
        }
        label={t("compose.linkPrompt", { defaultValue: "Link URL" })}
        placeholder="https://example.com"
        defaultValue={existingHref || "https://"}
        inputType="url"
        submitLabel={t("common.apply", { defaultValue: "Apply" })}
        onSubmit={applyLink}
        secondaryAction={
          existingHref
            ? {
                label: t("compose.removeLink", { defaultValue: "Remove link" }),
                onClick: removeLink,
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
      className={cn(
        "size-9 p-0 sm:size-8",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </Button>
  );
}
