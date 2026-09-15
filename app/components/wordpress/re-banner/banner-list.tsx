import { useTranslation } from "react-i18next";
import { CalendarClock, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import type { ReBanner } from "~/lib/wordpress/plugin-settings-types";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { CardBody, CardHeader, SectionCard } from "~/components/wordpress/fields";
import { cn } from "~/lib/utils";
import {
  STATE_I18N,
  STATE_TONE,
  scheduleLabel,
  stripHtml,
  VARIANTS,
} from "~/components/wordpress/re-banner/constants";

/**
 * The banners on the site, ordered the way the plugin picks a winner — newest
 * first — so the list reads top-down as "this is the one that shows".
 */
export function BannerList({
  banners,
  busyId,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: {
  banners: ReBanner[];
  /** Banner currently mid-toggle, so its switch can be disabled. */
  busyId: number | null;
  onCreate: () => void;
  onEdit: (banner: ReBanner) => void;
  onToggle: (banner: ReBanner) => void;
  onDelete: (banner: ReBanner) => void;
}) {
  const { t } = useTranslation();

  if (banners.length === 0) {
    return (
      <SectionCard>
        <CardBody className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarClock className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">
              {t("wordpress.reBanner.emptyTitle", "No banners yet")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {t(
                "wordpress.reBanner.emptyBody",
                "Create one to announce an opening, a closure or a promotion. It goes up on its start date and takes itself down on its end date.",
              )}
            </p>
          </div>
          <Button onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
            {t("wordpress.reBanner.addFirst", "Add your first banner")}
          </Button>
        </CardBody>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <CardHeader
        title={t("wordpress.reBanner.listTitle", "Banners")}
        subtitle={t(
          "wordpress.reBanner.listSubtitle",
          "When several are live in the same position, the newest one shows.",
        )}
        action={
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
            {t("wordpress.reBanner.add", "Add banner")}
          </Button>
        }
      />
      <CardBody className="space-y-0 p-0!">
        <ul className="divide-y">
          {banners.map((banner) => (
            <BannerRow
              key={banner.id}
              banner={banner}
              busy={busyId === banner.id}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </CardBody>
    </SectionCard>
  );
}

function BannerRow({
  banner,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  banner: ReBanner;
  busy: boolean;
  onEdit: (banner: ReBanner) => void;
  onToggle: (banner: ReBanner) => void;
  onDelete: (banner: ReBanner) => void;
}) {
  const { t } = useTranslation();
  const state = STATE_I18N[banner.state];
  const variant = VARIANTS.find((v) => v.key === banner.variant);
  const heading = banner.name.trim() || t("wordpress.reBanner.untitled", "Untitled banner");
  const excerpt = stripHtml(banner.body_html);

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
        {banner.image_url ? (
          <img src={banner.image_url} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-4" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(banner)}
            className="truncate text-sm font-semibold tracking-tight hover:underline"
          >
            {heading}
          </button>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              STATE_TONE[banner.state],
            )}
          >
            {t(state.i18n, state.fallback)}
          </span>
        </div>
        {excerpt ? (
          <p className="mt-0.5 truncate text-xs text-foreground/80">{excerpt}</p>
        ) : null}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {scheduleLabel(banner)}
          {variant ? ` · ${t(variant.i18n, variant.fallback)}` : null}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={banner.status === "active"}
          disabled={busy}
          onCheckedChange={() => onToggle(banner)}
          aria-label={
            banner.status === "active"
              ? t("wordpress.reBanner.pause", "Pause banner")
              : t("wordpress.reBanner.resume", "Resume banner")
          }
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(banner)}
          aria-label={t("wordpress.reBanner.edit", "Edit banner")}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(banner)}
          aria-label={t("wordpress.reBanner.delete", "Delete banner")}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
