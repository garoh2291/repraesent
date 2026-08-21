/**
 * The four-square Microsoft mark, inline so it needs no asset request.
 *
 * Shared marker for anything Microsoft-sourced — email account rows, calendar
 * rows, target selects — the counterpart of GoogleIcon.tsx.
 */
export function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 23 23"
      aria-hidden
      focusable="false"
    >
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
