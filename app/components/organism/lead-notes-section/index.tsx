import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  type Note,
} from "~/lib/api/notes";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import TooltipContainer from "~/components/tooltip-container";

function getInitials(note: Note): string {
  const first = note.user_first_name?.trim() ?? "";
  const last = note.user_last_name?.trim() ?? "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return "?";
}

function getCurrentUserInitials(
  first: string | undefined,
  last: string | undefined
): string {
  const f = first?.trim() ?? "";
  const l = last?.trim() ?? "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "?";
}

function getRelativeTime(note: Note): string {
  const date =
    note.version > 1 ? new Date(note.updated_at) : new Date(note.created_at);
  return formatRelativeTime(date);
}

function buildNoteUserLabel(note: Note, fallback: string): string {
  const name =
    [note.user_first_name, note.user_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    note.user_email ||
    fallback;
  return note.user_is_deleted ? `${name} (Deleted)` : name;
}

interface LeadNotesSectionProps {
  leadId: string;
  canEdit?: boolean;
}

export function LeadNotesSection({
  leadId,
  canEdit = true,
}: LeadNotesSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: () => getNotes(leadId),
    enabled: !!leadId,
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => createNote(leadId, content),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ["lead-notes", leadId] });
      const previousNotes = queryClient.getQueryData<Note[]>([
        "lead-notes",
        leadId,
      ]);
      const optimisticNote: Note = {
        id: `temp-${Date.now()}`,
        version: 1,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        user_first_name: user?.first_name ?? null,
        user_last_name: user?.last_name ?? null,
        user_email: user?.email ?? null,
        user_is_deleted: false,
      };
      queryClient.setQueryData<Note[]>(["lead-notes", leadId], (old = []) => [
        optimisticNote,
        ...old,
      ]);
      setIsAddingNew(false);
      setNewNoteContent("");
      return { previousNotes };
    },
    onError: (_err, _content, context) => {
      if (context?.previousNotes != null) {
        queryClient.setQueryData(["lead-notes", leadId], context.previousNotes);
      }
      setIsAddingNew(true);
      setNewNoteContent(_content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-history", leadId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      updateNote(noteId, content),
    onMutate: async ({ noteId, content }) => {
      await queryClient.cancelQueries({ queryKey: ["lead-notes", leadId] });
      const previousNotes = queryClient.getQueryData<Note[]>([
        "lead-notes",
        leadId,
      ]);
      const note = previousNotes?.find((n) => n.id === noteId);
      const optimisticNote: Note = note
        ? {
            ...note,
            content,
            version: note.version + 1,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
            user_first_name: user?.first_name ?? null,
            user_last_name: user?.last_name ?? null,
            user_email: user?.email ?? null,
            user_is_deleted: false,
          }
        : {
            id: noteId,
            version: 2,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
            updated_by: user?.id ?? null,
            user_first_name: user?.first_name ?? null,
            user_last_name: user?.last_name ?? null,
            user_email: user?.email ?? null,
            user_is_deleted: false,
          };
      queryClient.setQueryData<Note[]>(["lead-notes", leadId], (old = []) =>
        old.map((n) => (n.id === noteId ? optimisticNote : n))
      );
      setEditingNoteId(null);
      setEditingContent("");
      return { previousNotes };
    },
    onError: (_err, { noteId, content }, context) => {
      if (context?.previousNotes != null) {
        queryClient.setQueryData(["lead-notes", leadId], context.previousNotes);
      }
      setEditingNoteId(noteId);
      setEditingContent(content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-history", leadId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: ["lead-notes", leadId] });
      const previousNotes = queryClient.getQueryData<Note[]>([
        "lead-notes",
        leadId,
      ]);
      queryClient.setQueryData<Note[]>(["lead-notes", leadId], (old = []) =>
        old.filter((n) => n.id !== noteId)
      );
      setNoteIdToDelete(null);
      return { previousNotes };
    },
    onError: (_err, _noteId, context) => {
      if (context?.previousNotes != null) {
        queryClient.setQueryData(["lead-notes", leadId], context.previousNotes);
      }
      setNoteIdToDelete(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-history", leadId] });
    },
  });

  const handleAddNoteBlur = useCallback(() => {
    const content = newNoteContent.trim();
    if (content) {
      createMutation.mutate(content);
    } else {
      setIsAddingNew(false);
      setNewNoteContent("");
    }
  }, [newNoteContent, createMutation]);

  const handleEditBlur = useCallback(
    (note: Note) => {
      const content = editingContent.trim();
      if (content && content !== note.content) {
        updateMutation.mutate({ noteId: note.id, content });
      } else {
        setEditingNoteId(null);
        setEditingContent("");
      }
    },
    [editingContent, updateMutation]
  );

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("leads.detail.notes")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
          <span className="text-sm text-muted-foreground">
            {t("common.loading")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("leads.detail.notes")}{" "}
          {notes.length > 0 && (
            <span className="ml-1 normal-case tracking-normal font-normal text-muted-foreground/60">
              ({notes.length})
            </span>
          )}
        </h3>
        {canEdit && (
          <button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {t("leads.detail.addNote")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* New note input */}
        {isAddingNew && (
          <div className="rounded-xl border border-primary/30 bg-primary/4 p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                {getCurrentUserInitials(user?.first_name, user?.last_name)}
              </span>
              <span className="font-medium text-muted-foreground/70">
                {t("leads.detail.newNote")}
              </span>
            </div>
            <Textarea
              autoFocus
              placeholder={t("leads.detail.notePlaceholder")}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onBlur={handleAddNoteBlur}
              className="min-h-[72px] resize-none border-border/60 bg-white text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        )}

        {notes.length === 0 && !isAddingNew ? (
          <p className="text-sm text-muted-foreground py-2">
            {t("leads.detail.noNotes")}
          </p>
        ) : (
          notes.map((note) =>
            editingNoteId === note.id && canEdit ? (
              /* Editing state */
              <div
                key={note.id}
                className="rounded-xl border border-primary/30 bg-primary/4 p-3 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TooltipContainer
                    tooltipContent={buildNoteUserLabel(
                      note,
                      t("leads.detail.deletedUser")
                    )}
                    showCopyButton={false}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${note.user_is_deleted ? "bg-muted/50 text-muted-foreground/60" : "bg-muted"}`}
                    >
                      {getInitials(note)}
                    </span>
                  </TooltipContainer>
                  <span>{t("leads.detail.editing")}</span>
                </div>
                <Textarea
                  autoFocus
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onBlur={() => handleEditBlur(note)}
                  className="min-h-[72px] resize-none border-border/60 bg-white text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            ) : (
              /* Display state */
              <div
                key={note.id}
                className="group relative rounded-xl border border-border bg-card p-3.5 transition-all duration-150 hover:border-border/80 hover:shadow-sm"
              >
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap text-foreground leading-relaxed",
                    canEdit && "pr-14"
                  )}
                >
                  {note.content}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TooltipContainer
                      tooltipContent={buildNoteUserLabel(
                        note,
                        t("leads.detail.deletedUser")
                      )}
                      showCopyButton={false}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${note.user_is_deleted ? "bg-muted/50 text-muted-foreground/60" : "bg-muted"}`}
                      >
                        {getInitials(note)}
                      </span>
                    </TooltipContainer>
                    {note.user_is_deleted && (
                      <span className="text-[10px] text-muted-foreground/60">
                        (Deleted)
                      </span>
                    )}
                    <span>{getRelativeTime(note)}</span>
                    {note.version > 1 && (
                      <span className="italic text-muted-foreground/60">
                        {t("leads.detail.editedBadge")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit/delete controls */}
                {canEdit && (
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleStartEdit(note)}
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          aria-label="More options"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setNoteIdToDelete(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("leads.detail.deleteNote")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialog
                      open={noteIdToDelete === note.id}
                      onOpenChange={(open) => !open && setNoteIdToDelete(null)}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("leads.detail.deleteNoteConfirmTitle")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("leads.detail.deleteNoteConfirmDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-foreground text-background hover:opacity-90 transition-opacity"
                            onClick={() => {
                              deleteMutation.mutate(note.id);
                              setNoteIdToDelete(null);
                            }}
                          >
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
