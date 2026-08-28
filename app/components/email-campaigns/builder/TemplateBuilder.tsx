import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Globe, Loader2, Save, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { LanguageStrip } from "~/components/forms/LanguageStrip";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { FormLocale } from "~/lib/forms/schema";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  publishEmailTemplate,
  translateEmailTemplate,
  updateEmailTemplate,
  type Block,
  type BlockType,
  type EmailTemplateDetail,
  type TemplateDocument,
  type TemplateLocaleContent,
  type TemplateSettings,
} from "~/lib/api/email-templates";
import {
  BLOCK_META,
  cloneBlocks,
  emptyLocaleContent,
  FOOTER_SELECTION_ID,
  hasUnsubscribeUrl,
  newBlock,
} from "~/lib/email-templates/blocks";
import type { TemplateDocument as Doc } from "~/lib/api/email-templates";
import {
  buildKeyedRequest,
  buildMultiTargetRequest,
  buildTranslateRequest,
  cloneLocaleContent,
  countUntranslatedCopies,
  mergeTranslations,
} from "~/lib/email-templates/translate-items";
import {
  applyClears,
  changedKeysBetween,
  linkTranslations,
  mergeSyncResult,
  needsLinking,
  outOfDateCount,
  planSync,
  stamp,
  type TranslationProvenance,
} from "~/lib/email-templates/translation-sync";
import {
  applyToAllLocales,
  describeRemovedBlocks,
  localeDrift,
  matchStructure,
  mergeStructuralAttrs,
  replaceBlockAcrossLocales,
  type LocaleDrift,
} from "~/lib/email-templates/locale-sync";
import { ConfirmDeleteDialog } from "~/components/molecule/confirm-delete-dialog";
import { BlockCanvas } from "./BlockCanvas";
import { BlockInspector } from "./BlockInspector";
import { BlockPalette } from "./BlockPalette";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { TemplateStatusBadge } from "./TemplateStatusBadge";
import { TestSendDialog } from "./TestSendDialog";
import { VariableMenu } from "./VariableMenu";

/**
 * The template builder, on the forms-builder chrome: a thin sticky identity
 * bar (back · name · status), the LanguageStrip, then tabs sharing a baseline
 * with the actions (Save status readout · Published switch · Test).
 *
 * Same autosave contract as the forms builder: edits go through local state
 * with a dirty flag, a 1.2 s debounce persists them silently, and the Save
 * button is the status readout — only a manual press toasts. Once published,
 * every save also republishes (the forms "saving a live form republishes"
 * model); the server updates the latest version in place unless a campaign
 * has pinned it.
 */
