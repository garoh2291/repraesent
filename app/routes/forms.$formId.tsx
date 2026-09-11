import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  Globe,
  Loader2,
  Save,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { listEmailAccounts } from "~/lib/api/workspaces";
import { ConfirmationEmailPanel } from "~/components/forms/ConfirmationEmailPanel";
import { FieldInspector } from "~/components/forms/FieldInspector";
import { FieldPalette } from "~/components/forms/FieldPalette";
import { IntakeSetupPanel } from "~/components/forms/IntakeSetupPanel";
import { FormCanvas } from "~/components/forms/FormCanvas";
import { LanguageStrip } from "~/components/forms/LanguageStrip";
import { FormStatusBadge } from "~/components/forms/FormStatusBadge";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { AfterSubmitPanel } from "~/components/forms/AfterSubmitPanel";
import { ErrorMessagesPanel } from "~/components/forms/ErrorMessagesPanel";
import { SharePanel } from "~/components/forms/SharePanel";
import { ThemePanel } from "~/components/forms/ThemePanel";
import { DealPanel } from "~/components/forms/DealPanel";
import { WebhooksPanel } from "~/components/forms/webhooks/WebhooksPanel";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { verifyFormCommerce } from "~/lib/api/forms";
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
  seedRuntimeContent,
} from "~/lib/forms/content";
import {
  type BuilderSelection,
  type InspectorTarget,
  selectedFieldId,
} from "~/lib/forms/selection";
import {
  ADDRESS_GROUP,
  createField,
  createFieldGroup,
  newId,
  normalizeDefinition,
} from "~/lib/forms/field-types";
import {
  DEFAULT_FORM_COMMERCE,
  DEFAULT_FORM_LAYOUT,
  STEP_CONTENT_KEYS,
  contentKey,
  defaultStepTitle,
  flattenFields,
  isMultiStep,
  type FormConfirmationEmail,
  type FormDefinition,
  type FormDefinitionIssue,
  type FormField,
  type FormFieldType,
  type FormLocale,
  type FormSection,
} from "~/lib/forms/schema";
import { validateDefinition } from "~/lib/forms/validate";
import { useAuthContext } from "~/providers/auth-provider";
import { useCanEditForms } from "~/lib/hooks/useCanEditForms";
import { useFormDefinition } from "~/lib/hooks/useForms";

