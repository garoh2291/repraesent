import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Code2, CopyX, Lock, Plus, ShieldAlert, Trash2 } from "lucide-react";
import {
  getWorkspaceWebsiteCodePolicy,
  requestWorkspaceWebsiteCodeHosts,
  type WebsiteCodePolicy,
} from "~/lib/api/wordpress-hub";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type {
  ReCookieConsentMode,
  ReCookieNamedScript,
  ReCookieScriptCategory,
  ReCookieScriptPlacement,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";
import { checkCode, duplicateOf } from "~/lib/wordpress/website-code-policy";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Textarea } from "~/components/ui/textarea";
import { CardBody, CardHeader, InfoNote, SectionCard } from "~/components/wordpress/fields";
import {
  asScriptList,
  NAMED_SCRIPT_CATS,
  NAMED_SCRIPT_LABELS,
  type PatchSettings,
} from "~/components/wordpress/re-cookie/constants";
import { cn } from "~/lib/utils";

/** Same limits as re:cookie and the API. */
const MAX_PIECES = 30;
const MAX_BYTES = 20_000;

type When = "always" | ReCookieScriptCategory;

/** One piece of code as the tab edits it; `uid` keeps its place in the list. */
type Row = {
  uid: string;
  category: ReCookieScriptCategory;
  name: string;
  script: string;
  always_on: boolean;
  placement: ReCookieScriptPlacement;
};

let nextUid = 0;
const uid = () => `code-${++nextUid}`;

function rowsFrom(settings: ReCookieSettings): Row[] {
  const rows: Row[] = [];
  for (const category of NAMED_SCRIPT_CATS) {
    for (const item of asScriptList(settings.integrations.named_scripts[category])) {
      rows.push({
        uid: uid(),
        category,
        name: item.name ?? "",
        script: item.script ?? "",
        always_on: !!item.always_on,
        placement:
          item.placement === "body_open" || item.placement === "footer" ? item.placement : "head",
      });
    }
  }
  return rows;
}

function namedFrom(rows: Row[]): Record<ReCookieScriptCategory, ReCookieNamedScript[]> {
  const out = { functional: [], analytics: [], marketing: [] } as Record<
    ReCookieScriptCategory,
    ReCookieNamedScript[]
  >;
  for (const r of rows) {
    out[r.category].push({
      name: r.name,
      script: r.script,
      always_on: r.always_on,
      placement: r.placement,
    });
  }
  return out;
}

/**
 * Website settings › Code: code a tool gives the customer (a chat widget, a
 * verification tag, a pixel), with where on the page it goes and — while the
 * cookie banner asks — whether it waits for the visitor's consent.
 *
 * Stored as re:cookie's named scripts (one list per consent group), so the
 * banner lists every piece. The tab keeps its own list order: changing what a
 * piece waits for moves it to another group in storage, never on screen.
 */
