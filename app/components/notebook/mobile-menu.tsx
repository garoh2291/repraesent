import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Headset,
  HomeIcon,
  Loader2,
  LogOut,
  Megaphone,
  Package,
  Search,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import { SafeImg } from "~/components/atom/safe-img";
import { LanguageSwitcher } from "~/components/language-switcher";
import { ContactSalesDialog } from "~/components/sales-contact/contact-sales-dialog";
import { openCommandPalette } from "~/components/notebook/command-palette";
import { useAuthContext } from "~/providers/auth-provider";
import { PILOT_FEATURE_LABEL_KEY } from "~/lib/feature-flags";
import { useWorkspaceWpPluginInstalls } from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import { pluginKindIcon, wordpressPluginSettingsPath } from "~/lib/utils/wordpress-plugin-kind";
import { useNavSections } from "~/lib/nav/sections";
import { PILOT_SETTINGS, useNavModel } from "~/lib/nav/use-nav-model";
import { cn } from "~/lib/utils";
import { ListRow, SettingsGroups } from "~/components/notebook/settings-groups";
import { applyWaitingUpdate, useUpdateWaiting } from "~/lib/pwa/update-store";
import { EASE_OUT, SPRING } from "~/lib/motion";

/**
 * The phone menu: a light sheet that rises from the bottom (opened by "More"
 * in the tab bar, or ☰ in brand workspaces). The four daily jobs live in the
 * tab bar, so the sheet holds everything else — the area switcher, search,
 * Website, Settings, Billing, Contact re:praesent, language and log out.
 *
 * Same rules as the desktop sidebar (useNavModel). Inside Settings or Website
 * it opens on that section's own list, with a way back to the main menu that
 * doesn't navigate anywhere.
 */

type View = "main" | "settings" | "website";


export function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const nav = useNavModel();
  const [contactOpen, setContactOpen] = useState(false);
  const routeView: View = nav.inSettings ? "settings" : nav.inWebsite ? "website" : "main";
  const [view, setView] = useState<View>(routeView);
  // Every opening starts where the person is.
  useEffect(() => {
    if (open) setView(routeView);
  }, [open, routeView]);

  const close = () => onOpenChange(false);
  const reduce = useReducedMotion();
  const updateWaiting = useUpdateWaiting();

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88dvh] rounded-t-[28px] border-0 bg-background shadow-[0_-18px_50px_-20px_rgba(20,21,22,0.45)] lg:hidden">
          <DrawerTitle className="sr-only">{t("nav.mobileMenu.title", "Menu")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("nav.mobileMenu.description", "Everything beyond the four tabs")}</DrawerDescription>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AreaSwitcher onPicked={close} />
            {!nav.isDoorboostBrandWs ? (
              <button
                type="button"
                onClick={() => {
                  close();
                  // Let the sheet leave first; the palette is its own dialog.
                  setTimeout(openCommandPalette, 180);
                }}
                className="press mt-3 flex h-12 w-full items-center gap-3 rounded-full border border-border bg-card px-4 text-left text-[15px] text-muted-foreground transition-colors active:bg-muted"
              >
                <Search className="size-[18px] shrink-0" aria-hidden />
                <span className="truncate">{t("nav.mobileMenu.search", "Search or jump to…")}</span>
              </button>
            ) : null}

            {updateWaiting ? (
              <button
                type="button"
                onClick={applyWaitingUpdate}
                className="press mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left active:bg-muted"
              >
                <span className="size-2 shrink-0 rounded-full bg-marker ring-4 ring-marker/25" aria-hidden />
                <span className="min-w-0 flex-1 text-[15px] font-medium text-foreground">
                  {t("pwa.update.title", "New version ready")}
                </span>
                <span className="rounded-full bg-foreground px-3 py-1.5 text-[13px] font-semibold text-background">
                  {t("pwa.update.reload", "Reload")}
                </span>
              </button>
            ) : null}

            <div className="relative mt-5 overflow-x-clip">
              <AnimatePresence mode="popLayout" initial={false} custom={view === "main" ? -1 : 1}>
              <motion.div
                key={view}
                custom={view === "main" ? -1 : 1}
                variants={{
                  enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 36 }),
                  center: { opacity: 1, x: 0 },
                  exit: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * -36 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduce ? { duration: 0.15 } : SPRING}
              >
              {view === "settings" ? (
                <SettingsList onBack={() => setView("main")} onNavigate={close} />
              ) : view === "website" ? (
                <WebsiteList onBack={() => setView("main")} onNavigate={close} />
              ) : nav.isDoorboostBrandWs ? (
                <BrandTiles open={open} onNavigate={close} />
              ) : (
                <MainTiles
                  open={open}
                  onNavigate={close}
                  onContact={() => {
                    close();
                    setContactOpen(true);
                  }}
                  onOpenView={setView}
                />
              )}
              </motion.div>
              </AnimatePresence>
            </div>

            <Footer />
          </div>
        </DrawerContent>
      </Drawer>
      {nav.showContactSales ? <ContactSalesDialog open={contactOpen} onOpenChange={setContactOpen} /> : null}
    </>
  );
}

