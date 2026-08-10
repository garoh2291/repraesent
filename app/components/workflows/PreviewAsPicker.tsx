import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  getRecentRecords,
  type RecentRecord,
  type WorkflowEntity,
} from "~/lib/api/workflows";

/**
 * "Preview as" — pick a real record to render every template against.
 *
 * Customer.io's model, and the reason is sound: a template full of
 * `{{trigger.record.first_name}}` tells you nothing until you see it filled in
 * with somebody's actual data, and it is the fastest way to notice a variable
 * that resolves to nothing on the records you actually have.
 */
export function PreviewAsPicker({
  entity,
  selected,
  onSelect,
}: {
  entity: WorkflowEntity;
  selected: RecentRecord | null;
  onSelect: (record: RecentRecord | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: records, isPending } = useQuery({
    queryKey: ["workflow-recent-records", entity, search],
    queryFn: () => getRecentRecords(entity, search),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {selected ? selected.label : t("workflows.preview.pick")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("workflows.preview.search")}
            className="h-7 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {isPending ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : (records?.length ?? 0) === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("workflows.preview.noRecords")}
            </p>
          ) : (
            records!.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  onSelect(record);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted ${
                  selected?.id === record.id ? "bg-muted" : ""
                }`}
              >
                <span className="truncate text-sm">{record.label}</span>
                {record.sublabel ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {record.sublabel}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>

        {selected ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="w-full border-t border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("workflows.preview.clear")}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
