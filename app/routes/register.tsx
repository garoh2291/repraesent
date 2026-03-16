import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { register } from "~/lib/api/auth";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Create account - Repraesent" },
    { name: "description", content: "Create your Repraesent account" },
  ];
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="space-y-4 text-center">
          <img
            src={logoUrl}
            alt="Repraesent"
            className="mx-auto h-10 w-auto max-w-[200px]"
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
            <p className="text-muted-foreground">
              Enter your email to receive a magic link to sign in
            </p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-secondary border border-secondary/20 p-4 text-sm text-secondary-foreground">
              Check your email. We've sent you a sign-in link. The link expires
              in 6 hours.
            </div>
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or{" "}
              <Button
                variant="link"
                type="button"
                className="p-0 h-auto"
                onClick={() => setSuccess(false)}
              >
                try again
              </Button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="email"
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="secondary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </>
              ) : (
                "Send magic link"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline hover:no-underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
