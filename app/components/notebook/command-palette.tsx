import { useEffect, useMemo, useState } from "react";
import { useQuickCreate, type QuickCreateKind } from "~/components/notebook/quick-create";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Command } from "cmdk";
import {
  BookUser,
  Building2,
  Briefcase,
  CheckSquare,
  ClipboardList,
  CornerDownLeft,
  Mail,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { useAuthContext } from "~/providers/auth-provider";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useNavSections } from "~/lib/nav/sections";
import { useGlobalSearch } from "~/lib/hooks/useGlobalSearch";
import { SETTINGS_NAV } from "~/lib/nav/settings";
import { isMacPlatform } from "~/lib/utils/platform";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { contactPath } from "~/lib/contacts/contact-path";

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  keywords?: string;
  /** Opens a create dialog over the current page instead of navigating. */
  create?: QuickCreateKind;
  /** Runs over the current page instead of navigating (e.g. the email composer). */
  run?: () => void;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Opens with ⌘K / Ctrl K, or from any element dispatching `open-command-palette`. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

/**
 * ⌘K: go anywhere, start anything, find anyone (NOTEBOOK_UX_PLAN.md D12).
 * With the sidebar down to five jobs, this is how the rare pages (Settings →
 * BCC, a segment, the media bin) stay one keystroke away.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();
  const pilot = usePilotFeatures();
  const sections = useNavSections();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const search = useGlobalSearch(open ? query : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const isRootAdmin =
    currentWorkspace?.is_root === true && currentWorkspace.member_role === "admin";
  const isDemo = currentWorkspace?.is_demo === true;

  const destinations = useMemo<Item[]>(() => {
    if (!sections) return [];
    const out: Item[] = [];
    for (const s of sections) {
      out.push({ id: `sec-${s.key}`, label: s.label, icon: s.icon, to: s.to });
      for (const tab of s.tabs) {
        out.push({
          id: `tab-${s.key}-${tab.key}`,
          label: tab.label,
          hint: s.label,
          icon: tab.icon,
          to: tab.to,
        });
        for (const it of tab.items ?? []) {
          out.push({
            id: `item-${s.key}-${tab.key}-${it.key}`,
            label: it.label,
            hint: `${s.label} · ${tab.label}`,
            icon: tab.icon,
            to: it.to,
          });
        }
      }
    }
    for (const it of SETTINGS_NAV) {
      if (it.to === "/settings/integrations" && !(pilot.integrations || isDemo)) continue;
      if (it.to === "/settings/ai" && !pilot.aiAssistant) continue;
      if ((it.to === "/settings/onboarding" || it.to === "/settings/support") && !isRootAdmin) continue;
      out.push({
        id: `set-${it.to}`,
        label: t(it.labelKey),
        hint: t("nav.settings", "Settings"),
        icon: it.Icon ?? Settings,
        to: it.to,
      });
    }
    out.push({
      id: "billing",
      label: t("nav.billing", "Billing"),
      hint: t("nav.settings", "Settings"),
      icon: Settings,
      to: "/billing",
    });
    return out;
  }, [sections, pilot, isDemo, isRootAdmin, t]);

  const { openCompose } = useComposeEmail();
  const canEdit = useCanEditLeads();

  const actions = useMemo<Item[]>(
    () =>
      sections
        ? [
            { id: "new-lead", label: t("command.newInquiry", "New inquiry"), icon: Plus, to: "/lead-form?new=1", create: "lead" },
            { id: "new-deal", label: t("command.newDeal", "New deal"), icon: Plus, to: "/pipeline?newDeal=1", create: "deal" },
            { id: "new-task", label: t("command.newTask", "New task"), icon: Plus, to: "/tasks?new=1", create: "task" },
            { id: "new-contact", label: t("command.newContact", "New contact"), icon: Plus, to: "/contacts?new=1", create: "contact" },
            { id: "new-company", label: t("command.newCompany", "New company"), icon: Plus, to: "/companies?new=1", create: "company", keywords: "company firma unternehmen entreprise bedrijf" },
            ...(pilot.appointmentBook
              ? [{ id: "new-appointment", label: t("command.newAppointment", "New appointment"), icon: Plus, to: "/appointments", create: "appointment" as const, keywords: "appointment termin rendez-vous afspraak visit besuch booking buchung" }]
              : []),
            { id: "new-form", label: t("command.newForm", "New form"), icon: Plus, to: "/forms" },
            // Sending is editor-only server-side; the composer itself handles
            // "no mailbox connected yet" with a Connect button.
            ...(canEdit
              ? [{ id: "new-email", label: t("command.newEmail", "Send new email"), icon: Mail, to: "", keywords: "email e-mail mail write message nachricht courriel", run: () => openCompose({}) }]
              : []),
          ]
        : [],
    [sections, t, canEdit, openCompose, pilot.appointmentBook],
  );

  const q = norm(query.trim());
  const match = (i: Item) =>
    !q || norm(`${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`).includes(q);
  const shownDestinations = destinations.filter(match).slice(0, q ? 12 : 8);
  const shownActions = actions.filter(match);
  const hits = search.data;

  const quickCreate = useQuickCreate();
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const hitItems: { group: string; items: Item[] }[] = hits
    ? [
        {
          group: t("sections.tabs.inquiries", "Inquiries"),
          items: hits.leads.map((h) => ({ id: `l-${h.id}`, label: h.title, hint: h.subtitle ?? undefined, icon: Users, to: `/lead-form/${h.id}` })),
        },
        {
          group: t("sections.tabs.people", "People"),
          items: hits.contacts
            .filter((h) => h.kind !== "company")
            .map((h) => ({ id: `c-${h.id}`, label: h.title, hint: h.subtitle ?? undefined, icon: BookUser, to: contactPath(h) })),
        },
        {
          group: t("sections.tabs.companies", "Companies"),
          items: hits.contacts
            .filter((h) => h.kind === "company")
            .map((h) => ({ id: `c-${h.id}`, label: h.title, hint: h.subtitle ?? undefined, icon: Building2, to: contactPath(h) })),
        },
        {
          group: t("sections.deals", "Deals"),
          items: hits.deals.map((h) => ({ id: `d-${h.id}`, label: h.title, hint: h.subtitle ?? undefined, icon: Briefcase, to: `/pipeline/${h.id}` })),
        },
        {
          group: t("nav.tasks", "Tasks"),
          items: hits.tasks.map((h) => ({
            id: `t-${h.id}`,
            label: h.title,
            hint: h.subtitle ? new Date(h.subtitle).toLocaleDateString() : undefined,
            icon: CheckSquare,
            to: `/tasks?task_id=${h.id}`,
          })),
        },
        {
          group: t("nav.forms", "Forms"),
          items: hits.forms.map((h) => ({ id: `f-${h.id}`, label: h.title, icon: ClipboardList, to: `/forms/${h.id}` })),
        },
      ].filter((g) => g.items.length > 0)
    : [];

  // With shouldFilter off, cmdk keeps whatever it selected first — usually
  // "New inquiry" — even when the person's search hit arrives above it a beat
  // later. Keep the selection on the top result so Enter opens what you typed.
  const firstId =
    hitItems[0]?.items[0]?.id ?? shownActions[0]?.id ?? shownDestinations[0]?.id ?? "";
  useEffect(() => {
    setSelected(firstId);
  }, [firstId]);

  const row = (i: Item) => (
    <Command.Item
      key={i.id}
      value={i.id}
      onSelect={() => {
        if (i.run) {
          setOpen(false);
          i.run();
        } else if (i.create) {
          // Stay on this page: the palette closes, the dialog opens over it.
          setOpen(false);
          quickCreate.open(i.create);
        } else {
          go(i.to);
        }
      }}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-foreground aria-selected:bg-accent"
    >
      <i.icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{i.label}</span>
      {i.hint ? (
        <span className="max-w-[45%] shrink-0 truncate text-[12px] text-muted-foreground">{i.hint}</span>
      ) : null}
      <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-aria-selected:opacity-100 pointer-coarse:hidden" />
    </Command.Item>
  );

  const heading =
    "px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] w-[calc(100vw-1.5rem)] max-w-[600px] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:top-[14vh]"
      >
        <DialogTitle className="sr-only">{t("command.title", "Go to or search")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("command.description", "Find a page, a person or a deal")}
        </DialogDescription>
        <Command
          shouldFilter={false}
          loop
          value={selected}
          onValueChange={setSelected}
          className="flex flex-col"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t("command.placeholder", "Find a page, a person, a deal…")}
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
              esc
            </kbd>
          </div>
          <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
            {hitItems.map((g) => (
              <Command.Group key={g.group}>
                <p className={heading}>{g.group}</p>
                {g.items.map(row)}
              </Command.Group>
            ))}
            {shownActions.length > 0 ? (
              <Command.Group>
                <p className={heading}>{t("command.actions", "Start something")}</p>
                {shownActions.map(row)}
              </Command.Group>
            ) : null}
            {shownDestinations.length > 0 ? (
              <Command.Group>
                <p className={heading}>{t("command.goTo", "Go to")}</p>
                {shownDestinations.map(row)}
              </Command.Group>
            ) : null}
            {q && !search.isFetching && hitItems.length === 0 && shownDestinations.length === 0 && shownActions.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13.5px] text-muted-foreground">
                {t("command.empty", "Nothing matches “{{q}}”.", { q: query.trim() })}
              </div>
            ) : null}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
            <span>{t("command.footer", "Search people, deals, tasks and pages")}</span>
            {/* Keyboard shortcut: meaningless on a touch screen. */}
            <span className="num pointer-coarse:hidden">{isMacPlatform() ? "⌘K" : "Ctrl K"}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
