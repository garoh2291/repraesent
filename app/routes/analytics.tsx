import { useAuthContext } from "~/providers/auth-provider";

export function meta() {
  return [
    { title: "Analytics - Repraesent" },
    { name: "description", content: "Analytics dashboard" },
  ];
}

export default function Analytics() {
  const { currentWorkspace } = useAuthContext();

  const analyticsService = currentWorkspace?.services?.find(
    (s) => s.service_type === "analytics"
  );

  const sharedLink = analyticsService?.service_config?.shared_link as
    | string
    | undefined;

  if (!analyticsService) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Analytics service is not enabled for this workspace.
        </p>
      </div>
    );
  }

  if (!sharedLink) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Analytics is not configured yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={sharedLink}
      className="flex-1 w-full border-0 min-h-0"
      style={{ height: "calc(100vh - 2rem)" }}
      title="Analytics"
      allowFullScreen
    />
  );
}
