import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Star, Upload, X } from "lucide-react";
import {
  createCatalogPrice,
  createCatalogProduct,
  setCatalogDefaultPrice,
  updateCatalogPrice,
  updateCatalogProduct,
  uploadProductImage,
  type CatalogPrice,
  type CatalogProduct,
  type CreatePriceBody,
  type ProductKind,
} from "~/lib/api/stripe-catalog";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useCatalogProduct, useTaxCodes } from "~/lib/hooks/useStripeCatalog";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

/** Sentinel for "the create form", which has no product id to key on. */
const NEW_PRODUCT = "__new__";

const KINDS: ProductKind[] = ["service", "digital", "physical"];
const INTERVALS = ["day", "week", "month", "year"] as const;

interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode. */
  productId: string | null;
  /** Pre-fills the price currency on create. */
  defaultCurrency: string;
}

/** Form state, kept as strings so partially-typed input is never coerced. */
interface FormState {
  name: string;
  description: string;
  kind: ProductKind;
  category: string;
  active: boolean;
  images: string;
  unit_label: string;
  statement_descriptor: string;
  tax_code: string;
  url: string;
  inventory_count: string;
  height: string;
  length: string;
  weight: string;
  width: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  kind: "service",
  category: "",
  active: true,
  images: "",
  unit_label: "",
  statement_descriptor: "",
  tax_code: "",
  url: "",
  inventory_count: "",
  height: "",
  length: "",
  weight: "",
  width: "",
};

function toForm(product: CatalogProduct): FormState {
  return {
    name: product.name,
    description: product.description ?? "",
    kind: product.kind,
    category: product.category ?? "",
    active: product.active,
    images: product.images.join("\n"),
    unit_label: product.unit_label ?? "",
    statement_descriptor: product.statement_descriptor ?? "",
    tax_code: product.tax_code ?? "",
    url: product.url ?? "",
    inventory_count:
      product.inventory_count === null ? "" : String(product.inventory_count),
    height: product.package_dimensions?.height?.toString() ?? "",
    length: product.package_dimensions?.length?.toString() ?? "",
    weight: product.package_dimensions?.weight?.toString() ?? "",
    width: product.package_dimensions?.width?.toString() ?? "",
  };
}

/** All four or nothing — Stripe rejects a partial package_dimensions object. */
function dimensionsOf(form: FormState) {
  const nums = [form.height, form.length, form.weight, form.width].map((v) =>
    v.trim() === "" ? NaN : Number(v),
  );
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return { height: nums[0], length: nums[1], weight: nums[2], width: nums[3] };
}

