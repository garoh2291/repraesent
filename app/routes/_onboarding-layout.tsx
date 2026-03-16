import { Outlet, Link, useLocation } from "react-router";

const STEPS = [
  { path: "/onboarding/profile", label: "Profile" },
  { path: "/onboarding/workspace", label: "Workspace" },
  { path: "/onboarding/billing", label: "Billing" },
  { path: "/onboarding/products", label: "Products" },
];

export default function OnboardingLayout() {
  const location = useLocation();
  const currentIndex = STEPS.findIndex((s) => location.pathname === s.path);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((step, i) => (
              <div key={step.path} className="flex flex-1 items-center">
                <Link
                  to={step.path}
                  className={`text-sm font-medium ${
                    i <= (currentIndex >= 0 ? currentIndex : 0)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {i + 1}. {step.label}
                </Link>
                {i < STEPS.length - 1 && (
                  <div className="mx-2 h-px flex-1 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
