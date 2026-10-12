import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addContactAddress,
  createContact,
  patchContactCrm,
  type ContactKind,
} from "~/lib/api/contacts-crm";
import {
  CompanyPicker,
  EMPTY_COMPANY,
  companyErrorMessage,
  companyPickerPayload,
  type CompanyPickerValue,
} from "~/components/molecule/company-picker";
import { cn } from "~/lib/utils";
import { attachDealContact } from "~/lib/api/deals";
import {
  DealMultiPicker,
  type PickedDeal,
} from "~/components/molecule/deal-multi-picker";
import { contactPath } from "~/lib/contacts/contact-path";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  addContactEmail,
  addContactPhone,
  addContactAddress as addContactAddressAlt,
} from "~/lib/api/contacts";
import { CONTACT_TYPES, type ContactType } from "~/lib/contacts/contact-types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { AddFromPhone } from "~/components/notebook/phone-contacts";
import { desktopAutoFocus } from "~/lib/utils/touch";

export interface CreateContactInitialValues {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  contactType?: string;
  /** Start on "Company" instead of "Person". */
  kind?: ContactKind;
  /** The company the new person works at ("Add person" on a company page). */
  company?: CompanyPickerValue;
}

export interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called with the new contact instead of navigating to its page. `created`
   * carries what a caller needs to show it right away (a picker filling
   * itself in) without a second request.
   */
  onCreated?: (
    contactId: string,
    created: { name: string; kind: ContactKind },
  ) => void;
  /**
   * Show the "Deals" field: existing deals the new contact is added to once
   * saved. Off where the caller links the deal itself (the deal page, the New
   * deal dialog) — asking twice would be confusing.
   */
  withDeals?: boolean;
  /** When set, operates in "add info" mode – adds missing data to an existing contact. */
  editContactId?: string;
  /** Pre-fill form fields (useful when editing an existing contact). */
  initialValues?: CreateContactInitialValues;
  /** Called after successfully adding info to existing contact. */
  onUpdated?: () => void;
  /**
   * Where the owner started from the New contact menu: "phone" opens the
   * phone's contacts straight away, "manual" shows only the form. Unset keeps
   * the form with "Add from phone" on top (⌘K quick-create).
   */
  start?: "phone" | "manual";
}

/**
 * Validation schema for the *create* path only. Email is optional (a contact
 * can be created with just a name/phone) but, when provided, must be a real
 * email address.
 */
function createContactSchema(t: TFunction) {
  return z.object({
    email: z.union([
      z.literal(""),
      z.email({
        message: t("contacts.errors.invalidEmail", {
          defaultValue: "Please enter a valid email address.",
        }),
      }),
    ]),
  });
}

const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

