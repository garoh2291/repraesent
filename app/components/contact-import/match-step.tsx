import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Segmented } from "~/components/notebook/segmented";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { cn } from "~/lib/utils";
import {
  customKeyFor,
  type ContactImport,
  type ImportColumn,
  type ImportTarget,
  type RowKind,
} from "~/lib/api/contact-imports";
import { TARGET_GROUPS, groupLabel, targetLabel } from "./labels";

/** One file column as the owner sees it: where it goes and, if kept as a detail, its name. */
export interface ColumnChoice {
  target: ImportTarget;
  /** Only used while `target` is "custom". */
  name: string;
}

const SINGLE_USE = (t: ImportTarget) => t !== "custom" && t !== "skip";

/** Why the matching can't be checked yet, per column. */
export function matchProblems(
  columns: ImportColumn[],
  choices: Record<number, ColumnChoice>,
): Record<number, "name_missing" | "name_twice"> {
  const out: Record<number, "name_missing" | "name_twice"> = {};
  const seen = new Map<string, number>();
  for (const c of columns) {
    const choice = choices[c.column];
    if (!choice || choice.target !== "custom") continue;
    const key = customKeyFor(choice.name);
    if (!key) {
      out[c.column] = "name_missing";
      continue;
    }
    if (seen.has(key)) out[c.column] = "name_twice";
    else seen.set(key, c.column);
  }
  return out;
}

