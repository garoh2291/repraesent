import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { Building2 } from "lucide-react";

export function meta() {
  return [
    { title: "Brand Dashboard - Repraesent" },
    { name: "description", content: "Brand workspaces overview" },
  ];
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "unknown";
  const colors: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    canceled: "bg-red-500/15 text-red-400 border-red-500/20",
    past_due: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  };
  const cls = colors[label] ?? "bg-white/8 text-white/50 border-white/10";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default function BrandDashboard() {
  const { t } = useTranslation();
  const { brand, brandWorkspaces } = useAuthContext();

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h2 className="text-xl font-semibold text-white/90">
          {t("brand.workspaces", "Workspaces")}
        </h2>
        <p className="mt-1 text-sm text-white/40">
          {t(
            "brand.workspacesDescription",
            "Workspaces connected to your brand."
          )}
        </p>
      </div>

      {/* Workspaces table */}
      {brandWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/6 bg-white/[0.02] py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/8">
            <Building2 className="h-5 w-5 text-white/30" />
          </div>
          <p className="mt-4 text-sm font-medium text-white/50">
            {t("brand.noWorkspaces", "No workspaces connected yet")}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {t(
              "brand.noWorkspacesHint",
              "Your administrator will connect workspaces to your brand."
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/6 bg-white/[0.02]">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/30">
                    {t("brand.workspaceName", "Name")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/30">
                    {t("brand.workspaceStatus", "Status")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/30">
                    {t("brand.workspaceCreated", "Created")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {brandWorkspaces.map((ws) => (
                  <tr
                    key={ws.id}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/8">
                          <Building2 className="h-3.5 w-3.5 text-white/40" />
                        </div>
                        <span className="text-sm font-medium text-white/80">
                          {ws.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={ws.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-white/40">
                      {new Date(ws.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-white/4">
            {brandWorkspaces.map((ws) => (
              <div key={ws.id} className="px-4 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/8">
                      <Building2 className="h-3 w-3 text-white/40" />
                    </div>
                    <span className="text-sm font-medium text-white/80">
                      {ws.name}
                    </span>
                  </div>
                  <StatusBadge status={ws.status} />
                </div>
                <p className="text-xs text-white/30 pl-9.5">
                  {new Date(ws.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
