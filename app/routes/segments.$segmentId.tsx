import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Plus, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { AddMembersDialog } from "~/components/email-campaigns/segments/AddMembersDialog";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { SegmentContacts } from "~/components/segments/segment-contacts";
import { ConditionBuilder } from "~/components/workflows/ConditionBuilder";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getSegment,
  listSegmentContacts,
  previewSegmentContacts,
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
  // One request feeds the two numbers and the list of people: who matches
  // the rules as they stand on screen, saved or not.
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peoplePage, setPeoplePage] = useState(1);
  const debouncedSearch = useDebounce(peopleSearch, 300);
  const definitionKey = JSON.stringify(debouncedDefinition);
  useEffect(() => {
    setPeoplePage(1);
  }, [definitionKey, debouncedSearch]);
  const { data: people, isFetching: counting } = useQuery({
    queryKey: ["segment-preview-contacts", segmentId, definitionKey, debouncedSearch, peoplePage],
    queryFn: () =>
      previewSegmentContacts(debouncedDefinition, {
        page: peoplePage,
        limit: 25,
        search: debouncedSearch,
      }),
    enabled: !!segment && segment.kind === "dynamic" && definitionComplete,
    placeholderData: keepPreviousData,
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
          aria-label={t("emailCampaigns.segments.namePlaceholder", { defaultValue: "Segment name" })}
          className="h-9 min-w-0 flex-1 max-sm:basis-[calc(100%-3.5rem)] sm:w-64 sm:flex-none"
        />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`emailCampaigns.segments.kind_${segment.kind}`, {
            defaultValue: segment.kind,
          })}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button
            className="max-sm:h-11"
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
        // Rules beside the people they pick, so a change shows at once. Below
        // lg they stack: rules, then people.
        <div className="app-fade-up app-fade-up-d1 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <Panel className="lg:sticky lg:top-6">
            <PanelHeader
              icon={<UserRound className="h-3.5 w-3.5" />}
              title={t("emailCampaigns.segments.rulesTitle", { defaultValue: "Rules" })}
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
          <SegmentContacts
            mode="rules"
            data={definitionComplete ? people : undefined}
            loading={counting}
            incomplete={!definitionComplete}
            unsaved={
              JSON.stringify(definition) !== JSON.stringify(segment.definition ?? EMPTY_GROUP)
            }
            search={peopleSearch}
            onSearch={setPeopleSearch}
            onPage={setPeoplePage}
          />
        </div>
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isFetching } = useQuery({
    queryKey: ["segment-members", segmentId, debouncedSearch, page],
    queryFn: () => listSegmentContacts(segmentId, { page, limit: 25, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (contactId: string) => removeSegmentMember(segmentId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segment-members", segmentId] });
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <>
      <SegmentContacts
        mode="picked"
        data={data}
        loading={isFetching}
        search={search}
        onSearch={setSearch}
        onPage={setPage}
        onRemove={(row) => remove.mutate(row.contact_id)}
        removing={remove.isPending}
        action={
          <Button size="sm" className="max-sm:h-11" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("emailCampaigns.segments.addMembers", { defaultValue: "Add contacts" })}
          </Button>
        }
      />
      <AddMembersDialog open={addOpen} onOpenChange={setAddOpen} segmentId={segmentId} />
    </>
  );
}
