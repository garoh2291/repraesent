import { toast } from "sonner";
import type { ReReviewSettings } from "~/lib/wordpress/plugin-settings-types";

export const DEFAULT_SETTINGS: ReReviewSettings = {
  place_id: "",
  cache_ttl: 12,
  has_api_key: null,
  is_configured: false,
  cache: {
    present: false,
    business_name: "",
    rating: null,
    review_count: null,
    url: "",
    fetched_at: null,
    last_fetched_display: "—",
  },
};

/** Version badge — must track `RE_REVIEWS_VERSION` in re-reviews.php. */
export const PLUGIN_VERSION = "1.0.0";

export const SHORTCODE_EXAMPLES = [
  "[gmb_stars]",
  '[gmb_stars show="stars,rating" color="#0a0a0a" size="20"]',
  '[gmb_stars link="yes"]',
] as const;

export const SHORTCODE_ATTRS: {
  attr: string;
  default: string;
  description: string;
}[] = [
  {
    attr: "show",
    default: "stars,rating,count",
    description:
      "Comma-separated parts to render. Any subset of stars, rating, count.",
  },
  {
    attr: "color",
    default: "#F5A623",
    description: "Star fill color (hex).",
  },
  {
    attr: "size",
    default: "24",
    description: "Star icon size in px (12–128).",
  },
  {
    attr: "link",
    default: "no",
    description: 'Set to "yes" to wrap the widget in a link to the Google listing.',
  },
];

export type PatchSettings = (
  updater: (prev: ReReviewSettings) => ReReviewSettings,
) => void;

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}
