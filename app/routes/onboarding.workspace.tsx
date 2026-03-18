import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  createOnboardingWorkspace,
  updateOnboardingWorkspace,
} from "~/lib/api/onboarding";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";

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

  // Auth guard
  useEffect(() => {
    if (!user) return;
    if (!user.first_name?.trim() || !user.last_name?.trim()) {
      navigate("/onboarding/profile", { replace: true });
    }
  }, [user, navigate]);

  // Fetch workspace detail to get the URL
  const { data: workspaceDetail } = useQuery({
    queryKey: ["workspace-detail-onboarding", existingWorkspace?.id],
    queryFn: getWorkspaceDetail,
    enabled: !!existingWorkspace?.id,
  });

  // Pre-fill URL once workspace detail loads
  useEffect(() => {
    if (urlPrefilled) return;
    const existingUrl =
      workspaceDetail?.url?.url ?? workspaceDetail?.urls?.[0]?.url ?? "";
    if (existingUrl) {
      setUrl(existingUrl);
      setUrlPrefilled(true);
    }
  }, [workspaceDetail, urlPrefilled]);

  // Pre-fill name when workspace loads (initial render may not have it)
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
    <Card>
      <CardHeader>
        <CardTitle>
          {existingWorkspace ? "Your workspace" : "Create your workspace"}
        </CardTitle>
        <CardDescription>
          {existingWorkspace
            ? "Update your workspace details"
            : "Set up your workspace and invite team members"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Workspace name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">
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
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Invite members (optional)
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
              />
              <Button
                type="button"
                variant="outline"
                onClick={addMember}
                disabled={isSubmitting}
              >
                Add
              </Button>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeMember(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/onboarding/profile")}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
