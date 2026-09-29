import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Mail, Inbox, ArrowRight } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getBccMessages } from "~/lib/api/bcc-logs";
import { EmailCard } from "~/components/organism/email-card";
import { MailCardActions } from "~/components/organism/mail-card-actions";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Segmented } from "~/components/notebook/segmented";
import { cn } from "~/lib/utils";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import i18n from "~/i18n";

export function meta() {
  return [
    {
      title:
        i18n.t("mail.metaTitle", { defaultValue: "Mail" }) + " - Repraesent",
    },
    {
      name: "description",
      content: i18n.t("mail.metaDescription", {
        defaultValue: "All emails logged for your workspace.",
      }),
    },
  ];
}

const PAGE_SIZE = 20;
type MailFilter = "all" | "unlinked" | "linked";

export default function MailPage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [filter, setFilter] = useState<MailFilter>("all");

  useDocumentMeta({
    titleKey: "mail.metaTitle",
    descriptionKey: "mail.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const query = useInfiniteQuery({
    queryKey: ["mail-messages", filter],
    queryFn: ({ pageParam }) =>
      getBccMessages({
        page: pageParam,
        pageSize: PAGE_SIZE,
        unlinked: filter === "unlinked" ? true : undefined,
        linked: filter === "linked" ? true : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize;
      return (lastPage.total ?? 0) > loaded ? lastPage.page + 1 : undefined;
    },
    enabled: !!currentWorkspace,
  });

  const messages = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const filters: { key: MailFilter; label: string }[] = [
    { key: "all", label: t("mail.filterAll", { defaultValue: "All" }) },
    {
      key: "unlinked",
      label: t("mail.filterUnlinked", { defaultValue: "Needs contact" }),
    },
    {
      key: "linked",
      label: t("mail.filterLinked", { defaultValue: "Linked" }),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 sm:space-y-8 sm:p-6 app-fade-in">
      {/* Header */}
      <div className="app-fade-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 max-sm:hidden">
            <Mail className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
              {t("mail.pageTitle", { defaultValue: "Mail" })}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("mail.pageSubtitlePlain", {
                defaultValue: "Every email you copied in, in one place.",
              })}
            </p>
          </div>
        </div>

        {/* Segmented filter */}
        <Segmented
          label={t("mail.filterLabel", { defaultValue: "Show" })}
          value={filter}
          onChange={setFilter}
          stretch
          className="shrink-0"
          options={filters.map((f) => ({ value: f.key, label: f.label }))}
        />
      </div>

      {/* Body */}
      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <Skeleton className="h-[76px] w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">
          {t("mail.loadError", { defaultValue: "Could not load emails." })}
        </p>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <p className="text-sm font-medium text-foreground">
            {filter === "all"
              ? t("mail.emptyTitle", { defaultValue: "No emails yet" })
              : t("mail.emptyFilteredTitle", {
                  defaultValue: "Nothing here",
                })}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t("mail.emptySubtitlePlain", {
              defaultValue:
                "Put your copy address in BCC when you send an email, and it shows up here.",
            })}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5 max-sm:h-11 max-sm:px-4 max-sm:text-sm">
            <Link to="/settings/bcc">
              <Mail className="size-3.5" />
              {t("mail.emptyCtaPlain", { defaultValue: "Set up email copies (BCC)" })}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={m.id}
                className={cn("app-fade-up", i < 4 && `app-fade-up-d${i + 1}`)}
              >
                <EmailCard
                  message={m}
                  locale={i18nInstance.language}
                  actions={<MailCardActions message={m} />}
                />
              </div>
            ))}
          </div>

          {query.hasNextPage && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="gap-2 max-sm:h-11 max-sm:w-full max-sm:text-sm"
              >
                {query.isFetchingNextPage && (
                  <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                )}
                {t("mail.loadMore", { defaultValue: "Load more" })}
              </Button>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            {t("mail.showingCount", {
              defaultValue: "Showing {{shown}} of {{total}}",
              shown: messages.length,
              total,
            })}
          </p>
        </>
      )}
    </div>
  );
}
