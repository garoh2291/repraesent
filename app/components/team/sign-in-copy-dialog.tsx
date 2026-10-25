import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { updateWorkspaceMember } from "~/lib/api/workspaces";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-in copy: a second inbox that also gets this person's sign-in emails
 * (link, code, invite) — for people who never read their business inbox.
 * Stored per person on the server; empty removes it.
 */
export function SignInCopyDialog({
  member,
  workspaceId,
  onOpenChange,
}: {
  member: { user_id: string; user_email: string; login_copy_email?: string | null } | null;
  workspaceId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (member) {
      setValue(member.login_copy_email ?? "");
      setTouched(false);
    }
  }, [member]);

  const trimmed = value.trim().toLowerCase();
  const invalid = trimmed !== "" && !EMAIL_RE.test(trimmed);
  const sameAsMain =
    !!member && trimmed !== "" && trimmed === member.user_email.toLowerCase();

  const mutation = useMutation({
    mutationFn: (email: string) =>
      updateWorkspaceMember(member!.user_id, { login_copy_email: email }),
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: ["workspaceDetail", workspaceId] });
      toast.success(
        email
          ? t("settings.members.signInCopy.saved", { email })
          : t("settings.members.signInCopy.removed"),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      const code = (error as { response?: { data?: { code?: string } } })
        ?.response?.data?.code;
      toast.error(
        code === "LOGIN_COPY_OTHER_WORKSPACE"
          ? t("settings.members.signInCopy.otherBusiness")
          : extractErrorMessage(error),
      );
    },
  });

  const save = (email: string) => {
    setTouched(true);
    if (email && (invalid || sameAsMain)) return;
    mutation.mutate(email);
  };

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t("settings.members.signInCopy.title")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.members.signInCopy.description", {
              email: member?.user_email ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-1.5 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            save(trimmed);
          }}
        >
          <label
            htmlFor="sign-in-copy-email"
            className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {t("settings.members.signInCopy.label")}
          </label>
          <Input
            id="sign-in-copy-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t("settings.members.signInCopy.placeholder")}
            className="h-10"
            aria-invalid={touched && (invalid || sameAsMain)}
          />
          {touched && invalid && (
            <p className="text-xs text-destructive">
              {t("settings.members.signInCopy.invalid")}
            </p>
          )}
          {touched && sameAsMain && (
            <p className="text-xs text-destructive">
              {t("settings.members.signInCopy.sameAsMain")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("settings.members.signInCopy.hint")}
          </p>
        </form>

        <DialogFooter className="gap-2">
          {member?.login_copy_email && (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto text-destructive hover:text-destructive"
              onClick={() => save("")}
              disabled={mutation.isPending}
            >
              {t("settings.members.signInCopy.remove")}
            </Button>
          )}
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
            onClick={() => save(trimmed)}
            disabled={mutation.isPending || trimmed === "" || invalid || sameAsMain}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {t("settings.members.signInCopy.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
