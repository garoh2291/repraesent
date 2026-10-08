import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flag, MapPin, Palette, ScanSearch } from "lucide-react";
import type { ReTranslateColorKey, ReTranslateLengthKey, ReTranslateMenuDetection, ReTranslateOverview, ReTranslateSiteMenu, ReTranslateSwitcher, ReTranslateSwitcherPosition, ReTranslateSwitcherShow, ReTranslateTarget } from "~/lib/api/re-translate";
import { useReTranslateActions } from "~/lib/hooks/useReTranslate";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Slider } from "~/components/ui/slider";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { CardBody, CardHeader, Field, FieldHint, InfoNote, SectionCard } from "~/components/wordpress/fields";
import { errorText, flash } from "~/components/wordpress/re-translate/constants";
import { baseOf, menuName, shortName } from "./logic";
import { FlagImage, MenuPreview, type MenuLanguage } from "./menu-preview";

const POSITIONS: ReTranslateSwitcherPosition[] = ["bottom-left", "bottom-right", "top-left", "top-right", "manual"];
const SHOW: ReTranslateSwitcherShow[] = ["flag_name", "flag", "name", "flag_code", "code"];
const COLORS: Array<{ group: "all" | "current"; key: ReTranslateColorKey; label: string; fallback: string }> = [
  { group: "all", key: "text", label: "Text", fallback: "#111111" },
  { group: "all", key: "bg", label: "Background", fallback: "#ffffff" },
  { group: "all", key: "border", label: "Border", fallback: "#d4d4d8" },
  { group: "current", key: "active_text", label: "Text", fallback: "#ffffff" },
  { group: "current", key: "active_bg", label: "Background", fallback: "#111111" },
];
/** Slider ranges; the plugin clamps again (Settings::SWITCHER_LENGTHS). `rest` is where an untouched slider sits. */
const LENGTHS: Record<ReTranslateLengthKey, { max: number; rest: number }> = {
  radius: { max: 24, rest: 6 },
  pad_y: { max: 24, rest: 5 },
  pad_x: { max: 40, rest: 10 },
  offset_y: { max: 200, rest: 0 },
  offset_x: { max: 200, rest: 0 },
};


/**
 * Which language menu visitors use, and how ours looks. Two ways:
 * ours (a dropdown or a row of links with flags, in a corner or where the
 * site places it), or the website's own menu, found for the customer and
 * connected to the translations. Nothing changes on the website until Save:
 * which menu is used, where ours sits and how it looks. The preview shows
 * every change at once.
 */
