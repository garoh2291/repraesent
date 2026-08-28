import { Plus, Rows3, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyPanelState,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { BLOCK_META, cloneBlocks } from "~/lib/email-templates/blocks";
import {
  deleteSavedRow,
  listSavedRows,
  type Block,
  type BlockType,
} from "~/lib/api/email-templates";
import { BLOCK_TYPES } from "~/lib/api/email-templates";

/**
 * Left pane: block types to add, plus the workspace's saved rows.
 *
 * Click-to-append is the primary interaction (single-pointer, keyboard
 * reachable); reordering happens on the canvas afterwards. That keeps WCAG
 * 2.2's dragging-alternative rule satisfied without a second drag system
 * between panes.
 */
export function BlockPalette({
  onAdd,
  onInsertRow,
  disabled,
}: {
  onAdd: (type: BlockType) => void;
  /** Insert a saved row's blocks (already deep-copied). */
  onInsertRow: (blocks: Block[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["email-template-rows"],
    queryFn: listSavedRows,
  });

  const removeRow = useMutation({
    mutationFn: deleteSavedRow,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-template-rows"] }),
  });

  return (
    <Panel>
      <PanelHeader
        icon={<Plus className="h-3.5 w-3.5" />}
        title={t("emailCampaigns.templates.palette.title", {
          defaultValue: "Blocks",
        })}
      />
      <PanelBody>
        <div className="grid grid-cols-2 gap-2">
          {BLOCK_TYPES.map((type) => {
            const meta = BLOCK_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => onAdd(type)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2 py-3 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {t(meta.labelKey, { defaultValue: meta.defaultLabel })}
              </button>
            );
          })}
        </div>

        <PanelSection
          title={t("emailCampaigns.templates.savedRows.title", {
            defaultValue: "Saved rows",
          })}
        >
          {(rows?.length ?? 0) === 0 ? (
            <EmptyPanelState
              icon={<Rows3 className="h-4 w-4" />}
              title={t("emailCampaigns.templates.savedRows.empty", {
                defaultValue: "No saved rows yet",
              })}
              hint={t("emailCampaigns.templates.savedRows.emptyHint", {
                defaultValue:
                  "Select a block on the canvas and save it for reuse.",
              })}
            />
          ) : (
            <div className="space-y-1.5">
              {rows!.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onInsertRow(cloneBlocks(row.blocks))}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="truncate text-sm">{row.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t(`emailCampaigns.templates.savedRows.${row.category}`, {
                        defaultValue: row.category,
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeRow.mutate(row.id)}
                    aria-label={t("common.delete", { defaultValue: "Delete" })}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      </PanelBody>
    </Panel>
  );
}
