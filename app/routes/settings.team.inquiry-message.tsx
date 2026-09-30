import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Layers,
  Loader2,
  Lock,
  Minus,
  Plus,
  Search,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Segmented } from "~/components/notebook/segmented";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { LoadError } from "~/components/notebook/load-error";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  ALL_DETAILS_REF,
  CORE_ALERT_FIELDS,
  MAX_ALL_ROWS,
  alertFieldId,
  getAlertFields,
  getAvailableAlertFields,
  resetAlertFields,
  saveAlertFields,
  sendAlertTest,
  type AlertFieldRef,
  type AlertFieldsConfig,
  type AlertRow,
  type AvailableMetaField,
} from "~/lib/api/inquiry-alerts";
import { humanizeMetaKey } from "~/lib/leads/field-label";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";

/**
 * Team → "What the inquiry message shows" (INQUIRY_ALERTS.md).
 *
 * iOS "customise" pattern: the fields that are shown sit at the top in their
 * order (drag, or the arrows for keyboard / VoiceOver); everything that can
 * be added sits below with a plus. The preview on the right (a sheet on
 * phones) redraws from the newest real inquiry on every change.
 */

const MAX_FIELDS = 20;
const SEARCH_FROM = 12;

/** English labels: team chat messages are English-only (notification-formatters). */
const CHAT_CORE_LABELS: Record<string, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  source: "Where from",
  message: "Message",
  stage: "Stage",
  form: "Form",
};

/** Shown when the business has no inquiries yet — clearly labelled "Example". */
const EXAMPLE_VALUES: Record<string, string> = {
  name: "Anna Schmidt",
  phone: "+49 170 1234567",
  email: "anna@example.com",
  source: "—",
  message: "…",
  stage: "—",
  form: "—",
};

