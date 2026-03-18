import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Input } from "~/components/ui/input";
import { useAuthContext } from "~/providers/auth-provider";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Sign in - Repraesent" },
    { name: "description", content: "Sign in to your account" },
  ];
}

const FEATURES = [
  "Smart lead management",
  "Appointment booking",
  "Team collaboration",
];

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f11]">
        <div className="h-5 w-5 app-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col bg-[#111113] p-10 border-r border-white/5">
        <img
          src={logoUrl}
          alt="Repraesent"
          className="h-7 w-auto max-w-[120px] brightness-0 invert opacity-85"
        />

        <div className="flex-1 flex flex-col justify-center space-y-8">
          <div className="space-y-3">
            <h2
              className="text-[28px] font-semibold text-white leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Represent your
              <br />
              best work.
            </h2>
            <p className="text-sm text-white/45 leading-relaxed max-w-[260px]">
              The platform for modern sales teams. Manage leads, schedule
              appointments, and close deals.
            </p>
          </div>

          <div className="space-y-2.5">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm text-white/50">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-white/15">
          © {new Date().getFullYear()} Repraesent
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-stone-50 p-8">
        <div className="w-full max-w-sm space-y-8 app-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-7 w-auto max-w-[120px]"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a sign-in link
            </p>
          </div>

          {success ? (
            <div className="space-y-5 app-fade-up">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 leading-relaxed">
                <p className="font-medium">Check your inbox</p>
                <p className="text-emerald-700/80 mt-0.5">
                  We sent a sign-in link to{" "}
                  <span className="font-medium">{email}</span>. It expires in 30
                  minutes.
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive it?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setSuccess(false)}
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 app-fade-up app-fade-up-d1"
            >
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Email address
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
                  autoFocus
                  className="h-11 border-stone-200 bg-white focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow"
                />
              </div>

              <button
                type="submit"
                disabled={isRequestingMagicLink}
                className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRequestingMagicLink ? (
                  <>
                    <div className="h-4 w-4 app-spin rounded-full border-2 border-background/30 border-t-background" />
                    Sending…
                  </>
                ) : (
                  "Send magic link →"
                )}
              </button>

              <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link
                  to="/register"
                  className="text-primary font-medium hover:underline"
                >
                  Create one
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
