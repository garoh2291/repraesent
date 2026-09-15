import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  ChevronLeft,
  Eye,
  FileText,
  MapPin,
  Palette,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ReBannerConfig,
  ReBannerLinkTarget,
  ReBannerState,
} from "~/lib/wordpress/plugin-settings-types";
import type { ReBannerStyleElement } from "~/lib/wordpress/re-banner-styles";
import type { WpMediaItem } from "~/lib/api/wordpress-hub";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MediaLibraryPicker } from "~/components/wordpress/re-index/media-library-picker";
import { BannerPreview } from "~/components/wordpress/re-banner/banner-preview";
import { ContentPanel } from "~/components/wordpress/re-banner/content-panel";
import { DesignPanel } from "~/components/wordpress/re-banner/design-panel";
import { SchedulePanel } from "~/components/wordpress/re-banner/schedule-panel";
import { PlacementPanel } from "~/components/wordpress/re-banner/placement-panel";
import { isEndBeforeStart } from "~/components/wordpress/re-banner/banner-schedule-fields";
import {
  STATE_I18N,
  STATE_TONE,
  VARIANTS,
  scheduleLabel,
  stripHtml,
  tabFromParam,
  type EditorTab,
  type SetConfig,
} from "~/components/wordpress/re-banner/constants";

/**
 * The banner editor: a sticky header with the one Save button, four tabs of
 * settings on the left, and the live preview pinned on the right so every
 * change is visible without scrolling — the same shape as the re:cookie
 * screen, which is the pattern every plugin page in this app follows.
 */
