import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Mail, UserPlus } from "lucide-react";
import { inviteWorkspaceMembers } from "~/lib/api/workspaces";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "admin" | "editor" | "viewer";

interface Chip {
  value: string;
  valid: boolean;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [chips, setChips] = useState<Chip[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Role>("editor");

  const reset = () => {
    setChips([]);
    setDraft("");
    setRole("editor");
  };

  const addTokens = (raw: string) => {
    const tokens = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setChips((prev) => {
      const existing = new Set(prev.map((c) => c.value));
      const next = [...prev];
      for (const tok of tokens) {
        if (existing.has(tok)) continue;
        existing.add(tok);
        next.push({ value: tok, valid: EMAIL_RE.test(tok) });
      }
      return next;
    });
  };

  const commitDraft = () => {
    if (draft.trim()) {
      addTokens(draft);
      setDraft("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === ";") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && !draft && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1));
    }
  };

  const removeChip = (value: string) =>
    setChips((prev) => prev.filter((c) => c.value !== value));

  const validEmails = chips.filter((c) => c.valid).map((c) => c.value);
  const hasInvalid = chips.some((c) => !c.valid);

  const mutation = useMutation({
    mutationFn: (emails: string[]) => inviteWorkspaceMembers(emails, role),
    onSuccess: ({ results }) => {
      const counts = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      const invited = (counts.invited ?? 0) + (counts.added ?? 0);
      const already = counts.already_member ?? 0;
      const parts: string[] = [];
      if (invited > 0)
        parts.push(
          t("settings.members.inviteSummaryInvited", { count: invited })
        );
      if (already > 0)
        parts.push(
          t("settings.members.inviteSummaryAlready", { count: already })
        );
      if (parts.length > 0) toast.success(parts.join(" · "));
      if (counts.blocked) toast.error(t("settings.members.inviteBlockedSupport"));
      if (counts.error) toast.error(t("common.somethingWentWrong"));

      queryClient.invalidateQueries({
        queryKey: ["workspaceDetail", workspaceId],
      });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const handleSubmit = () => {
    // Include any email still sitting in the draft input (not yet a chip).
    const draftTokens = draft
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((tok) => EMAIL_RE.test(tok));
    const all = Array.from(new Set([...validEmails, ...draftTokens]));
    if (all.length === 0) return;
    commitDraft();
    mutation.mutate(all);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t("settings.members.inviteTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.members.inviteDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Email chips input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("settings.members.inviteEmail")}
            </label>
            <div
              className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 min-h-[44px] focus-within:ring-1 focus-within:ring-foreground/25 transition-shadow cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {chips.map((c) => (
                <span
                  key={c.value}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                    c.valid
                      ? "bg-muted text-foreground"
                      : "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                  }`}
                >
                  {c.value}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeChip(c.value);
                    }}
                    className="opacity-60 hover:opacity-100"
                    aria-label={t("common.cancel")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commitDraft}
                onPaste={(e) => {
                  e.preventDefault();
                  addTokens(e.clipboardData.getData("text"));
                }}
                placeholder={
                  chips.length === 0
                    ? t("settings.members.inviteEmailsPlaceholder")
                    : ""
                }
                className="flex-1 min-w-[140px] h-7 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {hasInvalid && (
              <p className="text-xs text-destructive">
                {t("settings.members.inviteInvalidEmail")}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("settings.members.inviteRole")}
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">
                  {t("settings.members.roles.editor")}
                </SelectItem>
                <SelectItem value="viewer">
                  {t("settings.members.roles.viewer")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              mutation.isPending ||
              hasInvalid ||
              (validEmails.length === 0 && !EMAIL_RE.test(draft.trim()))
            }
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            {mutation.isPending
              ? t("settings.members.inviteSending")
              : t("settings.members.inviteAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