export default function FormBuilderRoute() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditForms();
  const { currentWorkspace } = useAuthContext();

  const { data: form, isLoading } = useFormDefinition(formId);

  // Confirmation emails need something to send from. That used to mean the
  // admin-provisioned email-config service and nothing else, which hid this
  // whole tab from any workspace whose users had connected their own mailbox.
  // Mirrors the backend gate in `leads.service.ts`.
  const hasLegacyEmailService =
    currentWorkspace?.services?.some(
      (s) =>
        s.service_type === "email-config" || s.service_slug === "email-config",
    ) ?? false;

  const { data: emailAccounts, isPending: emailAccountsPending } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccounts,
    enabled: !!currentWorkspace,
  });

  const isIntake = form?.kind === "intake";

  const hasEmailConfig =
    hasLegacyEmailService || (emailAccounts?.length ?? 0) > 0;

  // --- local draft ---------------------------------------------------------
  // The builder edits a local copy and saves explicitly. The hydration effect
  // below is keyed on the form ID alone, so a refetch — on mount or after a
  // mutation — never yanks the draft out from under an in-progress edit.
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [locales, setLocales] = useState<FormLocale[]>([]);
  const [defaultLocale, setDefaultLocale] = useState<FormLocale>("de");
  const [confirmationEmail, setConfirmationEmail] =
    useState<FormConfirmationEmail | null>(null);
  const [editingLocale, setEditingLocale] = useState<FormLocale>("de");
  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  // `?tab=` lets the create dialog land a product form on its Products tab.
  const [tab, setTab] = useState(() => {
    const wanted = searchParams.get("tab");
    return wanted && BUILDER_TABS.includes(wanted) ? wanted : "build";
  });
  /** Multi-step: the step the Build canvas shows. Builder UI state, never saved. */
  const [activeStep, setActiveStep] = useState(0);
  const [pendingStepDelete, setPendingStepDelete] = useState<string | null>(
    null,
  );
  /**
   * Stripe-side bundle checks (archived price, disconnected account) — the
   * server appends these at publish, so the builder asks for them too.
   * Keyed by the bundle's price ids: re-checked when a line is added or
   * removed, not on every keystroke.
   */
  const bundleKey = (definition?.commerce?.items ?? [])
    .map((i) => i.priceId)
    .join(",");
  const commerceVerify = useQuery({
    queryKey: ["form-commerce-verify", formId, bundleKey],
    queryFn: () => verifyFormCommerce(formId!),
    enabled: !!formId && form?.kind === "product",
    staleTime: 30_000,
    retry: false,
  });
  const commerceIssues = useMemo<FormDefinitionIssue[]>(
    () => commerceVerify.data ?? [],
    [commerceVerify.data],
  );
  const archivedPriceIds = useMemo(
    () =>
      new Set(
        commerceIssues
          .filter((i) => i.code === "commerceInactivePrice" && i.priceId)
          .map((i) => i.priceId as string),
      ),
    [commerceIssues],
  );
  const [mergeOpen, setMergeOpen] = useState(false);
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
    setDefinition(
      normalizeDefinition(form.definition, form.default_locale, form.kind),
    );
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
    if (
      form?.kind === "product" &&
      (tab === "afterSubmit" || tab === "products")
    ) {
      setTab("build");
    }
    // The mirror case: only product forms have a checkout to build a deal from.
    if (form && form.kind !== "product" && tab === "deal") {
      setTab("build");
    }
    // An intake form has no canvas, so Build is not a place it can land.
    if (form?.kind === "intake" && tab !== "webhooks" && tab !== "share") {
      if (tab !== "setup") setTab("setup");
    }
    if (form && form.kind !== "intake" && tab === "setup") {
      setTab("build");
    }
  }, [tab, form, form?.kind]);

  useEffect(() => {
    // Wait for the account list before bouncing — otherwise deep-linking to
    // ?tab=email kicks you to Build during the first fetch, even when the
    // workspace does have an account.
    if (emailAccountsPending) return;
    if (tab === "email" && !hasEmailConfig) setTab("build");
  }, [tab, hasEmailConfig, emailAccountsPending]);

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

  /** Set by the Save button so onSuccess can tell a press from a timer. */
  const manualSave = useRef(false);

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
    // The webhook payload keys are derived from the draft's fields.
    await queryClient.invalidateQueries({
      queryKey: ["form-webhook-payload-keys", formId],
    });
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
      // Autosave stays quiet. A toast every time you stop typing is noise, and
      // the button already reads "Saved" — pressing Save yourself is the one
      // case that deserves an acknowledgement.
      if (manualSave.current) toast.success(t("forms.builder.saved"));
      manualSave.current = false;
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
      // Same ordering as autosave: publish validates against the STORED
      // confirmation e-mail, so an unsaved one has to land first.
      if (emailDirty) await emailMutation.mutateAsync();
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
  //
  // EVERY caller uses mutateAsync, never mutate-with-callbacks. Adding a
  // language and "Translate with AI" both fire TWO requests through this one
  // instance — form content and the confirmation e-mail. A second mutate()
  // swaps the observer's current mutation, and the FIRST call's onSuccess and
  // onSettled are then never invoked. The spinner is ref-counted on onSettled,
  // so the count never returned to zero: the language span spun forever, the
  // strip stayed locked, and Save stayed disabled because `busy` includes
  // `translating.size > 0`.
  //
  // mutateAsync resolves the promise the caller is holding, so the bookkeeping
  // runs in that caller's own closure and cannot be dropped.
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

    void (async () => {
      try {
        const response = await translateMutation.mutateAsync({
          source_locale: defaultLocale,
          items,
          targets: payloadTargets,
        });
        patchDefinitionFn((current) => {
          let next = current;
          for (const result of response.results) {
            if (!result.ok) continue;
            next = mergeTranslations(next, result.locale, result.values);
          }
          return next;
        });
        reportTranslateOutcome(response);
      } catch (error) {
        reportTranslateError(error);
      } finally {
        bumpTranslating(inFlight, -1);
      }
    })();
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

    void (async () => {
      try {
        const response = await translateMutation.mutateAsync({
          source_locale: defaultLocale,
          items,
          targets: payloadTargets,
        });

        // Functional update: the content translation running alongside this one
        // may have re-rendered since, and the `confirmationEmail` captured when
        // this closure was created would be stale.
        setConfirmationEmail((prev) => {
          const base: FormConfirmationEmail = prev ?? {
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

          return { ...base, by_locale: byLocale };
        });
        setEmailDirty(true);
        reportTranslateOutcome(response);
      } catch (error) {
        reportTranslateError(error);
      } finally {
        bumpTranslating(inFlight, -1);
      }
    })();
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

    void (async () => {
      try {
        const response = await translateMutation.mutateAsync({
          source_locale: defaultLocale,
          items: built.items,
          targets: [{ locale, keys: built.keys }],
        });
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
      } catch {
        fallbackCopy();
      } finally {
        bumpTranslating([locale], -1);
      }
    })();
  };

  const addLocale = (locale: FormLocale) => {
    if (!definition || locales.includes(locale)) return;
    setLocales([...locales, locale]);
    setDirty(true);
    setEditingLocale(locale); // Customer.io drops you into the new tab
    autoTranslateNew(locale, definition);

    // The confirmation e-mail is a separate blob with a separate endpoint, so
    // it does not ride along with the definition translation above. Adding a
    // language used to leave its subject and body blank — which, now that both
    // are required when the e-mail is enabled, would immediately block publish
    // on a language the operator had only just added.
    //
    // `overwrite: false`, so this only ever fills the blanks it just created.
    if (confirmationEmail?.enabled) {
      const source = confirmationEmail.by_locale?.[defaultLocale];
      if (source?.subject || source?.html) {
        runEmailTranslate([locale], false);
      }
    }
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
  /**
   * The REAL verdict, unfiltered. This is what gates saving and publishing, and
   * it has to agree with the server's answer — the server validates the whole
   * form and knows nothing about what the builder is busy doing.
   */
  const issues = useMemo(
    () =>
      // `locales` in the deps is load-bearing: without it, adding a language
      // would not re-validate and the strip would show no dot while publish
      // failed server-side with an error the UI never predicted.
      definition
        ? validateDefinition(
            definition,
            defaultLocale,
            locales,
            // The confirmation e-mail lives in its own column and its own bit
            // of state, so it has to be handed in or the builder would show a
            // clean form while publish rejected it server-side.
            confirmationEmail,
            // An intake form is a URL, not a page — the same rule the server
            // applies. Without the kind the builder demands an e-mail field on
            // a form that has no fields at all.
            form?.kind,
          )
        : [],
    [definition, defaultLocale, locales, confirmationEmail, form?.kind],
  );

  // Stripe-dependent checks come from the server; they block publish there too,
  // so they belong in the verdict, not just the banner.
  const allIssues = useMemo(
    () => (form?.kind === "product" ? [...issues, ...commerceIssues] : issues),
    [issues, commerceIssues, form?.kind],
  );
  const hasIssues = allIssues.length > 0;

  /**
   * The same list with in-flight translations hidden, for DISPLAY only.
   *
   * A locale being translated right now is not a locale with a problem: its
   * strings arrive when the AI call returns, and until then every one of them
   * reads as "missing content", so adding a language flashed a wall of errors
   * that cleared itself seconds later.
   *
   * Deliberately NOT folded into `issues` above. Doing that made the builder
   * believe a half-translated form was valid, so autosave fired on a live form
   * and the server — which does no such filtering — rejected it with "a live
   * form cannot be saved while it has blocking issues". Suppression is a
   * presentation decision and must never reach a gate.
   */
  const shownIssues = useMemo(
    () =>
      translating.size === 0
        ? allIssues
        : allIssues.filter(
            (i) => i.locale === undefined || !translating.has(i.locale),
          ),
    [allIssues, translating],
  );

  /**
   * What the tab badges and the banner show: language-agnostic issues, which
   * are always actionable, plus the ones for the language you are editing.
   * "field X has no label in FR" while you are typing in DE is noise you cannot
   * act on without switching tabs — the strip is where that belongs.
   */
  const visibleIssues = useMemo(
    () =>
      shownIssues.filter(
        (i) => i.locale === undefined || i.locale === editingLocale,
      ),
    [shownIssues, editingLocale],
  );

  /**
   * Fields the banner is complaining about, for the canvas to paint red.
   *
   * Built from `visibleIssues`, not `issues`, so the canvas agrees with the
   * banner: a label missing in French while you are editing German is not
   * something you can act on without switching language first, and colouring it
   * red would send you hunting for a problem that is not on screen.
   */
  const invalidFieldIds = useMemo(
    () =>
      new Set(
        visibleIssues
          .map((i) => i.fieldId)
          .filter((id): id is string => id != null),
      ),
    [visibleIssues],
  );

  const issuesByTab = useMemo(
    () => ({
      build: visibleIssues.filter((i) => i.tab === "build").length,
      // `invalidRedirect` is attributed to "design" by validateDefinition, which
      // is a byte-for-byte mirror of the backend validator and must not be
      // edited for a UI reshuffle. The redirect URL now lives under After
      // submission, so the badge is re-pointed here instead — otherwise the
      // count lands on a tab that no longer contains the offending field.
      design: visibleIssues.filter(
        (i) => i.tab === "design" && i.code !== "invalidRedirect",
      ).length,
      afterSubmit: visibleIssues.filter((i) => i.code === "invalidRedirect")
        .length,
      email: visibleIssues.filter((i) => i.tab === "email").length,
    }),
    [visibleIssues],
  );

  /** Per step: its own issues plus those of the fields it holds (step-rail dots). */
  const issuesBySection = useMemo(() => {
    const map = new Map<string, number>();
    if (!definition) return map;
    const owner = new Map<string, string>();
    for (const section of definition.sections) {
      map.set(section.id, 0);
      for (const field of section.fields) owner.set(field.id, section.id);
    }
    for (const issue of visibleIssues) {
      const sectionId =
        issue.sectionId ??
        (issue.fieldId ? owner.get(issue.fieldId) : undefined);
      if (sectionId) map.set(sectionId, (map.get(sectionId) ?? 0) + 1);
    }
    return map;
  }, [definition, visibleIssues]);

  /** Locale-scoped only — drives the red dots in the language strip. */
  const issuesByLocale = useMemo(() => {
    const map = new Map<FormLocale, number>();
    for (const locale of locales) map.set(locale, 0);
    for (const issue of shownIssues) {
      if (!issue.locale) continue;
      map.set(issue.locale, (map.get(issue.locale) ?? 0) + 1);
    }
    return map;
  }, [shownIssues, locales]);

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
    unpublishMutation.isPending ||
    // Translation counts as busy because `issues` deliberately ignores the
    // locales in flight. Without this you could publish during that window on
    // the strength of a validation result that is only clean because it is
    // waiting for the strings.
    translating.size > 0;

  const saveTooltip = !dirty
    ? t("forms.builder.saveTipNoChanges")
    : isLive && hasIssues
      ? t("forms.builder.saveTipLiveInvalid", { count: allIssues.length })
      : isLive
        ? t("forms.builder.saveTipUpdatesLive")
        : t("forms.builder.save");

  /**
   * Autosave.
   *
   * Same gate as the Save button, deliberately: `isLive && hasIssues` means the
   * draft would overwrite a PUBLISHED form with something that fails validation.
   * Saving that silently, on a timer, with no button press to blame, is strictly
   * worse than the old behaviour — so when the gate is shut autosave stops and
   * the button comes back as the only way through, tooltip and all.
   *
   * One timer, restarted on every keystroke, so a burst of typing is one write
   * rather than one per character.
   */
  const canAutosave =
    canEdit && (dirty || emailDirty) && !busy && !(isLive && hasIssues);

  useEffect(() => {
    if (!canAutosave) return;

    const id = window.setTimeout(() => {
      void (async () => {
        try {
          // The confirmation e-mail FIRST, and this order is load-bearing.
          //
          // It lives in its own column behind its own endpoint, but the server
          // validates a definition save against the e-mail it has STORED. After
          // adding a language, the builder holds a freshly translated German
          // e-mail that the server has never seen — so the client considered the
          // form valid, autosaved the definition, and the server rejected it
          // with "a live form cannot be saved while it has blocking issues".
          //
          // Saving the e-mail first makes the server's view match the one the
          // gate was evaluated against.
          if (emailDirty) await emailMutation.mutateAsync();
          if (dirty) await saveMutation.mutateAsync();
        } catch {
          // Both mutations report their own failures; this only stops an
          // unhandled rejection.
        }
      })();
    }, 1200);

    return () => window.clearTimeout(id);
    // The mutations are stable for the component's life; including them would
    // restart the timer on every render and nothing would ever save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canAutosave,
    definition,
    name,
    locales,
    defaultLocale,
    emailDirty,
    confirmationEmail,
  ]);

  /** What the Save button says. It is now a status readout you can still press. */
  const saveLabel = saveMutation.isPending
    ? t("forms.builder.savingAuto")
    : dirty
      ? t("forms.builder.save")
      : t("forms.builder.savedAuto");

  const liveTooltip = isLive
    ? dirty
      ? `${t("forms.builder.liveTipTakeOffline")} ${t("forms.builder.liveTipKeepsEdits")}`
      : t("forms.builder.liveTipTakeOffline")
    : hasIssues
      ? t("forms.builder.liveTipBlocked", { count: allIssues.length })
      : dirty
        ? t("forms.builder.liveTipGoLiveSaves")
        : t("forms.builder.liveTipGoLive");

  // --- field editing -------------------------------------------------------

  const fields = useMemo(
    () => (definition ? flattenFields(definition) : []),
    [definition],
  );
  const selectedField =
    fields.find((f) => f.id === selectedFieldId(selection)) ?? null;

  const multi = definition ? isMultiStep(definition) : false;
  const selectedStepIndex =
    selection?.kind === "step" && definition
      ? definition.sections.findIndex((s) => s.id === selection.stepId)
      : -1;

  /** What the inspector edits: a field, the header, the submit button, a step or the order summary. */
  const inspectorTarget: InspectorTarget | null =
    selection?.kind === "header"
      ? {
          kind: "header",
          showFormTitle: definition?.theme.showFormTitle ?? true,
        }
      : selection?.kind === "submit"
        ? { kind: "submit" }
        : selection?.kind === "step" && definition && selectedStepIndex >= 0
          ? {
              kind: "step",
              section: definition.sections[selectedStepIndex],
              index: selectedStepIndex,
              total: definition.sections.length,
            }
          : selectedField
            ? {
                kind: "field",
                field: selectedField,
                steps: multi ? definition?.sections : undefined,
                stepId: definition?.sections.find((s) =>
                  s.fields.some((f) => f.id === selectedField.id),
                )?.id,
              }
            : null;

  // Selecting a field that lives on another step (from the banner, say) has to
  // bring that step on screen, or the selection ring points at nothing.
  useEffect(() => {
    if (!definition || !multi || !selectedField) return;
    const index = definition.sections.findIndex((s) =>
      s.fields.some((f) => f.id === selectedField.id),
    );
    if (index >= 0 && index !== activeStep) setActiveStep(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField?.id]);

  // A deleted or merged step can leave the index past the end.
  useEffect(() => {
    if (!definition) return;
    const max = Math.max(definition.sections.length - 1, 0);
    if (activeStep > max) setActiveStep(max);
  }, [definition, activeStep]);

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

  /**
   * Append fields to the last section and select the first of them.
   *
   * `content` is merged rather than replaced so a group can arrive with its
   * labels already written; a single field passes nothing and lands blank,
   * which is fine now that a label is optional.
   */
  const appendFields = (
    added: FormField[],
    content?: FormDefinition["content"],
  ) => {
    if (!definition || added.length === 0) return;

    const sections = definition.sections.length
      ? definition.sections
      : [{ id: newId("s"), fields: [] }];
    // Multi-step: the step you are looking at. Single page: the end.
    const targetIndex = isMultiStep(definition)
      ? Math.min(activeStep, sections.length - 1)
      : sections.length - 1;

    patchDefinition({
      ...definition,
      sections: sections.map((section, i) =>
        i === targetIndex
          ? { ...section, fields: [...section.fields, ...added] }
          : section,
      ),
      ...(content ? { content } : {}),
    });
    setSelection({ kind: "field", fieldId: added[0].id });
  };

  const addField = (type: FormFieldType) => {
    if (!definition) return;
    const taken = new Set(fields.map((f) => f.key));

    // Address is a group, not a field: four ordinary fields, each with its own
    // label and Required. See ADDRESS_GROUP for why.
    if (type === "address") {
      const added = createFieldGroup(ADDRESS_GROUP, taken);
      const content = { ...definition.content };

      // Seeded in every enabled language, not just the one being edited — the
      // four names are already translated, so a French form has no reason to
      // open with English labels and a fresh batch of translate work.
      for (const locale of locales) {
        const strings = { ...(content[locale] ?? {}) };
        added.forEach((field, i) => {
          strings[contentKey.fieldLabel(field.id)] = t(
            ADDRESS_GROUP[i].labelKey,
            { lng: locale },
          );
        });
        content[locale] = strings;
      }

      appendFields(added, content);
      return;
    }

    // The slot picker's runtime strings (loading/empty states, slot-taken
    // error) live in the FORM's content, not the app's — embeds have no
    // i18next. Seed them in every enabled language the first time an
    // appointment field is added, same reasoning as the address labels above;
    // existing values are kept so a second field never overwrites edits.
    if (type === "appointment") {
      const APPT_CONTENT: Array<{ key: string; i18nKey: string }> = [
        {
          key: "appointment.loading",
          i18nKey: "forms.appointmentContent.loading",
        },
        { key: "appointment.empty", i18nKey: "forms.appointmentContent.empty" },
        {
          // Co-hosts only, but seeded for every appointment field: a form can
          // gain a second host later, and this string is what the visitor sees
          // instead of a false "no free times" when a host's calendar cannot
          // be read.
          key: "appointment.unavailable",
          i18nKey: "forms.appointmentContent.unavailable",
        },
        {
          key: "error.slot_unavailable",
          i18nKey: "forms.appointmentContent.slotUnavailable",
        },
        {
          key: "error.slot_invalid",
          i18nKey: "forms.appointmentContent.slotInvalid",
        },
      ];
      const content = { ...definition.content };
      for (const locale of locales) {
        const strings = { ...(content[locale] ?? {}) };
        for (const { key, i18nKey } of APPT_CONTENT) {
          if (!strings[key]) strings[key] = t(i18nKey, { lng: locale });
        }
        content[locale] = strings;
      }
      appendFields([createField(type, taken)], content);
      return;
    }

    appendFields([createField(type, taken)]);
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

  /**
   * Single-page reorder is flat across the whole form, so it collapses into one
   * section — sections are a grouping device for headings there, not an order.
   * Multi-step forms never reach this: their canvas reorders within a step.
   */
  const reorderFields = (orderedIds: string[]) => {
    if (!definition) return;
    const byId = new Map(fields.map((f) => [f.id, f]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((f): f is FormField => !!f);

    patchDefinition({
      ...definition,
      sections: [
        { id: definition.sections[0]?.id ?? newId("s"), fields: ordered },
      ],
    });
  };

  // --- steps ---------------------------------------------------------------

  const reorderInStep = (sectionId: string, orderedIds: string[]) => {
    if (!definition) return;
    patchDefinition({
      ...definition,
      sections: definition.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const byId = new Map(section.fields.map((f) => [f.id, f]));
        return {
          ...section,
          fields: orderedIds
            .map((id) => byId.get(id))
            .filter((f): f is FormField => !!f),
        };
      }),
    });
  };

  /** Send fields to another step in one patch; they keep their relative order. */
  const moveFieldsToStep = (fieldIds: string[], sectionId: string) => {
    if (!definition) return;
    const wanted = new Set(fieldIds);
    const moving = fields.filter((f) => wanted.has(f.id));
    if (moving.length === 0) return;
    patchDefinition({
      ...definition,
      sections: definition.sections.map((section) => {
        const without = section.fields.filter((f) => !wanted.has(f.id));
        if (section.id === sectionId) {
          return { ...section, fields: [...without, ...moving] };
        }
        return without.length === section.fields.length
          ? section
          : { ...section, fields: without };
      }),
    });
    const index = definition.sections.findIndex((s) => s.id === sectionId);
    if (index >= 0) setActiveStep(index);
  };
  const moveFieldToStep = (fieldId: string, sectionId: string) =>
    moveFieldsToStep([fieldId], sectionId);

  const reorderSteps = (orderedIds: string[]) => {
    if (!definition) return;
    const byId = new Map(definition.sections.map((s) => [s.id, s]));
    const activeId = definition.sections[activeStep]?.id;
    const sections = orderedIds
      .map((id) => byId.get(id))
      .filter((s): s is FormSection => !!s);
    patchDefinition({ ...definition, sections });
    const next = sections.findIndex((s) => s.id === activeId);
    if (next >= 0) setActiveStep(next);
  };

  const addStep = () => {
    if (!definition) return;
    const section: FormSection = { id: newId("s"), fields: [] };
    const index = Math.min(activeStep + 1, definition.sections.length);
    const sections = [...definition.sections];
    sections.splice(index, 0, section);
    // Every step gets a name of its own from the start — "Step 3" in each
    // language — because a titled step 1 next to an untitled step 2 reads as
    // the same page twice.
    const content = { ...definition.content };
    for (const l of locales) {
      content[l] = {
        ...(content[l] ?? {}),
        [contentKey.sectionTitle(section.id)]: defaultStepTitle(l, index + 1),
      };
    }
    patchDefinition({ ...definition, sections, content });
    setActiveStep(index);
    setSelection({ kind: "step", stepId: section.id });
  };

  const duplicateStep = (sectionId: string) => {
    if (!definition) return;
    const index = definition.sections.findIndex((s) => s.id === sectionId);
    const source = definition.sections[index];
    if (!source) return;
    const taken = new Set(fields.map((f) => f.key));
    const idMap = new Map<string, string>();
    const copyFields = source.fields.map((f) => {
      let key = `${f.key}_copy`;
      let n = 2;
      while (taken.has(key)) key = `${f.key}_copy_${n++}`;
      taken.add(key);
      const id = newId("f");
      idMap.set(f.id, id);
      return {
        ...f,
        id,
        key,
        // A lead column can only be filled once.
        mapping: null,
        options: f.options?.map((o) => ({ ...o, id: newId("o") })),
      };
    });
    const copy: FormSection = { id: newId("s"), fields: copyFields };

    // Carry the step's own title/description and every field label across.
    const content = { ...definition.content };
    for (const [locale, strings] of Object.entries(content)) {
      if (!strings) continue;
      const next = { ...strings };
      for (const [k, v] of Object.entries(strings)) {
        if (k.startsWith(`section.${source.id}.`)) {
          next[k.replace(`section.${source.id}.`, `section.${copy.id}.`)] = v;
        }
        for (const [oldId, newFieldId] of idMap) {
          if (k.startsWith(`field.${oldId}.`)) {
            next[k.replace(`field.${oldId}.`, `field.${newFieldId}.`)] = v;
          }
        }
      }
      content[locale as FormLocale] = next;
    }

    const sections = [...definition.sections];
    sections.splice(index + 1, 0, copy);
    patchDefinition({ ...definition, sections, content });
    setActiveStep(index + 1);
    setSelection({ kind: "step", stepId: copy.id });
  };

  /** Delete a step. `keepFields` moves its fields to the neighbouring step. */
  const deleteStep = (sectionId: string, keepFields: boolean) => {
    if (!definition || definition.sections.length <= 1) return;
    const index = definition.sections.findIndex((s) => s.id === sectionId);
    if (index < 0) return;
    const removed = definition.sections[index];
    const sections = definition.sections.filter((s) => s.id !== sectionId);
    if (keepFields && removed.fields.length) {
      const target = Math.max(index - 1, 0);
      sections[target] = {
        ...sections[target],
        fields: [...sections[target].fields, ...removed.fields],
      };
    }
    patchDefinition({ ...definition, sections });
    setActiveStep(Math.min(Math.max(index - 1, 0), sections.length - 1));
    if (selection?.kind === "step" && selection.stepId === sectionId) {
      setSelection(null);
    }
    if (
      !keepFields &&
      selectedFieldId(selection) &&
      removed.fields.some((f) => f.id === selectedFieldId(selection))
    ) {
      setSelection(null);
    }
    setPendingStepDelete(null);
  };

  const requestDeleteStep = (sectionId: string) => {
    if (!definition) return;
    const section = definition.sections.find((s) => s.id === sectionId);
    if (!section) return;
    // Nothing to lose — no dialog.
    if (section.fields.length === 0) deleteStep(sectionId, false);
    else setPendingStepDelete(sectionId);
  };

  /**
   * One page → steps. Nothing is lost: the one section becomes step 1 and the
   * Back / Next strings are seeded in every enabled language.
   */
  const splitIntoSteps = () => {
    if (!definition) return;
    const seeded = seedRuntimeContent(definition, locales, STEP_CONTENT_KEYS);
    const second: FormSection = { id: newId("s"), fields: [] };
    const sections =
      seeded.sections.length > 1
        ? seeded.sections
        : [...seeded.sections, second];
    // Name the steps where they have no name yet, in every language. The
    // header shows the current step's title, so step 1 inherits the form's
    // title (and description) — the visitor sees the same opening words.
    const content = { ...seeded.content };
    for (const l of locales) {
      const strings = { ...(content[l] ?? {}) };
      sections.forEach((section, i) => {
        const key = contentKey.sectionTitle(section.id);
        if ((strings[key] ?? "").trim() === "") {
          const formTitle = (strings[contentKey.formTitle()] ?? "").trim();
          strings[key] =
            i === 0 && formTitle
              ? formTitle
              : defaultStepTitle(
                  l,
                  i === 0 ? "contact" : i === 1 ? "details" : i + 1,
                );
        }
        if (i === 0) {
          const descKey = contentKey.sectionDescription(section.id);
          const formDesc = strings[contentKey.formDescription()] ?? "";
          if ((strings[descKey] ?? "").trim() === "" && formDesc.trim()) {
            strings[descKey] = formDesc;
          }
        }
      });
      content[l] = strings;
    }
    patchDefinition({
      ...seeded,
      sections,
      content,
      layout: { ...(seeded.layout ?? DEFAULT_FORM_LAYOUT), mode: "multi_step" },
    });
    setActiveStep(0);
  };

  /**
   * Steps → one page. Fields keep their order. Only the first step's title
   * survives: it becomes the form title (the header showed it while the form
   * was multi-step, so nothing the visitor saw first changes); the other
   * steps' titles are dropped rather than turned into headings.
   */
  const mergeSteps = () => {
    if (!definition) return;
    const merged: FormField[] = definition.sections.flatMap((s) => s.fields);
    const content = { ...definition.content };
    const first = definition.sections[0];
    for (const l of locales) {
      const strings = { ...(content[l] ?? {}) };
      const titleKey = contentKey.sectionTitle(first.id);
      const descKey = contentKey.sectionDescription(first.id);
      if ((strings[titleKey] ?? "").trim()) {
        strings[contentKey.formTitle()] = strings[titleKey];
      }
      if ((strings[descKey] ?? "").trim()) {
        strings[contentKey.formDescription()] = strings[descKey];
      }
      // A single-step section renders its own title under the header, which
      // would now repeat the form title — so the step keys are cleared.
      delete strings[titleKey];
      delete strings[descKey];
      content[l] = strings;
    }
    patchDefinition({
      ...definition,
      content,
      sections: [{ id: definition.sections[0].id, fields: merged }],
      layout: { ...(definition.layout ?? DEFAULT_FORM_LAYOUT), mode: "single" },
    });
    setActiveStep(0);
    setMergeOpen(false);
    if (selection?.kind === "step") setSelection(null);
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
    // Editing the default language re-translates that string into the other
    // languages once typing stops — the other way round it stays put, since
    // a translation is where a person writes exactly what a language needs.
    if (editingLocale === defaultLocale && locales.length > 1) {
      pendingSync.current.add(key);
      setSyncTick((n) => n + 1);
    }
  };

  // --- default-language edits follow into the other languages ---------------
  const pendingSync = useRef<Set<string>>(new Set());
  const syncInFlight = useRef(false);
  const [syncTick, setSyncTick] = useState(0);
  const [syncing, setSyncing] = useState<ReadonlySet<FormLocale>>(new Set());

  const runAutoSync = async () => {
    if (!definition || syncInFlight.current) return;
    const keys = [...pendingSync.current];
    pendingSync.current = new Set();
    const targets = locales.filter((l) => l !== defaultLocale);
    if (keys.length === 0 || targets.length === 0) return;

    const source = definition.content?.[defaultLocale] ?? {};
    const items: TranslateFormRequest["items"] = {};
    const clears: string[] = [];
    for (const key of keys) {
      const value = source[key] ?? "";
      if (value.trim() === "") clears.push(key);
      else items[key] = { value };
    }
    // An emptied string needs no translator: clear it everywhere.
    if (clears.length > 0) {
      patchDefinitionFn((current) => {
        const content = { ...current.content };
        for (const l of targets) {
          const strings = { ...(content[l] ?? {}) };
          for (const key of clears) delete strings[key];
          content[l] = strings;
        }
        return { ...current, content };
      });
    }
    const translateKeys = Object.keys(items);
    if (translateKeys.length === 0) return;

    syncInFlight.current = true;
    setSyncing(new Set(targets));
    try {
      const response = await translateMutation.mutateAsync({
        source_locale: defaultLocale,
        items,
        targets: targets.map((locale) => ({ locale, keys: translateKeys })),
      });
      patchDefinitionFn((current) => {
        let next = current;
        for (const result of response.results) {
          if (!result.ok) continue;
          next = mergeTranslations(next, result.locale, result.values);
        }
        return next;
      });
    } catch {
      // Put them back so the next edit sweeps them up with its own; a missing
      // AI key stays quiet here — the strip's own Translate action reports it.
      for (const key of keys) pendingSync.current.add(key);
    } finally {
      syncInFlight.current = false;
      setSyncing(new Set());
    }
  };

  /**
   * Fire once typing stops. Longer than the 1.2 s autosave on purpose: this
   * spends an AI call, and a half-typed label translated three times is waste.
   */
  useEffect(() => {
    if (syncTick === 0) return;
    if (translating.size > 0) return;
    const id = window.setTimeout(() => void runAutoSync(), 2500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick, translating.size]);

  /**
   * The language strip renders at the top of every locale-dependent tab rather
   * than once in the command bar, so switching language visibly changes the
   * thing you are looking at instead of something two panels away.
   *
   * One props object, five mount points: five hand-written prop lists would
   * drift the first time one of them gained a handler.
   */
  const stripProps = {
    locales,
    defaultLocale,
    activeLocale: editingLocale,
    onSelect: setEditingLocale,
    issuesByLocale,
    translating,
    syncing,
    disabled: !canEdit,
    onAddLocale: addLocale,
    onRemoveLocale: removeLocale,
    onMakeDefault: makeDefaultLocale,
    onTranslateLocale: translateLocale,
  };

  // --- render --------------------------------------------------------------

  if (isLoading || !definition || !form) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 pb-10! pt-4! sm:p-6 sm:pt-6!">
        <Skeleton className="h-14 w-full rounded-2xl" />
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
      // One constant, several consumers: the sticky inspector, the sticky Design
      // preview and the validation banner all offset by it so they clear the
      // command bar instead of sliding under it. Retuned when the bar lost its
      // buttons and language strip — bar height plus the wrapper's padding.
      style={{ "--fb-stick": "5.5rem" } as React.CSSProperties}
    >
      <UnsavedChangesGuard when={canEdit && (dirty || emailDirty)} />

      {/* The command bar, deliberately thin. It used to carry the buttons and
          the language strip too, which made it 7.5rem of dark chrome pinned to
          the top of every scroll. Identity only now — where you are, what it is
          called, whether it is live. Everything you DO lives with the tabs.

          Bleeds the page padding, or the sticky element leaves a transparent
          gutter as content scrolls under it. */}
      <div className="app-fade-down sticky top-0 z-30 -mx-4 bg-background/80 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
          <div className="flex min-w-0 items-center gap-3 px-4 py-2.5 sm:px-5">
            <Link
              to="/forms"
              aria-label={t("forms.builder.back")}
              title={t("forms.builder.back")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Input
              value={name}
              disabled={!canEdit}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border-transparent bg-transparent px-0 text-lg font-semibold tracking-tight text-white shadow-none selection:bg-white/20 focus-visible:border-white/10 focus-visible:bg-white/5 focus-visible:px-2.5 disabled:opacity-100 sm:text-xl"
            />

            <FormStatusBadge
              tone="dark"
              status={form.status}
              hasUnpublishedChanges={form.has_unpublished_changes || dirty}
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
        // Sticky, and deliberately so: the banner names fields that are further
        // down the page, and scrolling to fix one used to scroll the list of
        // what is wrong out of view. Opaque background, or the tab content
        // shows through it as it passes underneath.
        <div className="app-fade-up sticky top-[var(--fb-stick,1.5rem)] z-20 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:bg-[#241d07] dark:text-amber-200">
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
        {/* Tabs and actions share one baseline. The `line` variant only
            underlines the active trigger, so the wrapper supplies the rule the
            whole row sits on — including the buttons, which is what makes them
            read as part of the same control surface rather than floating. */}
        <div className="app-fade-up app-fade-up-d1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
          <TabsList variant="line" className="-mb-px">
            {/* An intake form is a URL: no canvas to draw, no theme to style,
                no copy a visitor ever reads. Showing those tabs would be
                showing an editor for a page that does not exist. */}
            {isIntake ? (
              <TabsTrigger value="setup">
                {t("forms.builder.tabSetup", { defaultValue: "Setup" })}
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="build">
                  {t("forms.builder.tabBuild")}
                  <IssueBadge count={issuesByTab.build} />
                </TabsTrigger>
                <TabsTrigger value="design">
                  {t("forms.builder.tabDesign")}
                  <IssueBadge count={issuesByTab.design} />
                </TabsTrigger>
              </>
            )}
            {/* A product form hands the visitor to Stripe; what comes after is
                the checkout's outcome pages, configured on the product field. */}
            {form.kind !== "product" && !isIntake ? (
              <TabsTrigger value="afterSubmit">
                {t("forms.builder.tabAfterSubmit")}
                <IssueBadge count={issuesByTab.afterSubmit} />
              </TabsTrigger>
            ) : null}
            {!isIntake ? (
              <TabsTrigger value="errors">
                {t("forms.builder.tabErrors")}
              </TabsTrigger>
            ) : null}
            {hasEmailConfig && !isIntake ? (
              <TabsTrigger value="email">
                {t("forms.builder.tabEmail")}
                <IssueBadge count={issuesByTab.email} />
              </TabsTrigger>
            ) : null}
            {form.kind === "product" ? (
              <TabsTrigger value="deal">
                {t("forms.builder.tabDeal", { defaultValue: "Deal" })}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="webhooks">
              {t("forms.builder.tabWebhooks")}
            </TabsTrigger>
            <TabsTrigger value="share">
              {t("forms.builder.tabShare")}
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            {isLive ? (
              <a
                href={buildPublicFormUrl(form.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                        onClick={() => {
                          manualSave.current = true;
                          saveMutation.mutate();
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : dirty ? (
                          <Save className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        {saveLabel}
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{saveTooltip}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border px-3"
                    >
                      <Globe
                        className={`h-3.5 w-3.5 ${isLive ? "text-emerald-500" : "text-muted-foreground/50"}`}
                        aria-hidden="true"
                      />
                      <Label
                        htmlFor="form-live-toggle"
                        className="cursor-pointer text-sm font-medium text-muted-foreground"
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

        <TabsContent value="setup" className="app-fade-up pt-5">
          <div className="mx-auto w-full max-w-2xl">
            <IntakeSetupPanel formId={form.id} intake={definition.intake} />
          </div>
        </TabsContent>

        <TabsContent value="build" className="pt-5">
          <TabLanguages {...stripProps} />
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
            <aside className="app-fade-up app-fade-up-d1 order-2 lg:order-1">
              <FieldPalette
                onAdd={addField}
                disabled={!canEdit}
                kind={form.kind}
                hasProduct={fields.some((f) => f.type === "product")}
              />
            </aside>

            <div className="app-fade-up app-fade-up-d2 order-1 min-w-0 lg:order-2">
              <FormCanvas
                definition={definition}
                locale={editingLocale}
                fallbackLocale={defaultLocale}
                offeredLocales={locales}
                selection={selection}
                onSelect={setSelection}
                onReorder={reorderFields}
                onDuplicateField={duplicateField}
                onDeleteField={deleteField}
                activeStep={activeStep}
                onActiveStepChange={setActiveStep}
                onReorderInStep={reorderInStep}
                onMoveFieldToStep={moveFieldToStep}
                onMoveFieldsToStep={moveFieldsToStep}
                onReorderSteps={reorderSteps}
                onAddStep={addStep}
                onDuplicateStep={duplicateStep}
                onDeleteStep={requestDeleteStep}
                onSplitIntoSteps={splitIntoSteps}
                onMergeSteps={() =>
                  definition.sections.length > 1
                    ? setMergeOpen(true)
                    : mergeSteps()
                }
                issuesBySection={issuesBySection}
                onLocaleChange={setEditingLocale}
                invalidFieldIds={invalidFieldIds}
                onRemoveTitle={() =>
                  patchDefinition({
                    ...definition,
                    theme: { ...definition.theme, showFormTitle: false },
                  })
                }
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
                onMoveToStep={
                  activeFieldId
                    ? (stepId) => moveFieldToStep(activeFieldId, stepId)
                    : undefined
                }
                onMoveStep={
                  selection?.kind === "step"
                    ? (dir) => {
                        const ids = definition.sections.map((s) => s.id);
                        const from = ids.indexOf(selection.stepId);
                        const to = from + dir;
                        if (from < 0 || to < 0 || to >= ids.length) return;
                        const next = [...ids];
                        next.splice(from, 1);
                        next.splice(to, 0, selection.stepId);
                        reorderSteps(next);
                      }
                    : undefined
                }
                onDeleteStep={
                  selection?.kind === "step"
                    ? () => requestDeleteStep(selection.stepId)
                    : undefined
                }
                commerce={definition.commerce}
                onCommerceChange={(patch) =>
                  patchDefinition({
                    ...definition,
                    commerce: {
                      ...(definition.commerce ?? DEFAULT_FORM_COMMERCE),
                      ...patch,
                    },
                  })
                }
                archivedPriceIds={archivedPriceIds}
                onDeleteField={
                  activeFieldId ? () => deleteField(activeFieldId) : undefined
                }
              />
            </aside>
          </div>

          <AlertDialog
            open={pendingStepDelete != null}
            onOpenChange={(open) => {
              if (!open) setPendingStepDelete(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("forms.steps.deleteTitle", {
                    n:
                      definition.sections.findIndex(
                        (s) => s.id === pendingStepDelete,
                      ) + 1,
                  })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("forms.steps.deleteBody", {
                    count:
                      definition.sections.find(
                        (s) => s.id === pendingStepDelete,
                      )?.fields.length ?? 0,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    pendingStepDelete && deleteStep(pendingStepDelete, true)
                  }
                >
                  {t("forms.steps.deleteMove")}
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() =>
                    pendingStepDelete && deleteStep(pendingStepDelete, false)
                  }
                >
                  {t("forms.steps.deleteAll")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={mergeOpen} onOpenChange={setMergeOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("forms.steps.mergeTitle", {
                    count: definition.sections.length,
                  })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("forms.steps.mergeBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={mergeSteps}>
                  {t("forms.steps.merge")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="design" className="app-fade-up pt-5">
          <TabLanguages {...stripProps} />
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

        {form.kind !== "product" ? (
          <TabsContent value="afterSubmit" className="app-fade-up pt-5">
            <TabLanguages {...stripProps} />
            <AfterSubmitPanel
              definition={definition}
              disabled={!canEdit}
              getText={(key) => getRawContent(definition, editingLocale, key)}
              setText={setText}
              onChange={(patch) => patchDefinition({ ...definition, ...patch })}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="errors" className="app-fade-up pt-5">
          <TabLanguages {...stripProps} />
          <ErrorMessagesPanel
            disabled={!canEdit}
            getText={(key) => getRawContent(definition, editingLocale, key)}
            setText={setText}
          />
        </TabsContent>

        {hasEmailConfig ? (
          <TabsContent value="email" className="app-fade-up pt-5">
            <TabLanguages {...stripProps} />
            <ConfirmationEmailPanel
              definition={definition}
              locales={locales}
              defaultLocale={defaultLocale}
              value={confirmationEmail}
              locale={editingLocale}
              onSelectLocale={setEditingLocale}
              disabled={!canEdit}
              // The Save used to hang on the page background below the card
              // with no footer or toolbar; it lives in the panel header now.
              onSave={canEdit ? () => emailMutation.mutate() : undefined}
              saveDisabled={!emailDirty || emailMutation.isPending}
              saving={emailMutation.isPending}
              dirty={emailDirty}
              onChange={(next) => {
                setConfirmationEmail(next);
                setEmailDirty(true);
              }}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="deal" className="app-fade-up pt-5">
          <DealPanel formId={form.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="webhooks" className="app-fade-up pt-5">
          <WebhooksPanel formId={form.id} kind={form.kind} canEdit={canEdit} />
        </TabsContent>

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

/** Every tab value, so `?tab=` cannot point at a panel that does not exist. */
const BUILDER_TABS = [
  "build",
  "design",
  "afterSubmit",
  "errors",
  "email",
  // Product forms only — the bounce effect above sends it back to Build on a
  // standard form, the same way afterSubmit is handled for product forms.
  "deal",
  "webhooks",
  "share",
];

/**
 * The language strip, wrapped for use inside a tab panel.
 *
 * No panel of its own: the strip now uses the app's tokens and sits directly on
 * the tab background. It briefly had a dark bar carried over from the command
 * bar it used to live in, which made it read as chrome bolted on top of the tab
 * rather than as the tab's own control.
 */
function TabLanguages(props: React.ComponentProps<typeof LanguageStrip>) {
  return (
    <div className="app-fade-up mb-4">
      <LanguageStrip {...props} />
    </div>
  );
}

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
  // The confirmation e-mail is per locale and carries no field, so it needs the
  // locale spelled out or "Subject is missing" gives no clue which language.
  if (
    issue.code === "emailSubjectMissing" ||
    issue.code === "emailBodyMissing"
  ) {
    return t(`forms.validation.${issue.code}`, {
      locale: (issue.locale ?? defaultLocale).toUpperCase(),
    });
  }

  if (issue.code === "emptyStep") {
    return t("forms.validation.emptyStep");
  }
  if (issue.code === "commerceInactivePrice" && issue.priceId) {
    return `${t("forms.validation.commerceInactivePrice")} (${issue.priceId})`;
  }

  // A blank key has no key to name it by, so fall through to the generic copy
  // rather than rendering "Field  has no key".
  if (issue.fieldKey) {
    return t(`forms.validation.field.${issue.code}`, {
      field: issue.fieldKey,
      defaultValue: t(`forms.validation.${issue.code}`),
    });
  }
  return t(`forms.validation.${issue.code}`);
}
