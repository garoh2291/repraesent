import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { useAiVisibilityAnswers } from "~/lib/hooks/useAiVisibility";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AnswerList } from "~/components/ai-visibility/answer-list";
import { AnswerSheet } from "~/components/ai-visibility/answer-sheet";
import { Segmented, num, useFilters } from "~/components/ai-visibility/shared";

const PAGE = 25;

/** Every answer, newest first — the raw material behind every number. */
export default function AiVisibilityAnswers() {
  const { t } = useTranslation();
  const [filters] = useFilters();
  const [mentioned, setMentioned] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useAiVisibilityAnswers({ ...filters, mentioned: mentioned === "all" ? null : mentioned, limit: PAGE, offset: page * PAGE });
  const d = q.data;
  const pages = d ? Math.max(1, Math.ceil(d.total / PAGE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<"all" | "yes" | "no">
          label={t("aiVisibility.answers.filter", "Show")}
          value={mentioned}
          onChange={(v) => {
            setMentioned(v);
            setPage(0);
          }}
          options={[
            { value: "all", label: t("aiVisibility.answers.all", "All") },
            { value: "yes", label: t("aiVisibility.answers.withYou", "Named you") },
            { value: "no", label: t("aiVisibility.answers.withoutYou", "Didn't name you") },
          ]}
        />
        {d ? <span className="num text-[12.5px] text-muted-foreground">{t("aiVisibility.answers.total", "{{n}} answers", { n: num(d.total) })}</span> : null}
      </div>

      {!d ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : d.items.length ? (
        <Panel className="overflow-hidden">
          <AnswerList items={d.items} onOpen={setOpenId} />
          {pages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 sm:px-5">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t("aiVisibility.common.prev", "Newer")}
              </Button>
              <span className="num text-[12.5px] text-muted-foreground">
                {page + 1} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                {t("aiVisibility.common.next", "Older")}
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel>
          <EmptyState icon={<MessagesSquare />} title={t("aiVisibility.answers.none", "No answers match.")} />
        </Panel>
      )}
      <AnswerSheet answerId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
