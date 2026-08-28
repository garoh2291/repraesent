/**
 * Renders a compiled email inside an isolated frame.
 *
 * WHY THIS EXISTS
 *
 * Email HTML is a whole document, and MJML's `<head>` carries unscoped global
 * CSS — `a { color: #2563eb }`, `body { margin:0 }`, `p { display:block }`,
 * `table, td { border-collapse:collapse }`. Dropping that into the app's own
 * DOM with `dangerouslySetInnerHTML` applies every one of those rules to the
 * entire page: all links turn blue and the surrounding layout shifts. That is
 * not a hypothetical — it is what the workflow email preview did.
 *
 * An iframe is the only real fix. Scoping the CSS would mean parsing and
 * rewriting a stylesheet the email needs verbatim to render the way a mail
 * client will.
 *
 * `sandbox=""` (deny everything) also stops scripts in author-pasted HTML from
 * running, so a preview cannot execute anything the author did not intend.
 *
 * The frame needs an explicit height: `sandbox=""` blocks the script that would
 * measure the content and report its height back, so callers size it and the
 * content scrolls inside. The alternative — allow-scripts plus a postMessage
 * handshake — would give back the script execution this is here to prevent.
 */
export function EmailHtmlFrame({
  html,
  title,
  className,
}: {
  html: string;
  /** Describes the frame for screen readers; iframes need one. */
  title: string;
  /** Sizing. Must include a height — the frame cannot size itself. */
  className?: string;
}) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={html}
      className={
        className ??
        "block h-[320px] w-full rounded-xl border border-border bg-white"
      }
    />
  );
}
