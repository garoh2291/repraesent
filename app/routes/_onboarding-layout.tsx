import { Outlet } from "react-router";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { LanguageSwitcher } from "~/components/language-switcher";

export default function OnboardingLayout() {

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

      <div className="min-h-screen bg-stone-50 pt-safe dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl px-5">

          {/* Top bar */}
          <div className="flex items-center justify-between h-16">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-7 w-auto max-w-[130px] ob-fade-in"
            />
            <div className="ob-fade-in">
              <LanguageSwitcher variant="light" persistToDb />
            </div>
          </div>

          {/* The old 4-step stepper (profile → workspace → billing → products)
              is gone with the steps it listed: new accounts use the
              onboarding wizard at /onboarding/start, which has its own
              progress bar. Profile and DoorBoost pages keep this shell. */}
          <div className="pb-6" />

          {/* Page content */}
          <div className="pb-20">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
