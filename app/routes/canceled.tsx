import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function meta() {
  return [
    { title: "Workspace canceled - Repraesent" },
    { name: "description", content: "Your workspace has been canceled" },
  ];
}

export default function Canceled() {
  const { logout, isLoggingOut } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Workspace canceled
          </CardTitle>
          <CardDescription>
            Your workspace has been canceled. If you believe this is an error or would like
            to reactivate, please contact support.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            For assistance, contact:{" "}
            <a
              href="mailto:support@dendritecorp.com"
              className="text-primary underline hover:no-underline"
            >
              support@dendritecorp.com
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
