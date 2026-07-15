import React, { useState } from "react";
import type { ReAppointmentButtonConfig } from "~/lib/wordpress/plugin-settings-types";

/**
 * Same visual mapping as `Reappt_Shortcode::inline_styles()`. Hover uses
 * mouse handlers so we don't need a leftover CSS rule for `:hover`.
 */
export function PreviewButton({
  config,
}: {
  config: ReAppointmentButtonConfig;
}) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    backgroundColor: hovered ? config.hover_bg : config.bg_color,
    color: config.font_color,
    fontSize: `${config.font_size}px`,
    borderRadius: `${config.border_radius}px`,
    padding: `${config.padding_y}px ${config.padding_x}px`,
    margin: `${config.margin_y}px ${config.margin_x}px`,
    borderStyle: "solid",
    borderWidth: `${config.border_width}px`,
    borderColor: config.border_color,
    cursor: "pointer",
    display: config.full_width ? "flex" : "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    lineHeight: "1.2",
    transition: "background-color 0.15s ease",
    ...(config.full_width ? { width: "100%" } : null),
  };

  return (
    <button
      type="button"
      id="reappt-preview-btn"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {config.icon ? <span>{config.icon}</span> : null}
      <span>{config.label}</span>
    </button>
  );
}
