import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowRight, Check, Contact, FileUp, FolderDown, Share, Smartphone } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { createContact } from "~/lib/api/contacts-crm";
import {
  parseContactsVcard,
  uploadContactsImport,
  type ContactImportRow,
} from "~/lib/api/contacts-import";
import { extractErrorCode, extractErrorMessage } from "~/lib/api/axios-instance";
import type { CreateContactInitialValues } from "~/components/organism/create-contact-dialog";

/** One person from the phone, already split into our fields. */
interface PhonePerson {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type Mode =
  | { kind: "idle" }
  | { kind: "ios" }
  | { kind: "confirm"; people: PhonePerson[]; rows?: ContactImportRow[] }
  | { kind: "saving"; count: number }
  | {
      kind: "result";
      created: number;
      skipped: number;
      existing: { name: string; id: string }[];
      failed: number;
    };

interface ContactsManager {
  select: (
    props: ("name" | "tel" | "email")[],
    opts?: { multiple?: boolean },
  ) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>;
}

function contactPicker(): ContactsManager | null {
  if (typeof window === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts && "ContactsManager" in window ? nav.contacts : null;
}

function splitName(full: string): { first: string; last: string } {
  const s = full.trim().replace(/\s+/g, " ");
  const at = s.indexOf(" ");
  return at < 0 ? { first: s, last: "" } : { first: s.slice(0, at), last: s.slice(at + 1) };
}

function fromRow(r: ContactImportRow): PhonePerson {
  let first = r.first_name?.trim() || "";
  let last = r.last_name?.trim() || "";
  if (!first && !last && r.full_name) ({ first, last } = splitName(r.full_name));
  return { firstName: first, lastName: last, email: r.email?.trim() || "", phone: r.phone?.trim() || "" };
}

function label(p: PhonePerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || p.phone;
}

/**
 * "Add from phone" inside New contact (MOBILE_PACKAGE_PLAN.md C4), phones only.
 * Android: the system contact picker. iPhone and others: share the contact as
 * a .vcf file and choose it here. One person fills the form; several are
 * added after one confirm. Everything happens inside the dialog, no new sheet.
 */
export function AddFromPhone({
  onPrefill,
  onActiveChange,
  onFinished,
  autoStart = false,
}: {
  /** Open the phone's contacts as soon as this shows (the menu tap was the ask). */
  autoStart?: boolean;
  onPrefill: (values: CreateContactInitialValues) => void;
  /** True while a panel replaces the form (steps, confirm, result). */
  onActiveChange: (active: boolean) => void;
  /** People were added: the dialog can close. */
  onFinished: () => void;
}) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => onActiveChange(mode.kind !== "idle"), [mode.kind, onActiveChange]);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || !phone || autoStarted.current) return;
    autoStarted.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, phone]);

  if (!phone) return null;

  const prefill = (p: PhonePerson) => {
    onPrefill({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone });
    setMode({ kind: "idle" });
  };

  const pickAndroid = async (picker: ContactsManager) => {
    setError(null);
    try {
      const picked = await picker.select(["name", "tel", "email"], { multiple: true });
      const people = picked
        .map((c) => {
          const { first, last } = splitName(c.name?.[0] ?? "");
          return {
            firstName: first,
            lastName: last,
            email: c.email?.[0]?.trim() ?? "",
            phone: c.tel?.[0]?.trim() ?? "",
          };
        })
        .filter((p) => p.firstName || p.lastName || p.email || p.phone);
      if (people.length === 1) prefill(people[0]);
      else if (people.length > 1) setMode({ kind: "confirm", people });
    } catch {
      setError(t("phoneContacts.errors.picker", "Your phone didn't share the contacts. Try again."));
    }
  };

  const start = () => {
    const picker = contactPicker();
    if (picker) void pickAndroid(picker);
    else setMode({ kind: "ios" });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const res = await parseContactsVcard(file);
      const rows = res.rows ?? [];
      if (rows.length === 0) {
        setError(t("phoneContacts.errors.empty", "No contacts in that file. Share a contact card (.vcf) and choose it."));
      } else if (rows.length === 1) {
        prefill(fromRow(rows[0]));
      } else {
        setMode({ kind: "confirm", people: rows.map(fromRow), rows });
      }
    } catch (err) {
      setError(
        extractErrorMessage(err) ||
          t("phoneContacts.errors.file", "That file couldn't be read. Choose a contact card (.vcf)."),
      );
    } finally {
      setReading(false);
    }
  };

  const addAll = async (people: PhonePerson[], rows?: ContactImportRow[]) => {
    setMode({ kind: "saving", count: people.length });
    try {
      if (rows) {
        // A .vcf goes through the import, which skips duplicates itself.
        const res = await uploadContactsImport({ rows, source: "vcard_import" });
        setMode({ kind: "result", created: res.created, skipped: res.skipped, existing: [], failed: res.errors?.length ?? 0 });
      } else {
        let created = 0;
        let failed = 0;
        const existing: { name: string; id: string }[] = [];
        for (const p of people) {
          try {
            await createContact({
              first_name: p.firstName || null,
              last_name: p.lastName || null,
              email: p.email || null,
              phone: p.phone || null,
              contact_type: "contact",
            });
            created++;
          } catch (err) {
            const dup =
              extractErrorCode(err) === "CONTACT_EMAIL_EXISTS" && axios.isAxiosError(err)
                ? (err.response?.data as { contact?: { id?: string; full_name?: string | null } } | undefined)?.contact
                : undefined;
            if (dup?.id) existing.push({ id: dup.id, name: dup.full_name?.trim() || label(p) });
            else failed++;
          }
        }
        setMode({ kind: "result", created, skipped: existing.length, existing, failed });
      }
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      void qc.invalidateQueries({ queryKey: ["contacts-options"] });
    } catch (err) {
      setMode({ kind: "confirm", people, rows });
      setError(extractErrorMessage(err) || t("phoneContacts.errors.save", "They weren't added. Try again."));
    }
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".vcf,text/vcard,text/x-vcard"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (mode.kind === "idle") {
    return (
      <div className="space-y-1.5">
        <Button type="button" variant="outline" className="h-11 w-full gap-2 text-[14px]" onClick={start}>
          <Smartphone className="size-4" aria-hidden />
          {t("phoneContacts.add", "Add from phone")}
        </Button>
        {error ? <p className="text-[12.5px] text-overdue">{error}</p> : null}
      </div>
    );
  }

  if (mode.kind === "ios") {
    const steps = [
      {
        Icon: Contact,
        Icon2: Share,
        text: t("phoneContacts.ios.step1", "In Contacts, open the person and tap Share Contact."),
      },
      {
        Icon: FolderDown,
        text: t("phoneContacts.ios.step2", "Tap Save to Files, then come back and choose the file."),
      },
    ];
    return (
      <div className="space-y-4 py-1">
        {fileInput}
        <div>
          <p className="text-[15px] font-semibold text-foreground">
            {t("phoneContacts.ios.title", "Add from your phone's contacts")}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("phoneContacts.ios.body", "Two steps in the Contacts app:")}
          </p>
        </div>
        <ol className="space-y-3">
          {steps.map((s, n) => (
            <li key={n} className="flex items-start gap-3">
              <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-background">
                {n + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5" aria-hidden>
                  <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted">
                    <s.Icon className="size-5 text-foreground" />
                  </span>
                  {s.Icon2 ? (
                    <>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted">
                        <s.Icon2 className="size-5 text-foreground" />
                      </span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-snug text-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        {error ? <p className="text-[12.5px] text-overdue">{error}</p> : null}
        <div className="grid gap-2">
          <Button type="button" className="h-12 gap-2 text-[15px]" loading={reading} onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden />
            {t("phoneContacts.ios.choose", "Choose file")}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => { setError(null); setMode({ kind: "idle" }); }}>
            {t("phoneContacts.back", "Type it in instead")}
          </Button>
        </div>
      </div>
    );
  }

  if (mode.kind === "confirm" || mode.kind === "saving") {
    const people = mode.kind === "confirm" ? mode.people : [];
    const count = mode.kind === "confirm" ? people.length : mode.count;
    return (
      <div className="space-y-4 py-1 text-center">
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {t("phoneContacts.confirmTitle", "Add {{count}} people?", { count })}
        </p>
        {people.length ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-muted/60 px-3 py-2.5 text-left text-[13.5px] text-foreground">
            {people.map((p, n) => (
              <li key={n} className="truncate">
                {label(p)}
                {p.phone || p.email ? (
                  <span className="text-muted-foreground"> · {p.phone || p.email}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="text-[12.5px] text-overdue">{error}</p> : null}
        <div className="grid gap-2">
          <Button
            type="button"
            className="h-12 text-[15px]"
            loading={mode.kind === "saving"}
            onClick={() => mode.kind === "confirm" && void addAll(mode.people, mode.rows)}
          >
            {t("phoneContacts.confirmCta", "Add {{count}} people", { count })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={mode.kind === "saving"}
            onClick={() => { setError(null); setMode({ kind: "idle" }); }}
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // Result: the "Email sent" style card.
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-2 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-earned-soft">
        <Check className="size-6 text-earned" strokeWidth={2.5} aria-hidden />
      </span>
      <p className="text-lg font-semibold tracking-tight text-foreground">
        {t("phoneContacts.resultTitle", "{{count}} added", { count: mode.created })}
      </p>
      {mode.existing.length ? (
        <ul className="mt-2 w-full space-y-1 text-[13px]">
          {mode.existing.map((e) => (
            <li key={e.id} className="flex items-center justify-center gap-2">
              <span className="text-muted-foreground">
                {t("phoneContacts.already", "Already a customer: {{name}}", { name: e.name })}
              </span>
              <Link to={`/contacts/${e.id}`} onClick={onFinished} className="font-medium text-foreground underline underline-offset-4">
                {t("phoneContacts.open", "Open")}
              </Link>
            </li>
          ))}
        </ul>
      ) : mode.skipped ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("phoneContacts.skipped", "{{count}} were already in your customers.", { count: mode.skipped })}
        </p>
      ) : null}
      {mode.failed ? (
        <p className="mt-1 text-[13px] text-overdue">
          {t("phoneContacts.failed", "{{count}} couldn't be added — add them by hand.", { count: mode.failed })}
        </p>
      ) : null}
      <Button type="button" className="mt-5 h-11 w-full" onClick={onFinished} autoFocus>
        {t("phoneContacts.done", "Done")}
      </Button>
    </div>
  );
}
