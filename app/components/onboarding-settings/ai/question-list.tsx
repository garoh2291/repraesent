import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock, Pin, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  OVERRIDE_REGIONS,
  type AiQuestion,
  type LocalizedText,
  type WordingRegion,
} from "~/lib/api/ai-onboarding";
import { cn } from "~/lib/utils";
import { LocalizedField, RegionPills } from "./localized-field";
import { RulesEditor } from "./rules-editor";

const REGIONS: readonly WordingRegion[] = ["default", ...OVERRIDE_REGIONS];

export function useQuestionName() {
  const { t } = useTranslation();
  return (q: AiQuestion) =>
    q.kind === "custom"
      ? q.name || t("settings.onboarding.ai.untitled")
      : t(`settings.onboarding.ai.q.${q.key}`, { defaultValue: q.default_name ?? q.key });
}

/**
 * The ordered checklist of what the assistant asks. Pinned questions (business
 * name first, billing + terms last) sit outside the sortable part; everything
 * else drags (or moves with the arrow buttons, for keyboards).
 */
export function QuestionList({
  questions,
  onChange,
  openKey,
  setOpenKey,
}: {
  questions: AiQuestion[];
  onChange: (next: AiQuestion[]) => void;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const first = questions.filter((q) => q.pinned === "first");
  const middle = questions.filter((q) => !q.pinned);
  const last = questions.filter((q) => q.pinned === "last");
  const setMiddle = (m: AiQuestion[]) => onChange([...first, ...m, ...last]);
  const patch = (key: string, p: Partial<AiQuestion>) => onChange(questions.map((q) => (q.key === key ? { ...q, ...p } : q)));
  const remove = (key: string) => {
    onChange(
      questions
        .filter((q) => q.key !== key)
        // A rule that skipped the removed question has nothing to skip any more.
        .map((q) => ({ ...q, rules: q.rules.filter((r) => r.target_key !== key) })),
    );
    setOpenKey(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = middle.findIndex((q) => q.key === e.active.id);
    const to = middle.findIndex((q) => q.key === e.over!.id);
    if (from < 0 || to < 0) return;
    setMiddle(arrayMove(middle, from, to));
  };
  const move = (key: string, dir: -1 | 1) => {
    const from = middle.findIndex((q) => q.key === key);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= middle.length) return;
    setMiddle(arrayMove(middle, from, to));
  };

  const addQuestion = () => {
    const key = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const q: AiQuestion = {
      key,
      kind: "custom",
      enabled: true,
      name: "",
      texts: { default: {}, regions: {} },
      rules: [],
      locked: false,
      pinned: null,
      step: null,
      fields: [{ path: `custom.${key}`, type: "long_text" }],
      default_texts: null,
      default_name: null,
    };
    setMiddle([...middle, q]);
    setOpenKey(key);
  };

  const row = (q: AiQuestion, i: number, sortable: boolean) => (
    <QuestionRow
      key={q.key}
      question={q}
      questions={questions}
      index={i}
      sortable={sortable}
      open={openKey === q.key}
      onToggleOpen={() => setOpenKey(openKey === q.key ? null : q.key)}
      onPatch={(p) => patch(q.key, p)}
      onRemove={() => remove(q.key)}
      onMove={sortable ? (dir) => move(q.key, dir) : undefined}
      canMoveUp={sortable && i > 0}
      canMoveDown={sortable && i < middle.length - 1}
    />
  );

  return (
    <div className="space-y-2">
      <ol className="space-y-2">{first.map((q, i) => row(q, i, false))}</ol>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={middle.map((q) => q.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">{middle.map((q, i) => row(q, i, true))}</ol>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addQuestion}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40"
      >
        <Plus className="size-4" aria-hidden />
        {t("settings.onboarding.ai.addQuestion")}
      </button>
      <ol className="space-y-2">{last.map((q, i) => row(q, i, false))}</ol>
    </div>
  );
}

function QuestionRow({
  question: q,
  questions,
  sortable,
  open,
  onToggleOpen,
  onPatch,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  question: AiQuestion;
  questions: AiQuestion[];
  index: number;
  sortable: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (p: Partial<AiQuestion>) => void;
  onRemove: () => void;
  onMove?: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const name = useQuestionName();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.key, disabled: !sortable });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const ownWording = Object.keys(q.texts.default).length > 0 || Object.keys(q.texts.regions).length > 0;
  const panelId = `q-panel-${q.key}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        open ? "border-foreground/25 shadow-sm" : "border-border",
        isDragging && "relative z-10 shadow-lg",
        !q.enabled && "bg-muted/30",
      )}
    >
      <div className="flex min-h-14 items-center gap-2 px-2 sm:px-3">
        {sortable ? (
          <span
            {...attributes}
            {...listeners}
            className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
            aria-label={t("settings.onboarding.ai.dragToReorder")}
          >
            <GripVertical className="size-4" aria-hidden />
          </span>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50" title={t("settings.onboarding.ai.pinned")}>
            <Pin className="size-3.5" aria-hidden />
            <span className="sr-only">{t("settings.onboarding.ai.pinned")}</span>
          </span>
        )}
        <span className="relative flex size-8 shrink-0 items-center justify-center" title={q.locked ? t("settings.onboarding.ai.lockedHint") : undefined}>
          <Checkbox
            checked={q.enabled}
            disabled={q.locked}
            className="size-[18px] data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background disabled:opacity-60"
            onCheckedChange={(v) => onPatch({ enabled: v === true })}
            aria-label={t("settings.onboarding.ai.askThis", { name: name(q) })}
          />
          {q.locked ? <Lock className="absolute -right-0.5 -bottom-0.5 size-3 text-muted-foreground" aria-hidden /> : null}
        </span>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-medium", q.enabled ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40")}>
              {name(q)}
            </span>
            <span className="mt-0.5 flex flex-wrap gap-1.5">
              {q.kind === "custom" ? <Chip tone="accent">{t("settings.onboarding.ai.yourQuestion")}</Chip> : null}
              {q.locked ? <Chip>{t("settings.onboarding.ai.required")}</Chip> : null}
              {ownWording ? <Chip>{t("settings.onboarding.ai.ownWording")}</Chip> : null}
              {q.rules.length ? <Chip>{t("settings.onboarding.ai.ruleCount", { count: q.rules.length })}</Chip> : null}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
        {onMove ? (
          <span className="hidden shrink-0 flex-col sm:flex">
            <button type="button" disabled={!canMoveUp} onClick={() => onMove(-1)} className="flex h-5 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label={t("settings.onboarding.ai.moveUp")}>
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
            <button type="button" disabled={!canMoveDown} onClick={() => onMove(1)} className="flex h-5 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label={t("settings.onboarding.ai.moveDown")}>
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </span>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <QuestionEditor question={q} questions={questions} onPatch={onPatch} onRemove={onRemove} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "accent" }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[11px] font-medium",
        tone === "accent" ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function QuestionEditor({
  question: q,
  questions,
  onPatch,
  onRemove,
}: {
  question: AiQuestion;
  questions: AiQuestion[];
  onPatch: (p: Partial<AiQuestion>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = useQuestionName();
  const [region, setRegion] = useState<WordingRegion>("default");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const builtinDefault: LocalizedText = q.default_texts ?? {};
  const value: LocalizedText = region === "default" ? q.texts.default : (q.texts.regions[region] ?? {});
  // An empty language shows what the customer would get instead.
  const placeholder: LocalizedText = region === "default" ? builtinDefault : { ...builtinDefault, ...q.texts.default };
  const setValue = (v: LocalizedText) =>
    onPatch({
      texts:
        region === "default"
          ? { ...q.texts, default: v }
          : { ...q.texts, regions: { ...q.texts.regions, [region]: v } },
    });
  const hasOwn = Object.keys(value).length > 0;

  return (
    <div className="space-y-5 border-t border-border px-3 pt-4 pb-4 sm:px-5">
      {q.kind === "custom" ? (
        <div className="space-y-2">
          <label htmlFor={`qname-${q.key}`} className="text-sm font-medium text-foreground">
            {t("settings.onboarding.ai.stepName")}
          </label>
          <Input
            id={`qname-${q.key}`}
            className="h-10"
            value={q.name}
            maxLength={80}
            autoFocus={!q.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={t("settings.onboarding.ai.stepNamePlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("settings.onboarding.ai.customAnswerHint")}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <RegionPills
            regions={REGIONS}
            value={region}
            onChange={setRegion}
            filled={(r) => r !== "default" && Object.keys(q.texts.regions[r] ?? {}).length > 0}
          />
          {hasOwn && (q.kind === "builtin" || region !== "default") ? (
            <button
              type="button"
              onClick={() => setValue({})}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t(region === "default" ? "settings.onboarding.ai.resetDefault" : "settings.onboarding.ai.resetRegion")}
            </button>
          ) : null}
        </div>
        <LocalizedField
          key={region}
          label={t("settings.onboarding.ai.questionText")}
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          multiline
          hint={
            region === "default"
              ? t(q.kind === "builtin" ? "settings.onboarding.ai.textHintBuiltin" : "settings.onboarding.ai.textHintCustom")
              : t("settings.onboarding.ai.textHintRegion", { region: t(`settings.onboarding.regions.${region}`) })
          }
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">{t("settings.onboarding.ai.rules.title")}</h4>
        <p className="text-xs text-muted-foreground">{t("settings.onboarding.ai.rules.hint")}</p>
        <RulesEditor question={q} questions={questions} questionName={name} onChange={(rules) => onPatch({ rules })} />
      </div>

      {q.kind === "custom" ? (
        <div className="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={() => (confirmDelete ? onRemove() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              confirmDelete ? "bg-destructive text-white hover:bg-destructive/90" : "text-destructive hover:bg-destructive/10",
            )}
          >
            <Trash2 className="size-4" aria-hidden />
            {t(confirmDelete ? "settings.onboarding.ai.confirmDelete" : "settings.onboarding.ai.deleteQuestion")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
