import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { ColorField, Segmented, SliderField } from "~/components/wordpress/re-cookie/fields";
import { FieldHint } from "~/components/wordpress/fields";
import { cn } from "~/lib/utils";
import type { ReBannerVariant } from "~/lib/wordpress/plugin-settings-types";
import {
  countOverrides,
  REBNR_ALIGNS,
  REBNR_DECORATIONS,
  REBNR_ELEMENT_PROPS,
  REBNR_FONT_STACKS,
  REBNR_FONT_WEIGHTS,
  REBNR_STYLE_ELEMENTS,
  REBNR_STYLE_RANGES,
  REBNR_TEXT_TRANSFORMS,
  type ReBannerElementStyle,
  type ReBannerFontKey,
  type ReBannerSide,
  type ReBannerStyleElement,
  type ReBannerStyleProp,
  type ReBannerStyles,
} from "~/lib/wordpress/re-banner-styles";
import { SideInput } from "~/components/wordpress/re-banner/side-input";

/* ── Draft helpers ───────────────────────────────────────────────────────
 *
 * The draft's `styles` is kept pruned at all times — an element with no
 * properties is removed, not left as `{}` — so "does this banner have
 * overrides?" is `Object.keys(styles).length > 0` everywhere, and `{}` really
 * does post as "inherit everything".
 * ------------------------------------------------------------------------ */

export function setStyle<P extends ReBannerStyleProp>(
  styles: ReBannerStyles,
  element: ReBannerStyleElement,
  prop: P,
  value: ReBannerElementStyle[P] | undefined,
): ReBannerStyles {
  const current: ReBannerElementStyle = { ...(styles[element] ?? {}) };
  if (value === undefined) delete current[prop];
  else current[prop] = value;

  const next: ReBannerStyles = { ...styles };
  if (Object.keys(current).length === 0) delete next[element];
  else next[element] = current;
  return next;
}

export function resetElement(
  styles: ReBannerStyles,
  element: ReBannerStyleElement,
): ReBannerStyles {
  const next = { ...styles };
  delete next[element];
  return next;
}

/* ── What to show ────────────────────────────────────────────────────── */

const ELEMENT_I18N: Record<ReBannerStyleElement, [string, string]> = {
  container: ["wordpress.reBanner.elements.container", "Container"],
  body: ["wordpress.reBanner.elements.body", "Text area"],
  p: ["wordpress.reBanner.elements.p", "Paragraph"],
  h1: ["wordpress.reBanner.elements.h1", "Heading 1"],
  h2: ["wordpress.reBanner.elements.h2", "Heading 2"],
  h3: ["wordpress.reBanner.elements.h3", "Heading 3"],
  h4: ["wordpress.reBanner.elements.h4", "Heading 4"],
  h5: ["wordpress.reBanner.elements.h5", "Heading 5"],
  h6: ["wordpress.reBanner.elements.h6", "Heading 6"],
  li: ["wordpress.reBanner.elements.li", "List item"],
  a: ["wordpress.reBanner.elements.a", "Link"],
  cta: ["wordpress.reBanner.elements.cta", "Button"],
  image: ["wordpress.reBanner.elements.image", "Image"],
};

/** A text banner is one element: its container IS its text area. */
function elementsFor(variant: ReBannerVariant): ReBannerStyleElement[] {
  if (variant === "text") {
    return REBNR_STYLE_ELEMENTS.filter(
      (e) => e !== "body" && e !== "cta" && e !== "image",
    );
  }
  return [...REBNR_STYLE_ELEMENTS];
}

/**
 * Which elements the banner actually has, so the picker shows those and
 * nothing else. A box always has its container and text area; a text banner
 * has no box at all — its blocks *are* the banner — so it starts from what
 * the words contain: type a Heading 2 in the editor and "Heading 2" is the
 * element, not a wrapper around it.
 */
export function elementsInUse(
  bodyHtml: string,
  variant: ReBannerVariant,
  hasCta: boolean,
  hasImage: boolean,
): Set<ReBannerStyleElement> {
  const used = new Set<ReBannerStyleElement>();
  if (variant !== "text") {
    used.add("container");
    used.add("body");
  }
  for (const tag of ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "a"] as const) {
    if (new RegExp(`<${tag}\\b`, "i").test(bodyHtml)) used.add(tag);
  }
  if (hasCta) used.add("cta");
  if (hasImage) used.add("image");
  return used;
}

