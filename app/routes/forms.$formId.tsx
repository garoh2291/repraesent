import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Eye, Globe, Save } from "lucide-react";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ConfirmationEmailPanel } from "~/components/forms/ConfirmationEmailPanel";
import { FieldInspector } from "~/components/forms/FieldInspector";
import { FieldPalette } from "~/components/forms/FieldPalette";
import { FormCanvas } from "~/components/forms/FormCanvas";
import { LanguageStrip } from "~/components/forms/LanguageStrip";
import { FormStatusBadge } from "~/components/forms/FormStatusBadge";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { SharePanel } from "~/components/forms/SharePanel";
import { ThemePanel } from "~/components/forms/ThemePanel";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  EMAIL_BODY_KEY,
  EMAIL_SUBJECT_KEY,
  publishForm,
  translateForm,
  type TranslateFormRequest,
  type TranslateFormResponse,
  unpublishForm,
  updateForm,
  updateFormConfirmationEmail,
} from "~/lib/api/forms";
import { buildPublicFormUrl } from "~/lib/config";
import {
  buildTranslateItems,
  copyFromDefault,
  getRawContent,
  mergeTranslations,
} from "~/lib/forms/content";
import {
  type BuilderSelection,
  type InspectorTarget,
  selectedFieldId,
} from "~/lib/forms/selection";
import {
  createField,
  newId,
  normalizeDefinition,
} from "~/lib/forms/field-types";
import {
  flattenFields,
  type FormConfirmationEmail,
  type FormDefinition,
  type FormDefinitionIssue,
  type FormField,
  type FormFieldType,
  type FormLocale,
} from "~/lib/forms/schema";
import { validateDefinition } from "~/lib/forms/validate";
import { useAuthContext } from "~/providers/auth-provider";
import { useCanEditForms } from "~/lib/hooks/useCanEditForms";
import { useFormDefinition } from "~/lib/hooks/useForms";