export default function InquiryMessageSettings() {
  useDocumentMeta({
    titleKey: "settings.inquiryMessage.metaTitle",
    descriptionKey: "settings.inquiryMessage.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const queryClient = useQueryClient();
  const wsId = currentWorkspace?.id;
  const lang = (i18n.resolvedLanguage || i18n.language || "de").slice(0, 2);

  const configQuery = useQuery({
    queryKey: ["inquiry-alerts", wsId],
    queryFn: getAlertFields,
    enabled: !!wsId,
  });
  const availableQuery = useQuery({
    queryKey: ["inquiry-alerts", "available", wsId, lang],
    queryFn: () => getAvailableAlertFields(lang),
    enabled: !!wsId,
  });

  const config = configQuery.data;
  const available = availableQuery.data;
  const canEdit = config?.can_edit ?? false;

  const [draft, setDraft] = useState<AlertFieldRef[] | null>(null);
  useEffect(() => {
    if (config && draft === null) setDraft(config.fields);
  }, [config, draft]);

  const fields = draft ?? config?.fields ?? [];
  const dirty =
    !!config &&
    JSON.stringify(fields.map(alertFieldId)) !==
      JSON.stringify(config.fields.map(alertFieldId));

  const metaByKey = useMemo(() => {
    const m = new Map<string, AvailableMetaField>();
    for (const f of available?.meta ?? []) m.set(f.key, f);
    return m;
  }, [available]);

  const sampleById = useMemo(() => {
    const m = new Map<string, AlertRow>();
    for (const r of available?.sample?.rows ?? []) m.set(`${r.kind}:${r.key}`, r);
    return m;
  }, [available]);

  const chosen = new Set(fields.map(alertFieldId));

  // "All other details" on the newest inquiry: its details minus the ones
  // picked on their own — the same rule the server applies to the email.
  const allRows = useMemo(() => {
    const pinned = new Set(fields.filter((f) => f.kind === "meta").map((f) => f.key));
    return (available?.sample?.rows ?? []).filter((r) => r.kind === "meta" && !pinned.has(r.key));
  }, [available, fields]);

  const labelOf = (f: AlertFieldRef) =>
    f.kind === "core"
      ? t(`settings.inquiryMessage.fields.${f.key}`)
      : f.kind === "all"
        ? t("settings.inquiryMessage.all.label")
        : metaByKey.get(f.key)?.label ?? humanizeMetaKey(f.key);

  const exampleOf = (f: AlertFieldRef): string | null => {
    if (f.kind === "all") {
      return allRows.length
        ? t("settings.inquiryMessage.all.countOnLatest", { count: allRows.length })
        : t("settings.inquiryMessage.all.whatever");
    }
    if (available?.sample) return sampleById.get(alertFieldId(f))?.value ?? null;
    return f.kind === "core" ? EXAMPLE_VALUES[f.key] ?? null : metaByKey.get(f.key)?.example ?? null;
  };

  /** One picked item → the preview rows it becomes (the catch-all expands). */
  const previewRowsOf = (f: AlertFieldRef): PreviewRow[] => {
    if (f.kind !== "all") {
      const label = labelOf(f);
      return [
        {
          id: alertFieldId(f),
          kind: f.kind,
          key: f.key,
          label,
          chatLabel: f.kind === "core" ? CHAT_CORE_LABELS[f.key] : label,
          value: exampleOf(f),
        },
      ];
    }
    const shown: PreviewRow[] = allRows.slice(0, MAX_ALL_ROWS).map((r) => ({
      id: `all:${r.key}`,
      kind: "meta",
      key: r.key,
      label: r.label,
      chatLabel: r.label,
      value: r.value,
    }));
    const rest = allRows.length - shown.length;
    if (rest > 0) {
      shown.push({
        id: "all:more",
        kind: "more",
        key: "more",
        label: "",
        chatLabel: "More",
        value: t("settings.inquiryMessage.all.more", { count: rest }),
      });
    }
    return shown;
  };
  const full = fields.length >= MAX_FIELDS;

  const add = (f: AlertFieldRef) => {
    if (!canEdit || full || chosen.has(alertFieldId(f))) return;
    setDraft([...fields, f]);
  };
  const remove = (id: string) => setDraft(fields.filter((f) => alertFieldId(f) !== id));
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= fields.length) return;
    setDraft(arrayMove(fields, index, to));
  };

  const setConfig = (next: AlertFieldsConfig) => {
    queryClient.setQueryData(["inquiry-alerts", wsId], next);
    setDraft(next.fields);
  };

  const save = useMutation({
    mutationFn: () => saveAlertFields(fields),
    onSuccess: (next) => {
      setConfig(next);
      toast.success(
        next.fields.some((f) => f.kind === "all")
          ? t("settings.inquiryMessage.all.saved")
          : t("settings.inquiryMessage.saved", { count: next.fields.length }),
      );
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: resetAlertFields,
    onSuccess: (next) => {
      setConfig(next);
      toast.success(t("settings.inquiryMessage.resetDone"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const test = useMutation({
    mutationFn: sendAlertTest,
    onSuccess: (r) =>
      r.sent
        ? toast.success(t("settings.inquiryMessage.testSent", { email: r.to ?? "" }))
        : toast.error(t("settings.inquiryMessage.testFailed")),
    onError: () => toast.error(t("settings.inquiryMessage.testFailed")),
  });

  const [previewOpen, setPreviewOpen] = useState(false);

  if (configQuery.isError || availableQuery.isError) {
    return (
      <LoadError
        what={t("settings.inquiryMessage.metaTitle")}
        onRetry={() => {
          void configQuery.refetch();
          void availableQuery.refetch();
        }}
      />
    );
  }

  if (!config || !available) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-12">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  const coreLeft = CORE_ALERT_FIELDS.map((key) => ({ key, kind: "core" as const })).filter(
    (f) => !chosen.has(alertFieldId(f)),
  );
  const metaLeft = available.meta.filter((m) => !chosen.has(`meta:${m.key}`));

  const preview = (
    <MessagePreview
      rows={fields.flatMap(previewRowsOf)}
      classic={Object.fromEntries(
        CORE_ALERT_FIELDS.map((key) => [key, exampleOf({ key, kind: "core" })]),
      )}
      customised={config.customised || dirty}
      fromLatest={!!available.sample}
      workspaceName={currentWorkspace?.name ?? ""}
    />
  );

  return (
    <div className="grid gap-8 app-fade-up app-fade-up-d2 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <div className="min-w-0 space-y-7">
        {!canEdit ? (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            {t("settings.inquiryMessage.adminOnly")}
          </p>
        ) : null}

        <OrderList
          fields={fields}
          canEdit={canEdit}
          labelOf={labelOf}
          exampleOf={exampleOf}
          onMove={move}
          onRemove={remove}
          onReorder={(from, to) => setDraft(arrayMove(fields, from, to))}
        />

        {/* Phones: the preview lives in a sheet so the list stays in reach. */}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 lg:hidden"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="size-4" aria-hidden />
          {t("settings.inquiryMessage.showPreview")}
        </Button>

        {canEdit ? (
          <>
            <PickGroup title={t("settings.inquiryMessage.basics")}>
              {coreLeft.map((f) => (
                <AddRow
                  key={alertFieldId(f)}
                  label={labelOf(f)}
                  example={exampleOf(f)}
                  disabled={full}
                  onAdd={() => add(f)}
                />
              ))}
            </PickGroup>

            <ExtrasGroup
              items={metaLeft}
              total={available.meta.length}
              scanned={available.scanned}
              disabled={full}
              allChosen={chosen.has(alertFieldId(ALL_DETAILS_REF))}
              onAddAll={() => add(ALL_DETAILS_REF)}
              onAdd={(key) => add({ key, kind: "meta" })}
            />
            {full ? <p className="text-xs text-muted-foreground">{t("settings.inquiryMessage.maxReached")}</p> : null}
          </>
        ) : null}

        <div className="space-y-2 text-[13px] leading-5 text-muted-foreground">
          <p>{t("settings.inquiryMessage.privacy")}</p>
          <p className="flex items-start gap-2">
            <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("settings.inquiryMessage.phoneNote")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending || dirty}
            title={dirty ? t("settings.inquiryMessage.testUsesSaved") : undefined}
            className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {test.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
            {t("settings.inquiryMessage.test")}
          </button>
          {dirty ? <span className="text-xs text-muted-foreground">{t("settings.inquiryMessage.testUsesSaved")}</span> : null}
          {canEdit && config.customised && !dirty ? (
            <button
              type="button"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
              className="inline-flex min-h-10 items-center text-[14px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {t("settings.inquiryMessage.reset")}
            </button>
          ) : null}
        </div>

        <SaveBar
          dirty={dirty && canEdit}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => setDraft(config.fields)}
        />
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:block">{preview}</aside>

      <BottomSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={t("settings.inquiryMessage.preview")}
      >
        <div className="pb-4">{preview}</div>
      </BottomSheet>
    </div>
  );
}

/* ── The chosen fields, in order ─────────────────────────────── */

function OrderList({
  fields,
  canEdit,
  labelOf,
  exampleOf,
  onMove,
  onRemove,
  onReorder,
}: {
  fields: AlertFieldRef[];
  canEdit: boolean;
  labelOf: (f: AlertFieldRef) => string;
  exampleOf: (f: AlertFieldRef) => string | null;
  onMove: (index: number, delta: number) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = fields.map(alertFieldId);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onReorder(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[12px] font-medium text-muted-foreground">
        {t("settings.inquiryMessage.order")}
      </h2>
      {fields.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
          {t("settings.inquiryMessage.orderEmpty")}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {fields.map((f, i) => (
                <OrderRow
                  key={ids[i]}
                  id={ids[i]}
                  group={f.kind === "all"}
                  label={labelOf(f)}
                  example={exampleOf(f)}
                  canEdit={canEdit}
                  first={i === 0}
                  last={i === fields.length - 1}
                  onUp={() => onMove(i, -1)}
                  onDown={() => onMove(i, 1)}
                  onRemove={() => onRemove(ids[i])}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function OrderRow({
  id,
  group,
  label,
  example,
  canEdit,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: {
  id: string;
  /** "All other details": several rows in one — marked with the layers icon. */
  group?: boolean;
  label: string;
  example: string | null;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEdit,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex min-h-14 items-center gap-2 bg-card py-2 pl-2 pr-2 sm:pl-3",
        isDragging && "z-10 shadow-lg ring-1 ring-border",
      )}
    >
      {canEdit ? (
        <button
          type="button"
          className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted active:cursor-grabbing"
          aria-label={t("settings.inquiryMessage.drag", { label })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="w-2" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-foreground">
          {group ? <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          {label}
        </span>
        <span className={cn("block truncate text-[13px]", example ? "text-muted-foreground" : "italic text-muted-foreground/60")}>
          {example ?? t("settings.inquiryMessage.emptyHere")}
        </span>
      </span>
      {canEdit ? (
        <span className="flex shrink-0 items-center">
          {/* Arrows: always there for keyboard and screen readers. Desktop shows
              them on hover; phones drag (long-press), so they stay off-screen. */}
          <span className="flex items-center max-sm:sr-only sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 motion-reduce:transition-none">
            <IconButton label={t("settings.inquiryMessage.moveUp", { label })} disabled={first} onClick={onUp}>
              <ChevronUp className="size-4" />
            </IconButton>
            <IconButton label={t("settings.inquiryMessage.moveDown", { label })} disabled={last} onClick={onDown}>
              <ChevronDown className="size-4" />
            </IconButton>
          </span>
          <IconButton label={t("settings.inquiryMessage.remove", { label })} onClick={onRemove} tone="remove">
            <Minus className="size-3.5" strokeWidth={3} />
          </IconButton>
        </span>
      ) : null}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "add" | "remove";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="press flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
    >
      {tone ? (
        <span
          className={cn(
            "flex size-[22px] items-center justify-center rounded-full",
            tone === "add" ? "bg-foreground text-background" : "border border-border bg-muted text-foreground",
          )}
          aria-hidden
        >
          {children}
        </span>
      ) : (
        <span aria-hidden>{children}</span>
      )}
    </button>
  );
}

/* ── What can be added ───────────────────────────────────────── */

function PickGroup({
  title,
  hint,
  children,
  toolbar,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[12px] font-medium text-muted-foreground">{title}</h2>
          {hint ? <p className="text-[12px] text-muted-foreground/70">{hint}</p> : null}
        </div>
      </div>
      {toolbar}
      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{children}</ul>
      ) : null}
    </section>
  );
}

function AddRow({
  label,
  example,
  disabled,
  onAdd,
  icon: Icon,
}: {
  label: string;
  example: string | null;
  disabled: boolean;
  onAdd: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50 active:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] text-foreground", Icon && "font-medium")}>{label}</span>
          {example ? (
            <span className={cn("block text-[13px] text-muted-foreground", Icon ? "leading-snug" : "truncate")}>
              {example}
            </span>
          ) : null}
        </span>
        <span className="sr-only">{t("common.add")}</span>
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-foreground text-background" aria-hidden>
          <Plus className="size-3.5" strokeWidth={3} />
        </span>
      </button>
    </li>
  );
}

/**
 * Extras from forms, the website chat and the old lead endpoint. The first
 * item is always "All other details": the one choice that also covers keys
 * nobody has seen yet — what an endpoint sending unknown fields needs.
 */
function ExtrasGroup({
  items,
  total,
  scanned,
  disabled,
  allChosen,
  onAddAll,
  onAdd,
}: {
  items: AvailableMetaField[];
  total: number;
  scanned: number;
  disabled: boolean;
  allChosen: boolean;
  onAddAll: () => void;
  onAdd: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const query = q.trim().toLowerCase();
  const shown = query
    ? items.filter((m) => m.label.toLowerCase().includes(query) || (m.example ?? "").toLowerCase().includes(query))
    : items;

  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className="text-[12px] font-medium text-muted-foreground">{t("settings.inquiryMessage.extras")}</h2>
        {total > 0 ? (
          <p className="text-[12px] text-muted-foreground/70">
            {t("settings.inquiryMessage.extrasHint", { count: scanned })}
          </p>
        ) : null}
      </div>

      {!allChosen ? (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          <AddRow
            icon={Layers}
            label={t("settings.inquiryMessage.all.label")}
            example={t("settings.inquiryMessage.all.hint")}
            disabled={disabled}
            onAdd={onAddAll}
          />
        </ul>
      ) : null}

      {total === 0 ? (
        <p className="px-1 text-[13px] text-muted-foreground">{t("settings.inquiryMessage.extrasEmpty")}</p>
      ) : (
        <>
          {allChosen ? (
            <p className="px-1 text-[13px] text-muted-foreground">{t("settings.inquiryMessage.all.alreadyIncluded")}</p>
          ) : null}
          {total > SEARCH_FROM ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={withHint(t("settings.inquiryMessage.searchPlaceholder"))}
                className="h-10 pl-9"
              />
            </div>
          ) : null}
          {shown.length || query ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {shown.map((m) => (
                <AddRow key={m.key} label={m.label} example={m.example} disabled={disabled} onAdd={() => onAdd(m.key)} />
              ))}
              {query && shown.length === 0 ? (
                <li className="px-4 py-4 text-sm text-muted-foreground">{t("settings.inquiryMessage.noMatch", { q })}</li>
              ) : null}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ── Live preview ────────────────────────────────────────────── */

type PreviewRow = {
  id: string;
  kind: "core" | "meta" | "more";
  key: string;
  label: string;
  chatLabel: string;
  value: string | null;
};

function MessagePreview({
  rows,
  classic,
  customised,
  fromLatest,
  workspaceName,
}: {
  rows: PreviewRow[];
  /** Core values of the sample inquiry — the classic team chat message. */
  classic: Record<string, string | null>;
  customised: boolean;
  fromLatest: boolean;
  workspaceName: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"email" | "chat">("email");
  const filled = rows.filter((r) => r.value);
  const classicChat: PreviewRow[] = [
    { id: "c:name", kind: "core", key: "name", label: "", chatLabel: "Name", value: null },
    { id: "c:email", kind: "core", key: "email", label: "", chatLabel: "Email", value: null },
    { id: "c:phone", kind: "core", key: "phone", label: "", chatLabel: "Phone", value: null },
    { id: "c:source", kind: "core", key: "source", label: "", chatLabel: "Source", value: null },
    { id: "c:stage", kind: "core", key: "stage", label: "", chatLabel: "Stage", value: null },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          label={t("settings.inquiryMessage.preview")}
          role="tablist"
          options={[
            { value: "email", label: t("settings.inquiryMessage.previewEmail") },
            { value: "chat", label: t("settings.inquiryMessage.previewChat") },
          ]}
        />
        <span className="text-right text-[11px] leading-4 text-muted-foreground">
          {fromLatest ? t("settings.inquiryMessage.previewFromLatest") : t("settings.inquiryMessage.previewExample")}
        </span>
      </div>

      {tab === "email" ? (
        <div className="overflow-hidden rounded-xl border border-[#e2e1dc] bg-white text-[#141516] shadow-[0_1px_0_rgba(20,21,22,0.04),0_12px_32px_-16px_rgba(20,21,22,0.25)] dark:border-border">
          <div className="h-[3px] bg-[#f5d74f]" aria-hidden />
          <div className="px-5 pb-5 pt-5">
            <p className="text-[18px] font-bold leading-6">{t("settings.inquiryMessage.previewH1")}</p>
            <p className="text-[13px] text-[#6b6866]">
              {t("settings.inquiryMessage.previewFor")} <strong className="font-semibold text-[#141516]">{workspaceName}</strong>
            </p>
            {filled.length ? (
              <div className="mt-4 space-y-2.5 rounded-md border-l-[3px] border-[#f5d74f] bg-[#f5f4f1] px-4 py-3">
                {filled.map((r) =>
                  r.kind === "more" ? (
                    <p key={r.id} className="app-fade-in text-[13px] text-[#6b6866]">
                      {r.value}
                    </p>
                  ) : (
                  <div key={r.id} className="app-fade-in">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#9a9893]">{r.label}</p>
                    <p
                      className={cn(
                        "whitespace-pre-line break-words text-[14px] leading-5",
                        (r.key === "phone" || r.key === "email") && r.kind === "core" && "underline decoration-[#f5d74f] underline-offset-2",
                      )}
                    >
                      {r.value}
                    </p>
                  </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[#6b6866]">{t("settings.inquiryMessage.previewNoDetails")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[15px] font-bold text-foreground">New lead</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {(customised ? rows.filter((r) => r.value) : classicChat).map((r) => (
                <div key={r.id} className="min-w-0">
                  <dt className="text-[12px] font-semibold text-foreground">{r.chatLabel}</dt>
                  <dd className="truncate text-[13px] text-muted-foreground">
                    {customised ? r.value : classic[r.key] ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] font-medium text-foreground underline decoration-border underline-offset-2">
              Open in Repraesent
            </p>
          </div>
          <p className="text-[12px] leading-4 text-muted-foreground">
            {customised ? t("settings.inquiryMessage.chatCustomNote") : t("settings.inquiryMessage.chatStandardNote")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Save bar ────────────────────────────────────────────────── */

function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "pointer-events-none sticky bottom-4 z-30 transition-all duration-300 max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))] motion-reduce:transition-none",
        dirty ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      aria-hidden={!dirty}
    >
      <div
        className={cn(
          "flex items-center justify-end gap-3 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-lg backdrop-blur-md",
          dirty && "pointer-events-auto",
        )}
      >
        <span className="mr-auto hidden text-sm text-muted-foreground sm:inline">{t("settings.inquiryMessage.unsaved")}</span>
        <Button variant="ghost" onClick={onDiscard} disabled={saving || !dirty} tabIndex={dirty ? 0 : -1} className="max-sm:h-11 max-sm:flex-1">
          {t("settings.onboarding.discard")}
        </Button>
        <Button onClick={onSave} disabled={saving || !dirty} tabIndex={dirty ? 0 : -1} className="max-sm:h-11 max-sm:flex-1">
          {saving ? t("settings.onboarding.saving") : t("settings.inquiryMessage.save")}
        </Button>
      </div>
    </div>
  );
}