const PROP_I18N: Record<ReBannerStyleProp, [string, string]> = {
  font_family: ["wordpress.reBanner.props.fontFamily", "Font"],
  font_size: ["wordpress.reBanner.props.fontSize", "Size"],
  font_weight: ["wordpress.reBanner.props.fontWeight", "Weight"],
  line_height: ["wordpress.reBanner.props.lineHeight", "Line height"],
  letter_spacing: ["wordpress.reBanner.props.letterSpacing", "Letter spacing"],
  text_transform: ["wordpress.reBanner.props.textTransform", "Case"],
  text_align: ["wordpress.reBanner.props.textAlign", "Text alignment"],
  text_decoration: ["wordpress.reBanner.props.textDecoration", "Underline"],
  color: ["wordpress.reBanner.props.color", "Colour"],
  width: ["wordpress.reBanner.props.width", "Width"],
  height: ["wordpress.reBanner.props.height", "Height"],
  max_width: ["wordpress.reBanner.props.maxWidth", "Max width"],
  border_radius: ["wordpress.reBanner.props.borderRadius", "Corner radius"],
  margin: ["wordpress.reBanner.props.margin", "Margin"],
  padding: ["wordpress.reBanner.props.padding", "Padding"],
  align: ["wordpress.reBanner.props.align", "Placement"],
};

/** Where a slider lands the moment it is switched on. */
const OVERRIDE_START: Record<
  "font_size" | "line_height" | "letter_spacing" | "width" | "height" | "max_width" | "border_radius",
  number
> = {
  font_size: 16,
  line_height: 1.5,
  letter_spacing: 0,
  width: 200,
  height: 120,
  max_width: 720,
  border_radius: 8,
};

const FONT_I18N: Record<ReBannerFontKey, [string, string]> = {
  system: ["wordpress.reBanner.fonts.system", "System"],
  sans: ["wordpress.reBanner.fonts.sans", "Sans-serif"],
  serif: ["wordpress.reBanner.fonts.serif", "Serif"],
  mono: ["wordpress.reBanner.fonts.mono", "Monospace"],
};

const TRANSFORM_I18N: Record<(typeof REBNR_TEXT_TRANSFORMS)[number], [string, string]> = {
  none: ["wordpress.reBanner.transforms.none", "As typed"],
  uppercase: ["wordpress.reBanner.transforms.uppercase", "UPPER"],
  lowercase: ["wordpress.reBanner.transforms.lowercase", "lower"],
  capitalize: ["wordpress.reBanner.transforms.capitalize", "Title"],
};

type Group = "typography" | "box" | "spacing";
const GROUP_OF: Record<ReBannerStyleProp, Group> = {
  font_family: "typography",
  font_size: "typography",
  font_weight: "typography",
  line_height: "typography",
  letter_spacing: "typography",
  text_transform: "typography",
  text_align: "typography",
  text_decoration: "typography",
  color: "typography",
  width: "box",
  height: "box",
  max_width: "box",
  border_radius: "box",
  align: "box",
  margin: "spacing",
  padding: "spacing",
};
const GROUP_I18N: Record<Group, [string, string]> = {
  typography: ["wordpress.reBanner.groups.typography", "Typography"],
  box: ["wordpress.reBanner.groups.box", "Size & placement"],
  spacing: ["wordpress.reBanner.groups.spacing", "Spacing"],
};

/* ── Component ───────────────────────────────────────────────────────── */

/**
 * Per-element typography and spacing overrides.
 *
 * Every control starts *off*. That is the feature, not a default: a banner
 * with nothing switched on inherits its theme completely and ships no CSS.
 * Switching a control on writes one property; switching it off deletes it.
 * There is no "reset to default" value because the default is absence.
 *
 * The element list is what the content actually contains — plus anything
 * that already carries an override, so a stored setting is never invisible —
 * and nothing else: a banner whose words are one Heading 2 offers "Heading
 * 2", not thirteen HTML tags. Selecting an element outlines it in the
 * preview.
 */
