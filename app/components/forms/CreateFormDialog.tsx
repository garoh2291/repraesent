/**
 * "New form": pick what kind of form, then name it.
 *
 * Three cards, one decision. The card is the whole affordance — an
 * illustration drawn in code (so it takes the theme's colours), a name, one
 * line on when to pick it. Product is only offered when the workspace has
 * Stripe connected; otherwise the card stays visible but disabled and says how
 * to enable it, because a missing option looks like a missing feature.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import {
  FORM_LOCALES,
  type FormKind,
  type FormLocale,
} from "~/lib/forms/schema";
import { cn } from "~/lib/utils";

export type FormType = "single" | "multi" | "product";

export function formTypeToPayload(type: FormType): {
  kind: FormKind;
  layout_mode: "single" | "multi_step";
} {
  return {
    kind: type === "product" ? "product" : "standard",
    layout_mode: type === "multi" ? "multi_step" : "single",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLocale: FormLocale;
  pending: boolean;
  onCreate: (input: {
    name: string;
    type: FormType;
    default_locale: FormLocale;
  }) => void;
}

export function CreateFormDialog({
  open,
  onOpenChange,
  defaultLocale,
  pending,
  onCreate,
}: Props) {
  const { t } = useTranslation();
  const { isConnected: stripeConnected, isLoading: stripeLoading } =
    useStripeConnection(open);

  const [type, setType] = useState<FormType>("single");
  const [name, setName] = useState("");
  const [locale, setLocale] = useState<FormLocale>(defaultLocale);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // Autofocus only where a keyboard is already on the desk: on a phone it
  // pops the on-screen keyboard and scrolls the type cards out of view.
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    const id = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  // Fresh every time it opens; a half-typed name from last time is noise.
  useEffect(() => {
    if (!open) return;
    setType("single");
    setName("");
    setLocale(defaultLocale);
  }, [open, defaultLocale]);

  const canCreate = name.trim().length > 0 && !pending;
  const submit = () => {
    if (!canCreate) return;
    onCreate({ name: name.trim(), type, default_locale: locale });
  };

  const types: Array<{
    value: FormType;
    disabled?: boolean;
  }> = [
    { value: "single" },
    { value: "multi" },
    { value: "product", disabled: !stripeConnected },
  ];

  /** Roving focus across the cards: arrows move, Space/Enter pick. */
  const onCardKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = types.filter((x) => !x.disabled);
    const pos = enabled.findIndex((x) => x.value === types[index].value);
    let nextPos = pos;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextPos = pos + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextPos = pos - 1;
    else if (e.key === "Home") nextPos = 0;
    else if (e.key === "End") nextPos = enabled.length - 1;
    else return;
    e.preventDefault();
    const next = enabled[(nextPos + enabled.length) % enabled.length];
    if (!next) return;
    setType(next.value);
    (
      e.currentTarget.parentElement?.querySelector<HTMLElement>(
        `[data-type="${next.value}"]`,
      ) ?? null
    )?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped to the viewport and scrolling inside: on a small phone the
          three cards plus name and language are taller than the screen, and a
          centred dialog with no cap simply ran off the bottom. */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("forms.list.newForm")}</DialogTitle>
          <DialogDescription>{t("forms.create.typeLabel")}</DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-5 overflow-y-auto px-6">
          <div
            role="radiogroup"
            aria-label={t("forms.create.typeLabel")}
            className="grid gap-3 sm:grid-cols-3"
          >
            {types.map(({ value, disabled }, index) => {
              const checked = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  data-type={value}
                  aria-checked={checked}
                  aria-disabled={disabled || undefined}
                  tabIndex={checked ? 0 : -1}
                  onKeyDown={(e) => onCardKeyDown(e, index)}
                  onClick={() => {
                    if (disabled) return;
                    setType(value);
                    nameRef.current?.focus();
                  }}
                  className={cn(
                    "group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-[transform,border-color,background-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    disabled
                      ? "cursor-not-allowed border-border/60 bg-muted/20 opacity-70"
                      : checked
                        ? "border-primary/50 bg-primary/5 active:scale-[0.99]"
                        : "border-border bg-card hover:border-foreground/25 active:scale-[0.99]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-3 top-3 h-4 w-4 rounded-full border-2 transition-colors",
                      checked
                        ? "border-primary bg-primary"
                        : "border-border bg-background group-hover:border-foreground/30",
                    )}
                  >
                    {checked ? (
                      <span className="absolute inset-[3px] rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>

                  <TypeIllustration
                    type={value}
                    active={checked && !disabled}
                  />

                  <span className="space-y-1">
                    <span className="block text-sm font-semibold">
                      {t(`forms.create.type.${value}.title`)}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {t(`forms.create.type.${value}.body`)}
                    </span>
                  </span>

                  {value === "product" && disabled && !stripeLoading ? (
                    // A real link inside a disabled card: the card cannot be
                    // picked, but the way out is one click.
                    <span className="mt-auto text-xs text-muted-foreground">
                      {t("forms.create.type.product.disabled")}{" "}
                      <Link
                        to="/settings/integrations"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChange(false);
                        }}
                        tabIndex={0}
                      >
                        {t("forms.create.type.product.connect")} →
                      </Link>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-form-name">
                {t("forms.list.nameLabel")}
              </label>
              <Input
                id="new-form-name"
                ref={nameRef}
                value={name}
                placeholder={t("forms.list.namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-form-locale">
                {t("forms.list.languageLabel")}
              </label>
              <Select
                value={locale}
                onValueChange={(v) => setLocale(v as FormLocale)}
              >
                <SelectTrigger id="new-form-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_LOCALES.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button disabled={!canCreate} onClick={submit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("forms.create.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 96×60 sketches in currentColor. Not icons: each one draws the thing you get.
 * Single page — three field bars and a button. Multi-step — two overlapping
 * pages and a three-segment progress rail. Product — a line with a picture
 * tile, a price tag, and a lock for the payment step.
 */
function TypeIllustration({
  type,
  active,
}: {
  type: FormType;
  active: boolean;
}) {
  const ink = active ? "text-primary" : "text-muted-foreground/60";
  const accent = active ? "text-primary" : "text-foreground/40";
  return (
    <svg
      viewBox="0 0 96 60"
      className={cn("h-[60px] w-24 shrink-0", ink)}
      aria-hidden
      fill="none"
    >
      {type === "single" ? (
        <>
          <rect
            x="8"
            y="6"
            width="80"
            height="48"
            rx="6"
            className="stroke-current"
            strokeWidth="1.5"
          />
          <rect
            x="16"
            y="14"
            width="64"
            height="7"
            rx="2"
            className="fill-current opacity-30"
          />
          <rect
            x="16"
            y="25"
            width="64"
            height="7"
            rx="2"
            className="fill-current opacity-30"
          />
          <rect
            x="16"
            y="36"
            width="30"
            height="7"
            rx="2"
            className="fill-current opacity-30"
          />
          <rect
            x="52"
            y="36"
            width="28"
            height="9"
            rx="3"
            className={cn("fill-current", accent)}
          />
        </>
      ) : null}
      {type === "multi" ? (
        <>
          <rect
            x="18"
            y="4"
            width="70"
            height="42"
            rx="6"
            className="stroke-current opacity-40"
            strokeWidth="1.5"
          />
          <rect
            x="8"
            y="12"
            width="70"
            height="42"
            rx="6"
            className="fill-background stroke-current"
            strokeWidth="1.5"
          />
          <rect
            x="16"
            y="24"
            width="54"
            height="7"
            rx="2"
            className="fill-current opacity-30"
          />
          <rect
            x="16"
            y="35"
            width="38"
            height="7"
            rx="2"
            className="fill-current opacity-30"
          />
          <rect
            x="16"
            y="17"
            width="16"
            height="3"
            rx="1.5"
            className={cn("fill-current", accent)}
          />
          <rect
            x="35"
            y="17"
            width="16"
            height="3"
            rx="1.5"
            className={cn("fill-current", accent)}
          />
          <rect
            x="54"
            y="17"
            width="16"
            height="3"
            rx="1.5"
            className="fill-current opacity-25"
          />
        </>
      ) : null}
      {type === "product" ? (
        <>
          <rect
            x="8"
            y="6"
            width="80"
            height="48"
            rx="6"
            className="stroke-current"
            strokeWidth="1.5"
          />
          <rect
            x="16"
            y="14"
            width="18"
            height="18"
            rx="3"
            className={cn("fill-current opacity-25")}
          />
          <rect
            x="40"
            y="16"
            width="30"
            height="5"
            rx="2"
            className="fill-current opacity-40"
          />
          <rect
            x="40"
            y="25"
            width="20"
            height="5"
            rx="2"
            className={cn("fill-current", accent)}
          />
          <rect
            x="16"
            y="40"
            width="64"
            height="8"
            rx="3"
            className={cn("fill-current", accent)}
          />
          <path
            d="M77 12.5h5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2zm1-1.5a1.5 1.5 0 0 1 3 0v1.5h-3V11z"
            className="fill-current"
          />
        </>
      ) : null}
    </svg>
  );
}