export function ProductSheet({
  open,
  onOpenChange,
  productId,
  defaultCurrency,
}: ProductSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!productId;

  const { data: product, isPending: loadingProduct } =
    useCatalogProduct(open ? productId : null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [priceOpen, setPriceOpen] = useState(false);
  // Tax codes are ~600 rows; only fetch once the user opens the picker.
  const [taxCodesWanted, setTaxCodesWanted] = useState(false);
  const { data: taxCodes } = useTaxCodes(taxCodesWanted);

  /**
   * Which product the form currently holds, so it is filled exactly once per
   * open. Adding a price refetches the product, and re-running the fill on
   * every new object identity would throw away whatever the user had typed
   * into name or description in the meantime.
   */
  const filledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      filledFor.current = null;
      return;
    }
    const target = productId ?? NEW_PRODUCT;
    if (filledFor.current === target) return;

    if (!productId) {
      setForm(EMPTY);
      setPriceOpen(false);
      filledFor.current = target;
      return;
    }
    // Wait for the right product; the query may still be returning the last one.
    if (product?.id === productId) {
      setForm(toForm(product));
      setPriceOpen(false);
      filledFor.current = target;
    }
  }, [open, productId, product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Images are held as newline-joined text so the rest of the form stays a flat
  // string record; the picker works in arrays.
  const imageUrls = form.images.split("\n").map((s) => s.trim()).filter(Boolean);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stripe-products"] }),
      queryClient.invalidateQueries({ queryKey: ["stripe-product", productId] }),
    ]);
  };

  const body = useMemo(() => {
    const dims = dimensionsOf(form);
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      category: form.category.trim() || null,
      active: form.active,
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      unit_label: form.unit_label.trim() || null,
      statement_descriptor: form.statement_descriptor.trim() || null,
      tax_code: form.tax_code || null,
      url: form.url.trim() || null,
      inventory_count:
        form.kind === "physical" && form.inventory_count.trim() !== ""
          ? Number(form.inventory_count)
          : null,
      package_dimensions: form.kind === "physical" ? dims : null,
    };
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: async (initialPrice?: CreatePriceBody) => {
      if (isEdit) return updateCatalogProduct(productId!, body);
      return createCatalogProduct({
        ...body,
        ...(initialPrice ? { price: initialPrice } : {}),
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(
        isEdit
          ? t("stripeProducts.saved", { defaultValue: "Product saved" })
          : t("stripeProducts.created", { defaultValue: "Product created" }),
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const [newPrice, setNewPrice] = useState<{
    amount: string;
    currency: string;
    recurring: boolean;
    interval: (typeof INTERVALS)[number];
    nickname: string;
    set_as_default: boolean;
  }>({
    amount: "",
    currency: defaultCurrency,
    recurring: false,
    interval: "month",
    nickname: "",
    set_as_default: true,
  });

  useEffect(() => {
    setNewPrice((p) => ({ ...p, currency: defaultCurrency }));
  }, [defaultCurrency]);

  function buildPriceBody(): CreatePriceBody | null {
    const major = Number(newPrice.amount.replace(",", "."));
    if (!Number.isFinite(major) || major < 0) return null;
    return {
      // Stripe wants minor units; rounding here rather than trusting float math
      // on a value the user typed as "19.99".
      unit_amount: Math.round(major * 100),
      currency: newPrice.currency.toLowerCase(),
      ...(newPrice.recurring ? { interval: newPrice.interval } : {}),
      ...(newPrice.nickname.trim() ? { nickname: newPrice.nickname.trim() } : {}),
      set_as_default: newPrice.set_as_default,
    };
  }

  const addPriceMutation = useMutation({
    mutationFn: (priceBody: CreatePriceBody) =>
      createCatalogPrice(productId!, priceBody),
    onSuccess: async () => {
      await invalidate();
      setPriceOpen(false);
      setNewPrice((p) => ({ ...p, amount: "", nickname: "" }));
      toast.success(
        t("stripeProducts.priceAdded", { defaultValue: "Price added" }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const archivePriceMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateCatalogPrice(id, { active }),
    onSuccess: invalidate,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const defaultPriceMutation = useMutation({
    mutationFn: (priceId: string) =>
      setCatalogDefaultPrice(productId!, priceId),
    onSuccess: invalidate,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(
        t("stripeProducts.nameRequired", { defaultValue: "Name is required" }),
      );
      return;
    }
    if (isEdit) {
      saveMutation.mutate(undefined);
      return;
    }
    // On create the price is optional, but a half-filled one is a mistake.
    const priceBody = newPrice.amount.trim() ? buildPriceBody() : undefined;
    if (newPrice.amount.trim() && !priceBody) {
      toast.error(
        t("stripeProducts.invalidAmount", {
          defaultValue: "Enter a valid amount",
        }),
      );
      return;
    }
    saveMutation.mutate(priceBody ?? undefined);
  }

  const prices = product?.prices ?? [];
  const busy = saveMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t("stripeProducts.editTitle", { defaultValue: "Edit product" })
              : t("stripeProducts.newTitle", { defaultValue: "New product" })}
          </SheetTitle>
          <SheetDescription>
            {t("stripeProducts.sheetDescription", {
              defaultValue:
                "Saved straight to your Stripe account. Nothing is stored here.",
            })}
          </SheetDescription>
        </SheetHeader>

        {isEdit && loadingProduct ? (
          <div className="space-y-3 px-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 px-4 pb-4">
            {/* ---------------- General ---------------- */}
            <Fieldset
              label={t("stripeProducts.general", { defaultValue: "General" })}
            >
              <Field label={t("stripeProducts.name", { defaultValue: "Name" })}>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Premium plan"
                />
              </Field>

              <Field
                label={t("stripeProducts.description", {
                  defaultValue: "Description",
                })}
              >
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("stripeProducts.kind", { defaultValue: "Type" })}
                >
                  <Select
                    value={form.kind}
                    onValueChange={(v) => set("kind", v as ProductKind)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`stripeProducts.kinds.${k}`, {
                            defaultValue:
                              k === "physical"
                                ? "Physical good"
                                : k === "digital"
                                  ? "Digital good"
                                  : "Service",
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label={t("stripeProducts.category", {
                    defaultValue: "Category",
                  })}
                  hint={t("stripeProducts.categoryHint", {
                    defaultValue: "Your own label, for grouping.",
                  })}
                >
                  <Input
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label={t("stripeProducts.images", {
                  defaultValue: "Images",
                })}
                hint={t("stripeProducts.imagesHint", {
                  defaultValue:
                    "Up to 8. Uploaded to your Stripe account, which hosts them.",
                })}
              >
                <ImagePicker
                  urls={imageUrls}
                  onChange={(next) => set("images", next.join("\n"))}
                />
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("stripeProducts.active", { defaultValue: "Active" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("stripeProducts.activeHint", {
                      defaultValue:
                        "Inactive products stay on past invoices but cannot be sold.",
                    })}
                  </p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => set("active", v)}
                />
              </div>
            </Fieldset>

            {/* ---------------- Pricing ---------------- */}
            <Fieldset
              label={t("stripeProducts.pricing", { defaultValue: "Pricing" })}
            >
              {!isEdit ? (
                <NewPriceFields
                  value={newPrice}
                  onChange={setNewPrice}
                  showDefaultToggle={false}
                />
              ) : (
                <>
                  {prices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("stripeProducts.noPrices", {
                        defaultValue: "No prices yet.",
                      })}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {prices.map((price) => (
                        <PriceRow
                          key={price.id}
                          price={price}
                          busy={
                            archivePriceMutation.isPending ||
                            defaultPriceMutation.isPending
                          }
                          onMakeDefault={() =>
                            defaultPriceMutation.mutate(price.id)
                          }
                          onToggleActive={() =>
                            archivePriceMutation.mutate({
                              id: price.id,
                              active: !price.active,
                            })
                          }
                        />
                      ))}
                    </ul>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("stripeProducts.priceImmutable", {
                      defaultValue:
                        "Stripe prices cannot be edited. To change an amount, add a new price and archive the old one.",
                    })}
                  </p>

                  {priceOpen ? (
                    <div className="space-y-3 rounded-xl border border-border p-4">
                      <NewPriceFields
                        value={newPrice}
                        onChange={setNewPrice}
                        showDefaultToggle
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={addPriceMutation.isPending}
                          onClick={() => {
                            const priceBody = buildPriceBody();
                            if (!priceBody) {
                              toast.error(
                                t("stripeProducts.invalidAmount", {
                                  defaultValue: "Enter a valid amount",
                                }),
                              );
                              return;
                            }
                            addPriceMutation.mutate(priceBody);
                          }}
                        >
                          {t("stripeProducts.addPrice", {
                            defaultValue: "Add price",
                          })}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPriceOpen(false)}
                        >
                          {t("common.cancel", { defaultValue: "Cancel" })}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPriceOpen(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      {t("stripeProducts.addPrice", {
                        defaultValue: "Add price",
                      })}
                    </Button>
                  )}
                </>
              )}
            </Fieldset>

            {/* ---------------- Shipping (physical only) ---------------- */}
            {form.kind === "physical" ? (
              <Fieldset
                label={t("stripeProducts.shipping", {
                  defaultValue: "Shipping & stock",
                })}
              >
                <Field
                  label={t("stripeProducts.inventory", {
                    defaultValue: "Stock on hand",
                  })}
                  hint={t("stripeProducts.inventoryHint", {
                    defaultValue:
                      "Stripe has no inventory system — this is a note stored on the product and nothing decrements it.",
                  })}
                >
                  <Input
                    type="number"
                    min={0}
                    value={form.inventory_count}
                    onChange={(e) => set("inventory_count", e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["length", "Length (in)"],
                      ["width", "Width (in)"],
                      ["height", "Height (in)"],
                      ["weight", "Weight (oz)"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field
                      key={key}
                      label={t(`stripeProducts.dim.${key}`, {
                        defaultValue: label,
                      })}
                    >
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("stripeProducts.dimHint", {
                    defaultValue:
                      "Stripe needs all four dimensions or none of them.",
                  })}
                </p>
              </Fieldset>
            ) : null}

            {/* ---------------- Advanced ---------------- */}
            <Fieldset
              label={t("stripeProducts.advanced", { defaultValue: "Advanced" })}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("stripeProducts.unitLabel", {
                    defaultValue: "Unit label",
                  })}
                >
                  <Input
                    value={form.unit_label}
                    onChange={(e) => set("unit_label", e.target.value)}
                    placeholder="per seat"
                  />
                </Field>
                <Field
                  label={t("stripeProducts.statementDescriptor", {
                    defaultValue: "Statement descriptor",
                  })}
                  hint={t("stripeProducts.statementHint", {
                    defaultValue: "Max 22 characters.",
                  })}
                >
                  <Input
                    maxLength={22}
                    value={form.statement_descriptor}
                    onChange={(e) =>
                      set("statement_descriptor", e.target.value)
                    }
                  />
                </Field>
              </div>

              <Field
                label={t("stripeProducts.taxCode", {
                  defaultValue: "Tax category",
                })}
              >
                <Select
                  value={form.tax_code || "none"}
                  onValueChange={(v) => set("tax_code", v === "none" ? "" : v)}
                  onOpenChange={(o) => o && setTaxCodesWanted(true)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("stripeProducts.taxCodeNone", {
                        defaultValue: "None",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">
                      {t("stripeProducts.taxCodeNone", {
                        defaultValue: "None",
                      })}
                    </SelectItem>
                    {(taxCodes ?? []).map((code) => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label={t("stripeProducts.url", { defaultValue: "Product URL" })}
              >
                <Input
                  value={form.url}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </Fieldset>

            <SheetFooter className="px-0">
              <Button type="submit" disabled={busy}>
                {busy
                  ? t("common.loading", { defaultValue: "Loading…" })
                  : isEdit
                    ? t("common.save", { defaultValue: "Save" })
                    : t("stripeProducts.create", {
                        defaultValue: "Create product",
                      })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Choose-a-file image picker.
 *
 * Stripe's `product.images` is an array of URLs, not files, so each pick is
 * uploaded to the connected account's Stripe file store first and the returned
 * public link is what goes in the array. That is why this cannot just be an
 * `<input type="file">` bound to the form — the upload has to happen before
 * save, not with it.
 *
 * Existing products may hold URLs typed elsewhere; those render and delete the
 * same way, and the URL row below still allows adding one by hand.
 */
function ImagePicker({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const room = MAX_IMAGES - urls.length;
    if (room <= 0) {
      toast.error(
        t("stripeProducts.tooManyImages", {
          defaultValue: "Stripe allows at most 8 images per product.",
          count: MAX_IMAGES,
        }),
      );
      return;
    }

    const picked = Array.from(fileList).slice(0, room);
    const tooBig = picked.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      toast.error(
        t("stripeProducts.imageTooLarge", {
          defaultValue: "{{name}} is larger than 5 MB.",
          name: tooBig.name,
        }),
      );
      return;
    }

    setUploading(true);
    try {
      // Sequential, not parallel: a handful of images is not worth hammering
      // Stripe's file endpoint, and a partial failure stays easy to reason about.
      const added: string[] = [];
      for (const file of picked) {
        const { url } = await uploadProductImage(file);
        added.push(url);
      }
      onChange([...urls, ...added]);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setUploading(false);
      // Clear the input so re-picking the same file fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addUrl() {
    const value = urlDraft.trim();
    if (!value) return;
    if (urls.length >= MAX_IMAGES) {
      toast.error(
        t("stripeProducts.tooManyImages", {
          defaultValue: "Stripe allows at most 8 images per product.",
          count: MAX_IMAGES,
        }),
      );
      return;
    }
    onChange([...urls, value]);
    setUrlDraft("");
  }

  return (
    <div className="space-y-3">
      {urls.length ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-background"
            >
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                aria-label={t("stripeProducts.removeImage", {
                  defaultValue: "Remove image",
                })}
              >
                <X className="h-3 w-3" />
              </button>
              {index === 0 ? (
                <span className="absolute bottom-0 left-0 right-0 bg-background/80 py-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("stripeProducts.mainImage", { defaultValue: "Main" })}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || urls.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {uploading
            ? t("stripeProducts.uploading", { defaultValue: "Uploading…" })
            : t("stripeProducts.chooseFile", { defaultValue: "Choose file" })}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("stripeProducts.imageCount", {
            defaultValue: "{{used}} of {{max}}",
            used: urls.length,
            max: MAX_IMAGES,
          })}
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder={t("stripeProducts.orPasteUrl", {
            defaultValue: "…or paste an image URL",
          })}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0"
          disabled={!urlDraft.trim()}
          onClick={addUrl}
        >
          {t("common.add", { defaultValue: "Add" })}
        </Button>
      </div>
    </div>
  );
}

function Fieldset({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PriceRow({
  price,
  busy,
  onMakeDefault,
  onToggleActive,
}: {
  price: CatalogPrice;
  busy: boolean;
  onMakeDefault: () => void;
  onToggleActive: () => void;
}) {
  const { t } = useTranslation();

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {formatMoneyFromMinor(price.unit_amount, price.currency)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {price.interval
              ? t(`stripeProducts.interval.${price.interval}`, {
                  defaultValue: `per ${price.interval}`,
                })
              : t("stripeProducts.oneTime", { defaultValue: "one-time" })}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            price.nickname,
            price.is_default
              ? t("stripeProducts.defaultPrice", { defaultValue: "Default" })
              : null,
            !price.active
              ? t("stripeProducts.archived", { defaultValue: "Archived" })
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || price.id}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!price.is_default && price.active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onMakeDefault}
            title={t("stripeProducts.makeDefault", {
              defaultValue: "Make default",
            })}
          >
            <Star className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onToggleActive}
          title={
            price.active
              ? t("stripeProducts.archive", { defaultValue: "Archive" })
              : t("stripeProducts.restore", { defaultValue: "Restore" })
          }
        >
          {price.active ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </li>
  );
}

function NewPriceFields({
  value,
  onChange,
  showDefaultToggle,
}: {
  value: {
    amount: string;
    currency: string;
    recurring: boolean;
    interval: (typeof INTERVALS)[number];
    nickname: string;
    set_as_default: boolean;
  };
  onChange: React.Dispatch<React.SetStateAction<typeof value>>;
  showDefaultToggle: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof typeof value>(key: K, v: (typeof value)[K]) =>
    onChange((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field
          label={t("stripeProducts.amount", { defaultValue: "Amount" })}
        >
          <Input
            inputMode="decimal"
            value={value.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="19.99"
          />
        </Field>
        <Field
          label={t("stripeProducts.currency", { defaultValue: "Currency" })}
        >
          <Input
            value={value.currency.toUpperCase()}
            onChange={(e) => set("currency", e.target.value.toLowerCase())}
            maxLength={3}
          />
        </Field>
        <Field
          label={t("stripeProducts.billing", { defaultValue: "Billing" })}
        >
          <Select
            value={value.recurring ? value.interval : "one_time"}
            onValueChange={(v) =>
              v === "one_time"
                ? set("recurring", false)
                : onChange((p) => ({
                    ...p,
                    recurring: true,
                    interval: v as (typeof INTERVALS)[number],
                  }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">
                {t("stripeProducts.oneTime", { defaultValue: "one-time" })}
              </SelectItem>
              {INTERVALS.map((i) => (
                <SelectItem key={i} value={i}>
                  {t(`stripeProducts.interval.${i}`, {
                    defaultValue: `per ${i}`,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label={t("stripeProducts.priceNickname", {
          defaultValue: "Price label (optional)",
        })}
      >
        <Input
          value={value.nickname}
          onChange={(e) => set("nickname", e.target.value)}
        />
      </Field>

      {showDefaultToggle ? (
        <div className="flex items-center gap-3">
          <Switch
            checked={value.set_as_default}
            onCheckedChange={(v) => set("set_as_default", v)}
          />
          <span className="text-sm text-muted-foreground">
            {t("stripeProducts.setAsDefault", {
              defaultValue: "Make this the default price",
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