export function TemplateBuilder({
  template,
}: {
  template: EmailTemplateDetail;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [name, setName] = useState(template.name);
  const [doc, setDoc] = useState<TemplateDocument>(template.content);
  const [settings, setSettings] = useState<TemplateSettings>(template.settings);
  const [defaultLocale, setDefaultLocale] = useState(template.default_locale);
  const [activeLocale, setActiveLocale] = useState(template.default_locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  /** Language awaiting confirmation of a structure repair (destructive). */
  const [matchTarget, setMatchTarget] = useState<FormLocale | null>(null);
  /** Ref-counted like the forms builder — one locale can have two requests
   * in flight, and a Set would clear the spinner after the first returns. */
  const [translateCounts, setTranslateCounts] = useState<
    Record<string, number>
  >({});
  /** Set by the Save button so onSuccess can tell a press from a timer. */
  const manualSave = useRef(false);

  const isPublished = template.current_version > 0;

  // Hydrate on the template ID ALONE — a refetch of the same template after
  // an autosave must not clobber edits typed in the meantime (forms pattern).
  useEffect(() => {
    setName(template.name);
    setDefaultLocale(template.default_locale);
    setActiveLocale(template.default_locale);
    setSelectedId(null);
    // Templates authored before the footer moved into settings still carry a
    // trailing footer BLOCK. The server now appends its own at compile time,
    // so strip the legacy one or the email would show two.
    const initial = stripLegacyFooter(template.content);
    if (!initial.locales[template.default_locale]) {
      // A brand-new template: seed the default locale so the canvas opens
      // with the unsubscribe footer instead of a void.
      setDoc({
        ...initial,
        locales: {
          ...initial.locales,
          [template.default_locale]: emptyLocaleContent(),
        },
      });
      setDirty(true);
    } else {
      setDoc(initial);
      setDirty(false);
    }
    setSettings(template.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const locales = Object.keys(doc.locales);
  const content: TemplateLocaleContent = doc.locales[activeLocale] ?? {
    subject: "",
    preheader: "",
    blocks: [],
  };

  const translating = useMemo(
    () =>
      new Set(
        Object.entries(translateCounts)
          .filter(([, count]) => count > 0)
          .map(([locale]) => locale),
      ) as ReadonlySet<FormLocale>,
    [translateCounts],
  );
  const anyTranslating = translating.size > 0;

  const bumpTranslating = (locale: string, delta: 1 | -1) =>
    setTranslateCounts((previous) => ({
      ...previous,
      [locale]: Math.max(0, (previous[locale] ?? 0) + delta),
    }));

  /**
   * The automatic sync runs on its OWN counter, deliberately.
   *
   * `busy` below folds `anyTranslating` into autosave, Save, Test and the whole
   * language strip. Routing a sync that fires while you are still typing
   * through the same counter would suspend the autosave and grey out the
   * controls every few seconds. This one drives a quiet indicator and nothing
   * else.
   */
  const [syncing, setSyncing] = useState<ReadonlySet<string>>(new Set());
  /** Text keys edited since the last sync — `subject`, `preheader`, `block.<id>.<attr>`. */
  const pendingKeys = useRef(new Set<string>());
  /** The language those pending keys were edited in. */
  const pendingSource = useRef(activeLocale);
  const syncInFlight = useRef(false);
  /** The "not linked yet" nudge is worth saying once, not every edit. */
  const linkPromptShown = useRef(false);
  /** Bumped by every text edit; the sync effect waits for it to stop moving. */
  const [editTick, setEditTick] = useState(0);

  const markEdited = (keys: string[]) => {
    if (keys.length === 0) return;
    // Switching language mid-edit: the queued keys belong to the language they
    // were typed in, so flush rather than attribute them to the new one.
    if (pendingSource.current !== activeLocale) {
      pendingKeys.current = new Set();
      pendingSource.current = activeLocale;
    }
    for (const key of keys) pendingKeys.current.add(key);
    setEditTick((tick) => tick + 1);
  };

  // ------------------------------------------------------------- mutations

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["email-template", template.id],
    });
    queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  };

  const save = useMutation({
    mutationFn: () =>
      updateEmailTemplate(template.id, {
        name: name.trim() || template.name,
        content: doc,
        settings,
        default_locale: defaultLocale,
        // Once published, every save republishes (server updates the latest
        // unpinned version in place).
        auto_publish: isPublished,
      }),
    onSuccess: () => {
      setDirty(false);
      invalidate();
      if (manualSave.current) {
        toast.success(t("forms.builder.saved", { defaultValue: "Saved" }));
      }
      manualSave.current = false;
    },
    onError: (error) => {
      manualSave.current = false;
      toast.error(extractErrorMessage(error));
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) {
        await updateEmailTemplate(template.id, {
          name: name.trim() || template.name,
          content: doc,
          settings,
          default_locale: defaultLocale,
        });
        setDirty(false);
      }
      return publishEmailTemplate(template.id);
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(
        t("emailCampaigns.templates.published", {
          defaultValue: "Published v{{version}}",
          version: result.version,
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const busy = save.isPending || publish.isPending || anyTranslating;
  const canAutosave = dirty && !busy;

  // The forms-builder autosave: one 1.2 s timer, re-armed by every edit
  // (the deps include the whole draft). Mutations deliberately excluded —
  // including them restarts the timer every render and nothing ever saves.
  useEffect(() => {
    if (!canAutosave) return;
    const id = window.setTimeout(() => {
      void save.mutateAsync().catch(() => {
        /* the mutation toasts its own failures */
      });
    }, 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutosave, name, doc, settings, defaultLocale]);

  const saveLabel = save.isPending
    ? t("forms.builder.savingAuto", { defaultValue: "Saving…" })
    : dirty
      ? t("forms.builder.save", { defaultValue: "Save" })
      : t("forms.builder.savedAuto", { defaultValue: "Saved" });

  // ------------------------------------------------------------ translate

  /**
   * Translate one or more languages from the default one, in a SINGLE request.
   *
   * mode "all" overwrites; mode "copies" only fills strings still identical to
   * the default language's. `fallbackIsCopy` marks the add-language path, where
   * a failure still leaves usable (copied) content and deserves a different
   * toast.
   *
   * Every merge stamps provenance, so a language translated here is afterwards
   * known to be ours and follows later edits automatically.
   */
  const runTranslateMany = async (
    targets: string[],
    mode: "all" | "copies",
    options?: { fallbackIsCopy?: boolean; docOverride?: TemplateDocument },
  ) => {
    const source = options?.docOverride ?? doc;
    const request = buildMultiTargetRequest(source, defaultLocale, targets, mode);
    if (!request) return;

    const wanted = request.targets.map((entry) => entry.locale);
    for (const locale of wanted) bumpTranslating(locale, 1);
    try {
      const response = await translateEmailTemplate(template.id, request);
      const merged = response.results.filter(
        (result) => result.ok && Object.keys(result.values).length > 0,
      );

      if (merged.length > 0) {
        // Functional update — a closure over `doc` would drop edits made
        // while the request was in flight (forms lesson).
        setDoc((previous) => {
          const sourceContent = previous.locales[defaultLocale];
          const locales = { ...previous.locales };
          for (const result of merged) {
            const current = locales[result.locale];
            if (!current) continue;
            const next = mergeTranslations(current, result.values);
            locales[result.locale] = sourceContent
              ? stamp(next, sourceContent, Object.keys(result.values))
              : next;
          }
          return { ...previous, locales };
        });
        setDirty(true);
        toast.success(
          t("forms.builder.translateDone", {
            defaultValue: "Translated",
          }),
        );
      } else if (options?.fallbackIsCopy) {
        toast.warning(
          t("forms.builder.copiedInstead", {
            defaultValue:
              "Copied the default language — translation failed, review the copy",
          }),
        );
      } else {
        toast.error(
          t("forms.builder.translateFailed", {
            defaultValue: "Translation failed",
          }),
        );
      }
    } catch (error) {
      if (options?.fallbackIsCopy) {
        toast.warning(
          t("forms.builder.copiedInstead", {
            defaultValue:
              "Copied the default language — translation failed, review the copy",
          }),
        );
      } else {
        toast.error(extractErrorMessage(error));
      }
    } finally {
      for (const locale of wanted) bumpTranslating(locale, -1);
    }
  };

  const runTranslate = (
    target: string,
    mode: "all" | "copies",
    options?: { fallbackIsCopy?: boolean; docOverride?: TemplateDocument },
  ) => runTranslateMany([target], mode, options);

  // ------------------------------------------------------------- text sync

  /**
   * Carry an edit into every other language.
   *
   * Runs on the keys the author just touched, skips anything a person has
   * rewritten in the target language, and blanks rather than translates when
   * the source string was emptied. One request covers all the languages —
   * the endpoint has always taken up to three targets.
   *
   * Failure is deliberately silent. Nothing is lost: the strings stay stale,
   * the strip counts them, and the next edit retries. A toast every time the
   * network hiccups while someone is typing is worse than no toast.
   */
  const runAutoSync = async () => {
    if (syncInFlight.current) return;
    const keys = [...pendingKeys.current];
    const sourceLocale = pendingSource.current;
    if (keys.length === 0) return;
    pendingKeys.current = new Set();

    const sourceContent = doc.locales[sourceLocale];
    if (!sourceContent) return;
    const plan = planSync(doc, sourceLocale, keys);

    /**
     * The one place this can look broken: you edit German on a template written
     * before any of this, nothing happens in French, and there is no reason
     * given. Say it out loud, once, at the moment it matters — and put the fix
     * on the toast rather than making them find the menu.
     */
    if (
      plan.targets.length === 0 &&
      plan.clears.length === 0 &&
      !linkPromptShown.current &&
      Object.keys(doc.locales).some(
        (locale) => locale !== defaultLocale && needsLinking(doc, defaultLocale, locale),
      )
    ) {
      linkPromptShown.current = true;
      toast.info(
        t("emailCampaigns.templates.syncNeedsLink", {
          defaultValue:
            "The other languages are not linked yet, so this edit stayed here.",
        }),
        {
          duration: 10_000,
          action: {
            label: t("forms.strip.linkTranslations", {
              defaultValue: "Link translations",
            }),
            onClick: linkAll,
          },
        },
      );
    }

    // Emptying a string needs no translator.
    if (plan.clears.length > 0) {
      setDoc((previous) => {
        const source = previous.locales[sourceLocale];
        if (!source) return previous;
        const locales = { ...previous.locales };
        for (const entry of plan.clears) {
          const current = locales[entry.locale];
          if (current) {
            locales[entry.locale] = applyClears(current, source, entry.keys);
          }
        }
        return { ...previous, locales };
      });
      setDirty(true);
    }

    const request = buildKeyedRequest(doc, sourceLocale, plan.targets);
    if (!request) return;

    // Snapshot the provenance the decision was made against, so the merge can
    // re-check it against whatever the document looks like when it lands.
    const guards: Record<string, TranslationProvenance> = {};
    for (const entry of request.targets) {
      guards[entry.locale] = doc.locales[entry.locale]?.translated ?? {};
    }

    syncInFlight.current = true;
    setSyncing(new Set(request.targets.map((entry) => entry.locale)));
    try {
      const response = await translateEmailTemplate(template.id, request);
      const usable = response.results.filter(
        (result) => result.ok && Object.keys(result.values).length > 0,
      );
      if (usable.length === 0) return;

      // The updater stays pure — React may invoke it twice in development, and
      // deciding "did anything change" inside it would be a side effect.
      setDoc((previous) => {
        const source = previous.locales[sourceLocale];
        if (!source) return previous;
        const locales = { ...previous.locales };
        for (const result of usable) {
          const current = locales[result.locale];
          if (!current) continue;
          locales[result.locale] = mergeSyncResult(
            current,
            source,
            result.values,
            guards[result.locale] ?? {},
          );
        }
        return { ...previous, locales };
      });
      setDirty(true);
    } catch {
      // Put them back so the next edit sweeps them up with its own.
      for (const key of keys) pendingKeys.current.add(key);
    } finally {
      syncInFlight.current = false;
      setSyncing(new Set());
    }
  };

  /**
   * Fire once the typing stops. Much longer than the 1.2 s autosave: this
   * spends money on an AI call, and the server has no rate limit of its own.
   */
  useEffect(() => {
    if (editTick === 0) return;
    // A manual Translate/Retranslate owns the document while it runs.
    if (anyTranslating) return;
    const id = window.setTimeout(() => void runAutoSync(), 2500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTick, anyTranslating]);

  /** Adopt the current text as the translation — no AI call, nothing rewritten. */
  const linkAll = () => {
    // Against the DEFAULT language, not whichever tab you happen to be on, so
    // the recorded relationship is the same however you reached the action.
    setDoc((previous) => linkTranslations(previous, defaultLocale));
    setDirty(true);
    toast.success(
      t("forms.strip.linkedTranslations", {
        defaultValue: "Languages linked — edits will now sync",
      }),
    );
  };

  // --------------------------------------------------------------- locales

  const addLocale = (locale: FormLocale) => {
    if (doc.locales[locale]) {
      setActiveLocale(locale);
      return;
    }
    const source = doc.locales[defaultLocale];
    const seeded: TemplateDocument = {
      ...doc,
      locales: {
        ...doc.locales,
        // Structural clone with the SAME block ids — parallel structure is
        // what lets translations address blocks across locales.
        [locale]: source ? cloneLocaleContent(source) : emptyLocaleContent(),
      },
    };
    setDoc(seeded);
    setDirty(true);
    setActiveLocale(locale);
    setSelectedId(null);
    // Customer.io's move: drop into the new language already translating.
    void runTranslate(locale, "all", {
      fallbackIsCopy: true,
      docOverride: seeded,
    });
  };

  const removeLocale = (locale: FormLocale) => {
    if (locale === defaultLocale) return;
    setDoc((previous) => {
      const next = { ...previous.locales };
      delete next[locale];
      return { ...previous, locales: next };
    });
    setDirty(true);
    if (activeLocale === locale) setActiveLocale(defaultLocale);
  };

  const makeDefault = (locale: FormLocale) => {
    setDefaultLocale(locale);
    setDirty(true);
  };

  /** Languages whose block structure no longer matches the default one. */
  const driftByLocale = useMemo(() => {
    const map = new Map<FormLocale, LocaleDrift>();
    for (const locale of Object.keys(doc.locales)) {
      const drift = localeDrift(doc, defaultLocale, locale);
      if (drift) map.set(locale as FormLocale, drift);
    }
    return map;
  }, [doc, defaultLocale]);

  const issuesByLocale = useMemo(() => {
    const map = new Map<FormLocale, number>();
    for (const [locale, entry] of Object.entries(doc.locales)) {
      let count = 0;
      if (!entry.subject.trim()) count += 1;
      if (entry.blocks.length === 0) count += 1;
      // Structure that differs from the default language is an issue in its
      // own right: the two languages are no longer the same e-mail.
      if (driftByLocale.has(locale as FormLocale)) count += 1;
      // Text that arrived by mirroring a structural edit and was never
      // translated — one click from fixed, via the strip's Translate action.
      count += countUntranslatedCopies(doc, defaultLocale, locale) > 0 ? 1 : 0;
      // Copy someone rewrote here, whose source has since moved on. Left alone
      // on purpose: overwriting it is what we are avoiding.
      count += outOfDateCount(doc, defaultLocale, locale) > 0 ? 1 : 0;
      map.set(locale as FormLocale, count);
    }
    return map;
  }, [doc, defaultLocale, driftByLocale]);

  /**
   * Languages holding text we cannot prove came from the translator — every
   * template written before this existed. Nothing is auto-updated there until
   * someone links them, so the strip offers the action.
   */
  const unlinkedLocales = useMemo(() => {
    const set = new Set<FormLocale>();
    for (const locale of Object.keys(doc.locales)) {
      if (needsLinking(doc, defaultLocale, locale)) set.add(locale as FormLocale);
    }
    return set;
  }, [doc, defaultLocale]);

  // ---------------------------------------------------------------- blocks

  const setContent = (next: TemplateLocaleContent) => {
    // Subject and preheader are text like any other, so an edit here queues for
    // the same sync a block edit does.
    markEdited(changedKeysBetween(doc.locales[activeLocale], next));
    setDoc((previous) => ({
      ...previous,
      locales: { ...previous.locales, [activeLocale]: next },
    }));
    setDirty(true);
  };

  /**
   * Apply one block transform to EVERY language.
   *
   * Structure is shared: a block that exists in German must exist in French,
   * under the same id, because translation addresses text by
   * `block.<id>.<field>`. Writing a structural change to the active locale
   * alone is what let the languages drift into different e-mails.
   *
   * Anything minted here — a new block, a duplicate — is created ONCE by the
   * caller and the same id handed to every language. Minting per-locale would
   * produce parallel blocks with different ids: identical on screen, and
   * untranslatable.
   */
  const applyStructure = (transform: (blocks: Block[]) => Block[]) => {
    // Returns the new document so a caller that must act on it — inserting a
    // row then translating what it brought — works from the post-edit state
    // rather than the render-time closure.
    const next = applyToAllLocales(doc, transform);
    setDoc(next);
    setDirty(true);
    return next;
  };

  const selectedBlock = content.blocks.find((b) => b.id === selectedId) ?? null;

  const addBlock = (type: BlockType) => {
    const block = newBlock(type);
    applyStructure((blocks) => [...blocks, block]);
    setSelectedId(block.id);
  };

  /**
   * Saved rows arrive carrying text, so unlike a fresh block they land in the
   * other languages already needing translation. Fill them in straight away —
   * `mode: "copies"` touches only the strings still identical to the source.
   *
   * One request for every language, not one per language: the endpoint takes up
   * to three targets and runs them concurrently.
   */
  const insertRow = (blocks: Block[]) => {
    const next = applyStructure((current) => [...current, ...blocks]);
    const others = Object.keys(next.locales).filter(
      (locale) => locale !== defaultLocale,
    );
    void runTranslateMany(others, "copies", { docOverride: next });
  };

  const reorder = (orderedIds: string[]) =>
    applyStructure((blocks) => {
      const byId = new Map(blocks.map((b) => [b.id, b]));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((b): b is Block => !!b);
      const placed = new Set(ordered.map((b) => b.id));
      // A language that drifted may hold blocks the dragged list never
      // mentioned; keep them rather than let a reorder silently delete them.
      return [...ordered, ...blocks.filter((b) => !placed.has(b.id))];
    });

  const duplicate = (id: string) => {
    const source = content.blocks.find((b) => b.id === id);
    if (!source) return;
    // Minted once, inserted everywhere under one id. `cloneBlocks` re-mints
    // ids by design, so calling it per-locale would break the parallel.
    const copy = cloneBlocks([source])[0];
    applyStructure((blocks) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index < 0) return blocks;
      const next = [...blocks];
      // Each language duplicates ITS OWN text under the shared new id.
      next.splice(index + 1, 0, mergeStructuralAttrs(copy, blocks[index]));
      return next;
    });
    setSelectedId(copy.id);
  };

  const removeBlock = (id: string) => {
    applyStructure((blocks) => blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  /**
   * An edit splits by what the field means, not by where it was made:
   * reading matter (`html`, `label`, `alt`) is written to the language you are
   * editing; everything else — colours, alignment, href, src, radius, level —
   * is structure and applies to all of them immediately. So restyling a button
   * restyles it everywhere at once.
   *
   * The text then follows too, but through the translator rather than by
   * copying: the changed strings are queued here and synced once you stop
   * typing.
   */
  const updateBlock = (updated: Block) => {
    const next = replaceBlockAcrossLocales(doc, activeLocale, updated);
    markEdited(
      changedKeysBetween(doc.locales[activeLocale], next.locales[activeLocale]),
    );
    setDoc(next);
    setDirty(true);
  };

  const driftedLocales = useMemo(
    () => new Set(driftByLocale.keys()),
    [driftByLocale],
  );

  /**
   * What the repair will do, in the two terms that matter: the blocks it
   * removes, named by type, and the fact that translated text survives.
   */
  const matchDescription = useMemo(() => {
    if (!matchTarget) return "";
    const target = doc.locales[matchTarget];
    const removed = target
      ? describeRemovedBlocks(target, driftByLocale.get(matchTarget)?.extra ?? [])
      : [];
    const kept = t("emailCampaigns.templates.matchStructureKeeps", {
      defaultValue:
        "{{locale}} is rebuilt on {{source}}'s blocks. Text already translated is kept.",
      locale: matchTarget.toUpperCase(),
      source: defaultLocale.toUpperCase(),
    });
    if (removed.length === 0) return kept;
    const names = removed
      .map((type) =>
        t(BLOCK_META[type as BlockType]?.labelKey ?? "", {
          defaultValue: BLOCK_META[type as BlockType]?.defaultLabel ?? type,
        }),
      )
      .join(", ");
    return `${kept} ${t("emailCampaigns.templates.matchStructureRemoves", {
      defaultValue_one: "This removes 1 block only {{locale}} has: {{names}}.",
      defaultValue_other:
        "This removes {{count}} blocks only {{locale}} has: {{names}}.",
      count: removed.length,
      locale: matchTarget.toUpperCase(),
      names,
    })}`;
  }, [matchTarget, doc, driftByLocale, defaultLocale, t]);

  /** Rebuild one language on the default's structure (destructive; confirmed). */
  const runMatchStructure = (locale: FormLocale) => {
    const next = matchStructure(doc, defaultLocale, locale);
    setDoc(next);
    setDirty(true);
    setSelectedId(null);
    setMatchTarget(null);
    // Blocks that just arrived carry the default language's words.
    void runTranslate(locale, "copies", { docOverride: next });
  };

  const subjectRef = useRef<HTMLInputElement>(null);
  const insertIntoSubject = (snippet: string) => {
    const input = subjectRef.current;
    const value = content.subject;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    setContent({
      ...content,
      subject: value.slice(0, start) + snippet + value.slice(end),
    });
  };

  // ------------------------------------------------------------------ jsx

  return (
    <div
      className="mx-auto w-full max-w-[1280px] space-y-5 p-4 pb-10! pt-0! sm:p-6 sm:pb-14! sm:pt-0! app-fade-in"
      style={{ "--fb-stick": "5.5rem" } as React.CSSProperties}
    >
      <UnsavedChangesGuard when={dirty} />

      {/* The command bar, deliberately thin — identity only (forms model).
          Everything you DO lives on the tabs baseline below. */}
      <div className="app-fade-down sticky top-0 z-30 -mx-4 bg-background/80 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
          <div className="flex min-w-0 items-center gap-3 px-4 py-2.5 sm:px-5">
            <Link
              to="/email-templates"
              aria-label={t("forms.builder.back", { defaultValue: "Back" })}
              title={t("emailCampaigns.templates.title", {
                defaultValue: "Email templates",
              })}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border-transparent bg-transparent px-0 text-lg font-semibold tracking-tight text-white shadow-none selection:bg-white/20 focus-visible:border-white/10 focus-visible:bg-white/5 focus-visible:px-2.5 disabled:opacity-100 sm:text-xl"
            />
            <TemplateStatusBadge
              tone="dark"
              version={template.current_version}
              hasUnpublishedChanges={dirty}
            />
          </div>
        </div>
      </div>

      <div className="app-fade-up flex justify-center">
        <LanguageStrip
          locales={locales as FormLocale[]}
          defaultLocale={defaultLocale as FormLocale}
          activeLocale={activeLocale as FormLocale}
          onSelect={(locale) => {
            setActiveLocale(locale);
            setSelectedId(null);
          }}
          issuesByLocale={issuesByLocale}
          translating={translating}
          onAddLocale={addLocale}
          onRemoveLocale={removeLocale}
          onMakeDefault={makeDefault}
          onTranslateLocale={(locale, overwrite) =>
            void runTranslate(locale, overwrite ? "all" : "copies")
          }
          driftedLocales={driftedLocales}
          onMatchStructure={setMatchTarget}
          unlinkedLocales={unlinkedLocales}
          onLinkTranslations={linkAll}
          syncing={syncing}
        />
      </div>

      <Tabs defaultValue="build">
        {/* Tabs and actions share one baseline (forms builder pattern). */}
        <div className="app-fade-up app-fade-up-d1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger value="build">
              {t("emailCampaigns.templates.tabBuild", {
                defaultValue: "Build",
              })}
            </TabsTrigger>
            <TabsTrigger value="preview">
              {t("emailCampaigns.templates.preview.title", {
                defaultValue: "Preview",
              })}
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            <button
              type="button"
              onClick={() => {
                if (dirty) {
                  save.mutate(undefined, {
                    onSuccess: () => setTestOpen(true),
                  });
                } else {
                  setTestOpen(true);
                }
              }}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-3.5 w-3.5" />
              {t("emailCampaigns.templates.testButton", {
                defaultValue: "Test",
              })}
            </button>

            <button
              type="button"
              onClick={() => {
                manualSave.current = true;
                save.mutate();
              }}
              disabled={!dirty || busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : dirty ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saveLabel}
            </button>

            {/* The forms Live switch, adapted: one-way. Once on, every save
                republishes; there is no "unpublish" because templates have no
                public surface — a published version simply exists. */}
            <label
              className="flex h-9 items-center gap-2 rounded-lg border px-3"
              title={
                isPublished
                  ? t("emailCampaigns.templates.publishedTip", {
                      defaultValue: "Every save publishes automatically",
                    })
                  : t("emailCampaigns.templates.publishTip", {
                      defaultValue:
                        "Publish this template so campaigns can send it",
                    })
              }
            >
              <Globe
                className={`h-3.5 w-3.5 ${
                  isPublished ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
              <span className="text-sm font-medium">
                {t("emailCampaigns.templates.publishedSwitch", {
                  defaultValue: "Published",
                })}
              </span>
              <Switch
                checked={isPublished}
                disabled={isPublished || busy}
                onCheckedChange={(next) => {
                  if (next) publish.mutate();
                }}
              />
            </label>
          </div>
        </div>

        <TabsContent value="build" className="app-fade-up pt-5">
          <div className="space-y-4">
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Input
                  ref={subjectRef}
                  value={content.subject}
                  onChange={(e) =>
                    setContent({ ...content, subject: e.target.value })
                  }
                  placeholder={t(
                    "emailCampaigns.templates.subjectPlaceholder",
                    { defaultValue: "Subject" },
                  )}
                  className="h-9"
                />
                <VariableMenu onInsert={insertIntoSubject} />
              </div>
              <Input
                value={content.preheader ?? ""}
                onChange={(e) =>
                  setContent({ ...content, preheader: e.target.value })
                }
                placeholder={t(
                  "emailCampaigns.templates.preheaderPlaceholder",
                  {
                    defaultValue:
                      "Preheader — the inbox preview line (optional)",
                  },
                )}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-4 sm:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
              <aside className="app-fade-up app-fade-up-d1 order-2 lg:order-1">
                <BlockPalette onAdd={addBlock} onInsertRow={insertRow} />
              </aside>
              <div className="app-fade-up app-fade-up-d2 order-1 min-w-0 lg:order-2">
                <BlockCanvas
                  content={content}
                  settings={settings}
                  locale={activeLocale}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={reorder}
                  onDuplicate={duplicate}
                  onDelete={removeBlock}
                />
              </div>
              <aside className="app-fade-up app-fade-up-d3 order-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[var(--fb-stick)] xl:self-start">
                <BlockInspector
                  block={selectedBlock}
                  settings={settings}
                  onChangeBlock={updateBlock}
                  onChangeSettings={(next) => {
                    setSettings(next);
                    setDirty(true);
                  }}
                  footerSelected={selectedId === FOOTER_SELECTION_ID}
                  // Per language: this is the wording for whichever locale the
                  // LanguageStrip currently has open.
                  localeUnsubscribeText={content.unsubscribe_text ?? ""}
                  onChangeLocaleUnsubscribeText={(text) =>
                    setContent({ ...content, unsubscribe_text: text })
                  }
                />
              </aside>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="app-fade-up pt-5">
          <TemplatePreviewPanel
            templateId={template.id}
            content={doc}
            settings={settings}
            locale={activeLocale}
          />
        </TabsContent>
      </Tabs>

      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        templateId={template.id}
        locale={activeLocale}
      />

      {/* Naming what disappears is the whole point of this confirmation: the
          repair keeps translated text but drops blocks the default language
          does not have, and those are content someone wrote. */}
      <ConfirmDeleteDialog
        open={matchTarget !== null}
        onOpenChange={(open) => !open && setMatchTarget(null)}
        name={matchTarget}
        title={t("emailCampaigns.templates.matchStructureTitle", {
          defaultValue: "Match {{locale}} to {{source}}?",
          locale: (matchTarget ?? "").toUpperCase(),
          source: defaultLocale.toUpperCase(),
        })}
        description={matchDescription}
        confirmLabel={t("forms.strip.matchStructure", {
          defaultValue: "Match structure",
        })}
        onConfirm={() => matchTarget && runMatchStructure(matchTarget)}
      />
    </div>
  );
}

/**
 * Remove a trailing unsubscribe footer block left over from when the footer
 * was authored content. The compiler appends the real one, so keeping this
 * would render it twice.
 */
function stripLegacyFooter(doc: Doc): Doc {
  const locales: Doc["locales"] = {};
  let changed = false;
  for (const [locale, content] of Object.entries(doc.locales ?? {})) {
    const blocks = [...content.blocks];
    const last = blocks[blocks.length - 1];
    if (last && hasUnsubscribeUrl([last])) {
      blocks.pop();
      changed = true;
    }
    locales[locale] = { ...content, blocks };
  }
  return changed ? { ...doc, locales } : doc;
}
