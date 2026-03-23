import { Link, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CheckSquare,
  ChevronDown,
  HomeIcon,
  Info,
  LogOut,
  Package,
  Settings,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { InstructionsModal } from "~/components/instructions-modal";

import { getLocalizedServiceName } from "~/lib/api/auth";
import { useAuthContext } from "~/providers/auth-provider";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { LanguageSwitcher } from "~/components/language-switcher";
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

function NavLink({
  to,
  isActive,
  children,
  disabled,
  onClick,
  className,
}: {
  to: string;
  isActive: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-disabled={disabled}
      className={[
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
        "border-l-2 transition-all duration-150",
        disabled
          ? "cursor-not-allowed border-transparent text-white/25"
          : isActive
            ? "border-amber-400 bg-amber-400/10 text-amber-300"
            : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/75",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function Sidebar({ onClose, className }: { onClose?: () => void; className?: string }) {
  const {
    currentWorkspace,
    workspaces,
    setCurrentWorkspace,
    logout,
    isLoggingOut,
  } = useAuthContext();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hasMultipleWorkspaces = (workspaces?.length ?? 0) > 1;
  const [instructionsMarkdown, setInstructionsMarkdown] = useState<
    string | null
  >(null);
  const hasAppointmentsService =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "appointments"
    ) ?? false;
  const hasLeadFormService =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form"
    ) ?? false;
  const { data: appointmentConfigs } = useAppointmentConfigs(
    hasAppointmentsService && !!currentWorkspace?.id
  );
  const showAppointmentsInSidebar =
    hasAppointmentsService && !!appointmentConfigs?.length;

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };

  return (
    <aside className={cn("flex h-full w-[220px] shrink-0 flex-col bg-[#111113] border-r border-white/5", className)}>
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-white/5 gap-2">
        <Link to="/" className="flex items-center flex-1 min-w-0" onClick={onClose}>
          <img
            src={logoUrl}
            alt="Repraesent"
            className="h-7 w-auto max-w-[120px] brightness-0 invert opacity-90"
          />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Workspace selector */}
      <div className="shrink-0 px-3 py-3 border-b border-white/5">
        {currentWorkspace &&
          (hasMultipleWorkspaces ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-white/55 hover:bg-white/5 hover:text-white/80 transition-colors duration-150">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                    {currentWorkspace.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate font-medium text-white/70">
                    {currentWorkspace.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
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
            <div className="flex items-center gap-2 px-2.5 py-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-[13px] font-medium text-white/70">
                {currentWorkspace.name}
              </span>
            </div>
          ))}
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto p-3 space-y-0.5">
        <NavLink to="/" isActive={location.pathname === "/"} onClick={onClose}>
          <HomeIcon className="h-4 w-4 shrink-0" />
          {t("nav.home")}
        </NavLink>

        {currentWorkspace?.services
          ?.filter(
            (service) =>
              service.service_type !== "appointments" ||
              showAppointmentsInSidebar
          )
          ?.map((service) => {
            const href = service.service_slug
              ? `/${service.service_slug}`
              : "#";
            const isActive =
              !!service.service_slug &&
              (location.pathname === `/${service.service_slug}` ||
                location.pathname.startsWith(`/${service.service_slug}/`));
            const hasSlug = !!service.service_slug;
            const iconName = service.service_icon
              ? kebabToPascal(service.service_icon)
              : null;
            const hasIcon = !!iconName && lucideIconNames.has(iconName);

            const instructions = (
              service.service_config as Record<string, unknown> | null
            )?.instructions as string | undefined;
            const hasInstructions = !!instructions;
            return (
              <div
                key={service.service_id}
                className="flex items-center group/svc"
              >
                <NavLink
                  to={href}
                  isActive={isActive}
                  disabled={!hasSlug}
                  onClick={(e) => {
                    if (!hasSlug) e.preventDefault();
                    else onClose?.();
                  }}
                  className="flex-1 min-w-0"
                >
                  {hasIcon && (
                    <DynamicIcon
                      name={iconName!}
                      className="h-4 w-4 shrink-0"
                    />
                  )}
                  <span className="truncate">
                    {getLocalizedServiceName(service, i18n.language ?? "de")}
                  </span>
                </NavLink>
                {hasInstructions && (
                  <button
                    type="button"
                    title="View instructions"
                    onClick={() => setInstructionsMarkdown(instructions!)}
                    className="
                      ml-0.5 mr-1 flex h-5 w-5 shrink-0 items-center justify-center
                      rounded opacity-0 group-hover/svc:opacity-100
                      text-white/25 hover:text-amber-400 hover:bg-amber-400/8
                      transition-all duration-150
                    "
                  >
                    <Info className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

        {hasLeadFormService && (
          <NavLink to="/tasks" isActive={location.pathname === "/tasks"} onClick={onClose}>
            <CheckSquare className="h-4 w-4 shrink-0" />
            {t("nav.tasks")}
          </NavLink>
        )}

        <NavLink to="/settings" isActive={location.pathname === "/settings"} onClick={onClose}>
          <Settings className="h-4 w-4 shrink-0" />
          {t("nav.settings")}
        </NavLink>
        <NavLink to="/products" isActive={location.pathname === "/products"} onClick={onClose}>
          <Package className="h-4 w-4 shrink-0" />
          {t("nav.subscriptions")}
        </NavLink>
      </nav>

      {/* Bottom: language + logout */}
      <div className="shrink-0 border-t border-white/5 p-3 space-y-1.5">
        <div className="px-3 py-1">
          <LanguageSwitcher variant="dark" persistToDb />
        </div>
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/35 hover:bg-white/5 hover:text-white/60 transition-all duration-150 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {isLoggingOut ? t("common.loading") : t("nav.logout")}
        </button>

        {/* Legal links */}
        {(() => {
          const isEn = i18n.language === "en";
          const base = isEn ? "https://repraesent.com/en" : "https://repraesent.com";
          return (
            <div className="flex items-center gap-3 px-3 pt-1">
              <a
                href={`${base}/privacy.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/20 hover:text-white/45 transition-colors"
              >
                {isEn ? "Privacy" : "Datenschutz"}
              </a>
              <span className="text-white/10 text-[10px]">·</span>
              <a
                href={`${base}/impressum.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/20 hover:text-white/45 transition-colors"
              >
                Impressum
              </a>
            </div>
          );
        })()}
      </div>

      {/* Instructions modal */}
      {instructionsMarkdown !== null && (
        <InstructionsModal
          open
          onClose={() => setInstructionsMarkdown(null)}
          markdown={instructionsMarkdown}
        />
      )}
    </aside>
  );
}
