import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Search, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { contactPath } from "~/lib/contacts/contact-path";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { cn } from "~/lib/utils";
import type { SegmentContactRow, SegmentContactsPage } from "~/lib/api/segments";

/**
 * The people in a segment, for both kinds.
 *
 * - "rules": the list fills itself from the rules, so nobody can be removed
 *   here; while the rules are being edited it shows who would match.
 * - "picked": a hand-picked list; each contact can be taken out.
 *
 * A contact that can't be emailed says why on its own line ("No email",
 * "Unsubscribed") — that is the gap between the two numbers in the heading,
 * shown on the people it concerns.
 */
export function SegmentContacts({
  mode,
  data,
  loading,
  unsaved = false,
  incomplete = false,
  search,
  onSearch,
  onPage,
  onRemove,
  removing = false,
  action,
  className,
}: {
  mode: "rules" | "picked";
  data: SegmentContactsPage | undefined;
  loading: boolean;
  /** Rules were changed and not saved: the list is a preview. */
  unsaved?: boolean;
  /** A rule is half filled in: there is nothing to show yet. */
  incomplete?: boolean;
  search: string;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  onRemove?: (row: SegmentContactRow) => void;
  removing?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { ref: searchRef, withHint } = useSearchShortcut();
  const fmt = (n: number) => n.toLocaleString(i18n.language);

  const matched = data?.matched ?? 0;
  const cannot = data ? data.matched - data.sendable : 0;
  const rows = data?.data ?? [];
  const searching = search.trim() !== "";
  const showSearch = !incomplete && (matched > 8 || searching);

  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}
      aria-labelledby="segment-contacts-title"
    >
      <header className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="segment-contacts-title"
              className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {t("emailCampaigns.segments.contacts.title", "Who is in this segment")}
            </h2>
            {incomplete ? null : !data ? (
              <Skeleton className="mt-2 h-8 w-40 rounded-md" />
            ) : (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="title-display num text-[28px] font-semibold text-foreground">
                  {fmt(matched)}
                </span>
                <span className="text-[14px] font-medium text-foreground">
                  {t("emailCampaigns.segments.contacts.count", {
                    defaultValue: "contacts",
                    count: matched,
                  })}
                </span>
                {matched > 0 ? (
                  <span className="text-[13px] text-muted-foreground">
                    {cannot === 0 ? (
                      t("emailCampaigns.segments.contacts.allCan", "· all can get emails")
                    ) : (
                      <>
                        {"· "}
                        <span className="marker num font-semibold text-foreground">{fmt(cannot)}</span>{" "}
                        {t("emailCampaigns.segments.contacts.cannot", {
                          defaultValue: "can't get emails",
                          count: cannot,
                        })}
                      </>
                    )}
                  </span>
                ) : null}
              </p>
            )}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {mode === "rules" && !incomplete ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {unsaved
              ? t(
                  "emailCampaigns.segments.contacts.unsaved",
                  "These are the contacts that match your changes. Save to keep the rules.",
                )
              : t(
                  "emailCampaigns.segments.contacts.rulesHint",
                  "This list fills itself from the rules. To take someone out, change the rules or the contact.",
                )}
          </p>
        ) : null}

        {showSearch ? (
          <div className="relative sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={withHint(
                t("emailCampaigns.segments.contacts.search", "Find in this segment"),
              )}
              aria-label={t("emailCampaigns.segments.contacts.search", "Find in this segment")}
            />
          </div>
        ) : null}
      </header>

      {incomplete ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted-foreground sm:px-5">
          {t("emailCampaigns.segments.contacts.incomplete", "Finish the rule to see who matches.")}
        </p>
      ) : !data ? (
        <div className="space-y-2 px-4 py-4 sm:px-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted-foreground sm:px-5">
          {searching
            ? t("emailCampaigns.segments.contacts.searchEmpty", {
                defaultValue: "No contact here matches “{{search}}”.",
                search: search.trim(),
              })
            : mode === "rules"
              ? t("emailCampaigns.segments.contacts.noneRules", "Nobody matches these rules yet.")
              : t("emailCampaigns.segments.noMembers", "Nobody here yet — add contacts to this list.")}
        </p>
      ) : (
        <ul
          className={cn("divide-y divide-border transition-opacity", loading && "opacity-60")}
          aria-busy={loading}
        >
          {rows.map((row) => (
            <ContactRow key={row.contact_id} row={row} onRemove={onRemove} removing={removing} />
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && !incomplete ? (
        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 sm:px-5">
          <span className="num text-[13px] text-muted-foreground">
            {t("emailCampaigns.segments.contacts.pageOf", {
              defaultValue: "{{from}}–{{to}} of {{total}}",
              from: fmt((data.page - 1) * data.limit + 1),
              to: fmt(Math.min(data.page * data.limit, data.total)),
              total: fmt(data.total),
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="max-sm:h-11 max-sm:px-4 max-sm:text-sm"
              disabled={!data.hasPrev || loading}
              onClick={() => onPage(data.page - 1)}
            >
              {t("common.previous", { defaultValue: "Previous" })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="max-sm:h-11 max-sm:px-4 max-sm:text-sm"
              disabled={!data.hasNext || loading}
              onClick={() => onPage(data.page + 1)}
            >
              {t("common.next", { defaultValue: "Next" })}
            </Button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}

function ContactRow({
  row,
  onRemove,
  removing,
}: {
  row: SegmentContactRow;
  onRemove?: (row: SegmentContactRow) => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  const name =
    row.full_name?.trim() ||
    row.email ||
    t("emailCampaigns.segments.unnamed", { defaultValue: "Unnamed" });
  // Where they work first (that tells two Annas apart), then how to reach them.
  const company = row.kind === "company" ? null : row.company_name;
  const second = [company, row.full_name?.trim() ? row.email : null, row.email ? null : row.phone]
    .filter(Boolean)
    .join(" · ");
  const tag = row.suppressed
    ? t("emailCampaigns.segments.contacts.unsubscribed", "Unsubscribed")
    : !row.email
      ? t("emailCampaigns.segments.contacts.noEmail", "No email")
      : null;

  return (
    <li className="flex items-stretch">
      <Link
        to={contactPath({ id: row.contact_id, kind: row.kind })}
        className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 sm:px-5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50"
        style={{ touchAction: "manipulation" }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-foreground">{name}</span>
          {second ? (
            <span className="block truncate text-[13px] text-muted-foreground">{second}</span>
          ) : null}
          {tag ? (
            <span className="mt-0.5 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-medium text-foreground">
              {tag}
            </span>
          ) : null}
        </span>
        {onRemove ? null : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
        )}
      </Link>
      {onRemove ? (
        <button
          type="button"
          disabled={removing}
          onClick={() => onRemove(row)}
          aria-label={t("emailCampaigns.segments.contacts.remove", {
            defaultValue: "Take {{name}} out of this segment",
            name,
          })}
          className="press flex w-12 shrink-0 select-none items-center justify-center text-muted-foreground disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/10 [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
          style={{ touchAction: "manipulation" }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}
