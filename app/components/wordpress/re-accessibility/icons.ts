/**
 * The menu's inline SVG icons — a copy of `Re_Accessibility_Icons::paths()` in the
 * plugin (24×24 grid, 2px stroke). Re-copy when the plugin's icons change.
 */
export const ICON_PATHS: Record<string, string> = {
  access:
    '<circle cx="12" cy="4.5" r="2" fill="currentColor" stroke="none"/><path d="M4.5 8.5 12 10l7.5-1.5M12 10v4.5M12 14.5 8.5 21M12 14.5l3.5 6.5"/>',
  "access-ring":
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none"/><path d="M7.5 10 12 11l4.5-1M12 11v3M12 14l-2.5 4M12 14l2.5 4"/>',
  wheelchair:
    '<circle cx="10" cy="4" r="1.75" fill="currentColor" stroke="none"/><path d="M10 7.5V13h5.5l2.5 6 2-.8"/><path d="M10 10h5"/><path d="M7 10.6A5.5 5.5 0 1 0 14.4 17"/>',
  eye:
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sliders:
    '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-9-9.5C1.9 6.9 4.3 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.1 0 5.5 2.9 4.4 6.5-1.5 4.9-9 9.5-9 9.5z"/>',
  contrast:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  links:
    '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.3-3.3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.3 3.3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  text:
    '<path d="M3 7V5h10v2M8 5v14M6 19h4"/><path d="M14 11.5V10h7v1.5M17.5 10v9M16 19h3"/>',
  spacing:
    '<path d="M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"/><path d="M3 4v2M21 4v2M3 18v2M21 18v2"/>',
  pause:
    '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
  images:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><path d="m3 3 18 18"/>',
  dyslexia:
    '<path d="M4 5h3.5a5.5 7 0 0 1 0 14H4z"/><path d="M15 19V8a3 3 0 0 1 5.5-1.6M13 12h6"/>',
  cursor:
    '<path d="M5 3l14 7.5-6.2 1.8L10 19z"/><path d="m13 12.5 5 6"/>',
  tooltips:
    '<path d="M4 4h16v12H10l-5 4v-4H4z"/><path d="M12 8v.01M12 11v3"/>',
  lineheight:
    '<path d="M4 7 6 5l2 2M6 5v14M4 17l2 2 2-2M11 6h9M11 10h9M11 14h9M11 18h9"/>',
  align:
    '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  saturation:
    '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M12 20a6 6 0 0 0 6-6H6a6 6 0 0 0 6 6z" fill="currentColor"/>',
  reset:
    '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  close:
    '<path d="M6 6l12 12M18 6 6 18"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  chevron:
    '<path d="m9 6 6 6-6 6"/>',
  document:
    '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
};

/** One icon as the plugin prints it (`Re_Accessibility_Icons::get()`). */
export function iconSvg(name: string): string {
  const paths = ICON_PATHS[name];
  if (!paths) return "";
  return `<svg class="reacc-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}
