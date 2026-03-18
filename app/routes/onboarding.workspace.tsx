import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  createOnboardingWorkspace,
  updateOnboardingWorkspace,
} from "~/lib/api/onboarding";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";
import { X } from "lucide-react";

export function meta() {
  return [
    { title: "Create workspace - Repraesent" },
    { name: "description", content: "Create your workspace" },
  ];
}

export default function OnboardingWorkspace() {
  const { user, currentWorkspace, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existingWorkspace = currentWorkspace ?? workspaces[0] ?? null;

  const [name, setName] = useState(existingWorkspace?.name ?? "");
  const [url, setUrl] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlPrefilled, setUrlPrefilled] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.first_name?.trim() || !user.last_name?.trim()) {
      navigate("/onboarding/profile", { replace: true });
    }
  }, [user, navigate]);

  const { data: workspaceDetail } = useQuery({
    queryKey: ["workspace-detail-onboarding", existingWorkspace?.id],
    queryFn: getWorkspaceDetail,
    enabled: !!existingWorkspace?.id,
  });

  useEffect(() => {
    if (urlPrefilled) return;
    const existingUrl =
      workspaceDetail?.url?.url ?? workspaceDetail?.urls?.[0]?.url ?? "";
    if (existingUrl) {
      setUrl(existingUrl);
      setUrlPrefilled(true);
    }
  }, [workspaceDetail, urlPrefilled]);

  useEffect(() => {
    if (existingWorkspace?.name && !name) {
      setName(existingWorkspace.name);
    }
  }, [existingWorkspace?.name, name]);

  const addMember = () => {
    const email = memberInput.trim().toLowerCase();
    if (
      email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      !members.includes(email)
    ) {
      setMembers([...members, email]);
      setMemberInput("");
    }
  };

  const removeMember = (email: string) => {
    setMembers(members.filter((m) => m !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }
    if (!url.trim()) {
      setError("Website URL is required");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingWorkspace?.id) {
        await updateOnboardingWorkspace(existingWorkspace.id, {
          name: name.trim(),
          url: url.trim(),
          members: members.map((email) => ({ email })),
        });
        queryClient.invalidateQueries({ queryKey: ["auth"] });
      } else {
        const result = await createOnboardingWorkspace({
          name: name.trim(),
          url: url.trim(),
          members: members.map((email) => ({ email })),
        });
        setStoredWorkspaceId(result.id);
        queryClient.invalidateQueries({ queryKey: ["auth"] });
      }
      navigate("/onboarding/billing", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ob-fade-up ob-fade-up-d1">
      {/* Section heading */}
      <div className="mb-8 space-y-1.5">
        <h1 className="ob-heading text-[26px] font-semibold tracking-tight text-foreground leading-snug">
          {existingWorkspace ? "Your workspace" : "Create your workspace"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {existingWorkspace
            ? "Update your workspace details below."
            : "Set up your workspace and optionally invite team members."}
        </p>
      </div>

      {/* Form panel */}
      <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="ob-fade-up rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Workspace name */}
          <div className="space-y-1.5 ob-fade-up ob-fade-up-d2">
            <label
              htmlFor="name"
              className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Workspace name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              required
              disabled={isSubmitting}
              className="h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
            />
          </div>

          {/* Website URL */}
          <div className="space-y-1.5 ob-fade-up ob-fade-up-d3">
            <label
              htmlFor="url"
              className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Website URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://acme.com"
              required
              disabled={isSubmitting}
              className="h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
            />
          </div>

          {/* Invite members */}
          <div className="space-y-1.5 ob-fade-up ob-fade-up-d4">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Invite members{" "}
              <span className="normal-case tracking-normal font-normal text-muted-foreground/70">
                (optional)
              </span>
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addMember())
                }
                placeholder="member@example.com"
                disabled={isSubmitting}
                className="h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addMember}
                disabled={isSubmitting}
                className="h-11 px-5 shrink-0 border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Add
              </Button>
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {members.map((email) => (
                  <span
                    key={email}
                    className="ob-fade-up inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-zinc-700 bg-stone-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeMember(email)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-1 ob-fade-up ob-fade-up-d5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/onboarding/profile")}
              disabled={isSubmitting}
              className="h-11 px-6 border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ← Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-8 font-medium text-sm transition-all duration-150 hover:opacity-90"
            >
              {isSubmitting ? "Saving…" : "Continue →"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
