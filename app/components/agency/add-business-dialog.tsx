import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import type { AuthState } from "~/lib/hooks/use-auth";
import { CLIENT_TYPES } from "~/lib/client-types";
import { DEAL_CURRENCIES } from "~/lib/api/deals";
import {
  businessKeys,
  createBusiness,
  errorCode,
  type CreateBusinessInput,
} from "~/lib/api/agencies";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { TimezonePicker } from "~/components/ui/timezone-picker";
import { CountryPicker } from "~/components/ui/country-picker";
import { countryName } from "~/lib/forms/commerce";
import { BusinessTypePicker, OTHER_TYPE } from "~/components/agency/business-type-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { desktopAutoFocus } from "~/lib/utils/touch";

const STEPS = ["business", "people", "website", "extras", "check"] as const;
type Step = (typeof STEPS)[number];
type Role = "admin" | "editor" | "viewer";

interface Draft {
  name: string;
  industry: string;
  /** Type of business in words, when "Other" is chosen. */
  industryOther: string;
  currency: string;
  phone: string;
  email: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  timezone: string;
  members: Array<{ email: string; role: Role }>;
  websiteMode: "existing" | "new" | "none";
  websiteUrl: string;
  websiteNote: string;
  emailWanted: boolean;
  mailboxes: string;
  domainWanted: boolean;
  domainName: string;
  other: string;
  note: string;
}

const EMPTY: Draft = {
  name: "",
  industry: "",
  industryOther: "",
  currency: "EUR",
  phone: "",
  email: "",
  street: "",
  postal_code: "",
  city: "",
  country: "DE",
  timezone: "Europe/Berlin",
  members: [{ email: "", role: "admin" }],
  websiteMode: "none",
  websiteUrl: "",
  websiteNote: "",
  emailWanted: false,
  mailboxes: "",
  domainWanted: false,
  domainName: "",
  other: "",
  note: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toInput(d: Draft): CreateBusinessInput {
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    name: d.name.trim(),
    industry: opt(d.industry),
    industry_other: d.industry === OTHER_TYPE ? opt(d.industryOther) : undefined,
    currency: d.currency,
    phone: opt(d.phone),
    email: opt(d.email),
    street: opt(d.street),
    postal_code: opt(d.postal_code),
    city: opt(d.city),
    country: opt(d.country),
    timezone: opt(d.timezone),
    members: d.members.filter((m) => m.email.trim()).map((m) => ({ email: m.email.trim().toLowerCase(), role: m.role })),
    website: {
      mode: d.websiteMode,
      url: d.websiteMode === "existing" ? opt(d.websiteUrl) : undefined,
      note: d.websiteMode !== "none" ? opt(d.websiteNote) : undefined,
    },
    services: {
      email: d.emailWanted
        ? { wanted: true, mailboxes: d.mailboxes.split(/[,\n]/).map((m) => m.trim()).filter(Boolean) }
        : undefined,
      domain: d.domainWanted ? { wanted: true, name: opt(d.domainName) } : undefined,
      other: opt(d.other),
    },
    note: opt(d.note),
  };
}

/**
 * "Add a business" (AGENCY_MODE_PLAN.md §3). Opens over the current page;
 * five short steps; nothing is asked twice; the website step says plainly
 * that re:praesent sets the site up and that it shows as "being built" until
 * then.
 */
