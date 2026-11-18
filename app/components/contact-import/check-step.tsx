import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { Segmented } from "~/components/notebook/segmented";
import { cn } from "~/lib/utils";
import type { ImportCheck } from "~/lib/api/contact-imports";
import { BigCount } from "./import-chrome";
import { changeFieldLabel, fileLine, problemTitle } from "./labels";

type RowChoices = Record<string, "update" | "skip">;

/** How many contacts the import would write with the current choices. */
export function plannedWrites(
  check: ImportCheck,
  existingMode: "update" | "skip",
  rowChoices: RowChoices,
): { add: number; update: number } {
  const changing = check.existing.filter((e) => e.changes.length > 0);
  const listed = changing.filter((e) =>
    (rowChoices[String(e.row_index)] ?? existingMode) === "update",
  ).length;
  // Rows beyond the listed ones follow the general choice.
  const unlisted =
    Math.max(0, check.counts.existing - check.counts.existing_unchanged - changing.length);
  return {
    add: check.counts.add,
    update: listed + (existingMode === "update" ? unlisted : 0),
  };
}

type Group = "problems" | "existing" | "workflows";

export function CheckStep({
  check,
  existingMode,
  onExistingMode,
  rowChoices,
  onRowChoices,
  workflowsAck,
  onWorkflowsAck,
  customLabel,
  busy,
}: {
  check: ImportCheck;
  existingMode: "update" | "skip";
  onExistingMode: (mode: "update" | "skip") => void;
  rowChoices: RowChoices;
  onRowChoices: (next: RowChoices) => void;
  workflowsAck: boolean;
  onWorkflowsAck: (ack: boolean) => void;
  customLabel: (key: string) => string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const c = check.counts;
  const changing = check.existing.filter((e) => e.changes.length > 0);
  const leftOut = c.problems;
  const changingTotal = c.existing - c.existing_unchanged;

  const { ref: searchRef, withHint } = useSearchShortcut();
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shownChanging = needle
    ? changing.filter((e) => `${e.contact_name} ${e.label}`.toLowerCase().includes(needle))
    : changing;

  // Desktop shows one group at a time next to a list of the groups; phones
  // (and a check with a single group) show everything in one column.
  const groups: Array<{ id: Group; label: string; count: number; marker?: boolean }> = [];
  if (check.workflows.length > 0) {
    groups.push({
      id: "workflows",
      label: t("contacts.importV2.check.navWorkflows", "Workflows that will start"),
      count: check.workflows.length,
      marker: !workflowsAck,
    });
  }
  if (check.problems.length > 0) {
    groups.push({
      id: "problems",
      label: t("contacts.importV2.check.problemsTitle", "Lines that can't be brought in"),
      count: leftOut,
      marker: true,
    });
  }
  if (changingTotal > 0) {
    groups.push({
      id: "existing",
      label: t("contacts.importV2.check.existingTitle", "Contacts that are already here"),
      count: changingTotal,
    });
  }
  const twoPane = groups.length > 1;
  const [picked, setPicked] = useState<Group | null>(null);
  const active = groups.some((g) => g.id === picked) ? picked : (groups[0]?.id ?? null);
  const paneClass = (id: Group) => cn(twoPane && active !== id && "lg:hidden");

  return (
    <div className={cn("space-y-8", busy && "pointer-events-none opacity-60")} aria-busy={busy}>
      <p className="text-[14px] text-muted-foreground">
        {t(
          "contacts.importV2.check.lead",
          "Nothing is saved yet. This is what will happen when you go on.",
        )}
      </p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
        <BigCount
          value={c.add}
          label={t("contacts.importV2.check.new", { defaultValue: "new contacts", count: c.add })}
          hint={
            c.without_email > 0
              ? t("contacts.importV2.check.withoutEmail", {
                  defaultValue: "{{count}} of them have no email and can't get emails.",
                  count: c.without_email,
                })
              : undefined
          }
        />
        <BigCount
          value={c.existing}
          label={t("contacts.importV2.check.existing", {
            defaultValue: "already in your contacts",
            count: c.existing,
          })}
          hint={
            c.existing > 0
              ? t("contacts.importV2.check.existingHint", {
                  defaultValue: "{{changing}} with something new, {{same}} the same as in the file.",
                  changing: changingTotal,
                  same: c.existing_unchanged,
                })
              : undefined
          }
        />
        <BigCount
          marker
          value={leftOut}
          label={t("contacts.importV2.check.leftOut", {
            defaultValue: "lines can't be brought in",
            count: leftOut,
          })}
          hint={leftOut > 0 ? t("contacts.importV2.check.leftOutHint", "See why below.") : undefined}
        />
      </div>

      {c.doubles > 0 ? (
        <p className="text-[13.5px] text-muted-foreground">
          {t("contacts.importV2.check.doubles", {
            defaultValue:
              "{{count}} lines name a contact that is already further up in the file. Each is joined with the first one, so no doubles are made.",
            count: c.doubles,
          })}
        </p>
      ) : null}

      <div className={cn(twoPane && "lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8")}>
        {twoPane ? (
          <nav
            className="hidden lg:sticky lg:top-6 lg:block"
            aria-label={t("contacts.importV2.check.navLabel", "What needs a look")}
          >
            <ul className="space-y-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(g.id)}
                    aria-current={active === g.id ? "true" : undefined}
                    className={cn(
                      "press flex w-full select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[14px]",
                      active === g.id
                        ? "bg-card font-semibold text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0">{g.label}</span>
                    <span className={cn("num shrink-0 font-semibold text-foreground", g.marker && "marker")}>
                      {g.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="min-w-0 space-y-8">
          {check.workflows.length > 0 ? (
            <section
              className={cn("rounded-xl border border-border bg-card px-4 py-4 sm:px-5", paneClass("workflows"))}
            >
              <h2 className="text-[15px] font-semibold text-foreground">
                <span className="marker">
                  {t("contacts.importV2.check.workflowsTitle", {
                    defaultValue: "{{count}} of your workflows will start for these contacts",
                    count: check.workflows.length,
                  })}
                </span>
              </h2>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[14px] text-foreground">
                {check.workflows.map((w) => (
                  <li key={w.id}>{w.name}</li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t(
                  "contacts.importV2.check.workflowsHint",
                  "They are turned on and start when a contact is added or changed. If they send emails, these contacts get them. To avoid that, turn the workflow off first.",
                )}
              </p>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-[14px] font-medium text-foreground">
                <Checkbox checked={workflowsAck} onCheckedChange={(v) => onWorkflowsAck(v === true)} />
                {t("contacts.importV2.check.workflowsAck", "That's fine, let them start")}
              </label>
            </section>
          ) : null}

          {check.problems.length > 0 ? (
            <section className={cn("space-y-2", paneClass("problems"))} aria-labelledby="import-problems">
              <h2 id="import-problems" className="text-[15px] font-semibold text-foreground">
                {t("contacts.importV2.check.problemsTitle", "Lines that can't be brought in")}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {t(
                  "contacts.importV2.check.problemsHint",
                  "Everything else still comes in. You can fix these in the file and bring it in again later; contacts already here are not doubled.",
                )}
              </p>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {check.problems.map((p) => (
                  <ProblemGroup key={p.code} problem={p} startOpen={twoPane || check.problems.length === 1} />
                ))}
              </div>
            </section>
          ) : null}

          {changingTotal > 0 ? (
            <section className={cn("space-y-3", paneClass("existing"))} aria-labelledby="import-existing">
              <h2 id="import-existing" className="text-[15px] font-semibold text-foreground">
                {t("contacts.importV2.check.existingTitle", "Contacts that are already here")}
              </h2>
              <Segmented<"update" | "skip">
                stretch
                label={t("contacts.importV2.check.existingTitle", "Contacts that are already here")}
                value={existingMode}
                onChange={onExistingMode}
                options={[
                  { value: "update", label: t("contacts.importV2.check.modeUpdate", "Add the file's details") },
                  { value: "skip", label: t("contacts.importV2.check.modeSkip", "Leave them as they are") },
                ]}
              />
              <p className="text-[13px] text-muted-foreground">
                {existingMode === "update"
                  ? t(
                      "contacts.importV2.check.modeUpdateHint",
                      "The file's values replace what is there. An empty cell never erases anything, and nobody's main email is changed. Untick a contact to leave it alone.",
                    )
                  : t(
                      "contacts.importV2.check.modeSkipHint",
                      "These contacts stay untouched. Tick one to give it the file's details anyway.",
                    )}
              </p>
              {changing.length > 8 ? (
                <div className="relative sm:max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    enterKeyHint="search"
                    placeholder={withHint(t("contacts.importV2.check.search", "Find a contact in this list"))}
                    aria-label={t("contacts.importV2.check.search", "Find a contact in this list")}
                  />
                </div>
              ) : null}
              {shownChanging.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">
                  {t("contacts.importV2.check.searchEmpty", {
                    defaultValue: "No contact in this list matches “{{search}}”.",
                    search: search.trim(),
                  })}
                </p>
              ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {shownChanging.map((e) => {
                  const key = String(e.row_index);
                  const on = (rowChoices[key] ?? existingMode) === "update";
                  const id = `import-existing-${e.row_index}`;
                  return (
                    <li key={e.row_index} className="flex gap-3 px-4 py-3 sm:px-5">
                      <span className="flex size-11 shrink-0 items-center justify-center sm:size-6 sm:pt-0.5">
                        <Checkbox
                          id={id}
                          checked={on}
                          onCheckedChange={(v) => {
                            const next = { ...rowChoices };
                            const wanted = v === true ? "update" : "skip";
                            if (wanted === existingMode) delete next[key];
                            else next[key] = wanted;
                            onRowChoices(next);
                          }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={id} className="block text-[14.5px] font-semibold text-foreground">
                          {e.contact_name || e.label}
                        </label>
                        <ul className={cn("mt-1 space-y-0.5 text-[13px]", !on && "opacity-50")}>
                          {e.changes.slice(0, 6).map((ch, i) => (
                            <li key={i} className="break-words text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {changeFieldLabel(t, ch.field, customLabel)}
                              </span>
                              {": "}
                              {ch.from ? (
                                <>
                                  <span className="line-through">{ch.from}</span>
                                  {" → "}
                                </>
                              ) : null}
                              <span className="text-foreground">{ch.to}</span>
                            </li>
                          ))}
                          {e.changes.length > 6 ? (
                            <li className="text-muted-foreground">
                              {t("contacts.importV2.check.moreChanges", {
                                defaultValue: "and {{count}} more",
                                count: e.changes.length - 6,
                              })}
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
              )}
              {changingTotal > changing.length ? (
                <p className="text-[13px] text-muted-foreground">
                  {t("contacts.importV2.check.moreExisting", {
                    defaultValue: "The first {{shown}} are listed. The other {{rest}} follow the choice above.",
                    shown: changing.length,
                    rest: changingTotal - changing.length,
                  })}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProblemGroup({
  problem,
  startOpen,
}: {
  problem: ImportCheck["problems"][number];
  startOpen: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex min-h-12 w-full select-none items-center justify-between gap-3 px-4 py-2.5 text-left sm:px-5"
        style={{ touchAction: "manipulation" }}
      >
        <span className="min-w-0 text-[14px] text-foreground">
          <span className="num font-semibold">{problem.count}</span>
          {" × "}
          {problemTitle(t, problem.code)}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-1 px-4 pb-3 text-[13px] text-muted-foreground sm:px-5">
          {problem.rows.map((r) => (
            <li key={r.row_index} className="break-words">
              <span className="num font-medium text-foreground">
                {t("contacts.importV2.check.line", { defaultValue: "Line {{n}}", n: fileLine(r.row_index) })}
              </span>
              {r.label ? ` · ${r.label}` : ""}
              {r.detail ? ` · ${r.detail}` : ""}
            </li>
          ))}
          {problem.count > problem.rows.length ? (
            <li>
              {t("contacts.importV2.check.moreLines", {
                defaultValue: "and {{count}} more lines",
                count: problem.count - problem.rows.length,
              })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
