import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, Package } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { getLeadStats } from "~/lib/api/leads";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardValue,
} from "~/components/ui/card";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Dashboard home" },
  ];
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

  return (
    <div className="mx-auto max-w-[1300px] p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-muted-foreground">Overview of your workspace</p>
      </div>

      <hr className="border-border" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="max-w-[400px]">
          <CardHeader>
            <CardTitle>Total Leads</CardTitle>
            <CardDescription>All leads in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <CardValue>{leadStats?.total ?? 0}</CardValue>
            )}
          </CardContent>
        </Card>
        <Card className="max-w-[400px]">
          <CardHeader>
            <CardTitle>New This Week</CardTitle>
            <CardDescription>Leads created in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <CardValue>{leadStats?.new_this_week ?? 0}</CardValue>
            )}
          </CardContent>
        </Card>
      </div>

      <hr className="border-border" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="max-w-[400px]">
          <CardHeader>
            <CardTitle>User</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <CardValue className="text-2xl">
              {user?.first_name} {user?.last_name}
            </CardValue>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>
        <Card className="max-w-[400px]">
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Current workspace and your role</CardDescription>
          </CardHeader>
          <CardContent>
            <CardValue className="text-2xl">
              {currentWorkspace?.name ?? "—"}
            </CardValue>
            <p className="text-sm text-muted-foreground capitalize">
              Role: {role}
            </p>
          </CardContent>
        </Card>
      </div>

      <hr className="border-border" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Services
          </CardTitle>
          <CardDescription>Services attached to this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Contact support to attach a service:{" "}
              <a
                href="mailto:support@dendritecorp.com"
                className="text-primary underline hover:no-underline"
              >
                support@dendritecorp.com
              </a>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {services.map((s) => {
                const hasSlug = !!s.service_slug;
                const cardContent = (
                  <Card
                    className={cn(
                      "max-w-[400px] overflow-hidden py-0 flex flex-row h-[88px] transition-shadow",
                      hasSlug && "hover:shadow-md cursor-pointer"
                    )}
                  >
                    {s.service_image ? (
                      <img
                        src={s.service_image}
                        alt={s.service_name}
                        className="h-full w-24 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-24 shrink-0 items-center justify-center bg-muted">
                        <Package className="h-10 w-10 text-primary" />
                      </div>
                    )}
                    <CardContent className="flex flex-1 flex-col justify-center p-4 min-w-0">
                      <p className="font-medium truncate" title={s.service_name}>
                        {s.service_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        {hasSlug ? (
                          <>
                            View section
                            <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                          </>
                        ) : (
                          "No section available"
                        )}
                      </p>
                    </CardContent>
                  </Card>
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
                  <div
                    key={s.service_id}
                    className="block opacity-60 cursor-not-allowed"
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
