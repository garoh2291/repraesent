import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { customKeyFor, updateContactCustomFields } from "~/lib/api/contact-imports";
import { detailLabel } from "~/components/contact-import/labels";

/**
 * Keys the app writes for itself (form language, onboarding answers, sync
 * ids). They are shown elsewhere or not meant to be edited by hand.
 */
function isSystemKey(key: string): boolean {
  return (
    key.startsWith("_") ||
    key.startsWith("onboarding_") ||
    key === "form_locale" ||
    key === "locale" ||
    key === "vcard_uid"
  );
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

interface Props {
  contactId: string;
  metadata: unknown;
  canEdit: boolean;
  onInvalidate: () => void;
}

/**
 * "More details": the extra columns a file import brought along, plus anything
 * the owner adds by hand. Each one can be changed or removed in place, and
 * every one of them can be used in a segment or an email.
 */
export function ContactCustomFieldsCard({ contactId, metadata, canEdit, onInvalidate }: Props) {
  const { t } = useTranslation();
  const fields = useMemo(() => {
    const m =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    return Object.entries(m)
      .filter(([key, value]) => !isSystemKey(key) && asText(value).trim() !== "")
      .map(([key, value]) => ({
        key,
        value: asText(value),
        // Nested values are shown as they are; editing them as text would flatten them.
        editable: value == null || typeof value !== "object",
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [metadata]);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const mutation = useMutation({
    mutationFn: (body: { set?: Record<string, string>; remove?: string[] }) =>
      updateContactCustomFields(contactId, body),
    onSuccess: (_data, body) => {
      onInvalidate();
      setEditing(null);
      setAdding(false);
      setNewName("");
      setNewValue("");
      toast.success(
        body.remove?.length
          ? t("contacts.customFields.removed", "Detail removed.")
          : t("contacts.customFields.saved", "Detail saved."),
      );
    },
    onError: (error) => {
      toast.error(t("contacts.customFields.saveFailed", "That could not be saved."), {
        description: extractErrorMessage(error),
      });
    },
  });

  const newKey = customKeyFor(newName);
  const nameTaken = !!newKey && fields.some((f) => f.key === newKey);

  // Nothing to show and nothing the viewer may add: no empty card.
  if (fields.length === 0 && !canEdit) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <header className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t("contacts.customFields.title", "More details")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground max-sm:text-[13px]">
            {fields.length > 0
              ? t(
                  "contacts.customFields.hint",
                  "From files you brought in, or added by hand. You can use them in segments and emails.",
                )
              : t(
                  "contacts.customFields.empty",
                  "Anything else worth knowing about this contact, like a customer number or a shoe size.",
                )}
          </p>
        </div>
        {canEdit && !adding ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs max-sm:h-11 max-sm:text-sm"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus className="size-3.5" />
            {t("contacts.customFields.add", "Add a detail")}
          </Button>
        ) : null}
      </header>

      {adding ? (
        <form
          className="space-y-2 border-t border-border px-4 py-3.5 sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newKey || nameTaken || !newValue.trim()) return;
            mutation.mutate({ set: { [newKey]: newValue.trim() } });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              enterKeyHint="next"
              aria-label={t("contacts.customFields.nameLabel", "What is it called?")}
              placeholder={t("contacts.customFields.namePlaceholder", "Name, e.g. Customer number")}
              aria-invalid={nameTaken}
            />
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              maxLength={2000}
              enterKeyHint="done"
              aria-label={t("contacts.customFields.valueLabel", "Value")}
              placeholder={t("contacts.customFields.valuePlaceholder", "Value")}
            />
          </div>
          {nameTaken ? (
            <p className="text-xs text-destructive max-sm:text-[13px]">
              {t(
                "contacts.customFields.nameTaken",
                "This contact already has a detail with that name. Change it in the list below.",
              )}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setNewValue("");
              }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm"
              disabled={!newKey || nameTaken || !newValue.trim() || mutation.isPending}
            >
              {t("contacts.customFields.saveNew", "Save detail")}
            </Button>
          </div>
        </form>
      ) : null}

      {fields.length > 0 ? (
        <dl className="border-t border-border">
          {fields.map((f) => {
            // A file's own "Source" column, told apart from the contact's built-in source.
            const label = detailLabel(t, f.key);
            const isEditing = editing === f.key;
            const long = f.value.length > 60 || f.value.includes("\n");
            return (
              <div
                key={f.key}
                className="border-b border-border px-4 py-2.5 last:border-b-0 sm:px-5"
              >
                {isEditing ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const next = draft.trim();
                      if (!next) return;
                      if (next === f.value) {
                        setEditing(null);
                        return;
                      }
                      mutation.mutate({ set: { [f.key]: next } });
                    }}
                  >
                    <label
                      htmlFor={`custom-field-${f.key}`}
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </label>
                    {long ? (
                      <Textarea
                        id={`custom-field-${f.key}`}
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={2000}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`custom-field-${f.key}`}
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={2000}
                        enterKeyHint="done"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive max-sm:h-11 max-sm:text-sm"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ remove: [f.key] })}
                      >
                        <Trash2 className="size-3.5" />
                        {t("contacts.customFields.remove", "Remove")}
                      </Button>
                      <span className="flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs max-sm:h-11 max-sm:text-sm"
                        onClick={() => setEditing(null)}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 text-xs max-sm:h-11 max-sm:text-sm"
                        disabled={!draft.trim() || mutation.isPending}
                      >
                        {t("common.save", "Save")}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
                      <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5 sm:text-[13px]">
                        {label}
                      </dt>
                      <dd className="whitespace-pre-wrap break-words text-sm text-foreground">
                        {f.value}
                      </dd>
                    </div>
                    {canEdit && f.editable ? (
                      <button
                        type="button"
                        className="press -my-1.5 -mr-2 flex size-9 shrink-0 select-none items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 max-sm:size-11 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
                        style={{ touchAction: "manipulation" }}
                        aria-label={t("contacts.customFields.edit", {
                          defaultValue: "Change {{name}}",
                          name: label,
                        })}
                        onClick={() => {
                          setAdding(false);
                          setDraft(f.value);
                          setEditing(f.key);
                        }}
                      >
                        <Pencil className="size-3.5 max-sm:size-4" />
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </dl>
      ) : null}
    </section>
  );
}