// ── area switcher ────────────────────────────────────────────────────────────

function WsAvatar({ name, src, size = 40 }: { name: string; src: string | null | undefined; size?: number }) {
  const letter = (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-foreground font-semibold text-background"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
  if (!src) return letter;
  return (
    <SafeImg
      src={src}
      className="shrink-0 rounded-xl border border-border bg-white object-contain p-1"
      style={{ width: size, height: size }}
      fallback={letter}
    />
  );
}

function AreaSwitcher({ onPicked }: { onPicked: () => void }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const nav = useNavModel();
  const [expanded, setExpanded] = useState(false);
  const ws = nav.currentWorkspace;
  if (!ws) return null;
  const avatar = ws.avatar_thumb_url ?? ws.avatar_url;

  const head = (
    <>
      <WsAvatar name={ws.name} src={avatar} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold leading-tight text-foreground">{ws.name}</span>
        {nav.hasMultipleWorkspaces ? (
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{t("nav.mobileMenu.switchBusiness", "Switch business")}</span>
        ) : null}
      </span>
    </>
  );

  if (!nav.hasMultipleWorkspaces) {
    return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">{head}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors active:bg-muted"
      >
        {head}
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.ul
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE_OUT }}
            className="max-h-[40dvh] overflow-y-auto border-t border-border"
          >
            {nav.showBrandSwitchEntry && nav.brand ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onPicked();
                    nav.switchToBrand();
                  }}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Building2 className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{nav.brand.name}</span>
                  <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
                    {t("nav.brand_label", "Brand")}
                  </span>
                </button>
              </li>
            ) : null}
            {nav.workspaces.map((w) => {
              const on = w.id === ws.id;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    aria-current={on ? "true" : undefined}
                    onClick={() => {
                      onPicked();
                      if (!on) nav.switchWorkspace(w.id);
                    }}
                    className={cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-muted", on && "bg-muted/60")}
                  >
                    <WsAvatar name={w.name} src={w.avatar_thumb_url ?? w.avatar_url} size={32} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{w.name}</span>
                    {w.type === "doorboost_brand" ? (
                      <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
                        {t("nav.brand_label", "Brand")}
                      </span>
                    ) : null}
                    {on ? <Check className="size-4 shrink-0 text-foreground" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── tiles ────────────────────────────────────────────────────────────────────

type Tile = {
  key: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
  /** Opens a list inside the sheet: shows a chevron. */
  drill?: boolean;
  active?: boolean;
};

function TileGrid({ tiles, open, onNavigate }: { tiles: Tile[]; open: boolean; onNavigate: () => void }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-2 gap-3">
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        // An odd last tile takes the whole row instead of sitting alone.
        const wide = tiles.length % 2 === 1 && i === tiles.length - 1;
        const body = (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Icon className="size-[19px]" aria-hidden />
            </span>
            <span className={cn("block min-w-0", wide ? "flex-1" : "mt-3")}>
              <span className="block text-[15px] font-semibold leading-tight text-foreground">{tile.label}</span>
              {tile.hint ? <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">{tile.hint}</span> : null}
            </span>
            {wide ? <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden /> : null}
            {tile.drill && !wide ? (
              <ChevronRight className="absolute right-3.5 top-4 size-4 text-muted-foreground/60" aria-hidden />
            ) : null}
            {tile.active ? <span className="absolute inset-x-5 bottom-0 h-[3px] rounded-t-full bg-marker" aria-hidden /> : null}
          </>
        );
        const cls = cn(
          wide ? "min-h-[76px] flex-row items-center gap-3.5" : "min-h-[112px] flex-col items-start",
          "press relative flex h-full w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(20,21,22,0.04)] transition-[transform,border-color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
        );
        return (
          <motion.li
            key={`${tile.key}-${open ? "o" : "c"}`}
            className={wide ? "col-span-2" : undefined}
            initial={reduce ? false : { opacity: 0, transform: "translateY(10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.26, delay: reduce ? 0 : 0.06 + i * 0.04, ease: EASE_OUT }}
          >
            {tile.to ? (
              <Link to={tile.to} prefetch="intent" onClick={onNavigate} aria-current={tile.active ? "page" : undefined} className={cls}>
                {body}
              </Link>
            ) : (
              <button type="button" onClick={tile.onClick} className={cls}>
                {body}
              </button>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}

function MainTiles({
  open,
  onNavigate,
  onContact,
  onOpenView,
}: {
  open: boolean;
  onNavigate: () => void;
  onContact: () => void;
  /** Website and Settings open their own list in the sheet, not a page. */
  onOpenView: (view: "settings" | "website") => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const nav = useNavModel();
  const sections = useNavSections();
  const website = sections?.find((s) => s.key === "website");
  const tiles: Tile[] = [];
  if (website) {
    tiles.push({
      key: "website",
      label: website.label,
      hint: t("nav.mobileMenu.hints.website", "Pages, SEO and your services"),
      icon: website.icon ?? Globe,
      onClick: () => onOpenView("website"),
      drill: true,
      active: location.pathname.startsWith("/website"),
    });
  }
  tiles.push(
    {
      key: "settings",
      label: t("nav.settings"),
      hint: t("nav.mobileMenu.hints.settings", "You, your team and connections"),
      icon: Settings,
      onClick: () => onOpenView("settings"),
      drill: true,
      active: nav.inSettings,
    },
    {
      key: "billing",
      label: t("nav.billing"),
      hint: t("nav.mobileMenu.hints.billing", "Plan and invoices"),
      icon: Package,
      to: "/billing",
      active: location.pathname === "/billing",
    },
  );
  if (nav.showContactSales) {
    tiles.push({
      key: "contact",
      label: t("salesContact.nav"),
      hint: t("nav.mobileMenu.hints.contact", "A real person from our team"),
      icon: Headset,
      onClick: onContact,
    });
  }
  return <TileGrid tiles={tiles} open={open} onNavigate={onNavigate} />;
}

function BrandTiles({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tiles: Tile[] = [
    { key: "home", label: t("nav.home", "Home"), icon: HomeIcon, to: "/db-brand", active: pathname === "/db-brand" },
    {
      key: "retailers",
      label: t("nav.brand_retailers", "Retailers"),
      icon: Store,
      to: "/brand-retailers",
      active: pathname.startsWith("/brand-retailers") || pathname.startsWith("/db-brand/retailers"),
    },
    { key: "campaigns", label: t("nav.brand_campaigns", "Campaigns"), icon: Megaphone, to: "/brand-campaigns", active: pathname.startsWith("/brand-campaigns") },
    { key: "leads", label: t("nav.brand_leads", "Leads"), icon: Users, to: "/brand-leads", active: pathname.startsWith("/brand-leads") },
  ];
  return <TileGrid tiles={tiles} open={open} onNavigate={onNavigate} />;
}

// ── section lists (Settings, Website) ────────────────────────────────────────

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="press -ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-foreground/80 active:bg-muted"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.mobileMenu.mainMenu", "Menu")}
      </button>
      <span className="ob2-heading text-[18px]">{label}</span>
    </div>
  );
}

function SettingsList({ onBack, onNavigate }: { onBack: () => void; onNavigate: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <BackRow label={t("nav.settings")} onBack={onBack} />
      <SettingsGroups onNavigate={onNavigate} />
    </div>
  );
}

function WebsiteList({ onBack, onNavigate }: { onBack: () => void; onNavigate: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const installs = useWorkspaceWpPluginInstalls(true);
  const plugins = [...(installs.data?.plugins ?? [])].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
  return (
    <div>
      <BackRow label={t("nav.website", "Website")} onBack={onBack} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <ListRow to="/website" icon={Globe} label={t("nav.websiteOverview", "Overview")} active={pathname === "/website"} onNavigate={onNavigate} />
        {installs.isPending && !installs.data ? (
          <li className="flex min-h-12 items-center gap-3 px-3 text-[14px] text-muted-foreground" aria-busy="true">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t("nav.loadingPlugins", "Loading services…")}
          </li>
        ) : (
          plugins.map((p) => {
            const path = wordpressPluginSettingsPath(p.plugin_uuid);
            return (
              <ListRow key={p.plugin_uuid} to={path} icon={pluginKindIcon(p.name)} label={p.display_name} active={pathname === path} onNavigate={onNavigate} />
            );
          })
        )}
      </ul>
    </div>
  );
}

// ── footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { t, i18n } = useTranslation();
  const { logout, isLoggingOut } = useAuthContext();
  const isEn = i18n.language === "en";
  const base = isEn ? "https://repraesent.com/en" : "https://repraesent.com";
  return (
    <div className="mt-6 space-y-4 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">{t("nav.mobileMenu.language", "Language")}</span>
        <LanguageSwitcher variant="light" persistToDb />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="press -ml-2 inline-flex h-11 items-center gap-2 rounded-full px-3 text-[14.5px] font-medium text-foreground/75 active:bg-muted disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden />
          {isLoggingOut ? t("common.loading") : t("nav.logout")}
        </button>
        <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground/80">
          <a href={`${base}/privacy.html`} target="_blank" rel="noopener noreferrer" className="py-2 underline-offset-2 hover:underline">
            {isEn ? "Privacy" : "Datenschutz"}
          </a>
          <span aria-hidden>·</span>
          <a href={`${base}/impressum.html`} target="_blank" rel="noopener noreferrer" className="py-2 underline-offset-2 hover:underline">
            Impressum
          </a>
        </span>
      </div>
    </div>
  );
}