export default function FormBuilderRoute() {
  const { formId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditForms();
  const { currentWorkspace } = useAuthContext();

  const { data: form, isLoading } = useFormDefinition(formId);

  const hasEmailConfig =
    currentWorkspace?.services?.some(
      (s) =>
        s.service_type === "email-config" || s.service_slug === "email-config",
    ) ?? false;

  // --- local draft ---------------------------------------------------------
  // The builder edits a local copy and saves explicitly. The QueryClient runs
  // with refetchOnMount:false and a 5-minute staleTime, so nothing yanks the
  // draft out from under an in-progress edit.
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [locales, setLocales] = useState<FormLocale[]>([]);
  const [defaultLocale, setDefaultLocale] = useState<FormLocale>("de");
  const [confirmationEmail, setConfirmationEmail] =
    useState<FormConfirmationEmail | null>(null);
  const [editingLocale, setEditingLocale] = useState<FormLocale>("de");
  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [tab, setTab] = useState("build");
  /**
   * Ref-counted, not a Set: "Translate with AI" fires TWO requests for one
   * locale (content + confirmation e-mail), and the first to settle would
   * otherwise clear the spinner while the second is still running.
   */
  const [translateCounts, setTranslateCounts] = useState<
    Record<string, number>
  >({});
  const [dirty, setDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);

  useEffect(() => {
    if (!form) return;
    setName(form.name);
    setDefinition(normalizeDefinition(form.definition, form.default_locale));
    setLocales(form.locales);
    setDefaultLocale(form.default_locale);
    setEditingLocale(form.default_locale);
    setConfirmationEmail(form.confirmation_email);
    setDirty(false);
    setEmailDirty(false);
    // Keyed on the form ID ALONE, deliberately. Including updated_at meant any
    // mutation that touches the row — unpublish, or saving the confirmation
    // e-mail — rehydrated from the server and silently threw away unsaved
    // Build-tab edits. Turning Live off is the escape hatch out of an
    // unsaveable live form, so it must not destroy the work it exists to save.
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchDefinition = useCallback((next: FormDefinition) => {
    setDefinition(next);
    setDirty(true);
  }, []);

  // A controlled <Tabs> pointing at a panel that no longer renders shows an
  // empty body, so follow hasEmailConfig in both directions.
  useEffect(() => {
    if (tab === "email" && !hasEmailConfig) setTab("build");
  }, [tab, hasEmailConfig]);

  /**
   * Functional patch — mandatory for anything async.
   *
   * A translate response's onSuccess closes over `definition` at call time. Two
   * responses in flight (two quick "Add language" clicks, or content + e-mail
   * together) means the second merges into a stale draft and silently drops the
   * first — plus every keystroke made while they were running.
   */
  const patchDefinitionFn = useCallback(
    (fn: (current: FormDefinition) => FormDefinition) => {
      setDefinition((prev) => (prev ? fn(prev) : prev));
      setDirty(true);
    },
    [],
  );

  const bumpTranslating = useCallback(
    (targets: FormLocale[], delta: 1 | -1) => {
      setTranslateCounts((prev) => {
        const next = { ...prev };
        for (const locale of targets) {
          next[locale] = Math.max(0, (next[locale] ?? 0) + delta);
        }
        return next;
      });
    },
    [],
  );

  const bannerRef = useRef<HTMLDivElement | null>(null);

  const translating = useMemo(
    () =>
      new Set(
        Object.entries(translateCounts)
          .filter(([, n]) => n > 0)
          .map(([locale]) => locale as FormLocale),
      ),
    [translateCounts],
  );

  // --- mutations -----------------------------------------------------------

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["forms"] });
    await queryClient.invalidateQueries({ queryKey: ["form", formId] });
    await queryClient.invalidateQueries({ queryKey: ["form-snippet", formId] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateForm(formId!, {
        name: name.trim(),
        definition: definition!,
        locales,
        default_locale: defaultLocale,
      }),
    onSuccess: async () => {
      await invalidate();
      setDirty(false);
      toast.success(t("forms.builder.saved"));
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      toast.error(
        status === 409
          ? t("forms.list.nameExists")
          : t("common.failedToSave", { defaultValue: "Could not save" }),
        status === 409
          ? undefined
          : { description: extractErrorMessage(error) },
      );
    },
  });

  const emailMutation = useMutation({
    mutationFn: () =>
      updateFormConfirmationEmail(
        formId!,
        confirmationEmail ?? {
          enabled: false,
          email_account_id: null,
          by_locale: {},
        },
      ),
    onSuccess: async () => {
      await invalidate();
      setEmailDirty(false);
      toast.success(t("forms.email.saved"));
    },
    onError: (error: unknown) =>
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(error),
        },
      ),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      // Publishing snapshots what is STORED, so an unsaved draft has to land
      // first or the user publishes the previous version and sees no change.
      if (dirty) {
        await updateForm(formId!, {
          name: name.trim(),
          definition: definition!,
          locales,
          default_locale: defaultLocale,
        });
        setDirty(false);
      }
      return publishForm(formId!);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(t("forms.builder.publishedToast"));
    },
    onError: (error: unknown) =>
      toast.error(t("forms.validation.cannotPublish"), {
        description: extractErrorMessage(error),
      }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishForm(formId!),
    onSuccess: async () => {
      await invalidate();
      toast.success(t("forms.builder.unpublishedToast"));
    },
    onError: (error: unknown) =>
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(error),
        },
      ),
  });

  // No mutation-level onError: it fires IN ADDITION to a call-level one, which
  // would make the add-language fallback toast "AI is not set up" and "copied
  // instead" at the same time. Each caller opts in explicitly.
  const translateMutation = useMutation({
    mutationFn: (body: TranslateFormRequest) => translateForm(formId!, body),
  });

  const reportTranslateError = (error: unknown) => {
    const code = (error as { response?: { data?: { code?: string } } })
      ?.response?.data?.code;
    toast.error(
      code === "AI_UNAVAILABLE"
        ? t("forms.strip.translateUnavailable")
        : t("forms.strip.translateFailed"),
      { description: extractErrorMessage(error) },
    );
  };

  /**
   * Translate form CONTENT into one or more locales and merge the result into
   * the local draft. Nothing is persisted — the user reviews, then saves.
   */
  const runContentTranslate = (targets: FormLocale[], overwrite: boolean) => {
    if (!definition || targets.length === 0) return;

    const items: TranslateFormRequest["items"] = {};
    const payloadTargets: TranslateFormRequest["targets"] = [];

    for (const target of targets) {
      const built = buildTranslateItems(definition, defaultLocale, target, {
        onlyEmpty: !overwrite,
      });
      if (built.keys.length === 0) continue;
      Object.assign(items, built.items);
      payloadTargets.push({ locale: target, keys: built.keys });
    }

    if (payloadTargets.length === 0) {
      toast.info(t("forms.strip.allTranslated"));
      return;
    }

    const inFlight = payloadTargets.map((target) => target.locale);
    bumpTranslating(inFlight, 1);

    translateMutation.mutate(
      { source_locale: defaultLocale, items, targets: payloadTargets },
      {
        onSuccess: (response) => {
          patchDefinitionFn((current) => {
            let next = current;
            for (const result of response.results) {
              if (!result.ok) continue;
              next = mergeTranslations(next, result.locale, result.values);
            }
            return next;
          });
          reportTranslateOutcome(response);
        },
        onError: reportTranslateError,
        onSettled: () => bumpTranslating(inFlight, -1),
      },
    );
  };

  /** Same, for the confirmation e-mail's subject + HTML body. */
  const runEmailTranslate = (targets: FormLocale[], overwrite: boolean) => {
    const source = confirmationEmail?.by_locale?.[defaultLocale];
    if (!source?.subject && !source?.html) {
      toast.info(t("forms.strip.allTranslated"));
      return;
    }

    const items: TranslateFormRequest["items"] = {};
    if (source.subject) items[EMAIL_SUBJECT_KEY] = { value: source.subject };
    if (source.html) {
      items[EMAIL_BODY_KEY] = { value: source.html, format: "html" };
    }

    const payloadTargets: TranslateFormRequest["targets"] = [];
    for (const target of targets) {
      const existing = confirmationEmail?.by_locale?.[target];
      const keys = Object.keys(items).filter((key) => {
        if (overwrite) return true;
        const current =
          key === EMAIL_SUBJECT_KEY ? existing?.subject : existing?.html;
        return (current ?? "").trim() === "";
      });
      if (keys.length > 0) payloadTargets.push({ locale: target, keys });
    }

    if (payloadTargets.length === 0) {
      toast.info(t("forms.strip.allTranslated"));
      return;
    }

    const inFlight = payloadTargets.map((target) => target.locale);
    bumpTranslating(inFlight, 1);

    translateMutation.mutate(
      { source_locale: defaultLocale, items, targets: payloadTargets },
      {
        onError: reportTranslateError,
        onSettled: () => bumpTranslating(inFlight, -1),
        onSuccess: (response) => {
          const base: FormConfirmationEmail = confirmationEmail ?? {
            enabled: false,
            email_account_id: null,
            by_locale: {},
          };
          const byLocale = { ...base.by_locale };

          for (const result of response.results) {
            if (!result.ok) continue;
            const current = byLocale[result.locale] ?? {
              subject: "",
              html: "",
            };
            byLocale[result.locale] = {
              subject: result.values[EMAIL_SUBJECT_KEY] ?? current.subject,
              html: result.values[EMAIL_BODY_KEY] ?? current.html,
            };
          }

          setConfirmationEmail({ ...base, by_locale: byLocale });
          setEmailDirty(true);
          reportTranslateOutcome(response);
        },
      },
    );
  };

  const reportTranslateOutcome = (response: TranslateFormResponse) => {
    const failed = response.results.filter((r) => !r.ok);
    if (failed.length === 0) {
      toast.success(t("forms.strip.translateDone"));
      return;
    }
    toast.warning(
      t("forms.strip.translatePartial", {
        locales: failed.map((r) => r.locale.toUpperCase()).join(", "),
      }),
    );
  };

  // --- languages -----------------------------------------------------------

  /**
   * Adding a language is one click, so it has to arrive usable: fire the AI
   * translate immediately. If AI is not configured or the model fails, fall
   * back to copying the default text — the new language is at least filled and
   * therefore valid — and say "copied", because copied and translated are very
   * different things to ship to a visitor.
   */
  const autoTranslateNew = (locale: FormLocale, source: FormDefinition) => {
    const built = buildTranslateItems(source, defaultLocale, locale, {
      onlyEmpty: true,
    });
    if (built.keys.length === 0) return; // default locale is itself empty

    const fallbackCopy = () => {
      patchDefinitionFn((current) =>
        copyFromDefault(current, locale, defaultLocale),
      );
      toast.warning(
        t("forms.strip.copiedInstead", { locale: locale.toUpperCase() }),
      );
    };

    bumpTranslating([locale], 1);
    translateMutation.mutate(
      {
        source_locale: defaultLocale,
        items: built.items,
        targets: [{ locale, keys: built.keys }],
      },
      {
        onSuccess: (response) => {
          const result = response.results.find((r) => r.locale === locale);
          if (result?.ok) {
            patchDefinitionFn((current) =>
              mergeTranslations(current, locale, result.values),
            );
            toast.success(
              t("forms.strip.translatedNew", { locale: locale.toUpperCase() }),
            );
          } else {
            fallbackCopy();
          }
        },
        onError: fallbackCopy,
        onSettled: () => bumpTranslating([locale], -1),
      },
    );
  };

  const addLocale = (locale: FormLocale) => {
    if (!definition || locales.includes(locale)) return;
    setLocales([...locales, locale]);
    setDirty(true);
    setEditingLocale(locale); // Customer.io drops you into the new tab
    autoTranslateNew(locale, definition);
  };

  const removeLocale = (locale: FormLocale) => {
    if (locale === defaultLocale) return; // the UI already hides this
    setLocales(locales.filter((l) => l !== locale));
    if (editingLocale === locale) setEditingLocale(defaultLocale);
    setDirty(true);
    // definition.content[locale] is deliberately KEPT: re-adding the language
    // restores the work, and the public switcher reads `locales`, not `content`.
  };

  const makeDefaultLocale = (next: FormLocale) => {
    if (!definition || next === defaultLocale) return;
    // Seed the incoming default from the outgoing one, or every label is
    // instantly "missing" in the new default and a live form becomes unsaveable.
    patchDefinition(copyFromDefault(definition, next, defaultLocale));
    setDefaultLocale(next);
    setEditingLocale(next);
    if (!locales.includes(next)) setLocales([...locales, next]);
    setDirty(true);
    toast.success(t("forms.strip.defaultLocaleSeeded"));
  };

  const translateLocale = (locale: FormLocale, overwrite: boolean) => {
    runContentTranslate([locale], overwrite);
    const source = confirmationEmail?.by_locale?.[defaultLocale];
    if (source?.subject || source?.html) runEmailTranslate([locale], overwrite);
  };

  // --- derived state -------------------------------------------------------

  // Computed from the LOCAL draft, not from form.issues, so badges and the
  // banner track what you are typing instead of the last server response.
  const issues = useMemo(
    // `locales` in the deps is load-bearing: without it, adding a language
    // would not re-validate and the strip would show no dot while publish
    // failed server-side with an error the UI never predicted.
    () =>
      definition ? validateDefinition(definition, defaultLocale, locales) : [],
    [definition, defaultLocale, locales],
  );
  /** Gates publish and live-save: EVERY language counts. */
  const hasIssues = issues.length > 0;

  /**
   * What the tab badges and the banner show: language-agnostic issues, which
   * are always actionable, plus the ones for the language you are editing.
   * "field X has no label in FR" while you are typing in DE is noise you cannot
   * act on without switching tabs — the strip is where that belongs.
   */
  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (i) => i.locale === undefined || i.locale === editingLocale,
      ),
    [issues, editingLocale],
  );

  const issuesByTab = useMemo(
    () => ({
      build: visibleIssues.filter((i) => i.tab === "build").length,
      design: visibleIssues.filter((i) => i.tab === "design").length,
    }),
    [visibleIssues],
  );

  /** Locale-scoped only — drives the red dots in the language strip. */
  const issuesByLocale = useMemo(() => {
    const map = new Map<FormLocale, number>();
    for (const locale of locales) map.set(locale, 0);
    for (const issue of issues) {
      if (!issue.locale) continue;
      map.set(issue.locale, (map.get(issue.locale) ?? 0) + 1);
    }
    return map;
  }, [issues, locales]);

  const otherLocalesWithIssues = useMemo(
    () =>
      locales.filter(
        (l) => l !== editingLocale && (issuesByLocale.get(l) ?? 0) > 0,
      ),
    [locales, editingLocale, issuesByLocale],
  );

  const isLive = form?.status === "published";
  const busy =
    saveMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending;

  const saveTooltip = !dirty
    ? t("forms.builder.saveTipNoChanges")
    : isLive && hasIssues
      ? t("forms.builder.saveTipLiveInvalid", { count: issues.length })
      : isLive
        ? t("forms.builder.saveTipUpdatesLive")
        : t("forms.builder.save");

  const liveTooltip = isLive
    ? dirty
      ? `${t("forms.builder.liveTipTakeOffline")} ${t("forms.builder.liveTipKeepsEdits")}`
      : t("forms.builder.liveTipTakeOffline")
    : hasIssues
      ? t("forms.builder.liveTipBlocked", { count: issues.length })
      : dirty
        ? t("forms.builder.liveTipGoLiveSaves")
        : t("forms.builder.liveTipGoLive");

  /**
   * The strip's issue pill. When every remaining issue belongs to some OTHER
   * language the banner is not rendered at all, so jump to that language first
   * and scroll on the next frame once it exists.
   */
  const focusIssues = () => {
    if (visibleIssues.length === 0 && otherLocalesWithIssues.length > 0) {
      setEditingLocale(otherLocalesWithIssues[0]);
      requestAnimationFrame(() =>
        bannerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      return;
    }
    bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // --- field editing -------------------------------------------------------

  const fields = useMemo(
    () => (definition ? flattenFields(definition) : []),
    [definition],
  );
  const selectedField =
    fields.find((f) => f.id === selectedFieldId(selection)) ?? null;

  /** What the inspector edits: a field, the form header, or the submit button. */
  const inspectorTarget: InspectorTarget | null =
    selection?.kind === "header"
      ? {
          kind: "header",
          showFormTitle: definition?.theme.showFormTitle ?? true,
        }
      : selection?.kind === "submit"
        ? { kind: "submit" }
        : selectedField
          ? { kind: "field", field: selectedField }
          : null;

  const mapFields = (fn: (field: FormField) => FormField | null) => {
    if (!definition) return;
    patchDefinition({
      ...definition,
      sections: definition.sections.map((section) => ({
        ...section,
        fields: section.fields
          .map(fn)
          .filter((f): f is FormField => f !== null),
      })),
    });
  };

  const addField = (type: FormFieldType) => {
    if (!definition) return;
    const taken = new Set(fields.map((f) => f.key));
    const field = createField(type, taken);

    const sections = definition.sections.length
      ? definition.sections
      : [{ id: newId("s"), fields: [] }];
    const lastIndex = sections.length - 1;

    patchDefinition({
      ...definition,
      sections: sections.map((section, i) =>
        i === lastIndex
          ? { ...section, fields: [...section.fields, field] }
          : section,
      ),
    });
    setSelection({ kind: "field", fieldId: field.id });
  };

  const duplicateField = (fieldId: string) => {
    if (!definition) return;
    const source = fields.find((f) => f.id === fieldId);
    if (!source) return;

    const taken = new Set(fields.map((f) => f.key));
    let key = `${source.key}_copy`;
    let n = 2;
    while (taken.has(key)) key = `${source.key}_copy_${n++}`;

    // A copy cannot keep the mapping — a lead column can only be filled once.
    const copy: FormField = {
      ...source,
      id: newId("f"),
      key,
      mapping: null,
      options: source.options?.map((o) => ({ ...o, id: newId("o") })),
    };

    // Carry the labels across so the copy is not a blank row.
    const content = { ...definition.content };
    for (const [locale, strings] of Object.entries(content)) {
      if (!strings) continue;
      const next = { ...strings };
      for (const [k, v] of Object.entries(strings)) {
        if (k.startsWith(`field.${source.id}.`)) {
          next[k.replace(`field.${source.id}.`, `field.${copy.id}.`)] = v;
        }
      }
      content[locale as FormLocale] = next;
    }

    patchDefinition({
      ...definition,
      content,
      sections: definition.sections.map((section) => {
        const index = section.fields.findIndex((f) => f.id === fieldId);
        if (index < 0) return section;
        const nextFields = [...section.fields];
        nextFields.splice(index + 1, 0, copy);
        return { ...section, fields: nextFields };
      }),
    });
    setSelection({ kind: "field", fieldId: copy.id });
  };

  const deleteField = (fieldId: string) => {
    mapFields((f) => (f.id === fieldId ? null : f));
    if (selectedFieldId(selection) === fieldId) setSelection(null);
  };

  const reorderFields = (orderedIds: string[]) => {
    if (!definition) return;
    const byId = new Map(fields.map((f) => [f.id, f]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((f): f is FormField => !!f);

    // Reorder is flat across the whole form, so it collapses into one section.
    // Sections remain a grouping device for headings, not for ordering.
    patchDefinition({
      ...definition,
      sections: [
        { id: definition.sections[0]?.id ?? newId("s"), fields: ordered },
      ],
    });
  };

  const setText = (key: string, value: string) => {
    if (!definition) return;
    patchDefinition({
      ...definition,
      content: {
        ...definition.content,
        [editingLocale]: {
          ...(definition.content?.[editingLocale] ?? {}),
          [key]: value,
        },
      },
    });
  };

  // --- render --------------------------------------------------------------

  if (isLoading || !definition || !form) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 pb-10! pt-4! sm:p-6 sm:pt-6!">
        <Skeleton className="h-[7.5rem] w-full rounded-2xl" />
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="hidden h-96 rounded-2xl xl:block" />
        </div>
      </div>
    );
  }

  const activeFieldId = selectedFieldId(selection);
  const otherKeys = new Set(
    fields.filter((f) => f.id !== activeFieldId).map((f) => f.key),
  );
  const otherMappings = new Set(
    fields
      .filter((f) => f.id !== activeFieldId && f.mapping)
      .map((f) => f.mapping as string),
  );

  return (
    <div
      className="mx-auto w-full max-w-[1280px] space-y-5 p-4 pb-10! pt-0! sm:p-6 sm:pb-14! sm:pt-0! app-fade-in"
      // One constant, two consumers: the sticky inspector and the sticky Design
      // preview both offset by it so they clear the command bar instead of
      // sliding under it. Roughly bar height + the sticky wrapper's padding.
      style={{ "--fb-stick": "10.5rem" } as React.CSSProperties}
    >
      <UnsavedChangesGuard when={canEdit && (dirty || emailDirty)} />

      {/* The command bar. Dark chrome around light content is the app's
          signature (shell #0f0f11, sidebar #111113) — the builder extends it
          one level in so the form canvas below becomes the bright object.
          Bleeds the page padding, or the sticky element leaves a transparent
          gutter as content scrolls under it. */}
      <div className="app-fade-down sticky top-0 z-30 -mx-4 bg-background/80 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                to="/forms"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35 transition-colors hover:text-white/70"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("forms.builder.back")}
              </Link>

              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                <Input
                  value={name}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                  className="h-9 w-full max-w-sm rounded-lg border-transparent bg-transparent px-0 text-[22px] font-semibold tracking-tight text-white shadow-none selection:bg-white/20 focus-visible:border-white/10 focus-visible:bg-white/5 focus-visible:px-2.5 disabled:opacity-100"
                />
                <FormStatusBadge
                  tone="dark"
                  status={form.status}
                  hasUnpublishedChanges={form.has_unpublished_changes || dirty}
                />
              </div>

              <p className="mt-0.5 truncate font-mono text-[11px] text-white/35">
                {form.slug}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isLive ? (
                <a
                  href={buildPublicFormUrl(form.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t("forms.share.open")}
                </a>
              ) : null}

              {canEdit ? (
                // This ui/tooltip does not wrap its own provider, and nothing
                // else in the app mounts one — so scope it here rather than
                // adding a global provider to root.tsx for two tooltips.
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A disabled button has pointer-events:none, so the
                          tooltip has to hang off a wrapper or it never fires —
                          and the disabled state is exactly when the explanation
                          matters. */}
                      <span tabIndex={0}>
                        <button
                          type="button"
                          disabled={!dirty || busy || (isLive && hasIssues)}
                          onClick={() => saveMutation.mutate()}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#131515] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Save className="h-4 w-4" />
                          {saveMutation.isPending
                            ? t("forms.builder.saving")
                            : t("forms.builder.save")}
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{saveTooltip}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3"
                      >
                        <Globe
                          className={`h-3.5 w-3.5 ${isLive ? "text-emerald-400" : "text-white/40"}`}
                          aria-hidden="true"
                        />
                        <Label
                          htmlFor="form-live-toggle"
                          className="cursor-pointer text-sm font-medium text-white/70"
                        >
                          {t("forms.builder.liveToggle")}
                        </Label>
                        <Switch
                          id="form-live-toggle"
                          checked={isLive}
                          disabled={busy || (!isLive && hasIssues)}
                          onCheckedChange={(next) =>
                            next
                              ? publishMutation.mutate()
                              : unpublishMutation.mutate()
                          }
                          aria-label={t("forms.builder.liveToggle")}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{liveTooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/5 px-4 py-2 sm:px-5">
            <LanguageStrip
              locales={locales}
              defaultLocale={defaultLocale}
              activeLocale={editingLocale}
              onSelect={setEditingLocale}
              issuesByLocale={issuesByLocale}
              totalIssues={issues.length}
              onFocusIssues={focusIssues}
              translating={translating}
              disabled={!canEdit}
              onAddLocale={addLocale}
              onRemoveLocale={removeLocale}
              onMakeDefault={makeDefaultLocale}
              onTranslateLocale={translateLocale}
            />
          </div>
        </div>
      </div>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          {t("forms.builder.readOnly")}
        </p>
      ) : null}

      {visibleIssues.length > 0 || otherLocalesWithIssues.length > 0 ? (
        <div
          ref={bannerRef}
          className="app-fade-up flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="space-y-1 pt-0.5">
            <p className="font-medium">
              {isLive
                ? t("forms.validation.cannotSaveLive")
                : t("forms.validation.cannotPublish")}
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {visibleIssues.map((issue, index) => (
                <li
                  key={`${issue.code}:${issue.locale ?? ""}:${issue.fieldId ?? issue.contentKey ?? index}`}
                >
                  {describeIssue(issue, t, defaultLocale)}
                </li>
              ))}
            </ul>

            {/* Other languages are a jump target, not a dead end. */}
            {otherLocalesWithIssues.length > 0 ? (
              <p className="pt-0.5">
                {t("forms.validation.otherLocales", {
                  count: otherLocalesWithIssues.reduce(
                    (sum, l) => sum + (issuesByLocale.get(l) ?? 0),
                    0,
                  ),
                })}{" "}
                {otherLocalesWithIssues.map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setEditingLocale(locale)}
                    className="mr-1 rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-xs uppercase underline-offset-2 hover:underline"
                  >
                    {locale}
                  </button>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        {/* The `line` variant only underlines the active trigger, so without a
            wrapper rule the tab strip floats with no baseline. */}
        <div className="app-fade-up app-fade-up-d1 border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger value="build">
              {t("forms.builder.tabBuild")}
              <IssueBadge count={issuesByTab.build} />
            </TabsTrigger>
            <TabsTrigger value="design">
              {t("forms.builder.tabDesign")}
              <IssueBadge count={issuesByTab.design} />
            </TabsTrigger>
            {hasEmailConfig ? (
              <TabsTrigger value="email">
                {t("forms.builder.tabEmail")}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="share">
              {t("forms.builder.tabShare")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="build" className="pt-5">
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
            <aside className="app-fade-up app-fade-up-d1 order-2 lg:order-1">
              <FieldPalette onAdd={addField} disabled={!canEdit} />
            </aside>

            <div className="app-fade-up app-fade-up-d2 order-1 min-w-0 lg:order-2">
              <FormCanvas
                definition={definition}
                locale={editingLocale}
                fallbackLocale={defaultLocale}
                selection={selection}
                onSelect={setSelection}
                onReorder={reorderFields}
                onDuplicateField={duplicateField}
                onDeleteField={deleteField}
                disabled={!canEdit}
              />
            </div>

            <aside className="app-fade-up app-fade-up-d3 order-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[var(--fb-stick)] xl:self-start">
              <FieldInspector
                target={inspectorTarget}
                otherKeys={otherKeys}
                otherMappings={otherMappings}
                disabled={!canEdit}
                getText={(key) => getRawContent(definition, editingLocale, key)}
                setText={setText}
                onChange={(patch) =>
                  mapFields((f) =>
                    f.id === activeFieldId ? { ...f, ...patch } : f,
                  )
                }
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="design" className="app-fade-up pt-5">
          <ThemePanel
            definition={definition}
            locale={editingLocale}
            fallbackLocale={defaultLocale}
            disabled={!canEdit}
            getText={(key) => getRawContent(definition, editingLocale, key)}
            setText={setText}
            onChange={(patch) => patchDefinition({ ...definition, ...patch })}
          />
        </TabsContent>

        {hasEmailConfig ? (
          <TabsContent value="email" className="app-fade-up pt-5">
            <ConfirmationEmailPanel
              definition={definition}
              locales={locales}
              defaultLocale={defaultLocale}
              value={confirmationEmail}
              locale={editingLocale}
              disabled={!canEdit}
              // The Save used to hang on the page background below the card
              // with no footer or toolbar; it lives in the panel header now.
              onSave={canEdit ? () => emailMutation.mutate() : undefined}
              saveDisabled={!emailDirty || emailMutation.isPending}
              onChange={(next) => {
                setConfirmationEmail(next);
                setEmailDirty(true);
              }}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="share" className="app-fade-up pt-5">
          <SharePanel
            formId={form.id}
            status={form.status}
            hasUnpublishedChanges={form.has_unpublished_changes || dirty}
            defaultLocale={defaultLocale}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Red count on a tab, so a problem is findable instead of hidden in a banner. */
function IssueBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-white">
      {count}
    </span>
  );
}

/** Name the offending field — "a choice field has no options" is unactionable. */
function describeIssue(
  issue: FormDefinitionIssue,
  t: TFunction,
  defaultLocale: FormLocale,
): string {
  // missingContent FIRST — it carries a fieldKey too, and the generic
  // fieldKey branch below would otherwise swallow it and drop the locale.
  if (issue.code === "missingContent") {
    const locale = (issue.locale ?? defaultLocale).toUpperCase();
    if (issue.contentKey === "form.submit") {
      return t("forms.validation.missingSubmit", { locale });
    }
    return t("forms.validation.field.missingContentLocale", {
      field: issue.fieldKey,
      locale,
    });
  }
  if (issue.fieldKey) {
    return t(`forms.validation.field.${issue.code}`, {
      field: issue.fieldKey,
      defaultValue: t(`forms.validation.${issue.code}`),
    });
  }
  return t(`forms.validation.${issue.code}`);
}