export function AddBusinessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { currentWorkspace, setCurrentWorkspace } = useAuthContext();
  const [step, setStep] = useState<Step>("business");
  const [d, setD] = useState<Draft>(EMPTY);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Problems show after the first "Next" on a step, not while typing.
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const idx = STEPS.indexOf(step);

  const industries = useMemo(
    () =>
      CLIENT_TYPES.map((k) => {
        const label = t(`clientTypes.${k}`, { count: 1 });
        return { k, label: label.charAt(0).toUpperCase() + label.slice(1) };
      }).sort((a, b) => a.label.localeCompare(b.label)),
    [t],
  );

  const reset = () => {
    setStep("business");
    setTried(false);
    setD(EMPTY);
    setWebsiteError(null);
    setFormError(null);
  };

  const create = useMutation({
    mutationFn: () => createBusiness(toInput(d)),
    onSuccess: (out) => {
      // The new business joins the switcher at once (no full reload).
      qc.setQueryData<AuthState>(["auth"], (prev) => {
        if (!prev || !currentWorkspace) return prev;
        const child = {
          id: out.id,
          name: out.name,
          agency_workspace_id: currentWorkspace.id,
          agency_name: currentWorkspace.name,
          website_state: out.setup.includes("website") ? ("building" as const) : ("none" as const),
          avatar_thumb_url: null,
        };
        const bump = (w: typeof prev.workspaces[number]) =>
          w.id === currentWorkspace.id && w.agency ? { ...w, agency: { ...w.agency, child_count: w.agency.child_count + 1 } } : w;
        return {
          ...prev,
          agencyChildren: [...prev.agencyChildren, child].sort((a, b) => a.name.localeCompare(b.name)),
          workspaces: prev.workspaces.map(bump),
          currentWorkspace: prev.currentWorkspace ? bump(prev.currentWorkspace) : prev.currentWorkspace,
        };
      });
      void qc.invalidateQueries({ queryKey: businessKeys.overview(currentWorkspace?.id) });
      toast.success(t("agency.add.toast.added", { business: out.name }), {
        action: { label: t("agency.add.toast.open"), onClick: () => setCurrentWorkspace(out.id) },
      });
      onOpenChange(false);
      reset();
    },
    onError: (err) => {
      const c = errorCode(err);
      if (c === "WEBSITE_TAKEN") {
        setWebsiteError(t("agency.add.errors.websiteTaken"));
        setStep("website");
      } else if (c === "WEBSITE_INVALID") {
        setWebsiteError(t("agency.add.errors.websiteInvalid"));
        setStep("website");
      } else if (c === "AGENCY_LIMIT") {
        setFormError(t("agency.add.errors.limit"));
      } else if (c === "AGENCY_NOT_ACTIVE") {
        setFormError(t("agency.add.errors.notActive"));
      } else {
        setFormError(t("agency.add.errors.generic"));
      }
    },
  });

  // What blocks "Next" on each step, in plain words (null = fine).
  const problem = (s: Step): string | null => {
    if (s === "business") {
      if (d.name.trim().length < 2) return t("agency.add.errors.name");
      if (d.industry === OTHER_TYPE && d.industryOther.trim().length < 2) return t("agency.add.errors.otherTypeMissing");
      if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) return t("agency.add.errors.email");
    }
    if (s === "people") {
      const bad = d.members.find((m) => m.email.trim() && !EMAIL_RE.test(m.email.trim()));
      if (bad) return t("agency.add.errors.memberEmail", { email: bad.email.trim() });
    }
    if (s === "website" && d.websiteMode === "existing" && !d.websiteUrl.trim()) return t("agency.add.errors.websiteMissing");
    return null;
  };
  const currentProblem = problem(step);

  const next = () => {
    if (currentProblem) {
      setTried(true);
      return;
    }
    setTried(false);
    setFormError(null);
    if (step === "check") create.mutate();
    else setStep(STEPS[idx + 1]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o && !create.isPending) reset();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:h-[min(640px,92dvh)] sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {t("agency.add.stepOf", { n: idx + 1, total: STEPS.length })} · {t(`agency.add.steps.${step}`)}
          </p>
          <DialogTitle className="pr-8">{t("agency.add.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("agency.add.description")}</DialogDescription>
          <div className="mt-3 flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s} className={cn("h-1 flex-1 rounded-full", i <= idx ? "bg-foreground" : "bg-muted")} />
            ))}
          </div>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
            {step === "business" ? (
              <>
                <Field label={t("agency.add.fields.name")} required>
                  <Input autoFocus value={d.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder={t("agency.add.fields.namePlaceholder")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Not a <label>: on a phone the list opens inside it, and a label would
                      forward every tap on a row to the button and close it again. */}
                  <div className="space-y-1.5" role="group" aria-labelledby="ab-industry">
                    <span id="ab-industry" className="block text-sm font-medium text-foreground">{t("agency.add.fields.industry")}</span>
                    <BusinessTypePicker
                      value={d.industry}
                      otherText={d.industryOther}
                      invalid={tried && d.industry === OTHER_TYPE && d.industryOther.trim().length < 2}
                      onChange={(type, typed) =>
                        setD((p) => ({ ...p, industry: type, industryOther: typed !== undefined ? typed : type === OTHER_TYPE ? p.industryOther : "" }))
                      }
                    />
                  </div>
                  <Field label={t("agency.add.fields.currency")}>
                    <NativeSelect value={d.currency} onChange={(e) => set("currency", e.target.value)} className="w-full">
                      {DEAL_CURRENCIES.map((c) => (
                        <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label={t("agency.add.fields.phone")}>
                    <Input type="tel" inputMode="tel" value={d.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                  <Field label={t("agency.add.fields.email")}>
                    <Input type="email" inputMode="email" value={d.email} maxLength={254} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                </div>
                {d.industry === OTHER_TYPE ? (
                  <Field label={t("agency.add.fields.otherTypeLabel")} required>
                    {/* The footer says what's missing; the field only shows where. */}
                    <Input
                      aria-invalid={tried && d.industryOther.trim().length < 2 ? true : undefined}
                      value={d.industryOther}
                      maxLength={60}
                      autoFocus={desktopAutoFocus() && !d.industryOther}
                      autoCapitalize="sentences"
                      enterKeyHint="next"
                      placeholder={t("agency.add.fields.otherTypePlaceholder")}
                      onChange={(e) => set("industryOther", e.target.value)}
                    />
                  </Field>
                ) : null}
                <Field label={t("agency.add.fields.street")}>
                  <Input value={d.street} maxLength={200} onChange={(e) => set("street", e.target.value)} />
                </Field>
                <div className="grid grid-cols-[7rem_1fr] gap-4">
                  <Field label={t("agency.add.fields.postalCode")}>
                    <Input value={d.postal_code} maxLength={20} onChange={(e) => set("postal_code", e.target.value)} />
                  </Field>
                  <Field label={t("agency.add.fields.city")}>
                    <Input value={d.city} maxLength={120} onChange={(e) => set("city", e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Not a <label>: on a phone the list opens inside it (see the type picker). */}
                  <div className="space-y-1.5" role="group" aria-labelledby="ab-country">
                    <span id="ab-country" className="block text-sm font-medium text-foreground">{t("agency.add.fields.country")}</span>
                    <CountryPicker value={d.country} onChange={(c) => set("country", c)} label={t("agency.add.fields.country")} />
                  </div>
                  <Field label={t("agency.add.fields.timezone")}>
                    <TimezonePicker value={d.timezone} onChange={(z) => set("timezone", z)} />
                  </Field>
                </div>
              </>
            ) : null}

            {step === "people" ? (
              <>
                <p className="text-sm text-muted-foreground">{t("agency.add.people.intro")}</p>
                <ul className="space-y-2">
                  {d.members.map((m, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Input
                        type="email"
                        inputMode="email"
                        aria-label={t("agency.add.people.emailLabel")}
                        placeholder={t("agency.add.people.emailPlaceholder")}
                        value={m.email}
                        maxLength={254}
                        onChange={(e) => set("members", d.members.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                        className="min-w-0 flex-1"
                      />
                      <NativeSelect
                        aria-label={t("agency.add.people.roleLabel")}
                        value={m.role}
                        onChange={(e) => set("members", d.members.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}
                        className="w-32 shrink-0"
                      >
                        <NativeSelectOption value="admin">{t("agency.add.people.roles.admin")}</NativeSelectOption>
                        <NativeSelectOption value="editor">{t("agency.add.people.roles.editor")}</NativeSelectOption>
                        <NativeSelectOption value="viewer">{t("agency.add.people.roles.viewer")}</NativeSelectOption>
                      </NativeSelect>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 shrink-0"
                        aria-label={t("agency.add.people.remove")}
                        onClick={() => set("members", d.members.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
                {d.members.length < 20 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => set("members", [...d.members, { email: "", role: "editor" }])}>
                    <Plus className="size-4" aria-hidden /> {t("agency.add.people.add")}
                  </Button>
                ) : null}
                <p className="text-[12.5px] text-muted-foreground">{t("agency.add.people.youHaveAccess")}</p>
              </>
            ) : null}

            {step === "website" ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">{t("agency.add.website.question")}</legend>
                  {(["existing", "new", "none"] as const).map((mode) => (
                    <label
                      key={mode}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                        d.websiteMode === mode ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="website-mode"
                        className="mt-1 size-4 accent-[var(--foreground)]"
                        checked={d.websiteMode === mode}
                        onChange={() => {
                          set("websiteMode", mode);
                          setWebsiteError(null);
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium">{t(`agency.add.website.modes.${mode}`)}</span>
                        <span className="block text-[12.5px] text-muted-foreground">{t(`agency.add.website.hints.${mode}`)}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {d.websiteMode === "existing" ? (
                  <Field label={t("agency.add.website.url")} error={websiteError}>
                    <Input
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="salon-mira.de"
                      value={d.websiteUrl}
                      maxLength={500}
                      onChange={(e) => {
                        set("websiteUrl", e.target.value);
                        setWebsiteError(null);
                      }}
                      aria-invalid={!!websiteError}
                    />
                  </Field>
                ) : websiteError ? (
                  <p role="alert" className="text-sm text-overdue">{websiteError}</p>
                ) : null}
                {d.websiteMode !== "none" ? (
                  <>
                    <Field label={t("agency.add.website.note")}>
                      <Textarea rows={2} maxLength={2000} value={d.websiteNote} onChange={(e) => set("websiteNote", e.target.value)} />
                    </Field>
                    <p className="rounded-xl bg-muted/50 px-3 py-2 text-[12.5px] text-muted-foreground">{t("agency.add.website.whatHappens")}</p>
                  </>
                ) : null}
              </>
            ) : null}

            {step === "extras" ? (
              <>
                <p className="text-sm text-muted-foreground">{t("agency.add.extras.intro")}</p>
                <Toggle checked={d.emailWanted} onChange={(v) => set("emailWanted", v)} label={t("agency.add.extras.email")} hint={t("agency.add.extras.emailHint")} />
                {d.emailWanted ? (
                  <Field label={t("agency.add.extras.mailboxes")}>
                    <Input value={d.mailboxes} onChange={(e) => set("mailboxes", e.target.value)} placeholder={t("agency.add.extras.mailboxesPlaceholder")} />
                  </Field>
                ) : null}
                <Toggle checked={d.domainWanted} onChange={(v) => set("domainWanted", v)} label={t("agency.add.extras.domain")} hint={t("agency.add.extras.domainHint")} />
                {d.domainWanted ? (
                  <Field label={t("agency.add.extras.domainName")}>
                    <Input autoCapitalize="none" value={d.domainName} maxLength={253} onChange={(e) => set("domainName", e.target.value)} placeholder="salon-mira.de" />
                  </Field>
                ) : null}
                <Field label={t("agency.add.extras.other")}>
                  <Textarea rows={2} maxLength={2000} value={d.other} onChange={(e) => set("other", e.target.value)} />
                </Field>
                <Field label={t("agency.add.extras.note")}>
                  <Textarea rows={2} maxLength={2000} value={d.note} onChange={(e) => set("note", e.target.value)} />
                </Field>
              </>
            ) : null}

            {step === "check" ? (
              <dl className="divide-y divide-border rounded-xl border border-border text-sm">
                <Row term={t("agency.add.fields.name")} value={d.name.trim()} />
                {d.industry ? (
                  <Row
                    term={t("agency.add.fields.industry")}
                    value={d.industry === OTHER_TYPE ? d.industryOther.trim() : (industries.find((i) => i.k === d.industry)?.label ?? d.industry)}
                  />
                ) : null}
                {d.city.trim() ? <Row term={t("agency.add.fields.city")} value={d.city.trim()} /> : null}
                {d.country ? <Row term={t("agency.add.fields.country")} value={countryName(d.country, i18n.language)} /> : null}
                <Row
                  term={t("agency.add.check.people")}
                  value={
                    toInput(d).members?.length
                      ? toInput(d).members!.map((m) => `${m.email} (${t(`agency.add.people.roles.${m.role}`)})`).join(", ")
                      : t("agency.add.check.nobody")
                  }
                />
                <Row
                  term={t("agency.add.check.website")}
                  value={d.websiteMode === "existing" ? d.websiteUrl.trim() : t(`agency.add.website.modes.${d.websiteMode}`)}
                />
                <Row
                  term={t("agency.add.check.extras")}
                  value={
                    [d.emailWanted && t("agency.add.extras.email"), d.domainWanted && t("agency.add.extras.domain"), d.other.trim() && t("agency.add.extras.other")]
                      .filter(Boolean)
                      .join(", ") || t("agency.add.check.none")
                  }
                />
              </dl>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-border px-6 py-4">
            {currentProblem && tried ? (
              <p role="alert" className="text-sm text-overdue">
                {currentProblem}
              </p>
            ) : null}
            {formError ? <p role="alert" className="text-sm text-overdue">{formError}</p> : null}
            <div className="flex items-center justify-between gap-2">
              {idx > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setTried(false);
                    setStep(STEPS[idx - 1]);
                  }}
                  disabled={create.isPending}
                >
                  {t("agency.add.back")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={create.isPending}>
                {step === "check" ? (
                  <>
                    <Check className="size-4" aria-hidden /> {create.isPending ? t("agency.add.creating") : t("agency.add.create")}
                  </>
                ) : (
                  t("agency.add.next")
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="block text-[12.5px] text-overdue">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
        checked ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/30",
      )}
    >
      <input type="checkbox" className="mt-1 size-4 accent-[var(--foreground)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[12.5px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}