export function WebsiteCodePanel({
  siteId,
  settings,
  patch,
  consentMode,
  canEdit,
  bannerPaused,
  plausibleOn,
}: {
  siteId: string;
  settings: ReCookieSettings;
  patch: PatchSettings;
  consentMode: ReCookieConsentMode;
  canEdit: boolean;
  bannerPaused: boolean;
  /** Repraesent's visitor statistics (Plausible) already load on every page. */
  plausibleOn: boolean;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(settings));
  // The named scripts this tab wrote last. Anything else arriving in settings
  // (a reseed after save, a site switch) replaces the list.
  const written = useRef(settings.integrations.named_scripts);
  useEffect(() => {
    if (settings.integrations.named_scripts !== written.current) {
      written.current = settings.integrations.named_scripts;
      setRows(rowsFrom(settings));
    }
  }, [settings]);

  function commit(next: Row[]) {
    setRows(next);
    const named = namedFrom(next);
    written.current = named;
    patch((prev) => ({
      ...prev,
      integrations: { ...prev.integrations, named_scripts: named },
    }));
  }

  const update = (id: string, change: Partial<Row>) =>
    commit(rows.map((r) => (r.uid === id ? { ...r, ...change } : r)));

  function add() {
    commit([
      ...rows,
      { uid: uid(), category: "functional", name: "", script: "", always_on: false, placement: "head" },
    ]);
  }

  const policy = useQuery({
    queryKey: ["workspace-wp-site-code-policy", siteId],
    queryFn: getWorkspaceWebsiteCodePolicy,
    staleTime: 5 * 60_000,
    // The site couldn't be asked: ask again in a while rather than keep "unknown".
    refetchInterval: (query) => (query.state.data?.enforced === null ? 30_000 : false),
  });

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <p className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {t(
            "wordpress.websiteCode.adminsOnly",
            "Only admins of this workspace can change the code on your website. You can see what's there.",
          )}
        </p>
      ) : null}

      {bannerPaused ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          {t(
            "wordpress.websiteCode.paused",
            "The cookie banner service is paused, so none of this code loads right now. Switch it back on on the cookie banner page.",
          )}
        </p>
      ) : null}

      <SectionCard>
        <CardHeader
          icon={<Code2 className="size-4" />}
          title={t("wordpress.websiteCode.title", "Code on your website")}
          subtitle={
            consentMode === "ask"
              ? t(
                  "wordpress.websiteCode.subtitleAsk",
                  "Paste the code a tool gives you and choose where it goes. Code that sets cookies waits until the visitor agrees.",
                )
              : consentMode === "region"
                ? t(
                    "wordpress.websiteCode.subtitleRegion",
                    "Paste the code a tool gives you and choose where it goes. For visitors in Europe, code that sets cookies waits until they agree.",
                  )
                : t(
                    "wordpress.websiteCode.subtitleOff",
                    "Paste the code a tool gives you and choose where it goes. There's no cookie banner, so it loads for every visitor.",
                  )
          }
        />
        <CardBody className="space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t(
                "wordpress.websiteCode.empty",
                "No code yet. Add the code a tool gives you, for example a chat widget or a verification tag.",
              )}
            </p>
          ) : null}

          {rows.map((row, idx) => (
            <CodeRow
              key={row.uid}
              index={idx}
              row={row}
              consentMode={consentMode}
              canEdit={canEdit}
              policy={policy.data}
              duplicate={duplicateOf(row.script, settings.integrations, plausibleOn)}
              onChange={(change) => update(row.uid, change)}
              onRemove={() => commit(rows.filter((r) => r.uid !== row.uid))}
            />
          ))}

          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full border-dashed text-muted-foreground sm:h-10"
              onClick={add}
              disabled={rows.length >= MAX_PIECES}
            >
              <Plus className="size-4" />
              {rows.length >= MAX_PIECES
                ? t("wordpress.websiteCode.full", "At most {{count}} pieces of code", { count: MAX_PIECES })
                : t("wordpress.websiteCode.add", "Add code")}
            </Button>
          ) : null}
        </CardBody>
      </SectionCard>

      <InfoNote>
        {t(
          "wordpress.websiteCode.saveNote",
          "Changes go live on your website when you save. Code you add here runs for your visitors, so only paste code from tools you trust.",
        )}
      </InfoNote>
    </div>
  );
}

const PLACEMENTS: { value: ReCookieScriptPlacement; key: string; label: string }[] = [
  { value: "head", key: "wordpress.websiteCode.whereHeader", label: "Header" },
  { value: "body_open", key: "wordpress.websiteCode.wherePage", label: "Page" },
  { value: "footer", key: "wordpress.websiteCode.whereFooterShort", label: "Footer" },
];

