import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent } from "react";

/**
 * Edit a translated sentence as plain words. The sentence travels tokenised
 * (<1>…</1> a link or bold words, <2/> a line break or icon, ⟦0⟧ a value the
 * site fills in); here those show as underlined words, a small dot and a
 * chip — never as markers to type. The words are edited freely; the formatting
 * is read back from the editor, and anything that still went missing (all the
 * words of a link deleted, say) is put back, so a save never fails on markers.
 */

const PARTS = /(<\/?\d+\/?>|⟦\d+⟧)/g;
const TOKEN = /<\/?\d+\/?>|⟦\d+⟧/g;

export type MarkedTextEditorHandle = {
  /** The sentence, tokenised again, with every marker of `source` in place. */
  value: () => string;
};

type Props = {
  /** What the editor starts with (the current translation, or the source). */
  initial: string;
  /** The original sentence: its markers are the ones the translation must keep. */
  source: string;
  dir?: "rtl" | "ltr";
  autoFocus?: boolean;
  label?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
};

export const MarkedTextEditor = forwardRef<MarkedTextEditorHandle, Props>(function MarkedTextEditor({ initial, source, dir, autoFocus, label, onSubmit, onCancel }, ref) {
  const el = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = el.current;
    if (!root) return;
    root.replaceChildren(...build(initial));
    if (autoFocus) {
      root.focus();
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    // Built once: the browser owns the words while editing.
  }, []);

  useImperativeHandle(ref, () => ({
    value: () => repair(serialize(el.current), source),
  }));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Enter") {
      // One sentence: a new paragraph would not fit in its place on the page.
      e.preventDefault();
      if (mod) onSubmit?.();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
      return;
    }
    // The page decides bold and italic, not the editor.
    if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) e.preventDefault();
  }

  return (
    <div
      ref={el}
      role="textbox"
      aria-multiline="false"
      aria-label={label}
      dir={dir}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        // Words only: formatting from elsewhere never comes along.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
      onDrop={(e) => e.preventDefault()}
      className="min-h-[4.5rem] w-full whitespace-pre-wrap break-words rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
});

/** Decoded words as the editor shows them. */
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** As the site writes sentence text (re:translate's Segmenter::escape_text). */
function encode(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
}

/** The editor's content for a tokenised sentence. */
export function build(tokenised: string): Node[] {
  const top = document.createDocumentFragment();
  const stack: Node[] = [top];
  const here = () => stack[stack.length - 1];
  for (const part of tokenised.split(PARTS)) {
    if (!part) continue;
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^<(\d+)>$/))) {
      const span = document.createElement("span");
      span.dataset.t = m[1];
      // An underline drawn as a shadow: Chrome would carry a real one over to new words as a <u>.
      span.className = "shadow-[inset_0_-1px_0_var(--muted-foreground)]";
      here().appendChild(span);
      stack.push(span);
    } else if (/^<\/\d+>$/.test(part)) {
      if (stack.length > 1) stack.pop();
    } else if ((m = part.match(/^<(\d+)\/>$/))) {
      here().appendChild(atom(`${m[1]}/`, ""));
    } else if (/^⟦\d+⟧$/.test(part)) {
      here().appendChild(atom(part, part));
    } else {
      here().appendChild(document.createTextNode(decode(part)));
    }
  }
  return [...top.childNodes];
}

/**
 * A line break, icon or filled-in value: one piece the cursor steps over.
 * Drawn by ::before only — Chrome gives words typed where a deleted piece was
 * that piece's own colours, and a pseudo-element has none to give.
 */
function atom(token: string, label: string): HTMLElement {
  const span = document.createElement("span");
  span.dataset.t = token;
  span.contentEditable = "false";
  if (label) {
    span.dataset.label = label;
    span.setAttribute("aria-label", label);
    span.className = "mx-0.5 before:rounded before:bg-muted before:px-1 before:font-mono before:text-[0.85em] before:text-muted-foreground before:content-[attr(data-label)]";
  } else {
    span.setAttribute("aria-hidden", "true");
    span.className = "mx-1 inline-block align-middle before:block before:size-1.5 before:rounded-full before:bg-muted-foreground/50 before:content-['']";
  }
  return span;
}

/** The editor's content tokenised again. A marker the browser copied (a split link) is written once. */
export function serialize(root: Node | null): string {
  const seen = new Set<string>();
  const walk = (node: Node): string => {
    let out = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += encode(child.textContent ?? "");
        return;
      }
      if (!(child instanceof HTMLElement)) return;
      const t = child.dataset.t;
      if (t && /^\d+$/.test(t)) {
        const inner = walk(child);
        if (seen.has(t)) out += inner;
        else {
          seen.add(t);
          out += `<${t}>${inner}</${t}>`;
        }
      } else if (t && /^\d+\/$/.test(t)) {
        if (!seen.has(t)) out += `<${t}>`;
        seen.add(t);
      } else if (t && /^⟦\d+⟧$/.test(t)) {
        if (!seen.has(t)) out += t;
        seen.add(t);
      } else if (child.tagName === "BR") {
        out += " ";
      } else {
        // Anything the browser added (a <b>, a <div>): its words count, the element does not.
        out += (child.tagName === "DIV" || child.tagName === "P" ? " " : "") + walk(child);
      }
    });
    return out;
  };
  return root ? walk(root).replace(/[ \t\n\r]+/g, " ").trim() : "";
}

/**
 * Every marker of the source, exactly as often: one the editor lost goes back
 * at the end (an emptied link is an empty pair, which shows nothing), one the
 * source does not have is dropped.
 */
export function repair(tokenised: string, source: string): string {
  const want = new Map<string, number>();
  for (const t of source.match(TOKEN) ?? []) want.set(t, (want.get(t) ?? 0) + 1);
  const have = new Map<string, number>();
  let out = tokenised.replace(TOKEN, (t) => {
    const n = (have.get(t) ?? 0) + 1;
    if (n > (want.get(t) ?? 0)) return "";
    have.set(t, n);
    return t;
  });
  const short = (t: string) => (want.get(t) ?? 0) - (have.get(t) ?? 0);
  for (const t of want.keys()) {
    const pair = t.match(/^<(\d+)>$/);
    // A link lost with its words comes back as an empty pair; a stray marker on its own.
    while (pair && short(t) > 0 && short(`</${pair[1]}>`) > 0) {
      out += `<${pair[1]}></${pair[1]}>`;
      have.set(t, (have.get(t) ?? 0) + 1);
      have.set(`</${pair[1]}>`, (have.get(`</${pair[1]}>`) ?? 0) + 1);
    }
  }
  for (const t of want.keys()) {
    for (let i = short(t); i > 0; i--) out += t;
  }
  return out;
}
