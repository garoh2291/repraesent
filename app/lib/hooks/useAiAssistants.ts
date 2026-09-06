import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmSourceUpload,
  createAssistant,
  createSource,
  createTest,
  deleteAssistant,
  deleteSource,
  deleteTest,
  dismissGap,
  getAssistant,
  getAssistantSnippet,
  getAssistants,
  getChatModels,
  getConversation,
  getConversations,
  getGaps,
  getSourceDocumentContent,
  getSourceDocuments,
  getSources,
  getTests,
  getUsage,
  presignSourceUpload,
  publishAssistant,
  putToPresignedUrl,
  resolveGap,
  resyncSource,
  runTests,
  unpublishAssistant,
  unresolveGap,
  updateAssistant,
  updateSource,
  updateTest,
  type CreateSourceDto,
  type KnowledgeSource,
  type ListConversationsParams,
  type UpdateAssistantDto,
  type UpdateSourceDto,
  type SnippetMode,
  type WidgetType,
} from "~/lib/api/ai-assistants";
import { useAuthContext } from "~/providers/auth-provider";

export const aiKeys = {
  all: ["ai-assistants"] as const,
  list: () => ["ai-assistants"] as const,
  detail: (id: string | undefined) => ["ai-assistant", id] as const,
  models: () => ["ai-assistant-models"] as const,
  sources: (id: string | undefined) => ["ai-assistant-sources", id] as const,
  snippet: (id: string | undefined, mode: SnippetMode) =>
    ["ai-assistant-snippet", id, mode] as const,
  conversations: (id: string | undefined, p: ListConversationsParams) =>
    ["ai-assistant-conversations", id, p] as const,
  conversation: (id: string | undefined, cid: string | undefined) =>
    ["ai-assistant-conversation", id, cid] as const,
  usage: (id: string | undefined, days: number) =>
    ["ai-assistant-usage", id, days] as const,
  gaps: (id: string | undefined, days: number) =>
    ["ai-assistant-gaps", id, days] as const,
  /** Prefix key: invalidates the gaps list whatever window it was fetched for. */
  gapsAll: (id: string | undefined) => ["ai-assistant-gaps", id] as const,
  documents: (id: string | undefined, sourceId: string | undefined) =>
    ["ai-assistant-source-documents", id, sourceId] as const,
  documentContent: (
    id: string | undefined,
    sourceId: string | undefined,
    docId: string | undefined,
  ) => ["ai-assistant-source-document", id, sourceId, docId] as const,
  tests: (id: string | undefined) => ["ai-assistant-tests", id] as const,
};

/** Mirrors useCanEditForms: viewers are read-only. */
export function useCanEditAiAssistants(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role !== "viewer";
}

export function useAiAssistants(enabled = true) {
  return useQuery({
    queryKey: aiKeys.list(),
    queryFn: getAssistants,
    enabled,
  });
}

export function useAiAssistant(id: string | undefined) {
  return useQuery({
    queryKey: aiKeys.detail(id),
    queryFn: () => getAssistant(id!),
    enabled: !!id,
  });
}

export function useChatModels() {
  return useQuery({
    queryKey: aiKeys.models(),
    queryFn: getChatModels,
    staleTime: 10 * 60_000,
  });
}

const SETTLED: ReadonlySet<string> = new Set(["ready", "failed"]);

/** How long a freshly opened, still-empty list keeps polling for a late job. */
const EMPTY_GRACE_MS = 30_000;

/**
 * Polls every 3s while anything is still being crawled/parsed/embedded.
 *
 * `staleTime: 0` overrides the app-wide 5 minutes on purpose: this is a
 * progress view, and a cached entry written a moment before a source was
 * created would otherwise be served as fresh for the whole window. The grace
 * period covers the same race from the other side — a list that is still empty
 * right after mount keeps asking, so a job queued in another tab appears.
 */
export function useAiSources(id: string | undefined) {
  const mountedAt = useRef(Date.now());
  return useQuery({
    queryKey: aiKeys.sources(id),
    queryFn: () => getSources(id!),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data as KnowledgeSource[] | undefined;
      if (!data) return false;
      if (data.some((s) => !SETTLED.has(s.status))) return 3000;
      const own = data.filter((s) => s.type !== "description");
      if (own.length === 0 && Date.now() - mountedAt.current < EMPTY_GRACE_MS) {
        return 3000;
      }
      return false;
    },
  });
}

export function useAiSnippet(
  id: string | undefined,
  mode: SnippetMode,
  enabled = true,
) {
  return useQuery({
    queryKey: aiKeys.snippet(id, mode),
    queryFn: () => getAssistantSnippet(id!, mode),
    enabled: !!id && enabled,
  });
}

