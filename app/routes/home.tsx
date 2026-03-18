import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, Package, TrendingUp, Users } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { getLeadStats } from "~/lib/api/leads";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Dashboard home" },
  ];
}

function StatCard({
  label,
  description,
  value,
  isLoading,
  icon: Icon,
  delay,
}: {
  label: string;
  description: string;
  value: number | string | undefined;
  isLoading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  delay: string;
}) {
  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-6 flex flex-col gap-4"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="text-[13px] text-muted-foreground/70">{description}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {isLoading ? (
        <div className="h-9 w-16 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="text-4xl font-bold tracking-tight text-foreground">
          {value ?? 0}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const { user, currentWorkspace } = useAuthContext();

  const { data: leadStats, isLoading: statsLoading } = useQuery({
    queryKey: ["leadStats", currentWorkspace?.id],
    queryFn: getLeadStats,
    enabled: !!currentWorkspace?.id,
  });

  const services = currentWorkspace?.services ?? [];
  const role = currentWorkspace?.member_role ?? "—";
  const displayName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8 app-fade-in">
      {/* Page heading */}
      <div className="app-fade-up space-y-1">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Good to see you{displayName ? `, ${displayName.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {currentWorkspace?.name} · <span className="capitalize">{role}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Leads"
          description="All leads in this workspace"
          value={leadStats?.total}
          isLoading={statsLoading}
          icon={Users}
          delay="0.06s"
        />
        <StatCard
          label="New This Week"
          description="Leads created in the last 7 days"
          value={leadStats?.new_this_week}
          isLoading={statsLoading}
          icon={TrendingUp}
          delay="0.12s"
        />
      </div>

      {/* User + workspace info */}
      <div className="grid gap-4 sm:grid-cols-2 app-fade-up app-fade-up-d3">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Account
          </p>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {displayName || "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {currentWorkspace?.name ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              Role: {role}
            </p>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="app-fade-up app-fade-up-d4 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Services
          </p>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Services attached to this workspace
          </p>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No services attached yet. Contact{" "}
              <a
                href="mailto:support@dendritecorp.com"
                className="text-primary hover:underline font-medium"
              >
                support@dendritecorp.com
              </a>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const hasSlug = !!s.service_slug;
              const cardContent = (
                <div
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border border-border bg-card overflow-hidden h-[76px] transition-all duration-200",
                    hasSlug
                      ? "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                      : "opacity-55 cursor-not-allowed"
                  )}
                >
                  {s.service_image ? (
                    <img
                      src={s.service_image}
                      alt={s.service_name}
                      className="h-full w-20 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-20 shrink-0 items-center justify-center bg-primary/6">
                      <Package className="h-6 w-6 text-primary/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {s.service_name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {hasSlug ? (
                        <>
                          Open section
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                        </>
                      ) : (
                        "Not available"
                      )}
                    </p>
                  </div>
                </div>
              );

              return hasSlug ? (
                <Link
                  key={s.service_id}
                  to={`/${s.service_slug}`}
                  className="block no-underline text-inherit"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={s.service_id}>{cardContent}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
