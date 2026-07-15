import { toast } from "sonner";
import type {
  ReAppointmentActionType,
  ReAppointmentButton,
  ReAppointmentButtonConfig,
  ReAppointmentTargetPosition,
} from "~/lib/wordpress/plugin-settings-types";

/* ── Defaults (mirror Reappt_CPT::defaults) ──────────────────────────── */

export const DEFAULTS: ReAppointmentButtonConfig = {
  action_type: "modal-iframe",
  url: "",
  html_content: "",
  wp_page_id: 0,
  new_tab: false,
  modal_width: "900px",
  modal_height: "700px",
  label: "Click here",
  font_size: 16,
  font_color: "#ffffff",
  bg_color: "#000000",
  hover_bg: "#555555",
  border_radius: 8,
  padding_y: 12,
  padding_x: 24,
  margin_y: 0,
  margin_x: 0,
  border_width: 0,
  border_color: "#000000",
  full_width: false,
  icon: "",
  placement_slots: [],
  placement_visibility: "all",
  placement_page_ids: [],
  placement_targets: [],
  mobile_position: "right",
  status: "active",
};

/** Mirrors `Reappt_CPT::$action_types` — order and labels included. */
export const ACTION_TYPES: { key: ReAppointmentActionType; label: string }[] = [
  { key: "modal-iframe", label: "Modal – iFrame" },
  { key: "modal-html", label: "Modal – HTML" },
  { key: "url", label: "Open URL" },
  { key: "page", label: "Go to WP Page" },
];

export const ACTION_TYPE_I18N: Record<ReAppointmentActionType, string> = {
  "modal-iframe": "wordpress.reAppointment.actions.modalIframe",
  "modal-html": "wordpress.reAppointment.actions.modalHtml",
  url: "wordpress.reAppointment.actions.url",
  page: "wordpress.reAppointment.actions.page",
};

export const TARGET_POSITIONS: ReAppointmentTargetPosition[] = [
  "before",
  "after",
  "prepend",
  "append",
];

/** Version badge — must track `REAPPT_VERSION` in reappointment.php. */
export const PLUGIN_VERSION = "1.3.0";

/** Sets one key of the editor draft. */
export type SetConfig = <K extends keyof ReAppointmentButtonConfig>(
  key: K,
  value: ReAppointmentButtonConfig[K],
) => void;

export function shortcodeFor(id: number): string {
  return `[reappointment id="${id}"]`;
}

/** Drop the server-assigned fields to get the part the editor actually edits. */
export function toConfig(
  button: ReAppointmentButton,
): ReAppointmentButtonConfig {
  const { id: _id, title: _title, ...config } = button;
  return config;
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}