export function useAiConversations(
  id: string | undefined,
  params: ListConversationsParams,
) {
  return useQuery({
    queryKey: aiKeys.conversations(id, params),
    queryFn: () => getConversations(id!, params),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}

export function useAiConversation(
  id: string | undefined,
  conversationId: string | undefined,
) {
  return useQuery({
    queryKey: aiKeys.conversation(id, conversationId),
    queryFn: () => getConversation(id!, conversationId!),
    enabled: !!id && !!conversationId,
  });
}

export function useAiUsage(id: string | undefined, days = 30) {
  return useQuery({
    queryKey: aiKeys.usage(id, days),
    queryFn: () => getUsage(id!, days),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// --- mutations ---------------------------------------------------------------

export function useInvalidateAssistant(id: string | undefined) {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: aiKeys.list() });
    await qc.invalidateQueries({ queryKey: aiKeys.detail(id) });
    await qc.invalidateQueries({ queryKey: ["ai-assistant-snippet", id] });
  };
}

export function useCreateAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAssistant,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiKeys.list() }),
  });
}

export function useUpdateAssistant(id: string | undefined) {
  const invalidate = useInvalidateAssistant(id);
  return useMutation({
    mutationFn: (dto: UpdateAssistantDto) => updateAssistant(id!, dto),
    onSuccess: invalidate,
  });
}

export function useDeleteAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAssistant,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiKeys.list() }),
  });
}

export function usePublishAssistant(id: string | undefined) {
  const invalidate = useInvalidateAssistant(id);
  return useMutation({
    mutationFn: () => publishAssistant(id!),
    onSuccess: invalidate,
  });
}

export function useUnpublishAssistant(id: string | undefined) {
  const invalidate = useInvalidateAssistant(id);
  return useMutation({
    mutationFn: () => unpublishAssistant(id!),
    onSuccess: invalidate,
  });
}

export function useSourceMutations(id: string | undefined) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: aiKeys.sources(id) });
    await qc.invalidateQueries({ queryKey: aiKeys.list() });
    // Adding knowledge is the one thing that changes the gap list; without this
    // the panel keeps serving its 60 s-stale copy and the gap looks stuck.
    await qc.invalidateQueries({ queryKey: aiKeys.gapsAll(id) });
  };

  const create = useMutation({
    mutationFn: (dto: CreateSourceDto) => createSource(id!, dto),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({
      sourceId,
      ...dto
    }: { sourceId: string } & UpdateSourceDto) =>
      updateSource(id!, sourceId, dto),
    onSuccess: refresh,
  });
  const resync = useMutation({
    mutationFn: (sourceId: string) => resyncSource(id!, sourceId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (sourceId: string) => deleteSource(id!, sourceId),
    onSuccess: refresh,
  });

  /** presign → PUT → confirm, one file. */
  const upload = async (
    file: File,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<KnowledgeSource> => {
    const presigned = await presignSourceUpload(id!, {
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
    await putToPresignedUrl(
      presigned.upload_url,
      file,
      presigned.headers,
      onProgress,
      signal,
    );
    const source = await confirmSourceUpload(id!, presigned.source_id);
    await refresh();
    return source;
  };

  return { create, update, resync, remove, upload, refresh };
}

// --- v2: gaps, source documents, tests ---------------------------------------

export function useAiGaps(id: string | undefined, days = 30) {
  return useQuery({
    queryKey: aiKeys.gaps(id, days),
    queryFn: () => getGaps(id!, days),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * Resolve / dismiss / undo a gap. Every one of them changes what the list
 * returns, so they all invalidate it — the panel is otherwise 60 s stale.
 */
export function useGapMutations(id: string | undefined) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: aiKeys.gapsAll(id) });

  const resolve = useMutation({
    mutationFn: (body: { question: string; source_id?: string }) =>
      resolveGap(id!, body),
    onSuccess: refresh,
  });
  const dismiss = useMutation({
    mutationFn: (question: string) => dismissGap(id!, question),
    onSuccess: refresh,
  });
  const undo = useMutation({
    mutationFn: (normalized: string) => unresolveGap(id!, normalized),
    onSuccess: refresh,
  });

  return { resolve, dismiss, undo };
}

export function useSourceDocuments(
  id: string | undefined,
  sourceId: string | undefined,
) {
  return useQuery({
    queryKey: aiKeys.documents(id, sourceId),
    queryFn: () => getSourceDocuments(id!, sourceId!),
    enabled: !!id && !!sourceId,
  });
}

export function useAiTests(id: string | undefined) {
  return useQuery({
    queryKey: aiKeys.tests(id),
    queryFn: () => getTests(id!),
    enabled: !!id,
  });
}

export function useTestMutations(id: string | undefined) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: aiKeys.tests(id) });

  const create = useMutation({
    mutationFn: (dto: { question: string; expected_keywords: string[] }) =>
      createTest(id!, dto),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (v: {
      testId: string;
      question?: string;
      expected_keywords?: string[];
    }) =>
      updateTest(id!, v.testId, {
        question: v.question,
        expected_keywords: v.expected_keywords,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (testId: string) => deleteTest(id!, testId),
    onSuccess: refresh,
  });
  const run = useMutation({
    mutationFn: (body: { with_llm?: boolean; ids?: string[] }) =>
      runTests(id!, body),
    onSuccess: refresh,
  });

  return { create, update, remove, run };
}

export function useSourceDocumentContent(
  id: string | undefined,
  sourceId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: aiKeys.documentContent(id, sourceId, documentId),
    queryFn: () => getSourceDocumentContent(id!, sourceId!, documentId!),
    enabled: !!id && !!sourceId && !!documentId,
    staleTime: 5 * 60_000,
  });
}