export function CreateContactDialog({
  open,
  onOpenChange,
  onCreated,
  withDeals = true,
  editContactId,
  initialValues,
  onUpdated,
  start,
}: CreateContactDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!editContactId;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactType, setContactType] = useState<ContactType>("contact");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [kind, setKind] = useState<ContactKind>("person");
  const [companyName, setCompanyName] = useState("");
  // Person: the company they work at. Company: the company it is part of.
  const [company, setCompany] = useState<CompanyPickerValue>(EMPTY_COMPANY);
  const [jobTitle, setJobTitle] = useState("");
  // Existing deals this contact belongs to; linked right after the save.
  const [deals, setDeals] = useState<PickedDeal[]>([]);
  const showDeals = withDeals && !isEditMode;
  const isCompany = kind === "company" && !isEditMode;
  // "Add from phone" (phones only) can replace the form with its own panel.
  const [phonePanel, setPhonePanel] = useState(false);

  useEffect(() => {
    if (open && initialValues) {
      setFirstName(initialValues.firstName ?? "");
      setLastName(initialValues.lastName ?? "");
      setEmail(initialValues.email ?? "");
      setPhone(initialValues.phone ?? "");
      setContactType(
        (initialValues.contactType as ContactType | undefined) ?? "contact",
      );
      setKind(initialValues.kind ?? "person");
      setCompany(initialValues.company ?? EMPTY_COMPANY);
    }
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setContactType("contact");
      setAddress(EMPTY_ADDRESS);
      setKind("person");
      setCompanyName("");
      setCompany(EMPTY_COMPANY);
      setJobTitle("");
      setDeals([]);
      setPhonePanel(false);
    }
  }, [open, initialValues]);

  const hasAddress = Object.values(address).some((v) => v.trim().length > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await createContact({
        kind,
        ...(isCompany
          ? { company_name: companyName.trim() }
          : {
              first_name: firstName.trim() || null,
              last_name: lastName.trim() || null,
              job_title: jobTitle.trim() || null,
            }),
        ...companyPickerPayload(company),
        email: email.trim() || null,
        phone: phone.trim() || null,
        contact_type: contactType,
      });
      if (hasAddress) {
        await addContactAddress(res.id, {
          line1: address.line1.trim() || null,
          line2: address.line2.trim() || null,
          city: address.city.trim() || null,
          state: address.state.trim() || null,
          postal_code: address.postal_code.trim() || null,
          country: address.country.trim() || null,
          is_primary: true,
        });
      }
      // The contact exists now; a deal that cannot be linked must not undo
      // that, so failures are counted and said, not thrown.
      const linked = showDeals
        ? await Promise.allSettled(
            deals.map((d) => attachDealContact(d.id, res.id)),
          )
        : [];
      return {
        ...res,
        dealsLinked: linked.length,
        dealsFailed: linked.filter((r) => r.status === "rejected").length,
      };
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-options"] });
      // A new person with a company belongs on that company's page too.
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      if (res.dealsLinked > 0) {
        void queryClient.invalidateQueries({ queryKey: ["deals"] });
        void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
        void queryClient.invalidateQueries({ queryKey: ["deal"] });
        void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      }
      if (res.dealsFailed > 0) {
        toast.warning(
          t("contacts.deals.someFailed", {
            defaultValue:
              "The contact is saved, but {{count}} deals could not be added. Open the contact and add them under Deals.",
            count: res.dealsFailed,
          }),
        );
      }
      const createdName = isCompany
        ? companyName.trim()
        : [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
          email.trim() ||
          phone.trim();
      onOpenChange(false);
      toast.success(
        isCompany
          ? t("contacts.company.createdSuccess", {
              defaultValue: "Company saved.",
            })
          : t("contacts.createdSuccess", { defaultValue: "Contact created." }),
      );
      if (onCreated) {
        onCreated(res.id, { name: createdName, kind });
      } else {
        navigate(contactPath({ id: res.id, kind }));
      }
    },
    onError: (error) => {
      toast.error(
        t("contacts.errors.createFailed", {
          defaultValue: "Could not create contact.",
        }),
        {
          description:
            companyErrorMessage(error, t) ?? extractErrorMessage(error),
        },
      );
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editContactId) throw new Error("No editContactId");
      const newEmail = email.trim();
      const newPhone = phone.trim();
      const hadEmail = !!initialValues?.email;
      const hadPhone = !!initialValues?.phone;

      const promises: Promise<unknown>[] = [];
      if (contactType !== (initialValues?.contactType ?? "contact")) {
        promises.push(
          patchContactCrm(editContactId, { contact_type: contactType }),
        );
      }
      if (newEmail && !hadEmail) {
        promises.push(
          addContactEmail(editContactId, {
            address: newEmail,
            type: "work",
            is_primary: true,
          }),
        );
      }
      if (newPhone && !hadPhone) {
        promises.push(
          addContactPhone(editContactId, {
            number: newPhone,
            type: "mobile",
            is_primary: true,
          }),
        );
      }
      if (hasAddress) {
        promises.push(
          addContactAddressAlt(editContactId, {
            line1: address.line1.trim() || null,
            line2: address.line2.trim() || null,
            city: address.city.trim() || null,
            state: address.state.trim() || null,
            postal_code: address.postal_code.trim() || null,
            country: address.country.trim() || null,
            is_primary: true,
          }),
        );
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-options"] });
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      onOpenChange(false);
      toast.success(
        t("contacts.updatedSuccess", { defaultValue: "Contact updated." }),
      );
      onUpdated?.();
    },
    onError: (error) => {
      toast.error(
        t("contacts.errors.updateFailed", {
          defaultValue: "Could not update contact.",
        }),
        { description: extractErrorMessage(error) },
      );
    },
  });

  const hasIdentity = isCompany
    ? companyName.trim().length > 0
    : firstName.trim().length > 0 ||
    lastName.trim().length > 0 ||
    email.trim().length > 0 ||
    phone.trim().length > 0;

  // Only validate the email format when creating a new contact.
  const trimmedEmail = email.trim();
  const emailParse = createContactSchema(t).shape.email.safeParse(trimmedEmail);
  const isEmailValid = emailParse.success;
  const showEmailError =
    !isEditMode && trimmedEmail.length > 0 && !isEmailValid;
  const emailError = emailParse.success
    ? undefined
    : emailParse.error.issues[0]?.message;

  const submitDisabled = isEditMode
    ? editMutation.isPending
    : createMutation.isPending || !hasIdentity || !isEmailValid;
  const submit = () =>
    isEditMode ? editMutation.mutate() : createMutation.mutate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t("contacts.addInfoTitle", {
                  defaultValue: "Add contact information",
                })
              : isCompany
                ? t("contacts.company.newTitle", {
                    defaultValue: "New company",
                  })
                : t("contacts.newContactTitle", { defaultValue: "New contact" })}
          </DialogTitle>
        </DialogHeader>

        {!isEditMode && start !== "manual" && !isCompany ? (
          <AddFromPhone
            autoStart={start === "phone"}
            onPrefill={(v) => {
              setFirstName(v.firstName ?? "");
              setLastName(v.lastName ?? "");
              setEmail(v.email ?? "");
              setPhone(v.phone ?? "");
            }}
            onActiveChange={setPhonePanel}
            onFinished={() => onOpenChange(false)}
          />
        ) : null}

        {phonePanel ? null : (
        <form
          id="create-contact-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitDisabled) submit();
          }}
          className="space-y-4 py-1 flex-1 overflow-y-auto px-2 max-sm:flex-none max-sm:overflow-visible max-sm:px-0.5"
        >
          {/* Person or company */}
          {!isEditMode ? (
            <div
              role="radiogroup"
              aria-label={t("contacts.company.kindLabel", {
                defaultValue: "Person or company",
              })}
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            >
              {(["person", "company"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "press h-9 rounded-md text-sm font-medium transition-colors max-sm:h-11",
                    kind === k
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k === "person"
                    ? t("contacts.company.person", { defaultValue: "Person" })
                    : t("contacts.company.company", {
                        defaultValue: "Company",
                      })}
                </button>
              ))}
            </div>
          ) : null}

          {isCompany ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="create-contact-company-name">
                  {t("contacts.company.name", {
                    defaultValue: "Company name",
                  })}
                </Label>
                <Input
                  id="create-contact-company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  autoFocus={desktopAutoFocus()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-contact-part-of">
                  {t("contacts.company.partOf", { defaultValue: "Part of" })}
                </Label>
                <CompanyPicker
                  id="create-contact-part-of"
                  value={company}
                  onChange={setCompany}
                  placeholder={t("contacts.company.partOfPlaceholder", {
                    defaultValue: "A bigger company it belongs to (optional)",
                  })}
                />
              </div>
            </>
          ) : null}

          {/* Name */}
          {isCompany ? null : (
          <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-first-name">
                {t("contacts.fields.firstName", { defaultValue: "First name" })}
              </Label>
              <Input
                id="create-contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                autoFocus={desktopAutoFocus() && (!isEditMode)}
                readOnly={isEditMode}
                className={isEditMode ? "bg-muted/50" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-last-name">
                {t("contacts.fields.lastName", { defaultValue: "Last name" })}
              </Label>
              <Input
                id="create-contact-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                autoCapitalize="words"
                enterKeyHint="next"
                readOnly={isEditMode}
                className={isEditMode ? "bg-muted/50" : undefined}
              />
            </div>
          </div>
          {!isEditMode ? (
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-company">
                {t("contacts.company.company", { defaultValue: "Company" })}
              </Label>
              <CompanyPicker
                id="create-contact-company"
                value={company}
                onChange={setCompany}
                placeholder={t("contacts.company.companyPlaceholder", {
                  defaultValue: "Where they work (optional)",
                })}
              />
            </div>
          ) : null}
          {!isEditMode ? (
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-position">
                {t("contacts.company.position", { defaultValue: "Position" })}
              </Label>
              <Input
                id="create-contact-position"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                autoComplete="organization-title"
                autoCapitalize="sentences"
                enterKeyHint="next"
                maxLength={200}
                placeholder={t("contacts.company.positionPlaceholder", {
                  defaultValue: "What they do there (optional)",
                })}
              />
            </div>
          ) : null}
          </>
          )}

          {/* Contact type */}
          <div className="space-y-1.5">
            <Label>
              {t("contacts.contactType", { defaultValue: "Contact type" })}
            </Label>
            <Select
              value={contactType}
              onValueChange={(v) => setContactType(v as ContactType)}
            >
              <SelectTrigger className="max-sm:w-full">
                <SelectValue
                  placeholder={t("contacts.contactType", {
                    defaultValue: "Contact type",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {t(`contacts.contactTypes.${ct}`, { defaultValue: ct })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="create-contact-email">
              {t("contacts.fields.email", { defaultValue: "Email" })}
            </Label>
            <Input
              id="create-contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              readOnly={isEditMode && !!initialValues?.email}
              aria-invalid={showEmailError}
              className={
                isEditMode && !!initialValues?.email
                  ? "bg-muted/50"
                  : showEmailError
                    ? "border-destructive focus-visible:ring-destructive"
                    : undefined
              }
            />
            {showEmailError && emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="create-contact-phone">
              {t("contacts.fields.phone", { defaultValue: "Phone" })}
            </Label>
            <PhoneNumberInput
              id="create-contact-phone"
              value={phone}
              onChange={setPhone}
              placeholder={t("contacts.fields.phone", {
                defaultValue: "Phone",
              })}
            />
          </div>

          {/* Deals */}
          {showDeals ? (
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-deals">
                {t("contacts.deals.label", { defaultValue: "Deals" })}
              </Label>
              <DealMultiPicker
                id="create-contact-deals"
                value={deals}
                onChange={setDeals}
                placeholder={t("contacts.deals.placeholder", {
                  defaultValue: "Add to a deal you already have (optional)",
                })}
              />
            </div>
          ) : null}

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="create-contact-line1">
              {t("contacts.addrLine1", { defaultValue: "Address line 1" })}
            </Label>
            <Input
              id="create-contact-line1"
              value={address.line1}
              onChange={(e) =>
                setAddress((a) => ({ ...a, line1: e.target.value }))
              }
              autoComplete="address-line1"
              enterKeyHint="next"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-contact-line2">
              {t("contacts.addrLine2", { defaultValue: "Address line 2" })}
            </Label>
            <Input
              id="create-contact-line2"
              value={address.line2}
              onChange={(e) =>
                setAddress((a) => ({ ...a, line2: e.target.value }))
              }
              autoComplete="address-line2"
              enterKeyHint="next"
            />
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-postal">
                {t("contacts.postalCode", { defaultValue: "Postal code" })}
              </Label>
              <Input
                id="create-contact-postal"
                value={address.postal_code}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, postal_code: e.target.value }))
                }
                autoComplete="postal-code"
                enterKeyHint="next"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-city">
                {t("contacts.city", { defaultValue: "City" })}
              </Label>
              <Input
                id="create-contact-city"
                value={address.city}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
                autoComplete="address-level2"
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-state">
                {t("contacts.state", { defaultValue: "State / Region" })}
              </Label>
              <Input
                id="create-contact-state"
                value={address.state}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, state: e.target.value }))
                }
                autoComplete="address-level1"
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-country">
                {t("contacts.country", { defaultValue: "Country" })}
              </Label>
              <Input
                id="create-contact-country"
                value={address.country}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, country: e.target.value }))
                }
                autoComplete="country"
                autoCapitalize="characters"
                enterKeyHint="done"
                placeholder="DE"
                maxLength={2}
              />
            </div>
          </div>
        </form>
        )}

        {phonePanel ? null : (
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            form="create-contact-form"
            disabled={submitDisabled}
          >
            {(isEditMode ? editMutation.isPending : createMutation.isPending)
              ? t("common.loading", { defaultValue: "Loading…" })
              : isEditMode
                ? t("common.save", { defaultValue: "Save" })
                : isCompany
                  ? t("contacts.company.save", {
                      defaultValue: "Save company",
                    })
                  : t("contacts.create", { defaultValue: "Create" })}
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
