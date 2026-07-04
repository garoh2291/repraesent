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
} from "~/lib/api/contacts-crm";
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

export interface CreateContactInitialValues {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  contactType?: string;
}

export interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new contact id instead of navigating to the contact page. */
  onCreated?: (contactId: string) => void;
  /** When set, operates in "add info" mode – adds missing data to an existing contact. */
  editContactId?: string;
  /** Pre-fill form fields (useful when editing an existing contact). */
  initialValues?: CreateContactInitialValues;
  /** Called after successfully adding info to existing contact. */
  onUpdated?: () => void;
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
  editContactId,
  initialValues,
  onUpdated,
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

  useEffect(() => {
    if (open && initialValues) {
      setFirstName(initialValues.firstName ?? "");
      setLastName(initialValues.lastName ?? "");
      setEmail(initialValues.email ?? "");
      setPhone(initialValues.phone ?? "");
      setContactType(
        (initialValues.contactType as ContactType | undefined) ?? "contact",
      );
    }
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setContactType("contact");
      setAddress(EMPTY_ADDRESS);
    }
  }, [open, initialValues]);

  const hasAddress = Object.values(address).some((v) => v.trim().length > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await createContact({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
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
      return res;
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-options"] });
      onOpenChange(false);
      toast.success(
        t("contacts.createdSuccess", { defaultValue: "Contact created." }),
      );
      if (onCreated) {
        onCreated(res.id);
      } else {
        navigate(`/contacts/${res.id}`);
      }
    },
    onError: (error) => {
      toast.error(
        t("contacts.errors.createFailed", {
          defaultValue: "Could not create contact.",
        }),
        { description: extractErrorMessage(error) },
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

  const hasIdentity =
    firstName.trim().length > 0 ||
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t("contacts.addInfoTitle", {
                  defaultValue: "Add contact information",
                })
              : t("contacts.newContactTitle", { defaultValue: "New contact" })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 flex-1 overflow-y-auto px-2">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-contact-first-name">
                {t("contacts.fields.firstName", { defaultValue: "First name" })}
              </Label>
              <Input
                id="create-contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus={!isEditMode}
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
                readOnly={isEditMode}
                className={isEditMode ? "bg-muted/50" : undefined}
              />
            </div>
          </div>

          {/* Contact type */}
          <div className="space-y-1.5">
            <Label>
              {t("contacts.contactType", { defaultValue: "Contact type" })}
            </Label>
            <Select
              value={contactType}
              onValueChange={(v) => setContactType(v as ContactType)}
            >
              <SelectTrigger>
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
              value={phone}
              onChange={setPhone}
              placeholder={t("contacts.fields.phone", {
                defaultValue: "Phone",
              })}
            />
          </div>

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
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                placeholder="DE"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={() =>
              isEditMode ? editMutation.mutate() : createMutation.mutate()
            }
            disabled={
              isEditMode
                ? editMutation.isPending
                : createMutation.isPending || !hasIdentity || !isEmailValid
            }
          >
            {(isEditMode ? editMutation.isPending : createMutation.isPending)
              ? t("common.loading", { defaultValue: "Loading…" })
              : isEditMode
                ? t("common.save", { defaultValue: "Save" })
                : t("contacts.create", { defaultValue: "Create" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
