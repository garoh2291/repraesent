import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Search, Sparkles, UserPlus, X } from "lucide-react";
import type { DealCustomerSuggestion } from "~/lib/api/deals";
import type { StripeCustomerSummary } from "~/lib/api/stripe-catalog";
import { useStripeCustomerSearch } from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface LinkCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: DealCustomerSuggestion | null;
  /** Currently linked customer id, shown as already linked in results. */
  currentCustomerId: string | null;
  busy: boolean;
  onLink: (stripeCustomerId: string) => Promise<void>;
  onCreate: (input: {
    name: string;
    email: string;
    contact_id?: string;
  }) => Promise<void>;
}

/**
 * Find a customer on the connected Stripe account, or make one.
 *
 * Search is live against Stripe (name or email substring, exact email) with
 * the deal's own contact offered first when it already has a customer. The
 * create tab is prefilled from that contact so the common case is one click.
 */
export function LinkCustomerDialog({
  open,
  onOpenChange,
  suggestion,
  currentCustomerId,
  busy,
  onLink,
  onCreate,
}: LinkCustomerDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"search" | "create">("search");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 300);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("search");
    setSearch("");
    setName(suggestion?.name ?? "");
    setEmail(suggestion?.email ?? "");
    setLinkingId(null);
  }, [open, suggestion?.name, suggestion?.email]);

  const results = useStripeCustomerSearch(debounced, open && tab === "search");
  const customers = results.data ?? [];
  const showSuggestion = !!suggestion?.stripe_customer_id && !debounced;

  const link = async (id: string) => {
    setLinkingId(id);
    try {
      await onLink(id);
      onOpenChange(false);
    } catch {
      // toasted by the caller
    } finally {
      setLinkingId(null);
    }
  };

  const create = async () => {
    if (!name.trim() || !email.trim()) return;
    try {
      await onCreate({
        name: name.trim(),
        email: email.trim(),
        ...(suggestion?.contact_id ? { contact_id: suggestion.contact_id } : {}),
      });
      onOpenChange(false);
    } catch {
      // toasted by the caller
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("pipeline.customer.dialog.title", {
              defaultValue: "Stripe customer for this deal",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("pipeline.customer.dialog.description", {
              defaultValue:
                "Invoices and subscriptions from this deal go to this customer on your connected Stripe account.",
            })}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1 gap-1.5">
              <Search className="h-3.5 w-3.5" />
              {t("pipeline.customer.dialog.tabSearch", {
                defaultValue: "Search Stripe",
              })}
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-1 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              {t("pipeline.customer.dialog.tabCreate", {
                defaultValue: "Create from contact",
              })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("pipeline.customer.dialog.searchPlaceholder", {
                  defaultValue: "Name or email…",
                })}
                className="pl-9 pr-9"
              />
              {search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={t("common.clearSearch", { defaultValue: "Clear" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border">
              {showSuggestion && suggestion ? (
                <div className="border-b border-border bg-primary/5 px-4 py-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <Sparkles className="h-3 w-3" />
                    {t("pipeline.customer.dialog.suggested", {
                      defaultValue: "From this deal's contact",
                    })}
                  </p>
                  <CustomerRow
                    customer={{
                      id: suggestion.stripe_customer_id!,
                      name: suggestion.name,
                      email: suggestion.email,
                      phone: null,
                      currency: null,
                      livemode: true,
                      created: 0,
                    }}
                    linked={currentCustomerId === suggestion.stripe_customer_id}
                    linking={linkingId === suggestion.stripe_customer_id}
                    busy={busy}
                    onLink={() => void link(suggestion.stripe_customer_id!)}
                  />
                </div>
              ) : null}

              {results.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  {t("common.loading", { defaultValue: "Loading…" })}
                </div>
              ) : customers.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {debounced
                    ? t("pipeline.customer.dialog.noResults", {
                        defaultValue: "No customers match that search.",
                      })
                    : t("pipeline.customer.dialog.noCustomers", {
                        defaultValue: "No customers on this Stripe account yet.",
                      })}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {!debounced ? (
                    <li className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("pipeline.customer.dialog.recent", {
                        defaultValue: "Recent customers",
                      })}
                    </li>
                  ) : null}
                  {customers.map((c) => (
                    <li key={c.id} className="px-4 py-3">
                      <CustomerRow
                        customer={c}
                        linked={currentCustomerId === c.id}
                        linking={linkingId === c.id}
                        busy={busy}
                        onLink={() => void link(c.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 pt-3">
            <p className="text-xs text-muted-foreground">
              {t("pipeline.customer.dialog.createHint", {
                defaultValue:
                  "Creates a customer on your Stripe account and links it to this deal. Your contact remembers it for next time.",
              })}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="stripe-customer-name">
                {t("pipeline.customer.dialog.name", { defaultValue: "Name" })}
              </Label>
              <Input
                id="stripe-customer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stripe-customer-email">
                {t("pipeline.customer.dialog.email", { defaultValue: "Email" })}
              </Label>
              <Input
                id="stripe-customer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                disabled={busy || !name.trim() || !email.trim()}
                onClick={() => void create()}
              >
                <UserPlus className="h-4 w-4" />
                {t("pipeline.customer.dialog.createAction", {
                  defaultValue: "Create & link",
                })}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CustomerRow({
  customer,
  linked,
  linking,
  busy,
  onLink,
}: {
  customer: StripeCustomerSummary;
  linked: boolean;
  linking: boolean;
  busy: boolean;
  onLink: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {customer.name ||
            customer.email ||
            t("pipeline.customer.unnamed", { defaultValue: "Unnamed customer" })}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          {customer.name && customer.email ? <span>{customer.email}</span> : null}
          <span className="font-mono">{customer.id}</span>
          {customer.currency ? (
            <span className="rounded-sm bg-muted px-1 py-px text-[10px] uppercase">
              {customer.currency}
            </span>
          ) : null}
        </p>
      </div>
      {linked ? (
        <span className="shrink-0 text-[11px] font-medium text-primary">
          {t("pipeline.customer.linked", { defaultValue: "Linked" })}
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1.5 text-xs"
          disabled={busy}
          onClick={onLink}
        >
          {linking ? (
            <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          {t("pipeline.customer.dialog.linkAction", { defaultValue: "Link" })}
        </Button>
      )}
    </div>
  );
}
