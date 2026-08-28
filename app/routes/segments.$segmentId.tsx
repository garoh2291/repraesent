import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { AddMembersDialog } from "~/components/email-campaigns/segments/AddMembersDialog";
import { SegmentCountBadge } from "~/components/email-campaigns/segments/SegmentCountBadge";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { ConditionBuilder } from "~/components/workflows/ConditionBuilder";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getSegment,
  listSegmentMembers,
  previewSegmentCount,
  removeSegmentMember,
  updateSegment,
} from "~/lib/api/segments";
import {
  getFieldCatalog,
  type CatalogField,
  type ConditionGroup,
  type ConditionOperator,
} from "~/lib/api/workflows";

/** Operators that need a previous row snapshot — meaningless in a segment
 * scan (previous is always null), so the picker hides them. */
const CHANGE_OPERATORS: ConditionOperator[] = [
  "changed",
  "changed_from",
  "changed_to",
];
import { useDebounce } from "~/lib/hooks/useDebounce";
import { Skeleton } from "~/components/ui/skeleton";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

const EMPTY_GROUP: ConditionGroup = { match: "all", conditions: [] };

export default function SegmentDetail() {
  const { t } = useTranslation();
  const { segmentId } = useParams<{ segmentId: string }>();
  const queryClient = useQueryClient();
  useDocumentMeta({
    titleKey: "emailCampaigns.segments.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const { data: segment, isPending } = useQuery({
    queryKey: ["segment", segmentId],
    queryFn: () => getSegment(segmentId!),
    enabled: !!segmentId,
  });

  const [name, setName] = useState("");
  const [definition, setDefinition] = useState<ConditionGroup>(EMPTY_GROUP);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!segment) return;
    setName(segment.name);
    setDefinition(segment.definition ?? EMPTY_GROUP);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment?.id]);

  // Contacts field catalog, with change-operators stripped: a segment scan
  // has no "previous" snapshot, so changed/changed_from/changed_to would be
  // constant-false noise in the picker.
  const { data: catalog } = useQuery({
    queryKey: ["workflow-field-catalog"],
    queryFn: getFieldCatalog,
    staleTime: 5 * 60_000,
  });
  const fields: CatalogField[] = useMemo(() => {
    const contactFields =
      catalog?.find((entity) => entity.entity === "contacts")?.fields ?? [];
    return contactFields.map((field) => ({
      ...field,
      operators: field.operators.filter(
        (operator) => !CHANGE_OPERATORS.includes(operator),
      ),
    }));
  }, [catalog]);

  // Live counts while editing, debounced on the definition. A half-built row
  // (field picked, value still empty) is a normal editing state, not a
  // request — the server would 400 it, so counting waits until every
  // condition is complete.
  const debouncedDefinition = useDebounce(definition, 600);
  const definitionComplete = useMemo(() => {
    const NULLARY = new Set(["is_empty", "is_not_empty"]);
    const groupComplete = (group: ConditionGroup): boolean =>
      group.conditions.every(
        (condition) =>
          condition.path &&
          (NULLARY.has(condition.operator) ||
            condition.valueField !== undefined ||
            (condition.value !== undefined &&
              condition.value !== null &&
              condition.value !== "" &&
              (!Array.isArray(condition.value) || condition.value.length > 0))),
      ) && (group.groups ?? []).every(groupComplete);
    return groupComplete(definition);
  }, [definition]);
  const { data: liveCounts, isFetching: counting } = useQuery({
    queryKey: [
      "segment-preview-count",
      segmentId,
      JSON.stringify(debouncedDefinition),
    ],
    queryFn: () => previewSegmentCount(debouncedDefinition),
    enabled: !!segment && segment.kind === "dynamic" && definitionComplete,
  });

  const save = useMutation({
    mutationFn: () =>
      updateSegment(segmentId!, {
        name,
        ...(segment?.kind === "dynamic" ? { definition } : {}),
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["segment", segmentId] });
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success(t("common.saved", { defaultValue: "Saved" }));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  if (isPending || !segment) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6 app-fade-in">
      <UnsavedChangesGuard when={dirty} />

      <div className="app-fade-up flex flex-wrap items-center gap-3">
        <Link
          to="/segments"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          aria-label={t("common.back", { defaultValue: "Back" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          className="h-9 w-64"
        />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`emailCampaigns.segments.kind_${segment.kind}`, {
            defaultValue: segment.kind,
          })}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {segment.kind === "dynamic" ? (
            <SegmentCountBadge
              matched={liveCounts?.matched ?? segment.matched_count}
              sendable={liveCounts?.sendable ?? segment.sendable_count}
              loading={counting}
            />
          ) : null}
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !dirty || !definitionComplete}
          >
            {save.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>

      {segment.kind === "dynamic" ? (
        <Panel className="app-fade-up app-fade-up-d1">
          <PanelHeader
            icon={<UserRound className="h-3.5 w-3.5" />}
            title={t("emailCampaigns.segments.conditionsTitle", {
              defaultValue: "Who is in this segment",
            })}
          />
          <PanelBody>
            <ConditionBuilder
              group={definition}
              fields={fields}
              onChange={(next) => {
                setDefinition(next);
                setDirty(true);
              }}
            />
          </PanelBody>
        </Panel>
      ) : (
        <ManualMembers segmentId={segment.id} />
      )}
    </div>
  );
}

function ManualMembers({ segmentId }: { segmentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["segment-members", segmentId, page],
    queryFn: () => listSegmentMembers(segmentId, { page, limit: 20 }),
  });

  const remove = useMutation({
    mutationFn: (contactId: string) =>
      removeSegmentMember(segmentId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["segment-members", segmentId],
      });
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <Panel>
      <PanelHeader
        icon={<UserRound className="h-3.5 w-3.5" />}
        title={t("emailCampaigns.segments.membersTitle", {
          defaultValue: "Members",
        })}
        meta={
          data ? (
            <span className="text-xs text-muted-foreground">{data.total}</span>
          ) : null
        }
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("emailCampaigns.segments.addMembers", {
              defaultValue: "Add contacts",
            })}
          </Button>
        }
      />
      <PanelBody>
        {(data?.data.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            {t("emailCampaigns.segments.noMembers", {
              defaultValue: "Nobody here yet — add contacts to this list.",
            })}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("emailCampaigns.segments.memberName", {
                      defaultValue: "Contact",
                    })}
                  </TableHead>
                  <TableHead>
                    {t("emailCampaigns.segments.memberEmail", {
                      defaultValue: "Email",
                    })}
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.data.map((member) => (
                  <TableRow key={member.member_id}>
                    <TableCell>
                      <Link
                        to={`/contacts/${member.id}`}
                        className="hover:underline"
                      >
                        {member.full_name ||
                          t("emailCampaigns.segments.unnamed", {
                            defaultValue: "Unnamed",
                          })}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.primary_email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => remove.mutate(member.id)}
                        aria-label={t("common.delete", {
                          defaultValue: "Delete",
                        })}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && data.totalPages > 1 ? (
              <div className="flex items-center justify-end gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("common.previous", { defaultValue: "Previous" })}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {data.page} / {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common.next", { defaultValue: "Next" })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </PanelBody>
      <AddMembersDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        segmentId={segmentId}
      />
    </Panel>
  );
}