export function MenuPanel({ target, overview }: { target: ReTranslateTarget; overview: ReTranslateOverview }) {
  const { t } = useTranslation();
  const { saveOptions } = useReTranslateActions(target);
  const settings = overview.settings;
  const [draft, setDraft] = useState<ReTranslateSwitcher>(settings.switcher);
  const [choice, setChoice] = useState<"plugin" | "site">(settings.switcher.mode);
  /** What was changed since the last Save; null when nothing is waiting. */
  const [changes, setChanges] = useState<Partial<ReTranslateSwitcher> | null>(null);

  // Take the server's copy when nothing is waiting to be saved (also after Save and Undo).
  useEffect(() => {
    if (!changes) setDraft(settings.switcher);
  }, [settings.switcher, changes]);
  // The website's menu was connected (its own button saves): follow it.
  useEffect(() => setChoice(settings.switcher.mode), [settings.switcher.mode]);

  /** Redraw the preview at once; the website only changes when Save is pressed. */
  const update = (patch: Partial<ReTranslateSwitcher>) => {
    setDraft((d) => ({ ...d, ...patch, colors: { ...d.colors, ...(patch.colors ?? {}) } }));
    setChanges((c) => ({ ...(c ?? {}), ...patch, ...(patch.colors ? { colors: { ...(c?.colors ?? {}), ...patch.colors } } : {}) }));
  };
  const modeChanged = choice !== settings.switcher.mode;
  // The website's own menu can only be used once it was found: saving before would leave visitors without a menu.
  const needsMenu = choice === "site" && !settings.switcher.site;
  // Changed and changed back is not a change.
  const lookChanged = !!changes && (Object.keys(changes) as Array<keyof ReTranslateSwitcher>).some((k) => JSON.stringify(draft[k]) !== JSON.stringify(settings.switcher[k]));
  const dirty = modeChanged || lookChanged;

  const saveChanges = () => {
    const body = changes;
    if (!dirty || needsMenu) return;
    saveOptions.mutate(
      { switcher: { ...(lookChanged ? body : {}), ...(modeChanged ? { mode: choice } : {}) } },
      {
        // Anything changed while saving stays waiting for the next Save.
        onSuccess: () => {
          setChanges((c) => (c === body ? null : c));
          flash(t("wordpress.reTranslate.saved", "Saved."));
        },
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );
  };
  const discard = () => {
    setChanges(null);
    setChoice(settings.switcher.mode);
  };

  // Leaving the page with changes not saved: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const tags = [settings.source.bcp47, ...settings.languages.filter((l) => l.enabled).map((l) => l.bcp47)];
  const languages: MenuLanguage[] = [
    { key: "source", name: menuName(settings.source.native, settings.source.name, settings.source.bcp47, tags), code: baseOf(settings.source.bcp47).toUpperCase(), flag: settings.source.flag, current: true },
    ...settings.languages
      .filter((l) => l.enabled)
      .map((l) => ({ key: l.locale, name: menuName(l.native, l.name, l.bcp47, tags), code: baseOf(l.bcp47).toUpperCase(), flag: l.flag, current: false })),
  ];

  /** Only chosen here; the website changes on Save. */
  const choose = (mode: "plugin" | "site") => setChoice(mode);

  return (
    <div className="space-y-4">
      {settings.languages.every((l) => !l.enabled) ? (
        <InfoNote>{t("wordpress.reTranslate.menu.noLanguages", "Add a language first. With only the original there is nothing to switch between, so no menu is shown.")}</InfoNote>
      ) : overview.open.length === 0 ? (
        <InfoNote>{t("wordpress.reTranslate.menu.notOpen", "Visitors see the menu once a page is live in one of your languages.")}</InfoNote>
      ) : null}

      <div role="radiogroup" aria-label={t("wordpress.reTranslate.menu.whichTitle", "Which language menu")} className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={choice === "plugin"}
          onClick={() => choose("plugin")}
          title={t("wordpress.reTranslate.menu.oursTitle", "Our language menu")}
          detail={t("wordpress.reTranslate.menu.oursDetail", "A menu with flags in a corner of every page, or where you place it. You choose how it looks.")}
          art={
            <span className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-1 text-[10px] font-medium shadow-sm ring-1 ring-black/5">
              <FlagImage country={languages[1]?.flag ?? languages[0]?.flag} />
              {languages[1]?.code ?? languages[0]?.code}
              <span aria-hidden className="text-[8px] opacity-60">▾</span>
            </span>
          }
        />
        <ModeCard
          active={choice === "site"}
          onClick={() => choose("site")}
          title={t("wordpress.reTranslate.menu.siteTitle", "My website's own menu")}
          detail={t("wordpress.reTranslate.menu.siteDetail", "Keep the language menu your website already has. We find it and make it switch between your translations; ours stays off.")}
          art={
            <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[10px] font-semibold shadow-sm ring-1 ring-black/5">
              {languages.slice(0, 3).map((l, i) => (
                <span key={l.key} className={cn(i > 0 && "border-l pl-1.5 opacity-60")}>{l.code}</span>
              ))}
            </span>
          }
        />
      </div>

      {choice === "site" ? (
        <SiteMenuCard target={target} overview={overview} onUseOurs={() => choose("plugin")} />
      ) : (
        <>
          <MenuPreview switcher={draft} languages={languages} />
          <WhereCard switcher={draft} update={update} />
          <LookCard switcher={draft} update={update} sample={languages[0]} />
          <FlagsCard target={target} overview={overview} />
        </>
      )}

      {dirty ? (
        <div role="status" className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border bg-background px-4 py-3 shadow-lg">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-secondary ring-1 ring-black/10" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("wordpress.reTranslate.menu.unsaved", "You have changes that are not saved yet.")}</p>
            <p className="text-xs text-muted-foreground">
              {needsMenu
                ? t("wordpress.reTranslate.menu.unsavedFindFirst", "Find your website's language menu below first, then save.")
                : t("wordpress.reTranslate.menu.unsavedHint", "Visitors see the change after you save.")}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="ghost" className="h-10 flex-1 sm:flex-none" onClick={discard} disabled={saveOptions.isPending}>
              {t("wordpress.reTranslate.menu.discard", "Undo changes")}
            </Button>
            <Button type="button" className="h-10 flex-1 sm:flex-none" onClick={saveChanges} disabled={needsMenu || saveOptions.isPending}>
              {saveOptions.isPending ? <Spinner className="size-4" /> : null}
              {t("wordpress.reTranslate.menu.saveChanges", "Save")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeCard({ active, onClick, title, detail, art }: { active: boolean; onClick: () => void; title: string; detail: string; art: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn("flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors", active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card hover:bg-muted/40")}
    >
      <span className="flex h-12 items-center justify-center rounded-xl bg-muted/60">{art}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ ours

function WhereCard({ switcher, update }: { switcher: ReTranslateSwitcher; update: (p: Partial<ReTranslateSwitcher>) => void }) {
  const { t } = useTranslation();
  const positionLabels: Record<ReTranslateSwitcherPosition, string> = {
    "bottom-right": t("wordpress.reTranslate.menu.position.bottom-right", "Bottom right"),
    "bottom-left": t("wordpress.reTranslate.menu.position.bottom-left", "Bottom left"),
    "top-right": t("wordpress.reTranslate.menu.position.top-right", "Top right"),
    "top-left": t("wordpress.reTranslate.menu.position.top-left", "Top left"),
    manual: t("wordpress.reTranslate.menu.position.manual", "Only where I place it"),
  };
  return (
    <SectionCard>
      <CardHeader icon={<MapPin className="size-3.5" />} title={t("wordpress.reTranslate.menu.whereTitle", "Language menu placement")} />
      <CardBody>
        <Field>
          <Label htmlFor="re-translate-position">{t("wordpress.reTranslate.menu.corner", "Corner")}</Label>
          <NativeSelect id="re-translate-position" className="h-10 w-full" value={switcher.position} onChange={(e) => update({ position: e.target.value as ReTranslateSwitcherPosition })}>
            {POSITIONS.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {positionLabels[p]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldHint>
            {switcher.position === "manual" ? (
              <>
                {t("wordpress.reTranslate.menu.manualHint", "Put this where the menu should appear — in a header block, a widget or a page:")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">[re_translate_switcher]</code>
              </>
            ) : (
              t("wordpress.reTranslate.menu.cornerHint", "The cookie button, chat bubbles and back-to-top buttons usually sit bottom right, so the menu starts bottom left. Move it if something is already there.")
            )}
          </FieldHint>
        </Field>
        <div role="radiogroup" aria-label={t("wordpress.reTranslate.menu.layoutLabel", "Layout")} className="grid gap-3 sm:grid-cols-2">
          {(["dropdown", "inline"] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              role="radio"
              aria-checked={switcher.layout === layout}
              onClick={() => update({ layout })}
              className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors", switcher.layout === layout ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40")}
            >
              <LayoutArt layout={layout} />
              <span className="text-sm font-medium">{layout === "dropdown" ? t("wordpress.reTranslate.menu.layout.dropdown", "Dropdown") : t("wordpress.reTranslate.menu.layout.inline", "Side by side")}</span>
            </button>
          ))}
        </div>
      </CardBody>
    </SectionCard>
  );
}

function LookCard({ switcher, update, sample }: { switcher: ReTranslateSwitcher; update: (p: Partial<ReTranslateSwitcher>) => void; sample?: MenuLanguage }) {
  const { t } = useTranslation();
  const showLabel = (mode: ReTranslateSwitcherShow) => {
    const name = sample?.name ?? "Deutsch";
    const code = sample?.code ?? "DE";
    const flag = <FlagImage country={sample?.flag} />;
    if (mode === "flag") return flag;
    if (mode === "name") return name;
    if (mode === "code") return code;
    return (
      <span className="inline-flex items-center gap-1.5">
        {flag}
        {mode === "flag_code" ? code : name}
      </span>
    );
  };
  const showNames: Record<ReTranslateSwitcherShow, string> = {
    flag_name: t("wordpress.reTranslate.menu.show.flag_name", "Flag and name"),
    flag: t("wordpress.reTranslate.menu.show.flag", "Flag only"),
    name: t("wordpress.reTranslate.menu.show.name", "Name only"),
    flag_code: t("wordpress.reTranslate.menu.show.flag_code", "Flag and code"),
    code: t("wordpress.reTranslate.menu.show.code", "Code only"),
  };
  const bottom = switcher.position.startsWith("bottom");
  const right = switcher.position.endsWith("right");

  return (
    <SectionCard>
      <CardHeader icon={<Palette className="size-3.5" />} title={t("wordpress.reTranslate.menu.lookTitle", "How it looks")} subtitle={t("wordpress.reTranslate.menu.lookSubtitle", "Anything you leave alone is taken from your website")} />
      <CardBody className="space-y-6">
        <Field>
          <Label>{t("wordpress.reTranslate.menu.shownAs", "Each language shown as")}</Label>
          <div className="flex flex-wrap gap-2">
            {SHOW.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={switcher.show === mode}
                aria-label={showNames[mode]}
                title={showNames[mode]}
                onClick={() => update({ show: mode })}
                className={cn("inline-flex h-10 items-center rounded-lg border px-3 text-xs font-medium transition-colors", switcher.show === mode ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40" : "hover:bg-muted/60")}
              >
                {showLabel(mode)}
              </button>
            ))}
          </div>
        </Field>

        {(["all", "current"] as const).map((group) => (
          <Field key={group}>
            <Label>{group === "all" ? t("wordpress.reTranslate.menu.colorsAll", "Every language") : t("wordpress.reTranslate.menu.colorsCurrent", "The current one")}</Label>
            <div className="flex flex-wrap gap-3">
              {COLORS.filter((c) => c.group === group).map((c) => (
                <ColorWell
                  key={c.key}
                  id={`re-translate-color-${c.key}`}
                  label={t(`wordpress.reTranslate.menu.color.${c.key}`, c.label)}
                  value={switcher.colors[c.key]}
                  fallback={c.fallback}
                  onChange={(v) => update({ colors: { [c.key]: v } as ReTranslateSwitcher["colors"] })}
                />
              ))}
            </div>
          </Field>
        ))}

        <Field>
          <Label>{t("wordpress.reTranslate.menu.radius", "Corner radius")}</Label>
          <LengthSlider name="radius" label={t("wordpress.reTranslate.menu.radiusLabel", "Radius")} switcher={switcher} update={update} />
        </Field>
        <Field>
          <Label>{t("wordpress.reTranslate.menu.padding", "Padding")}</Label>
          <LengthSlider name="pad_y" label={t("wordpress.reTranslate.menu.padY", "Top and bottom")} switcher={switcher} update={update} />
          <LengthSlider name="pad_x" label={t("wordpress.reTranslate.menu.padX", "Left and right")} switcher={switcher} update={update} />
        </Field>
        {switcher.position === "manual" ? null : (
          <Field>
            <Label>{t("wordpress.reTranslate.menu.offset", "Distance from the corner")}</Label>
            <LengthSlider name="offset_y" label={bottom ? t("wordpress.reTranslate.menu.offsetUp", "Up from the bottom") : t("wordpress.reTranslate.menu.offsetDown", "Down from the top")} switcher={switcher} update={update} />
            <LengthSlider name="offset_x" label={right ? t("wordpress.reTranslate.menu.offsetRight", "In from the right") : t("wordpress.reTranslate.menu.offsetLeft", "In from the left")} switcher={switcher} update={update} />
          </Field>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("wordpress.reTranslate.menu.hideCurrent", "Hide the current language")}</p>
            <p className="text-xs text-muted-foreground">{t("wordpress.reTranslate.menu.hideCurrentHint", "Show only the languages a visitor can switch to.")}</p>
          </div>
          <Switch checked={switcher.hide_current} onCheckedChange={(v) => update({ hide_current: v })} aria-label={t("wordpress.reTranslate.menu.hideCurrent", "Hide the current language")} />
        </div>
      </CardBody>
    </SectionCard>
  );
}

function LayoutArt({ layout }: { layout: "dropdown" | "inline" }) {
  return layout === "dropdown" ? (
    <span aria-hidden className="flex w-10 shrink-0 flex-col gap-1">
      <span className="h-2.5 rounded-sm bg-foreground/70" />
      <span className="h-1.5 rounded-sm bg-muted-foreground/30" />
      <span className="h-1.5 rounded-sm bg-muted-foreground/30" />
    </span>
  ) : (
    <span aria-hidden className="flex w-10 shrink-0 gap-1">
      <span className="h-2.5 flex-1 rounded-sm bg-foreground/70" />
      <span className="h-2.5 flex-1 rounded-sm bg-muted-foreground/30" />
      <span className="h-2.5 flex-1 rounded-sm bg-muted-foreground/30" />
    </span>
  );
}

function LengthSlider({ name, label, switcher, update }: { name: ReTranslateLengthKey; label: string; switcher: ReTranslateSwitcher; update: (p: Partial<ReTranslateSwitcher>) => void }) {
  const { t } = useTranslation();
  const spec = LENGTHS[name];
  const stored = switcher[name];
  const set = stored !== "";
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-muted-foreground sm:w-36">{label}</span>
      <Slider className="min-w-20 flex-1" aria-label={label} min={0} max={spec.max} step={1} value={[set ? Number(stored) : spec.rest]} onValueChange={([v]) => update({ [name]: String(v ?? 0) })} />
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{set ? `${stored}px` : t("wordpress.reTranslate.menu.default", "Default")}</span>
      <Button type="button" variant="ghost" size="sm" className={cn("shrink-0 text-xs", !set && "invisible")} onClick={() => update({ [name]: "" })}>
        {t("wordpress.reTranslate.menu.reset", "Reset")}
      </Button>
    </div>
  );
}

function ColorWell({ id, label, value, fallback, onChange }: { id: string; label: string; value: string; fallback: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <label htmlFor={id} className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border" style={value ? { background: value } : undefined}>
        {value ? null : <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--color-muted)_0_4px,transparent_4px_8px)]" />}
        <input id={id} type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className={cn("block text-[11px] text-muted-foreground", value && "font-mono")}>{value || t("wordpress.reTranslate.menu.inherited", "From your website")}</span>
      </span>
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label={`${t("wordpress.reTranslate.menu.clear", "Clear")} ${label}`} className="shrink-0 rounded-md px-1.5 text-sm leading-none text-muted-foreground hover:text-foreground">
          ×
        </button>
      ) : null}
    </div>
  );
}

/** A flag per language. A language is not a country, so the default is only a guess from its region. */
function FlagsCard({ target, overview }: { target: ReTranslateTarget; overview: ReTranslateOverview }) {
  const translation = useTranslation();
  const { t } = translation;
  // shtemaran's stand-in has no i18n object: it is English-only.
  const lang = (translation as { i18n?: { language?: string } }).i18n?.language || "en";
  const { saveOptions } = useReTranslateActions(target);
  const settings = overview.settings;
  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([lang], { type: "region" });
    } catch {
      names = null;
    }
    return overview.flags.map((cc) => ({ cc, name: names?.of(cc) ?? cc })).sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [overview.flags, lang]);

  const rows = [
    { key: "source", name: settings.source.native || settings.source.name || settings.source.bcp47, note: t("wordpress.reTranslate.menu.original", "Original"), flag: settings.source.flag },
    ...settings.languages.filter((l) => l.enabled).map((l) => ({ key: l.locale, name: l.native || l.name, note: "", flag: l.flag })),
  ];

  return (
    <SectionCard>
      <CardHeader icon={<Flag className="size-3.5" />} title={t("wordpress.reTranslate.menu.flagsTitle", "Flags")} subtitle={t("wordpress.reTranslate.menu.flagsHint", "A language is not a country — English can be the UK or the US. Pick the flag your visitors expect.")} />
      <CardBody className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center gap-3">
            <span className="flex w-8 justify-center text-lg">
              <FlagImage country={row.flag} className="h-4 w-6" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">
              {row.name}
              {row.note ? <span className="ml-2 text-xs font-normal text-muted-foreground">{row.note}</span> : null}
            </span>
            <NativeSelect
              aria-label={t("wordpress.reTranslate.menu.flagFor", "Flag for {{language}}", { language: row.name })}
              className="h-10 w-full sm:w-56"
              value={row.flag ?? "none"}
              onChange={(e) =>
                saveOptions.mutate({ flags: { [row.key]: e.target.value } }, { onSuccess: () => flash(t("wordpress.reTranslate.saved", "Saved.")), onError: (err) => flash(errorText(t, err), "error") })
              }
            >
              <NativeSelectOption value="none">{t("wordpress.reTranslate.menu.noFlag", "No flag")}</NativeSelectOption>
              {countries.map((c) => (
                <NativeSelectOption key={c.cc} value={c.cc}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
      </CardBody>
    </SectionCard>
  );
}

// ------------------------------------------------------------------ the website's own

/**
 * Find the website's own language menu and connect it. Nothing changes on the
 * website until the customer has seen which entry goes where and confirmed it.
 */
function SiteMenuCard({ target, overview, onUseOurs }: { target: ReTranslateTarget; overview: ReTranslateOverview; onUseOurs: () => void }) {
  const { t } = useTranslation();
  const { saveOptions, detectMenu } = useReTranslateActions(target);
  const settings = overview.settings;
  const saved = settings.switcher.site;
  const [found, setFound] = useState<ReTranslateMenuDetection | null>(null);
  const [menu, setMenu] = useState<ReTranslateSiteMenu | null>(null);
  // Shown only while the website's own menu is chosen; whether that choice is saved yet, the Save bar says.
  const connected = !!saved && !found;

  const search = () =>
    detectMenu.mutate(undefined, {
      onSuccess: (res) => {
        setFound(res);
        setMenu(res.found ? res.menu : null);
      },
      onError: (err) => flash(errorText(t, err), "error"),
    });

  const use = (next: ReTranslateSiteMenu, message: string) =>
    saveOptions.mutate(
      { switcher: { mode: "site", site: next } },
      {
        onSuccess: () => {
          setFound(null);
          setMenu(null);
          flash(message);
        },
        onError: (err) => flash(errorText(t, err), "error"),
      },
    );

  const where = (w: string) =>
    w === "header" ? t("wordpress.reTranslate.menu.inHeader", "in your header") : w === "footer" ? t("wordpress.reTranslate.menu.inFooter", "in your footer") : w === "nav" ? t("wordpress.reTranslate.menu.inNav", "in your navigation") : t("wordpress.reTranslate.menu.onPage", "on your homepage");

  const nameOf = (locale: string) => (locale === "" ? settings.source.native || settings.source.name || settings.source.bcp47 : (settings.languages.find((l) => l.locale === locale)?.native ?? locale));

  const searching = detectMenu.isPending;

  return (
    <SectionCard>
      <CardHeader
        icon={<ScanSearch className="size-3.5" />}
        title={connected ? t("wordpress.reTranslate.menu.connectedTitle", "Your website's menu does the switching") : t("wordpress.reTranslate.menu.findTitle", "Find your website's language menu")}
        subtitle={
          connected && saved
            ? t("wordpress.reTranslate.menu.connectedHint", "Found {{where}}. Each entry leads to the same page in its language.", { where: where(saved.found_at) })
            : t("wordpress.reTranslate.menu.findHint", "We read your homepage, find the menu visitors use to change language, and show you which entry goes where before anything changes.")
        }
        action={
          connected || found ? (
            <Button type="button" variant="outline" size="sm" onClick={search} disabled={searching}>
              {searching ? <Spinner className="size-3.5" /> : null}
              {t("wordpress.reTranslate.menu.searchAgain", "Search again")}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {searching ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner className="size-4" />
            {t("wordpress.reTranslate.menu.searching", "Looking at your homepage…")}
          </p>
        ) : connected && saved ? (
          <MappingTable
            menu={saved}
            overview={overview}
            onChange={(next) => use({ ...next, by: "person" }, t("wordpress.reTranslate.saved", "Saved."))}
          />
        ) : found && !found.found ? (
          <div className="space-y-3">
            <p className="text-sm">{t("wordpress.reTranslate.menu.notFound", "We didn't find a language menu on your homepage.")}</p>
            {found.plugins.length ? <PluginsNote plugins={found.plugins} /> : null}
            <FieldHint>{t("wordpress.reTranslate.menu.notFoundHint", "If your website shows one, it may be drawn by a script after the page loads. Use our menu, or add a menu with your languages to your header and search again.")}</FieldHint>
            <Button type="button" onClick={onUseOurs}>
              {t("wordpress.reTranslate.menu.useOurs", "Use our language menu")}
            </Button>
          </div>
        ) : found && found.found && menu ? (
          <div className="space-y-4">
            <p className="text-sm">
              {t("wordpress.reTranslate.menu.foundIntro", "We found your language menu {{where}}. Check where each entry leads:", { where: where(menu.found_at) })}
            </p>
            <MappingTable menu={menu} overview={overview} onChange={setMenu} />
            {found.missing.length ? (
              <InfoNote>
                {t("wordpress.reTranslate.menu.missing", "Your menu has no entry for {{languages}}. Visitors can't switch to it from there — add it to the menu on your website, then search again.", {
                  languages: found.missing.map(nameOf).join(", "),
                })}
              </InfoNote>
            ) : null}
            {found.plugins.length ? <PluginsNote plugins={found.plugins} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => use(menu, t("wordpress.reTranslate.menu.connected", "Your website's menu now switches languages."))} disabled={saveOptions.isPending}>
                {t("wordpress.reTranslate.menu.useThis", "Use this menu")}
              </Button>
              <Button type="button" variant="ghost" onClick={onUseOurs}>
                {t("wordpress.reTranslate.menu.useOurs", "Use our language menu")}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" onClick={search}>
            <ScanSearch className="size-4" />
            {t("wordpress.reTranslate.menu.find", "Find my language menu")}
          </Button>
        )}
      </CardBody>
    </SectionCard>
  );
}

function PluginsNote({ plugins }: { plugins: string[] }) {
  const { t } = useTranslation();
  return <InfoNote>{t("wordpress.reTranslate.menu.otherPlugin", "Your website also has {{plugins}}. It translates with its own service and would compete with this one — switch it off.", { plugins: plugins.join(", ") })}</InfoNote>;
}

/** Each entry of the website's menu and the language it leads to. */
function MappingTable({ menu, overview, onChange }: { menu: ReTranslateSiteMenu; overview: ReTranslateOverview; onChange: (menu: ReTranslateSiteMenu) => void }) {
  const { t } = useTranslation();
  const settings = overview.settings;
  const set = (i: number, locale: string) => onChange({ ...menu, items: menu.items.map((it, j) => (j === i ? { ...it, locale } : it)) });

  return (
    <ul className="divide-y rounded-xl border">
      {menu.items.map((item, i) => (
        <li key={i} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-0.5 text-sm font-medium">{item.text || "—"}</span>
            {item.href && item.role === "link" ? <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">{item.href}</span> : null}
          </span>
          {item.role === "current" ? (
            <span className="text-xs text-muted-foreground">{t("wordpress.reTranslate.menu.showsCurrent", "Shows the language being read")}</span>
          ) : (
            <NativeSelect aria-label={t("wordpress.reTranslate.menu.leadsTo", "{{entry}} leads to", { entry: item.text })} className="h-10 w-full sm:w-56" value={item.locale} onChange={(e) => set(i, e.target.value)}>
              <NativeSelectOption value="">{t("wordpress.reTranslate.menu.toOriginal", "Original ({{language}})", { language: shortName(settings.source.native || settings.source.name || settings.source.bcp47) })}</NativeSelectOption>
              {settings.languages
                .filter((l) => l.enabled)
                .map((l) => (
                  <NativeSelectOption key={l.locale} value={l.locale}>
                    {l.native || l.name}
                  </NativeSelectOption>
                ))}
              <NativeSelectOption value="keep">{t("wordpress.reTranslate.menu.keep", "Leave as it is")}</NativeSelectOption>
            </NativeSelect>
          )}
        </li>
      ))}
    </ul>
  );
}