export function BannerEditor({
  draft,
  set,
  bannerId,
  state,
  dirty,
  linkTargets,
  timezone,
  imageUrl,
  saving,
  tab,
  onTabChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  /** null while creating — there is no shortcode to show yet. */
  bannerId: number | null;
  /** The saved banner's derived state, null while creating. */
  state: ReBannerState | null;
  dirty: boolean;
  linkTargets: ReBannerLinkTarget[];
  timezone: string;
  imageUrl: string | null;
  saving: boolean;
  /** Controlled by the page, which keeps it in the URL (`?tab=`). */
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The picker hands back a fresh URL; until the list refetches, that is the
  // only way the preview knows what the newly chosen image looks like.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  // The override element the Design tab is working on, for the preview to
  // outline. Only meaningful while that tab is showing.
  const [inspected, setInspected] = useState<ReBannerStyleElement | null>(null);
  const onSelectElement = useCallback(
    (element: ReBannerStyleElement | null) => setInspected(element),
    [],
  );

  const shownImage = draft.image_id === 0 ? null : (pickedUrl ?? imageUrl);
  const isText = draft.variant === "text";

  const windowError = isEndBeforeStart(draft.starts_at, draft.ends_at);
  const canSave = !saving && !windowError;

  const hasCta =
    !isText &&
    draft.cta_label.trim() !== "" &&
    (draft.cta_type === "url" ? draft.cta_url.trim() !== "" : draft.cta_post_id > 0);

  const variant = VARIANTS.find((v) => v.key === draft.variant);
  const excerpt = stripHtml(draft.body_html);
  // What the header shows when no name is set: the first words of the text,
  // the same derivation the list and the plugin use.
  const derivedTitle =
    (excerpt.length > 48 ? `${excerpt.slice(0, 48).trimEnd()}…` : excerpt) ||
    (bannerId === null
      ? t("wordpress.reBanner.newBanner", "New banner")
      : t("wordpress.reBanner.untitled", "Untitled banner"));
  const title = draft.name.trim() || derivedTitle;

  // The name is edited where it is shown. Internal only — never on the site
  // — so an empty name is fine: the derived title stands in.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  function startEditingName() {
    setNameDraft(draft.name);
    setEditingName(true);
  }
  function commitName() {
    set("name", nameDraft.trim());
    setEditingName(false);
  }

  function handlePick(item: WpMediaItem) {
    set("image_id", item.id);
    setPickedUrl(item.thumb_url || item.url);
  }

  return (
    <div>
      {/* ── Sticky header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 app-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              aria-label={t("wordpress.reBanner.backToList", "All banners")}
              title={t("wordpress.reBanner.backToList", "All banners")}
              className="shrink-0"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {editingName ? (
                  <Input
                    autoFocus
                    value={nameDraft}
                    placeholder={derivedTitle}
                    aria-label={t("wordpress.reBanner.name", "Banner name")}
                    disabled={saving}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitName();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingName(false);
                      }
                    }}
                    className="h-8 w-[min(28rem,70vw)] text-lg font-semibold tracking-tight sm:text-xl"
                  />
                ) : (
                  <>
                    <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                      {title}
                    </h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={startEditingName}
                      disabled={saving}
                      aria-label={t("wordpress.reBanner.renameBanner", "Rename banner")}
                      title={t("wordpress.reBanner.renameBanner", "Rename banner")}
                      className="shrink-0 text-muted-foreground"
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </>
                )}
                {state ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      STATE_TONE[state],
                    )}
                  >
                    {t(STATE_I18N[state].i18n, STATE_I18N[state].fallback)}
                  </span>
                ) : null}
                {dirty ? (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 font-normal text-muted-foreground"
                  >
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    {t("wordpress.reBanner.unsaved", "Unsaved changes")}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {variant ? t(variant.i18n, variant.fallback) : null}
                {" · "}
                {scheduleLabel(draft)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                disabled={saving}
                aria-label={t("wordpress.reBanner.delete", "Delete banner")}
                title={t("wordpress.reBanner.delete", "Delete banner")}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              {t("wordpress.reBanner.cancel", "Cancel")}
            </Button>
            <Button onClick={onSave} disabled={!canSave} loading={saving}>
              <Save className="size-4" aria-hidden />
              {t("wordpress.reBanner.save", "Save banner")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Settings + preview ──────────────────────────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_520px]">
        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(tabFromParam(v))}
          className="min-w-0 gap-4 app-fade-up app-fade-up-d1"
        >
          <TabsList aria-label={t("wordpress.reBanner.tabs", "Banner settings")}>
            <TabsTrigger value="content" className="gap-1.5">
              <FileText className="size-3.5" />
              {t("wordpress.reBanner.tabContent", "Content")}
            </TabsTrigger>
            <TabsTrigger value="design" className="gap-1.5">
              <Palette className="size-3.5" />
              {t("wordpress.reBanner.tabDesign", "Design")}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5">
              <CalendarClock className="size-3.5" />
              {t("wordpress.reBanner.tabSchedule", "Schedule")}
              {windowError ? (
                <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="placement" className="gap-1.5">
              <MapPin className="size-3.5" />
              {t("wordpress.reBanner.tabPlacement", "Placement")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-0">
            <ContentPanel
              draft={draft}
              set={set}
              linkTargets={linkTargets}
              imageUrl={shownImage}
              saving={saving}
              onPickImage={() => setPickerOpen(true)}
            />
          </TabsContent>

          <TabsContent value="design" className="mt-0">
            <DesignPanel
              draft={draft}
              set={set}
              hasCta={hasCta}
              onSelectElement={onSelectElement}
            />
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <SchedulePanel
              draft={draft}
              set={set}
              timezone={timezone}
              saving={saving}
            />
          </TabsContent>

          <TabsContent value="placement" className="mt-0">
            <PlacementPanel
              draft={draft}
              set={set}
              bannerId={bannerId}
              linkTargets={linkTargets}
              saving={saving}
            />
          </TabsContent>
        </Tabs>

        <div className="lg:sticky lg:top-24 app-fade-up app-fade-up-d2">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Eye className="size-4 text-muted-foreground" aria-hidden />
              {t("wordpress.reBanner.preview", "Live preview")}
            </h2>
            <BannerPreview
              config={draft}
              bannerId={bannerId}
              imageUrl={shownImage}
              highlight={tab === "design" ? inspected : null}
            />
          </div>
        </div>
      </div>

      <MediaLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={draft.image_id}
        onSelect={handlePick}
      />
    </div>
  );
}
