import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

export function meta() {
  return [
    { title: "Choose workspace - Repraesent" },
    { name: "description", content: "Select a workspace to continue" },
  ];
}

export default function WorkspacePicker() {
  const { t } = useTranslation();
  const { workspaces, setCurrentWorkspace } = useAuthContext();
  const navigate = useNavigate();

  const handleSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    if (workspaces.length > 1) {
      setStoredWorkspaceId(workspaceId);
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-lg space-y-10 app-fade-up">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src={logoUrl}
            alt="Repraesent"
            className="h-8 w-auto max-w-[140px] app-fade-in"
          />
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 app-fade-up app-fade-up-d1">
          <h1
            className="text-[28px] font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            {t("auth.workspacePicker.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.workspacePicker.subtitle", { count: workspaces.length })}
          </p>
        </div>

        {/* Workspace cards */}
        <div className="grid gap-3 app-fade-up app-fade-up-d2">
          {workspaces.map((workspace, i) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => handleSelect(workspace.id)}
              className="group flex items-center gap-4 w-full rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-stone-300 hover:shadow-md active:scale-[0.99]"
              style={{ animationDelay: `${0.18 + i * 0.06}s` }}
            >
              {/* Workspace initial */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111113] text-white text-lg font-bold">
                {workspace.name.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {workspace.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("auth.workspacePicker.clickToEnter")}
                </p>
              </div>

              {/* Arrow */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-stone-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-stone-600"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
