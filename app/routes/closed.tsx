import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { StatusPageHeader } from "~/components/status-page-header";

export function meta() {
  return [
    { title: "Workspace closed - Repraesent" },
    { name: "description", content: "Your workspace has been closed" },
  ];
}

export default function Closed() {
  const { currentWorkspace, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const ws = currentWorkspace ?? workspaces[0];
  const status = ws?.status;

  useEffect(() => {
    if (status && status !== "canceled") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <StatusPageHeader />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Workspace closed
            </CardTitle>
            <CardDescription>
              Your workspace has been closed. If you believe this is an error or
              would like to reactivate, please contact support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              For assistance, contact:{" "}
              <a
                href="mailto:support@dendritecorp.com"
                className="text-primary underline hover:no-underline"
              >
                support@dendritecorp.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