/** Header / Page / Footer, all three in view (a dropdown hid the choice). */
function PlacementPicker({
  labelledBy,
  value,
  onChange,
  disabled,
}: {
  labelledBy: string;
  value: ReCookieScriptPlacement;
  onChange: (next: ReCookieScriptPlacement) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const at = Math.max(0, PLACEMENTS.findIndex((p) => p.value === value));

  function move(step: number, from: HTMLElement) {
    const next = PLACEMENTS[(at + step + PLACEMENTS.length) % PLACEMENTS.length];
    onChange(next.value);
    const buttons = from.parentElement?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons?.[PLACEMENTS.indexOf(next)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-[3px]"
    >
      {PLACEMENTS.map((p, i) => {
        const selected = i === at;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(p.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1, e.currentTarget);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1, e.currentTarget);
              }
            }}
            className={cn(
              "h-9 rounded-md px-2 text-sm font-medium transition-colors max-sm:h-11 disabled:cursor-not-allowed disabled:opacity-60",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {t(p.key, p.label)}
          </button>
        );
      })}
    </div>
  );
}

function CodeRow({
  index,
  row,
  consentMode,
  canEdit,
  policy,
  duplicate,
  onChange,
  onRemove,
}: {
  index: number;
  row: Row;
  consentMode: ReCookieConsentMode;
  canEdit: boolean;
  policy: WebsiteCodePolicy | undefined;
  /** What this code repeats (it is then left off the site), or null. */
  duplicate: string | null;
  onChange: (change: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = `website-code-${row.uid}`;
  const when: When = row.always_on ? "always" : row.category;
  const waits = consentMode !== "off" && !row.always_on;
  const tooBig = new TextEncoder().encode(row.script).length > MAX_BYTES;
  const check = useMemo(() => checkCode(row.script, policy), [row.script, policy]);

  return (
    <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <Input
          id={`${id}-name`}
          aria-label={t("wordpress.websiteCode.nameLabel", "Name")}
          placeholder={t("wordpress.websiteCode.namePlaceholder", "Name, e.g. Chat widget")}
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={!canEdit}
          className="h-10 flex-1 bg-card max-sm:h-11"
        />
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-muted-foreground hover:text-destructive max-sm:size-11"
            onClick={onRemove}
            aria-label={t("wordpress.websiteCode.remove", "Remove this code")}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <Textarea
        id={`${id}-code`}
        aria-label={t("wordpress.websiteCode.codeLabel", "Code")}
        placeholder="<script>…</script>"
        value={row.script}
        onChange={(e) => onChange({ script: e.target.value })}
        disabled={!canEdit}
        spellCheck={false}
        className="mt-2.5 min-h-[120px] bg-card font-mono text-xs leading-relaxed"
      />
      {tooBig ? (
        <p className="mt-1.5 text-xs text-destructive">
          {t("wordpress.websiteCode.tooBig", "This code is too long (at most 20 KB). Paste only the code the tool gives you.")}
        </p>
      ) : null}

      {/* Both dropdowns fill their column, whatever their longest option. */}
      <div
        className={cn(
          "mt-3 grid gap-3 [&_[data-slot=native-select-wrapper]]:w-full",
          consentMode !== "off" && "sm:grid-cols-2",
        )}
      >
        <div className="space-y-1.5">
          <p id={`${id}-where`} className="text-xs font-medium">
            {t("wordpress.websiteCode.whereInject", "Where on the page should the code be injected?")}
          </p>
          <PlacementPicker
            labelledBy={`${id}-where`}
            value={row.placement}
            onChange={(placement) => onChange({ placement })}
            disabled={!canEdit}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {row.placement === "body_open"
              ? t("wordpress.websiteCode.wherePageHint", "At the start of the page content, on every page.")
              : row.placement === "footer"
                ? t("wordpress.websiteCode.whereFooterHint", "At the very end of every page, after everything else.")
                : t("wordpress.websiteCode.whereHeaderHint", "In the page header, before anything shows. Most tools ask for this.")}
          </p>
        </div>

        {consentMode !== "off" ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-when`} className="text-xs font-medium">
              {t("wordpress.websiteCode.when", "When it loads")}
            </Label>
            <NativeSelect
              id={`${id}-when`}
              value={when}
              onChange={(e) => {
                const v = e.target.value as When;
                onChange(v === "always" ? { always_on: true } : { always_on: false, category: v });
              }}
              disabled={!canEdit}
              className="h-10 bg-card max-sm:h-11"
            >
              <NativeSelectOption value="always">
                {t("wordpress.websiteCode.whenAlways", "Always, for every visitor")}
              </NativeSelectOption>
              {/* Just the group name shows when closed: "After the visitor agrees
                  to …" in every option was cut off on phones. */}
              <NativeSelectOptGroup
                label={t("wordpress.websiteCode.whenAfterGroup", "After the visitor agrees to…")}
              >
                {NAMED_SCRIPT_CATS.map((cat) => (
                  <NativeSelectOption key={cat} value={cat}>
                    {t(`wordpress.reCookie.namedScripts.${cat}`, NAMED_SCRIPT_LABELS[cat])}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {row.always_on
                ? t(
                    "wordpress.websiteCode.whenAlwaysHint",
                    "Only for code that sets no cookies. The cookie banner lists it under Always on.",
                  )
                : t(
                    "wordpress.websiteCode.whenAfterHint",
                    "The cookie banner lists it under this group, and it loads once the visitor agrees.",
                  )}
            </p>
          </div>
        ) : null}
      </div>

      {waits && /document\.write\s*\(/.test(row.script) ? (
        <p className="mt-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          {t(
            "wordpress.websiteCode.documentWrite",
            "This code uses document.write, which can't work once the page has loaded. Choose “Always” if it sets no cookies, or ask the tool for its newer code.",
          )}
        </p>
      ) : null}

      {duplicate ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <CopyX className="mt-0.5 size-3.5 shrink-0" />
          {t(
            "wordpress.websiteCode.duplicate",
            "{{name}} is already on your website, so this code is left out. Loading it twice would count every visit twice. You can remove it here.",
            { name: duplicate },
          )}
        </p>
      ) : null}
      <BlockedNotice check={check} canEdit={canEdit} />
    </div>
  );
}

/**
 * The site's policy blocks part of this code: say so, and let the customer ask
 * our team to allow the address (one request per site and set of addresses).
 */
function BlockedNotice({ check, canEdit }: { check: ReturnType<typeof checkCode>; canEdit: boolean }) {
  const { t } = useTranslation();
  const [asked, setAsked] = useState<string | null>(null);
  const ask = useMutation({
    mutationFn: () => requestWorkspaceWebsiteCodeHosts(check.blockedHosts),
    onSuccess: (res) => setAsked(res.requested.join(",")),
  });
  if (check.blockedHosts.length === 0 && !check.inlineBlocked) return null;
  const list = check.blockedHosts.join(", ");
  const done = asked === check.blockedHosts.join(",");

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
      <p className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {check.blockedHosts.length > 0
            ? t("wordpress.websiteCode.blocked", {
                hosts: list,
                defaultValue:
                  "Your website only loads code from addresses we've approved, and {{hosts}} isn't one of them yet. Until it is, this code can't run.",
              })
            : t(
                "wordpress.websiteCode.inlineBlocked",
                "Your website doesn't run code pasted straight into the page. Ask us to change that before this code can run.",
              )}
        </span>
      </p>
      {check.blockedHosts.length > 0 && canEdit ? (
        done ? (
          <p className="mt-2 flex items-center gap-1.5 pl-5.5 font-medium">
            <Check className="size-3.5" />
            {t("wordpress.websiteCode.asked", "We've asked our team to allow it. The code starts working once they have.")}
          </p>
        ) : (
          <div className="mt-2 pl-5.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 bg-card max-sm:h-11"
              disabled={ask.isPending}
              onClick={() => ask.mutate()}
            >
              {t("wordpress.websiteCode.ask", "Ask us to allow it")}
            </Button>
            {ask.isError ? (
              <p className="mt-1.5 text-destructive">{extractErrorMessage(ask.error)}</p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
