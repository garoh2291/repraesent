import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getLeadStats } from "~/lib/api/leads";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

  const products = currentWorkspace?.products ?? [];
  const role = currentWorkspace?.member_role ?? "—";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-muted-foreground">Overview of your workspace</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Leads</CardTitle>
            <CardDescription>All leads in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <p className="text-3xl font-bold">{leadStats?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New This Week</CardTitle>
            <CardDescription>Leads created in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <p className="text-3xl font-bold">
                {leadStats?.new_this_week ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Current workspace and your role</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{currentWorkspace?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground capitalize">
              Role: {role}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>Products attached to this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Contact support to attach a product:{" "}
              <a
                href="mailto:support@dendritecorp.com"
                className="text-primary underline hover:no-underline"
              >
                support@dendritecorp.com
              </a>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <Card key={p.product_id} className="overflow-hidden">
                  <div className="flex h-24 items-center justify-center bg-muted">
                    {p.product_image ? (
                      <img
                        src={p.product_image}
                        alt={p.product_name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium truncate" title={p.product_name}>
                      {p.product_name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