export function MatchStep({
  imp,
  choices,
  onChoices,
  rowKind,
  onRowKind,
}: {
  imp: ContactImport;
  choices: Record<number, ColumnChoice>;
  onChoices: (next: Record<number, ColumnChoice>) => void;
  rowKind: RowKind;
  onRowKind: (kind: RowKind) => void;
}) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const [sheetFor, setSheetFor] = useState<number | null>(null);
  const problems = useMemo(() => matchProblems(imp.columns, choices), [imp.columns, choices]);

  const usedBy = useMemo(() => {
    const m = new Map<ImportTarget, number>();
    for (const c of imp.columns) {
      const target = choices[c.column]?.target;
      if (target && SINGLE_USE(target)) m.set(target, c.column);
    }
    return m;
  }, [imp.columns, choices]);

  /**
   * A contact field takes one column. Picking a field another column already
   * holds moves it here; the other column is kept as a detail under its own
   * header, so nothing is ever dropped by accident.
   */
  const choose = (column: number, target: ImportTarget) => {
    const next = { ...choices };
    const holder = SINGLE_USE(target) ? usedBy.get(target) : undefined;
    if (holder != null && holder !== column) {
      next[holder] = { target: "custom", name: imp.headers[holder] ?? "" };
    }
    next[column] = {
      target,
      name: target === "custom" ? next[column]?.name || imp.headers[column] || "" : next[column]?.name ?? "",
    };
    onChoices(next);
  };
  const rename = (column: number, name: string) =>
    onChoices({ ...choices, [column]: { target: "custom", name } });

  const has = (target: ImportTarget) => usedBy.has(target);
  const noIdentity =
    !has("email") && !has("company_name") && !has("full_name") && !has("first_name") && !has("last_name") && !has("phone");
  const noEmail = !noIdentity && !has("email");

  const sheetColumn = sheetFor == null ? null : imp.columns.find((c) => c.column === sheetFor) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[14px] font-medium text-foreground">
          {t("contacts.importV2.match.rowKind", "Each line of the file is")}
        </p>
        <Segmented<RowKind>
          stretch
          label={t("contacts.importV2.match.rowKind", "Each line of the file is")}
          value={rowKind}
          onChange={onRowKind}
          options={[
            { value: "person", label: t("contacts.importV2.match.kindPerson", "A person") },
            { value: "company", label: t("contacts.importV2.match.kindCompany", "A company") },
            { value: "auto", label: t("contacts.importV2.match.kindAuto", "Either") },
          ]}
        />
        {rowKind === "auto" ? (
          <p className="text-[13px] text-muted-foreground">
            {t(
              "contacts.importV2.match.kindAutoHint",
              "A line with a company and no person's name comes in as a company. Every other line comes in as a person.",
            )}
          </p>
        ) : null}
      </div>

      {noIdentity ? (
        <p role="alert" className="text-[14px] font-medium text-foreground">
          <span className="marker">
            {t(
              "contacts.importV2.match.noIdentity",
              "Choose which column holds the name, the company or the email. Without one of them there is nobody to save.",
            )}
          </span>
        </p>
      ) : noEmail ? (
        <p className="text-[13.5px] text-muted-foreground">
          {t(
            "contacts.importV2.match.noEmail",
            "No column is matched to Email. The contacts still come in, but we can't tell if a person is already in your contacts, and they can't get emails.",
          )}
        </p>
      ) : null}

      {/* The ledger: one ruled line per column of the file. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(0,5fr)_1.25rem_minmax(0,4fr)] gap-3 border-b border-border px-5 py-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:grid">
          <span>{t("contacts.importV2.match.inFile", "In your file")}</span>
          <span />
          <span>{t("contacts.importV2.match.goesTo", "Goes to")}</span>
        </div>
        <ul className="divide-y divide-border">
          {imp.columns.map((col) => {
            const choice = choices[col.column] ?? { target: "skip" as const, name: "" };
            const problem = problems[col.column];
            const label = choiceLabel(t, choice);
            const samples = col.samples.length
              ? col.samples.join(" · ")
              : t("contacts.importV2.match.emptyColumn", "This column is empty");
            return (
              <li key={col.column} className="px-4 py-3 sm:px-5">
                <div className="sm:grid sm:grid-cols-[minmax(0,5fr)_1.25rem_minmax(0,4fr)] sm:items-start sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-foreground">
                      <span className={cn(problem && "marker")}>{col.header}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-muted-foreground select-text">
                      {samples}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 hidden size-4 text-muted-foreground sm:block" aria-hidden />
                  <div className="min-w-0 max-sm:mt-2">
                    {phone ? (
                      <button
                        type="button"
                        onClick={() => setSheetFor(col.column)}
                        className="press flex min-h-11 w-full select-none items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                        style={{ touchAction: "manipulation" }}
                        aria-label={t("contacts.importV2.match.pickFor", {
                          defaultValue: "Where does “{{column}}” go? Now: {{target}}",
                          column: col.header,
                          target: label,
                        })}
                      >
                        <span className={cn("min-w-0 truncate", choice.target === "skip" && "text-muted-foreground")}>
                          {label}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    ) : (
                      <Select value={choice.target} onValueChange={(v) => choose(col.column, v as ImportTarget)}>
                        <SelectTrigger
                          className="h-9 w-full"
                          aria-label={t("contacts.importV2.match.pickFor", {
                            defaultValue: "Where does “{{column}}” go? Now: {{target}}",
                            column: col.header,
                            target: label,
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          <SelectGroup>
                            <SelectItem value="custom">{targetLabel(t, "custom")}</SelectItem>
                            <SelectItem value="skip">{targetLabel(t, "skip")}</SelectItem>
                          </SelectGroup>
                          {TARGET_GROUPS.map((g) => (
                            <SelectGroup key={g.id}>
                              <SelectSeparator />
                              <SelectLabel>{groupLabel(t, g.id)}</SelectLabel>
                              {g.targets.map((target) => {
                                const holder = usedBy.get(target);
                                return (
                                  <SelectItem key={target} value={target}>
                                    {targetLabel(t, target)}
                                    {holder != null && holder !== col.column ? (
                                      <span className="ml-1.5 text-muted-foreground">
                                        {t("contacts.importV2.match.usedBy", {
                                          defaultValue: "(now: {{column}})",
                                          column: imp.headers[holder],
                                        })}
                                      </span>
                                    ) : null}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {choice.target === "custom" ? (
                      <div className="mt-2">
                        <Input
                          value={choice.name}
                          onChange={(e) => rename(col.column, e.target.value)}
                          maxLength={60}
                          list="import-known-details"
                          autoCapitalize="sentences"
                          enterKeyHint="done"
                          aria-invalid={!!problem}
                          aria-label={t("contacts.importV2.match.detailName", {
                            defaultValue: "Name of the detail for “{{column}}”",
                            column: col.header,
                          })}
                          placeholder={t("contacts.importV2.match.detailPlaceholder", "Name of this detail")}
                          onFocus={(e) => {
                            // Phones: keep the field above the keyboard and the pinned buttons.
                            if (phone) {
                              const el = e.currentTarget;
                              window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
                            }
                          }}
                        />
                        {problem ? (
                          <p className="mt-1 text-[13px] font-medium text-destructive">
                            {problem === "name_missing"
                              ? t("contacts.importV2.match.nameMissing", "Give this detail a name, or choose “Don't bring in”.")
                              : t("contacts.importV2.match.nameTwice", "Another column already uses this name. Give this one a different name.")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <datalist id="import-known-details">
        {imp.known_custom_fields.map((k) => (
          <option key={k} value={k.replace(/_/g, " ")} />
        ))}
      </datalist>

      <BottomSheet
        open={sheetColumn != null}
        onOpenChange={(open) => !open && setSheetFor(null)}
        title={sheetColumn?.header ?? ""}
        description={
          sheetColumn?.samples.length
            ? sheetColumn.samples.join(" · ")
            : t("contacts.importV2.match.emptyColumn", "This column is empty")
        }
      >
        {sheetColumn ? (
          <div
            className="max-h-[60dvh] overflow-y-auto px-2 pb-4"
            style={{ overscrollBehavior: "contain" }}
          >
            <TargetList
              current={choices[sheetColumn.column]?.target ?? "skip"}
              usedBy={usedBy}
              column={sheetColumn.column}
              headers={imp.headers}
              onPick={(target) => {
                choose(sheetColumn.column, target);
                setSheetFor(null);
              }}
            />
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function choiceLabel(t: ReturnType<typeof useTranslation>["t"], choice: ColumnChoice): string {
  return targetLabel(t, choice.target);
}

/** The phone picker: big rows, the current choice ticked. */
function TargetList({
  current,
  usedBy,
  column,
  headers,
  onPick,
}: {
  current: ImportTarget;
  usedBy: Map<ImportTarget, number>;
  column: number;
  headers: string[];
  onPick: (target: ImportTarget) => void;
}) {
  const { t } = useTranslation();
  const row = (target: ImportTarget) => {
    const holder = usedBy.get(target);
    const taken = holder != null && holder !== column;
    return (
      <button
        key={target}
        type="button"
        onClick={() => onPick(target)}
        className="press flex min-h-12 w-full select-none items-center justify-between gap-3 rounded-lg px-3 text-left text-[16px] text-foreground active:bg-muted"
        style={{ touchAction: "manipulation" }}
        aria-pressed={current === target}
      >
        <span className="min-w-0">
          <span className="block truncate">{targetLabel(t, target)}</span>
          {taken ? (
            <span className="block truncate text-[12.5px] text-muted-foreground">
              {t("contacts.importV2.match.usedBy", {
                defaultValue: "(now: {{column}})",
                column: headers[holder],
              })}
            </span>
          ) : null}
        </span>
        {current === target ? <Check className="size-5 shrink-0" aria-hidden /> : null}
      </button>
    );
  };
  return (
    <div>
      {row("custom")}
      {row("skip")}
      {TARGET_GROUPS.map((g) => (
        <div key={g.id} className="mt-2 border-t border-border pt-2">
          <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {groupLabel(t, g.id)}
          </p>
          {g.targets.map(row)}
        </div>
      ))}
    </div>
  );
}
