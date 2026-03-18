import { Outlet, Link, useLocation } from "react-router";
import { Check } from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

const STEPS = [
  { path: "/onboarding/profile", label: "Profile" },
  { path: "/onboarding/workspace", label: "Workspace" },
  { path: "/onboarding/billing", label: "Billing" },
  { path: "/onboarding/products", label: "Products" },
];

export default function OnboardingLayout() {
  const location = useLocation();
  const currentIndex = STEPS.findIndex((s) => location.pathname === s.path);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

        @keyframes ob-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes ob-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ob-breathe {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.5; transform: scale(0.96); }
        }
        @keyframes ob-spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ob-slide-right {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        .ob-fade-up    { animation: ob-fade-up 0.52s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .ob-fade-up-d1 { animation-delay: 0.06s; }
        .ob-fade-up-d2 { animation-delay: 0.12s; }
        .ob-fade-up-d3 { animation-delay: 0.18s; }
        .ob-fade-up-d4 { animation-delay: 0.24s; }
        .ob-fade-up-d5 { animation-delay: 0.30s; }
        .ob-fade-up-d6 { animation-delay: 0.36s; }
        .ob-fade-in    { animation: ob-fade-in 0.5s ease both; }
        .ob-breathe    { animation: ob-breathe 2.8s ease-in-out infinite; }
        .ob-spin-slow  { animation: ob-spin-slow 1.6s linear infinite; }

        .ob-heading { font-family: 'Lora', Georgia, 'Times New Roman', serif; }

        .ob-input {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .ob-input:focus-within {
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
      `}</style>

      <div className="min-h-screen bg-stone-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl px-5">

          {/* Top bar */}
          <div className="flex items-center h-16">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-7 w-auto max-w-[130px] ob-fade-in"
            />
          </div>

          {/* Stepper */}
          <div className="pb-10 pt-2 ob-fade-up">
            <div className="flex items-center">
              {STEPS.map((step, i) => {
                const isCompleted = i < activeIndex;
                const isActive = i === activeIndex;
                return (
                  <div
                    key={step.path}
                    className="flex items-center flex-1 last:flex-none"
                  >
                    <Link
                      to={step.path}
                      className="flex items-center gap-2 group"
                    >
                      {/* Circle */}
                      <div
                        className={[
                          "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          "text-[11px] font-bold transition-all duration-200",
                          isCompleted
                            ? "bg-foreground text-background"
                            : isActive
                            ? "bg-foreground text-background shadow-[0_0_0_4px_hsl(var(--foreground)/0.08)]"
                            : "border border-stone-300 dark:border-zinc-600 text-stone-400 dark:text-zinc-500",
                        ].join(" ")}
                      >
                        {isCompleted ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={[
                          "hidden sm:block text-[13px] font-medium transition-colors",
                          isActive
                            ? "text-foreground"
                            : isCompleted
                            ? "text-foreground/60"
                            : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {step.label}
                      </span>
                    </Link>

                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div className="mx-3 flex-1 h-px bg-stone-200 dark:bg-zinc-800" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Page content */}
          <div className="pb-20">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
