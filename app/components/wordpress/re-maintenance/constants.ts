import { toast } from "sonner";
import type { ReMaintenanceSettings } from "~/lib/wordpress/plugin-settings-types";

/** Default primary message — mirrors plugin activation default. */
export const DEFAULT_MESSAGE = "Diese Seite befindet sich im Aufbau.";

export const DEFAULT_SETTINGS: ReMaintenanceSettings = {
  maintenance: {
    enabled: false,
    message: DEFAULT_MESSAGE,
    sub_message: "",
  },
  site: {
    site_title: "",
    tagline: "",
  },
};

export type PatchSettings = (
  updater: (prev: ReMaintenanceSettings) => ReMaintenanceSettings,
) => void;

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}
