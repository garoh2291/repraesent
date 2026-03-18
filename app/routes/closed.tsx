import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { StatusPageHeader } from "~/components/status-page-header";

export function meta() {
  return [
    { title: "Workspace closed - Repraesent" },
    { name: "description", content: "Your workspace has been closed" },
  ];
}

const CLOSED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap');

  @keyframes cl-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .cl-fade-up    { animation: cl-fade-up 0.52s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .cl-fade-up-d1 { animation-delay: 0.08s; }
  .cl-fade-up-d2 { animation-delay: 0.16s; }
  .cl-heading    { font-family: 'Lora', Georgia, serif; }
`;

export default function Closed() {
  const { currentWorkspace, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const ws = currentWorkspace ?? workspaces[0];
  const status = ws?.status;

  useEffect(() => {
    if (status && status !== "canceled") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950">
      <style>{CLOSED_STYLES}</style>
      <StatusPageHeader />

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8 text-center">
          {/* Icon mark */}
          <div className="flex justify-center cl-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-muted-foreground"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 12h8M12 8v8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{ transform: "rotate(45deg)", transformOrigin: "12px 12px" }}
                />
              </svg>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3 cl-fade-up cl-fade-up-d1">
            <h1 className="cl-heading text-[26px] font-semibold text-foreground leading-snug">
              Workspace closed
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your workspace has been closed. If you believe this is an error or
              would like to reactivate, please reach out to our support team.
            </p>
          </div>

          {/* Support CTA */}
          <div className="cl-fade-up cl-fade-up-d2">
            <a
              href="mailto:support@dendritecorp.com"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-8 text-sm font-medium text-foreground shadow-sm transition-all duration-150 hover:bg-stone-50 dark:hover:bg-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600"
            >
              Contact support →
            </a>
            <p className="mt-3 text-xs text-muted-foreground/60">
              support@dendritecorp.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