export function BannerStyleInspector({
  styles,
  variant,
  bodyHtml,
  hasCta,
  hasImage,
  onChange,
  onSelectElement,
}: {
  styles: ReBannerStyles;
  variant: ReBannerVariant;
  bodyHtml: string;
  hasCta: boolean;
  hasImage: boolean;
  onChange: (next: ReBannerStyles) => void;
  /** The element the controls are about, for the preview to outline. */
  onSelectElement?: (element: ReBannerStyleElement | null) => void;
}) {
  const { t } = useTranslation();
  const elements = useMemo(() => elementsFor(variant), [variant]);
  const inUse = useMemo(
    () => elementsInUse(bodyHtml, variant, hasCta, hasImage),
    [bodyHtml, variant, hasCta, hasImage],
  );

  const visible = useMemo(
    () => elements.filter((el) => inUse.has(el) || Object.keys(styles[el] ?? {}).length > 0),
    [elements, inUse, styles],
  );

  const [selected, setSelected] = useState<ReBannerStyleElement | null>(() =>
    firstSensible(visible, inUse),
  );

  // Editing the words, or switching to `text`, can take the selected element
  // away — a deleted heading, the button a text banner does not have.
  const element =
    selected !== null && visible.includes(selected) ? selected : firstSensible(visible, inUse);

  useEffect(() => {
    onSelectElement?.(element);
  }, [element, onSelectElement]);

  const current = element ? (styles[element] ?? {}) : {};
  const props = element ? REBNR_ELEMENT_PROPS[element] : [];
  const total = countOverrides(styles);

  const set = <P extends ReBannerStyleProp>(prop: P, value: ReBannerElementStyle[P] | undefined) => {
    if (element) onChange(setStyle(styles, element, prop, value));
  };

  const groups = (["typography", "box", "spacing"] as Group[])
    .map((g) => ({ g, props: props.filter((p) => GROUP_OF[p] === g) }))
    .filter((x) => x.props.length > 0);

  if (element === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "wordpress.reBanner.noElementsYet",
          "Write the banner's text first — the elements you use there (a heading, a paragraph, a list) appear here to fine-tune.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Element picker */}
      <div className="space-y-1.5">
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={t("wordpress.reBanner.element", "Element")}
        >
          {visible.map((el) => {
            const count = Object.keys(styles[el] ?? {}).length;
            const active = el === element;
            const used = inUse.has(el);
            // A text banner has no wrapper any more; `container` only shows
            // up there when a banner saved before 1.4.0 still carries
            // overrides on it, and those apply to every block at once.
            const label =
              el === "container" && variant === "text"
                ? t("wordpress.reBanner.elements.allText", "All text")
                : t(ELEMENT_I18N[el][0], ELEMENT_I18N[el][1]);
            return (
              <button
                key={el}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(el)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : used
                      ? "border-border bg-card text-foreground hover:border-foreground/50"
                      : "border-dashed border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
                )}
                title={
                  used
                    ? undefined
                    : t("wordpress.reBanner.notInContent", "Not in the content yet")
                }
              >
                {label}
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] tabular-nums",
                      active ? "bg-background/20" : "bg-primary/10 text-primary",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <FieldHint>
          {inUse.has(element)
            ? t(
                "wordpress.reBanner.elementHint",
                "Outlined in the preview. Anything you leave on Auto keeps the theme's value.",
              )
            : t(
                "wordpress.reBanner.elementNotInUseHint",
                "The content has no {{element}} right now — these settings apply as soon as it does, or reset them to drop this element.",
                {
                  element: t(ELEMENT_I18N[element][0], ELEMENT_I18N[element][1]).toLowerCase(),
                },
              )}
        </FieldHint>
      </div>

      {/* Controls */}
      {groups.map(({ g, props: groupProps }) => (
        <section key={g} className="overflow-hidden rounded-xl border bg-card">
          <h4 className="border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t(GROUP_I18N[g][0], GROUP_I18N[g][1])}
          </h4>
          <div className="divide-y">
            {groupProps.map((prop) => (
              <PropControl
                key={prop}
                id={`rebnr-style-${element}-${prop}`}
                element={element}
                variant={variant}
                prop={prop}
                value={current[prop]}
                onChange={(v) => set(prop, v as never)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? t("wordpress.reBanner.noOverrides", "No overrides — inherits everything.")
            : t("wordpress.reBanner.overrideCount", "{{count}} override(s) on this banner.", { count: total })}
        </p>
        <div className="flex items-center gap-1">
          {Object.keys(current).length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange(resetElement(styles, element))}
            >
              <RotateCcw aria-hidden />
              {t("wordpress.reBanner.resetElement", "Reset this element")}
            </Button>
          ) : null}
          {total > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive hover:text-destructive"
                >
                  {t("wordpress.reBanner.resetAll", "Reset all")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("wordpress.reBanner.resetAll", "Reset all")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "wordpress.reBanner.resetAllConfirm",
                      "Remove every typography and spacing override on this banner? It will inherit its theme again. Nothing is saved until you save the banner.",
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("wordpress.reBanner.cancel", "Cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onChange({})}>
                    {t("wordpress.reBanner.resetAll", "Reset all")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The element to open on: the first one the content has words in, else whatever is offered. */
function firstSensible(
  visible: ReBannerStyleElement[],
  inUse: Set<ReBannerStyleElement>,
): ReBannerStyleElement | null {
  const preferred: ReBannerStyleElement[] = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"];
  for (const el of preferred) {
    if (inUse.has(el) && visible.includes(el)) return el;
  }
  return visible[0] ?? null;
}

/* ── One property ────────────────────────────────────────────────────── */

function PropControl({
  id,
  element,
  variant,
  prop,
  value,
  onChange,
}: {
  id: string;
  element: ReBannerStyleElement;
  variant: ReBannerVariant;
  prop: ReBannerStyleProp;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation();
  const label = t(PROP_I18N[prop][0], PROP_I18N[prop][1]);
  const auto = t("wordpress.reBanner.auto", "Auto");

  switch (prop) {
    case "font_family":
      return (
        <Row id={id} label={label} isSet={value !== undefined} onReset={() => onChange(undefined)}>
          <NativeSelect
            id={id}
            size="sm"
            value={(value as string | undefined) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
            className="max-w-[200px]"
          >
            <NativeSelectOption value="">{auto}</NativeSelectOption>
            {(Object.keys(REBNR_FONT_STACKS) as ReBannerFontKey[]).map((key) => (
              <NativeSelectOption key={key} value={key}>
                {t(FONT_I18N[key][0], FONT_I18N[key][1])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Row>
      );

    case "font_size":
    case "line_height":
    case "letter_spacing":
    case "width":
    case "height":
    case "max_width":
    case "border_radius": {
      const [min, max, decimals] = REBNR_STYLE_RANGES[prop];
      const unit = prop === "line_height" ? "×" : prop === "letter_spacing" ? "em" : "px";
      const set = typeof value === "number";
      return (
        <Row
          id={id}
          label={label}
          isSet={set}
          onReset={() => onChange(undefined)}
          onEnable={() => onChange(OVERRIDE_START[prop])}
          stacked={set}
          hint={
            prop === "max_width" && element !== "container"
              ? t("wordpress.reBanner.maxWidthHint", "Only visible together with a placement other than the default.")
              : undefined
          }
        >
          {set ? (
            <SliderField
              id={id}
              value={value as number}
              onChange={(v) => onChange(v)}
              min={min}
              max={max}
              step={decimals === 0 ? 1 : 0.01}
              unit={unit}
            />
          ) : null}
        </Row>
      );
    }

    case "font_weight":
      return (
        <Row id={id} label={label} isSet={value !== undefined} onReset={() => onChange(undefined)} stacked>
          <Segmented
            ariaLabel={label}
            value={value === undefined ? "auto" : String(value)}
            onChange={(v) => onChange(v === "auto" ? undefined : Number(v))}
            options={[
              { value: "auto", label: auto },
              ...REBNR_FONT_WEIGHTS.map((w) => ({ value: String(w), label: String(w) })),
            ]}
            className="flex-wrap"
          />
        </Row>
      );

    case "text_transform":
      return (
        <Row id={id} label={label} isSet={value !== undefined} onReset={() => onChange(undefined)} stacked>
          <Segmented
            ariaLabel={label}
            value={(value as string | undefined) ?? "auto"}
            onChange={(v) => onChange(v === "auto" ? undefined : v)}
            options={[
              { value: "auto", label: auto },
              ...REBNR_TEXT_TRANSFORMS.map((k) => ({ value: k, label: t(TRANSFORM_I18N[k][0], TRANSFORM_I18N[k][1]) })),
            ]}
          />
        </Row>
      );

    case "text_align":
    case "align": {
      const icons = { left: AlignLeft, center: AlignCenter, right: AlignRight };
      const hint =
        prop === "align"
          ? element === "cta"
            ? t("wordpress.reBanner.alignCtaHint", "Where the button sits in its row or column.")
            : element === "container" && variant === "floating"
              ? t("wordpress.reBanner.alignFloatingHint", "Which corner the banner pins to.")
              : t("wordpress.reBanner.alignBlockHint", "Needs a max width narrower than its container to show.")
          : element === "container" || element === "body"
            ? t("wordpress.reBanner.textAlignBannerHint", "For the whole banner, use Alignment under Layout — it moves the image and button too.")
            : undefined;
      return (
        <Row id={id} label={label} isSet={value !== undefined} onReset={() => onChange(undefined)} hint={hint}>
          <Segmented
            ariaLabel={label}
            value={(value as string | undefined) ?? "auto"}
            onChange={(v) => onChange(v === "auto" ? undefined : v)}
            options={[
              { value: "auto", label: auto },
              ...REBNR_ALIGNS.map((k) => {
                const Icon = icons[k];
                return { value: k, label: "", icon: <Icon className="size-4" aria-label={k} /> };
              }),
            ]}
          />
        </Row>
      );
    }

    case "text_decoration":
      return (
        <Row id={id} label={label} isSet={value !== undefined} onReset={() => onChange(undefined)}>
          <Segmented
            ariaLabel={label}
            value={(value as string | undefined) ?? "auto"}
            onChange={(v) => onChange(v === "auto" ? undefined : v)}
            options={[
              { value: "auto", label: auto },
              ...REBNR_DECORATIONS.map((k) => ({
                value: k,
                label: k === "none" ? t("wordpress.reBanner.decorations.none", "None") : t("wordpress.reBanner.decorations.underline", "Underlined"),
              })),
            ]}
          />
        </Row>
      );

    case "color":
      return (
        <Row
          id={id}
          label={label}
          isSet={value !== undefined}
          onReset={() => onChange(undefined)}
          onEnable={() => onChange("#000000")}
          stacked={value !== undefined}
        >
          {value !== undefined ? (
            <ColorField
              id={id}
              label={label}
              value={value as string}
              placeholder="#000000"
              onChange={(v) => onChange(v)}
            />
          ) : null}
        </Row>
      );

    case "margin":
    case "padding":
      return (
        <div className="px-3 py-2.5">
          <SideInput
            id={id}
            label={label}
            value={value as ReBannerSide | undefined}
            onChange={(next) => onChange(next)}
          />
        </div>
      );
  }
}

/**
 * One property row: label on the left, its control on the right.
 *
 * An unset property that needs a starting value (a size, a colour) shows an
 * "Auto" chip with a plus — click it and the control appears in its place
 * with the starting value already applied. Pickers carry their own Auto
 * segment and simply sit in the row. A set property gets a small × to go
 * back to Auto. `stacked` puts a wide control on its own line under the
 * label instead of beside it.
 */
function Row({
  id,
  label,
  isSet,
  onReset,
  onEnable,
  hint,
  stacked = false,
  children,
}: {
  id: string;
  label: string;
  isSet: boolean;
  onReset: () => void;
  onEnable?: () => void;
  hint?: string;
  stacked?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const auto = t("wordpress.reBanner.auto", "Auto");

  const labelNode = (
    <Label
      htmlFor={id}
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-xs font-medium",
        isSet ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {isSet ? (
        <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
      ) : null}
      {label}
    </Label>
  );

  const resetNode = isSet ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onReset}
      aria-label={t("wordpress.reBanner.resetProp", "Back to Auto")}
      title={t("wordpress.reBanner.resetProp", "Back to Auto")}
      className="text-muted-foreground"
    >
      <X aria-hidden />
    </Button>
  ) : null;

  // Unset with a starting value: the chip IS the control.
  if (!isSet && onEnable) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        {labelNode}
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onEnable}
          className="text-muted-foreground"
        >
          {auto}
          <Plus aria-hidden />
        </Button>
      </div>
    );
  }

  if (stacked) {
    return (
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {labelNode}
          {resetNode}
        </div>
        {children}
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        {labelNode}
        <div className="flex items-center gap-1">
          {children}
          {resetNode}
        </div>
      </div>
      {hint ? <FieldHint className="mt-1.5">{hint}</FieldHint> : null}
    </div>
  );
}
