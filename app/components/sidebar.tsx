import { Link, useLocation, useNavigate } from "react-router";
import { Building2, ChevronDown, LogOut } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

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

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Link to="/" className="flex items-center">
          <img
            src={logoUrl}
            alt="Repraesent"
            className="h-8 w-auto max-w-[140px]"
          />
        </Link>
      </div>
      <div className="border-b px-3 py-3">
        {currentWorkspace && (
          hasMultipleWorkspaces ? (
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
          )
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {currentWorkspace?.products?.map((product) => {
          const href = product.product_slug ? `/${product.product_slug}` : "#";
          const isActive =
            product.product_slug &&
            (location.pathname === `/${product.product_slug}` ||
              location.pathname.startsWith(`/${product.product_slug}/`));
          const hasSlug = !!product.product_slug;

          return (
            <Link
              key={product.product_id}
              to={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                !hasSlug
                  ? "cursor-not-allowed text-muted-foreground opacity-60"
                  : isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
              onClick={(e) => !hasSlug && e.preventDefault()}
              aria-disabled={!hasSlug}
            >
              {product.product_name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
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
