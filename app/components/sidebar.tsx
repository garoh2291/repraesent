import { Link, useLocation, useNavigate } from "react-router";
import {
  Building2,
  ChevronDown,
  HomeIcon,
  LogOut,
  Package,
  Settings,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useAuthContext } from "~/providers/auth-provider";
import { useAppointmentConfig } from "~/lib/hooks/useAppointmentConfig";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

const lucideIconNames = new Set(
  Object.keys(LucideIcons).filter((key) => /^[A-Z]/.test(key))
);

function kebabToPascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = (LucideIcons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function Sidebar() {
  const {
    currentWorkspace,
    workspaces,
    setCurrentWorkspace,
    logout,
    isLoggingOut,
  } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const hasMultipleWorkspaces = (workspaces?.length ?? 0) > 1;
  const hasAppointmentsService =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "appointments"
    ) ?? false;
  const { data: appointmentConfig } = useAppointmentConfig(
    hasAppointmentsService && !!currentWorkspace?.id
  );
  const showAppointmentsInSidebar =
    hasAppointmentsService && !!appointmentConfig;

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-hidden  border-sidebar-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center">
          <img
            src={logoUrl}
            alt="Repraesent"
            className="h-8 w-auto max-w-[140px]"
          />
        </Link>
      </div>
      <div className="shrink-0 border-b border-sidebar-border px-2 py-2">
        {currentWorkspace &&
          (hasMultipleWorkspaces ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between gap-2 px-2 h-9 font-normal"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{currentWorkspace.name}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleWorkspaceChange(ws.id)}
                  >
                    <Building2 className="h-4 w-4" />
                    {ws.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{currentWorkspace.name}</span>
            </div>
          ))}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2 p-2">
        <Link
          to="/"
          className={`rounded-md px-2 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            location.pathname === "/"
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow)]"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          }`}
        >
          <HomeIcon className="h-4 w-4" />
          Home
        </Link>
        <Link
          to="/products"
          className={`rounded-md px-2 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            location.pathname === "/products"
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow)]"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          }`}
        >
          <Package className="h-4 w-4" />
          Products
        </Link>
        {currentWorkspace?.services
          ?.filter(
            (service) =>
              service.service_type !== "appointments" ||
              showAppointmentsInSidebar
          )
          ?.map((service) => {
          const href = service.service_slug ? `/${service.service_slug}` : "#";
          const isActive =
            service.service_slug &&
            (location.pathname === `/${service.service_slug}` ||
              location.pathname.startsWith(`/${service.service_slug}/`));
          const hasSlug = !!service.service_slug;
          const iconName = service.service_icon
            ? kebabToPascal(service.service_icon)
            : null;

          const hasIcon = !!iconName && lucideIconNames.has(iconName);

          return (
            <Link
              key={service.service_id}
              to={href}
              className={`rounded-md px-2 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                !hasSlug
                  ? "cursor-not-allowed text-muted-foreground opacity-60"
                  : isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              onClick={(e) => !hasSlug && e.preventDefault()}
              aria-disabled={!hasSlug}
            >
              {hasIcon && (
                <DynamicIcon name={iconName!} className="h-4 w-4 shrink-0" />
              )}
              {service.service_name}
            </Link>
          );
        })}
        <Link
          to="/settings"
          className={`rounded-md px-2 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            location.pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow)]"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => logout()}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Log out"}
        </Button>
      </div>
    </aside>
  );
}
