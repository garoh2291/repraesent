import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function meta() {
  return [
    { title: "No Workspace - Repraesent" },
    { name: "description", content: "Your account is not connected to any workspace" },
  ];
}

export default function NoWorkspace() {
  const { logout, isLoggingOut } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No Workspace</CardTitle>
          <CardDescription>
            Your user is not connected to any workspace. Contact support or your
            workspace owner to connect you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            For assistance, contact:{" "}
            <a
              href="mailto:support@gagadomains.com"
              className="text-primary underline hover:no-underline"
            >
              support@gagadomains.com
            </a>
          </p>
          <Button
            variant="outline"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
