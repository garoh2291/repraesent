import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Check, Search } from "lucide-react";
import { SafeImg } from "~/components/atom/safe-img";
import { cn } from "~/lib/utils";
import type { AgencyChild, WorkspaceContext } from "~/lib/api/auth";

/**
 * The one list of businesses a person can open — used by the phone menu, the
 * sidebar, the switch dialog and the sign-in picker, so they all say the same
 * thing (AGENCY_MODE_PLAN.md, picker redesign).
 *
 * A row's small second line says what it is in plain words, only when there
 * is something to say: "Agency · 3 of 10 businesses", "Managed by Studio
 * Nord". A standard business has no second line, so nothing changes for
 * people without agencies. Businesses reached through an agency come after
 * the person's own, under "Your businesses".
 */

const SEARCH_FROM = 9;

function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const letter = (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-foreground text-[13px] font-semibold text-background"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase() || <Building2 className="size-4" />}
    </span>
  );
  if (!src) return letter;
  return (
    <SafeImg
      src={src}
      className="shrink-0 rounded-lg border border-border bg-white object-contain p-1"
      style={{ width: size, height: size }}
      fallback={letter}
    />
  );
}

function Row({
  name,
  avatar,
  hint,
  current,
  onPick,
}: {
  name: string;
  avatar?: string | null;
  hint?: string | null;
  current: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={onPick}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          current && "bg-muted/60",
        )}
      >
        <Avatar name={name} src={avatar} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium leading-tight text-foreground">{name}</span>
          {hint ? (
            <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted-foreground">{hint}</span>
          ) : null}
        </span>
        {current ? <Check className="size-4 shrink-0 text-foreground" aria-hidden /> : null}
      </button>
    </li>
  );
}

/** The small second line for one of the person's own businesses. */
export function useWorkspaceHint() {
  const { t } = useTranslation();
  return (ws: Pick<WorkspaceContext, "agency" | "managed_by" | "type" | "via_agency_name">): string | null => {
    if (ws.via_agency_name) return t("agency.picker.via", { agency: ws.via_agency_name });
    if (ws.agency?.status === "active") {
      return ws.agency.child_limit == null
        ? t("agency.picker.agencyUnlimited", { count: ws.agency.child_count })
        : t("agency.picker.agencyOfLimit", { count: ws.agency.child_count, limit: ws.agency.child_limit });
    }
    if (ws.managed_by) return t("agency.picker.managedBy", { agency: ws.managed_by.name });
    if (ws.type === "doorboost_brand") return t("nav.brand_label", "Brand");
    return null;
  };
}

export function WorkspaceList({
  workspaces,
  agencyChildren,
  currentId,
  onPick,
  brand,
  onPickBrand,
  className,
}: {
  workspaces: WorkspaceContext[];
  agencyChildren: AgencyChild[];
  currentId: string | null | undefined;
  onPick: (workspaceId: string) => void;
  brand?: { name: string } | null;
  onPickBrand?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const hint = useWorkspaceHint();
  const [q, setQ] = useState("");
  const total = workspaces.length + agencyChildren.length;
  const agencyCount = new Set(agencyChildren.map((c) => c.agency_workspace_id)).size;

  const needle = q.trim().toLowerCase();
  const match = (name: string) => !needle || name.toLowerCase().includes(needle);
  const own = useMemo(() => workspaces.filter((w) => match(w.name)), [workspaces, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const children = useMemo(() => agencyChildren.filter((c) => match(c.name)), [agencyChildren, needle]); // eslint-disable-line react-hooks/exhaustive-deps

  const childHint = (c: AgencyChild) => {
    const parts: string[] = [];
    if (agencyCount > 1) parts.push(t("agency.picker.via", { agency: c.agency_name }));
    if (c.website_state === "building") parts.push(t("agency.picker.websiteBuilding"));
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {total >= SEARCH_FROM ? (
        <label className="relative block border-b border-border px-3 py-2">
          <span className="sr-only">{t("agency.picker.search")}</span>
          <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("agency.picker.search")}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
        </label>
      ) : null}
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <ul>
          {brand && onPickBrand && match(brand.name) ? (
            <Row name={brand.name} hint={t("nav.brand_label", "Brand")} current={false} onPick={onPickBrand} />
          ) : null}
          {own.map((w) => (
            <Row
              key={w.id}
              name={w.name}
              avatar={w.avatar_thumb_url ?? w.avatar_url}
              hint={hint(w)}
              current={w.id === currentId}
              onPick={() => onPick(w.id)}
            />
          ))}
        </ul>
        {children.length > 0 ? (
          <>
            <p className="border-t border-border px-3 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("agency.picker.yourBusinesses")}
            </p>
            <ul>
              {children.map((c) => (
                <Row
                  key={c.id}
                  name={c.name}
                  avatar={c.avatar_thumb_url}
                  hint={childHint(c)}
                  current={c.id === currentId}
                  onPick={() => onPick(c.id)}
                />
              ))}
            </ul>
          </>
        ) : null}
        {needle && own.length === 0 && children.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t("agency.picker.noMatch")}</p>
        ) : null}
      </div>
    </div>
  );
}
