import {
  Package,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmptyPanelState,
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { formatIntervalShort } from "~/components/organism/deal-products-section";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldHint, ToggleField } from "~/components/wordpress/fields";
import { useStripeCatalog } from "~/lib/hooks/useStripeCatalog";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import { isSnapshotStale, snapshotFrom } from "~/lib/forms/commerce";
import {
  COMMERCE_QUANTITY_MAX,
  DEFAULT_FORM_COMMERCE,
  contentKey,
  type FormCommerce,
  type FormCommerceItem,
} from "~/lib/forms/schema";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Link } from "react-router";
import { CountryPresetPicker } from "./CountryPresetPicker";
import { ProductPickerDialog } from "./ProductPickerDialog";

interface Props {
  commerce: FormCommerce | undefined;
  onChange: (patch: Partial<FormCommerce>) => void;
  /** Price ids the server says are archived/inactive in Stripe. */
  archivedPriceIds: ReadonlySet<string>;
  disabled?: boolean;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
  onDelete?: () => void;
}

/**
 * The product field's inspector: what is sold (bundle), how Stripe asks
 * (checkout), and what the buyer sees after (pages). Everything about the
 * product lives on the product, the way everything about an appointment field
 * lives on that field.
 */
export function ProductFieldInspector({
  commerce: stored,
  onChange,
  archivedPriceIds,
  disabled,
  getText,
  setText,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { isConnected } = useStripeConnection();
  const commerce = stored ?? DEFAULT_FORM_COMMERCE;
  const [pickerOpen, setPickerOpen] = useState(false);
  const catalog = useStripeCatalog({ includeArchived: true }, isConnected);
  const products = catalog.data?.data;

  const patch = (next: Partial<FormCommerce>) => onChange(next);
  const patchItem = (
    priceId: string,
    fn: (item: FormCommerceItem) => FormCommerceItem,
  ) =>
    patch({
      items: commerce.items.map((i) => (i.priceId === priceId ? fn(i) : i)),
    });

  const currency = commerce.items[0]?.snapshot.currency ?? null;
  const recurring = commerce.items.find(
    (i) => i.snapshot.type === "recurring",
  )?.snapshot;
  const staleCount = commerce.items.filter(
    (i) => isSnapshotStale(i, products) === "changed",
  ).length;

  const refreshSnapshots = () => {
    if (!products) return;
    patch({
      items: commerce.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const price = product?.prices.find((p) => p.id === item.priceId);
        if (!product || !price) return item;
        return { ...item, snapshot: snapshotFrom(product, price).snapshot };
      }),
    });
  };

  return (
    <Panel>
      <PanelHeader
        icon={<ShoppingBag className="h-3.5 w-3.5" />}
        title={t("forms.inspector.product")}
        meta={
          commerce.items.length ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
              {commerce.items.length} · {currency}
            </span>
          ) : null
        }
        action={
          onDelete && !disabled ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("forms.builder.deleteField")}
              title={t("forms.builder.deleteField")}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
      />
      <PanelBody>
        {!isConnected ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-[#241d07] dark:text-amber-200">
            <p className="font-medium">
              {t("forms.products.notConnectedTitle")}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {t("forms.products.notConnectedBody")}
            </p>
            <Link
              to="/settings/integrations"
              className="mt-2 inline-block text-xs font-medium underline-offset-2 hover:underline"
            >
              {t("forms.create.type.product.connect")} →
            </Link>
          </div>
        ) : null}

        <PanelSection
          title={t("forms.products.title")}
          action={
            !disabled && isConnected ? (
              <div className="flex items-center gap-1.5">
                {staleCount > 0 ? (
                  <GhostAction
                    className="h-7 px-2 text-xs"
                    onClick={refreshSnapshots}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("forms.products.refreshAll")}
                  </GhostAction>
                ) : null}
                <GhostAction
                  className="h-7 px-2 text-xs"
                  onClick={() => setPickerOpen(true)}
                >
                  {t("forms.products.add")}
                </GhostAction>
              </div>
            ) : null
          }
        >
          {/* The block's heading is visitor copy (content key commerce.title),
              edited per language like every other label. */}
          <Field>
            <Label htmlFor="co-title">{t("forms.products.titleLabel")}</Label>
            <Input
              id="co-title"
              disabled={disabled}
              value={getText(contentKey.commerce("title"))}
              onChange={(e) =>
                setText(contentKey.commerce("title"), e.target.value)
              }
            />
          </Field>
          <FieldHint>{t("forms.products.selectHint")}</FieldHint>
          {commerce.items.length === 0 ? (
            <EmptyPanelState
              icon={<Package className="h-5 w-5" />}
              title={t("forms.products.empty")}
              hint={t("forms.products.emptyHint")}
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {commerce.items.map((item) => {
                const s = item.snapshot;
                const stale = archivedPriceIds.has(item.priceId)
                  ? "archived"
                  : isSnapshotStale(item, products);
                const interval =
                  s.type === "recurring"
                    ? formatIntervalShort(s.interval, s.intervalCount, t)
                    : null;
                return (
                  <li key={item.priceId} className="space-y-2.5 p-3">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        <img
                          src={s.image}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                          {formatMoneyFromMinor(s.unitAmount, s.currency)}
                          {interval ? (
                            <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <Repeat className="h-2.5 w-2.5" />
                              {interval}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium uppercase tracking-wide">
                              {t("stripeProducts.oneTime", {
                                defaultValue: "one-time",
                              })}
                            </span>
                          )}
                          {stale === "archived" ? (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              <TriangleAlert className="h-2.5 w-2.5" />
                              {t("forms.products.archived")}
                            </span>
                          ) : stale === "changed" ? (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              <TriangleAlert className="h-2.5 w-2.5" />
                              {t("forms.products.stale")}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {!disabled ? (
                        <button
                          type="button"
                          onClick={() =>
                            patch({
                              items: commerce.items.filter(
                                (i) => i.priceId !== item.priceId,
                              ),
                            })
                          }
                          aria-label={t("forms.products.remove")}
                          title={t("forms.products.remove")}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <ToggleField
                      id={`pre-${item.priceId}`}
                      label={t("forms.products.preselected")}
                      checked={item.preselected}
                      disabled={disabled}
                      onChange={(v) =>
                        patchItem(item.priceId, (i) => ({
                          ...i,
                          preselected: v,
                        }))
                      }
                    />

                    {s.type === "recurring" ? (
                      <p className="text-xs text-muted-foreground">
                        {t("forms.products.perCheckout")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("forms.products.qty")}
                          </span>
                          <Segmented>
                            <SegmentedButton
                              active={!item.quantity.adjustable}
                              onClick={() =>
                                patchItem(item.priceId, (i) => ({
                                  ...i,
                                  quantity: {
                                    ...i.quantity,
                                    adjustable: false,
                                  },
                                }))
                              }
                            >
                              {t("forms.products.fixed")}
                            </SegmentedButton>
                            <SegmentedButton
                              active={item.quantity.adjustable}
                              onClick={() =>
                                patchItem(item.priceId, (i) => ({
                                  ...i,
                                  quantity: {
                                    adjustable: true,
                                    min: 1,
                                    max: Math.max(i.quantity.max, 10),
                                    default: i.quantity.default,
                                  },
                                }))
                              }
                            >
                              {t("forms.products.adjustable")}
                            </SegmentedButton>
                          </Segmented>
                        </div>
                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
                            item.quantity.adjustable
                              ? "grid-rows-[1fr]"
                              : "grid-rows-[0fr]",
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {(["min", "default", "max"] as const).map((k) => (
                                <label key={k} className="space-y-1">
                                  <span className="block text-[11px] text-muted-foreground">
                                    {t(`forms.products.${k}`)}
                                  </span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={COMMERCE_QUANTITY_MAX}
                                    value={item.quantity[k]}
                                    disabled={disabled}
                                    className="h-8 tabular-nums"
                                    onChange={(e) => {
                                      const n = Math.floor(
                                        Number(e.target.value),
                                      );
                                      if (!Number.isFinite(n)) return;
                                      patchItem(item.priceId, (i) => {
                                        const q = {
                                          ...i.quantity,
                                          [k]: Math.min(
                                            COMMERCE_QUANTITY_MAX,
                                            Math.max(1, n),
                                          ),
                                        };
                                        if (q.max < q.min) q.max = q.min;
                                        if (q.default < q.min)
                                          q.default = q.min;
                                        if (q.default > q.max)
                                          q.default = q.max;
                                        return { ...i, quantity: q };
                                      });
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        {!item.quantity.adjustable ? (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            {t("forms.products.fixedQty")}
                            <Input
                              type="number"
                              min={1}
                              max={COMMERCE_QUANTITY_MAX}
                              value={item.quantity.default}
                              disabled={disabled}
                              className="h-7 w-16 tabular-nums"
                              onChange={(e) => {
                                const n = Math.floor(Number(e.target.value));
                                if (!Number.isFinite(n)) return;
                                const v = Math.min(
                                  COMMERCE_QUANTITY_MAX,
                                  Math.max(1, n),
                                );
                                patchItem(item.priceId, (i) => ({
                                  ...i,
                                  quantity: {
                                    adjustable: false,
                                    min: v,
                                    max: v,
                                    default: v,
                                  },
                                }));
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>

        <PanelSection title={t("forms.products.checkout")}>
          <Field>
            <Label>{t("forms.products.billing")}</Label>
            <Segmented label={t("forms.products.billing")}>
              <SegmentedButton
                active={commerce.billingAddress === "auto"}
                onClick={() => patch({ billingAddress: "auto" })}
              >
                {t("forms.products.billingAuto")}
              </SegmentedButton>
              <SegmentedButton
                active={commerce.billingAddress === "required"}
                onClick={() => patch({ billingAddress: "required" })}
              >
                {t("forms.products.billingRequired")}
              </SegmentedButton>
            </Segmented>
            <FieldHint>{t("forms.products.billingHint")}</FieldHint>
          </Field>
          <ToggleField
            id="co-shipping"
            label={t("forms.products.shippingEnabled")}
            checked={commerce.shipping.enabled}
            disabled={disabled}
            onChange={(v) =>
              patch({ shipping: { ...commerce.shipping, enabled: v } })
            }
          />
          {commerce.shipping.enabled ? (
            <CountryPresetPicker
              value={commerce.shipping.allowedCountries}
              disabled={disabled}
              onChange={(codes) =>
                patch({
                  shipping: { ...commerce.shipping, allowedCountries: codes },
                })
              }
            />
          ) : null}
          <ToggleField
            id="co-phone"
            label={t("forms.products.phone")}
            checked={commerce.phone}
            disabled={disabled}
            onChange={(v) => patch({ phone: v })}
          />
          <ToggleField
            id="co-promo"
            label={t("forms.products.promo")}
            checked={commerce.promotionCodes}
            disabled={disabled}
            onChange={(v) => patch({ promotionCodes: v })}
          />
          <Field>
            <Label>{t("forms.products.submitType")}</Label>
            <Segmented label={t("forms.products.submitType")}>
              {(["pay", "book", "donate"] as const).map((k) => (
                <SegmentedButton
                  key={k}
                  active={commerce.submitType === k}
                  onClick={() => patch({ submitType: k })}
                >
                  {t(`forms.products.${k}`)}
                </SegmentedButton>
              ))}
            </Segmented>
            <FieldHint>{t("forms.products.submitTypeHint")}</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="co-submit-caption">
              {t("forms.products.caption")}
            </Label>
            <Input
              id="co-submit-caption"
              disabled={disabled}
              value={getText(contentKey.formSubmit())}
              onChange={(e) => setText(contentKey.formSubmit(), e.target.value)}
            />
            <FieldHint>{t("forms.products.captionHint")}</FieldHint>
          </Field>
        </PanelSection>

        <PanelSection title={t("forms.products.after")}>
          <Field>
            <Label htmlFor="co-success">{t("forms.products.successUrl")}</Label>
            <Input
              id="co-success"
              disabled={disabled}
              placeholder="https://"
              value={commerce.successUrl ?? ""}
              aria-invalid={urlInvalid(commerce.successUrl) || undefined}
              onChange={(e) =>
                patch({ successUrl: e.target.value || undefined })
              }
              className="font-mono text-[13px]"
            />
            <FieldHint>
              {urlInvalid(commerce.successUrl)
                ? t("forms.products.invalidUrl")
                : t("forms.products.successUrlHint")}
            </FieldHint>
          </Field>
          <Field>
            <Label htmlFor="co-cancel">{t("forms.products.cancelUrl")}</Label>
            <Input
              id="co-cancel"
              disabled={disabled}
              placeholder="https://"
              value={commerce.cancelUrl ?? ""}
              aria-invalid={urlInvalid(commerce.cancelUrl) || undefined}
              onChange={(e) =>
                patch({ cancelUrl: e.target.value || undefined })
              }
              className="font-mono text-[13px]"
            />
            <FieldHint>
              {urlInvalid(commerce.cancelUrl)
                ? t("forms.products.invalidUrl")
                : t("forms.products.cancelUrlHint")}
            </FieldHint>
          </Field>

          <Field>
            <Label htmlFor="co-secure">{t("forms.products.secureLabel")}</Label>
            <Input
              id="co-secure"
              disabled={disabled}
              value={getText(contentKey.commerce("secure"))}
              onChange={(e) =>
                setText(contentKey.commerce("secure"), e.target.value)
              }
            />
          </Field>

          {/* The hosted outcome pages' copy, per language — what the buyer reads
              instead of an "after submission" message. */}
          {(
            [
              ["paid.title", "pagesPaidTitle", false],
              ["paid.body", "pagesPaidBody", true],
              ["failed.title", "pagesFailedTitle", false],
              ["failed.body", "pagesFailedBody", true],
              ["failed.retry", "pagesRetry", false],
              ["canceled", "pagesCanceled", false],
            ] as const
          ).map(([key, label, multiline]) => {
            const id = `co-copy-${key.replace(".", "-")}`;
            const ck = contentKey.checkout(key);
            return (
              <Field key={key}>
                <Label htmlFor={id}>{t(`forms.products.${label}`)}</Label>
                {multiline ? (
                  <Textarea
                    id={id}
                    rows={2}
                    disabled={disabled}
                    value={getText(ck)}
                    onChange={(e) => setText(ck, e.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    disabled={disabled}
                    value={getText(ck)}
                    onChange={(e) => setText(ck, e.target.value)}
                  />
                )}
              </Field>
            );
          })}
          <FieldHint>{t("forms.products.pagesHint")}</FieldHint>
        </PanelSection>
      </PanelBody>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludedPriceIds={commerce.items.map((i) => i.priceId)}
        currency={currency}
        recurringInterval={
          recurring
            ? {
                interval: recurring.interval ?? "month",
                count: recurring.intervalCount ?? 1,
              }
            : null
        }
        onPick={(product, price) =>
          patch({ items: [...commerce.items, snapshotFrom(product, price)] })
        }
      />
    </Panel>
  );
}

function urlInvalid(value: string | undefined): boolean {
  if (!value || value.trim() === "") return false;
  if (value.length > 2048) return true;
  try {
    const url = new URL(value);
    return url.protocol !== "https:" && url.protocol !== "http:";
  } catch {
    return true;
  }
}
