import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { updateOnboardingProfile } from "~/lib/api/onboarding";
import { useQueryClient } from "@tanstack/react-query";

export function meta() {
  return [
    { title: "Your profile - Repraesent" },
    { name: "description", content: "Complete your profile" },
  ];
}

export default function OnboardingProfile() {
  const { user } = useAuthContext();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user?.first_name?.trim() && user?.last_name?.trim()) {
      navigate("/onboarding/workspace", { replace: true });
    }
  }, [user?.first_name, user?.last_name, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateOnboardingProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/onboarding/workspace", { replace: true });
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
          Personal information
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about yourself to get started.
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 ob-fade-up ob-fade-up-d2">
              <label
                htmlFor="firstName"
                className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                First name
              </label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                disabled={isSubmitting}
                autoFocus
                className="h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
              />
            </div>

            <div className="space-y-1.5 ob-fade-up ob-fade-up-d3">
              <label
                htmlFor="lastName"
                className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                Last name
              </label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                disabled={isSubmitting}
                className="h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1 ob-fade-up ob-fade-up-d4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-8 font-medium text-sm bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? "Saving…" : "Continue →"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
