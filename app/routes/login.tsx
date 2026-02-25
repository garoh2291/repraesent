import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuthContext } from "~/providers/auth-provider";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Sign in - Repraesent" },
    { name: "description", content: "Sign in to your account" },
  ];
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    requestMagicLinkAsync,
    isAuthenticated,
    isLoading: isAuthLoading,
    isRequestingMagicLink,
    magicLinkError,
  } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      navigate(returnUrl || "/", { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate, searchParams]);

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

    try {
      await requestMagicLinkAsync(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : magicLinkError?.message || "Something went wrong. Please try again."
      );
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">
              Enter your email to receive a magic link to sign in
            </p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
              Check your email. We've sent you a sign-in link. The link expires in 30 minutes.
            </div>
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setSuccess(false)}
              >
                try again
              </button>
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
                disabled={isRequestingMagicLink}
                required
                autoComplete="email"
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isRequestingMagicLink}
            >
              {isRequestingMagicLink ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </>
              ) : (
                "Send magic link"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
