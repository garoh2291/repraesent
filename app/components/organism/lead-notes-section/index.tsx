import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatDistanceToNow } from "date-fns";
import { Loader2, MoreHorizontal, Pencil, FileText, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";

function getInitials(note: Note): string {
  const first = note.user_first_name?.trim() ?? "";
  const last = note.user_last_name?.trim() ?? "";
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
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
    note.version > 1
      ? new Date(note.updated_at)
      : new Date(note.created_at);
  return formatDistanceToNow(date, { addSuffix: true });
}

interface LeadNotesSectionProps {
  leadId: string;
  canEdit?: boolean;
}

export function LeadNotesSection({ leadId, canEdit = true }: LeadNotesSectionProps) {
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
        queryClient.setQueryData(
          ["lead-notes", leadId],
          context.previousNotes
        );
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
        queryClient.setQueryData(
          ["lead-notes", leadId],
          context.previousNotes
        );
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
        queryClient.setQueryData(
          ["lead-notes", leadId],
          context.previousNotes
        );
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
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Notes
        </h3>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notes
        </h3>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsAddingNew(true)}
          disabled={!canEdit || isAddingNew}
        >
          + Add note
        </Button>
      </div>

      <div className="space-y-3">
        {isAddingNew && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Textarea
              autoFocus
              placeholder="Write a note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onBlur={handleAddNoteBlur}
              className="min-h-[80px] resize-none"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {getCurrentUserInitials(user?.first_name, user?.last_name)}
              </span>
              <span>just now</span>
            </div>
          </div>
        )}

        {notes.length === 0 && !isAddingNew ? (
          <p className="text-sm text-muted-foreground py-4">
            No notes yet.
          </p>
        ) : (
          notes.map((note) =>
            editingNoteId === note.id && canEdit ? (
              <div
                key={note.id}
                className="rounded-lg border bg-muted/30 p-3 space-y-2"
              >
                <Textarea
                  autoFocus
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onBlur={() => handleEditBlur(note)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {getInitials(note)}
                  </span>
                  <span>{getRelativeTime(note)}</span>
                </div>
              </div>
            ) : (
              <div
                key={note.id}
                className={cn(
                  "group rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50 relative"
                )}
              >
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    canEdit && "pr-8"
                  )}
                >
                  {note.content}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                      {getInitials(note)}
                    </span>
                    <span>{getRelativeTime(note)}</span>
                    {note.version > 1 && (
                      <span className="text-muted-foreground/80 italic">
                        edited
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6"
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
                          className="h-6 w-6"
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
                          Delete
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    <AlertDialog
                      open={noteIdToDelete === note.id}
                      onOpenChange={(open) =>
                        !open && setNoteIdToDelete(null)
                      }
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              deleteMutation.mutate(note.id);
                              setNoteIdToDelete(null);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
