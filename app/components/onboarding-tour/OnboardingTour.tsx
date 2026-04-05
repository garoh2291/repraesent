import { useState, useCallback, useEffect } from "react";
import { completeOnboarding } from "~/lib/api/auth";

/* ─────────────────────────────────────────────────────────
   Tour step data — bilingual
───────────────────────────────────────────────────────── */
interface Step {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  screenshot: string | null;
  screenshotAlt: string;
}

interface StepContent {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
}

// Screenshot paths + which service slugs/types gate each step (null = always shown, array = ALL must be present)
const STEP_META: Array<{
  id: string;
  screenshot: string | null;
  screenshotAlt: string;
  /** service_slug or service_type(s) that must ALL be present on the workspace */
  requiredServices: string[] | null;
}> = [
  {
    id: "welcome",
    screenshot: null,
    screenshotAlt: "",
    requiredServices: null,
  },
  {
    id: "dashboard",
    screenshot: "/onboarding/dashboard-overview.png",
    screenshotAlt: "Dashboard",
    requiredServices: null,
  },
  {
    id: "leads",
    screenshot: "/onboarding/leads-board.png",
    screenshotAlt: "Leads board",
    requiredServices: ["lead-form"],
  },
  {
    id: "lead-fallback",
    screenshot: "/onboarding/lead-fallback-email.png",
    screenshotAlt: "Lead fallback email",
    requiredServices: ["lead-form", "email-config"],
  },
  {
    id: "lead-detail",
    screenshot: "/onboarding/lead-detail.png",
    screenshotAlt: "Lead detail",
    requiredServices: ["lead-form"],
  },
  {
    id: "appointments",
    screenshot: "/onboarding/appointments-calendar.png",
    screenshotAlt: "Appointments",
    requiredServices: ["appointments"],
  },
  {
    id: "tasks",
    screenshot: "/onboarding/tasks.png",
    screenshotAlt: "Tasks",
    requiredServices: ["lead-form"],
  },
  {
    id: "analytics",
    screenshot: "/onboarding/analytics.png",
    screenshotAlt: "Analytics",
    requiredServices: ["analytics"],
  },
  {
    id: "email",
    screenshot: "/onboarding/email-config.png",
    screenshotAlt: "Email setup",
    requiredServices: ["email"],
  },
  {
    id: "settings",
    screenshot: "/onboarding/workspace-settings.png",
    screenshotAlt: "Settings",
    requiredServices: null,
  },
  {
    id: "doorboost-migration",
    screenshot: null,
    screenshotAlt: "Data migration",
    requiredServices: null,
  },
];

// Localised copy
const STEP_CONTENT: Record<"en" | "de", StepContent[]> = {
  en: [
    {
      badge: "Welcome",
      title: "You're in.",
      subtitle: "Let's get you started in 2 minutes.",
      description:
        "Repraesent is your all-in-one area for managing leads, booking appointments, and growing your business. This quick tour shows you everything you need to hit the ground running.",
    },
    {
      badge: "01 — Dashboard",
      title: "Your Mission\nControl Center",
      subtitle: "Everything at a glance.",
      description:
        "The dashboard gives you a real-time pulse on your business. Track today's tasks, monitor lead activity over time, and jump straight into any area service from one clean screen.",
    },
    {
      badge: "02 — Leads",
      title: "Never Lose a\nLead Again",
      subtitle: "Visual pipeline, instant updates.",
      description:
        "Manage every prospect through a drag-and-drop kanban board or a clean table view. Update statuses, add notes, and track the full journey from first contact to closed deal.",
    },
    {
      badge: "03 — Fallback Email",
      title: "Reply to Every\nLead Automatically",
      subtitle: "Set it once, follow up on autopilot.",
      description:
        "When a new lead submits your form or books an appointment, Repraesent automatically sends them a personalized reply from your own email address. Configure a custom subject line and HTML body per source — no extra tools needed.",
    },
    {
      badge: "04 — Lead Detail",
      title: "Every Lead,\nFully Documented",
      subtitle: "The full story in one place.",
      description:
        "Click any lead to open its detail view — see contact info, activity timeline, attached notes, and status history. Edit everything inline and never lose context on a conversation.",
    },
    {
      badge: "04 — Appointments",
      title: "Scheduling on\nAutopilot",
      subtitle: "Let clients book themselves.",
      description:
        "Share your personalized booking link and let clients choose their own slot. Set your working hours, define break times, and let Repraesent handle confirmations automatically.",
    },
    {
      badge: "05 — Tasks",
      title: "Stay on Top\nof Every Action",
      subtitle: "Your personal to-do, tied to leads.",
      description:
        "Create tasks linked directly to leads so nothing slips through the cracks. Filter by due date, priority, or assignee and always know exactly what needs your attention today.",
    },
    {
      badge: "06 — Analytics",
      title: "Know Who\nVisits Your Site",
      subtitle: "Real website traffic, no guesswork.",
      description:
        "The analytics tab is powered by Plausible — a privacy-friendly tool that shows you your website visitors, traffic sources, top pages, and more. See exactly where your audience comes from, all in one clean view.",
    },
    {
      badge: "07 — Email Setup",
      title: "Your Email,\nReady Anywhere",
      subtitle: "Connect your inbox in minutes.",
      description:
        "Find your personal email configuration here — server address, port, and login credentials — and follow the step-by-step guide to add your Repraesent mailbox to Outlook, Apple Mail, or any other email client.",
    },
    {
      badge: "08 — Settings",
      title: "Make It\nCompletely Yours",
      subtitle: "Your area, your rules.",
      description:
        "Customize your area name, manage team members and their roles, and fine-tune your public booking page. Every detail can be tailored to match your brand and workflow.",
    },
    {
      badge: "Migration",
      title: "Bring Your\nDoorboost Data",
      subtitle: "Campaigns, leads & team — one click.",
      description:
        "We detected your Doorboost account. Import all your historical campaigns, leads, notes, and team members into re:praesent with a single sync. Your data is safe and nothing will be lost.",
    },
  ],
  de: [
    {
      badge: "Willkommen",
      title: "Du bist dabei.",
      subtitle: "Starte in 2 Minuten durch.",
      description:
        "Repraesent ist dein All-in-One-Bereich für Lead-Management, Terminbuchungen und Unternehmenswachstum. Diese kurze Tour zeigt dir alles, was du für einen erfolgreichen Start brauchst.",
    },
    {
      badge: "01 — Dashboard",
      title: "Dein persönliches\nKontrollzentrum",
      subtitle: "Alles auf einen Blick.",
      description:
        "Das Dashboard zeigt dir in Echtzeit den Puls deines Unternehmens. Verfolge heutige Aufgaben, beobachte Lead-Aktivitäten im Zeitverlauf und springe direkt in jeden Bereich-Dienst.",
    },
    {
      badge: "02 — Leads",
      title: "Kein Lead geht\nmehr verloren",
      subtitle: "Visuelle Pipeline, sofortige Updates.",
      description:
        "Verwalte jeden Interessenten über ein Drag-and-Drop-Kanban-Board oder eine übersichtliche Tabellenansicht. Aktualisiere Status, füge Notizen hinzu und verfolge den gesamten Weg vom Erstkontakt bis zum Abschluss.",
    },
    {
      badge: "03 — Automatische Antwort",
      title: "Automatisch auf\njeden Lead antworten",
      subtitle: "Einmal einrichten, automatisch nachfassen.",
      description:
        "Wenn ein neuer Lead dein Formular ausfüllt oder einen Termin bucht, sendet Repraesent automatisch eine personalisierte Antwort von deiner eigenen E-Mail-Adresse. Lege Betreff und HTML-Inhalt je Quelle fest — keine zusätzlichen Tools nötig.",
    },
    {
      badge: "04 — Lead-Detail",
      title: "Jeder Lead,\nvollständig dokumentiert",
      subtitle: "Die ganze Geschichte an einem Ort.",
      description:
        "Klicke auf einen Lead, um dessen Detailansicht zu öffnen — Kontaktdaten, Aktivitätsverlauf, Notizen und Statushistorie. Alles inline bearbeitbar, ohne den Überblick zu verlieren.",
    },
    {
      badge: "04 — Termine",
      title: "Terminplanung\nauf Autopilot",
      subtitle: "Lass Kunden selbst buchen.",
      description:
        "Teile deinen persönlichen Buchungslink und lass Kunden ihren Slot selbst wählen. Lege deine Arbeitszeiten fest, definiere Pausenzeiten und lass Repraesent die Bestätigungen automatisch übernehmen.",
    },
    {
      badge: "05 — Aufgaben",
      title: "Behalte jeden\nSchritt im Blick",
      subtitle: "Deine To-do-Liste, verknüpft mit Leads.",
      description:
        "Erstelle Aufgaben direkt verknüpft mit Leads, damit nichts durch den Rost fällt. Filtere nach Fälligkeitsdatum, Priorität oder Bearbeiter und wisse stets genau, was heute deine Aufmerksamkeit braucht.",
    },
    {
      badge: "06 — Analytik",
      title: "Sieh, wer deine\nWebsite besucht",
      subtitle: "Echter Website-Traffic, keine Schätzungen.",
      description:
        "Der Analytik-Bereich wird von Plausible betrieben — einem datenschutzfreundlichen Tool, das dir Besucher, Traffic-Quellen, meistbesuchte Seiten und mehr anzeigt. Verstehe genau, woher dein Publikum kommt — alles in einer übersichtlichen Ansicht.",
    },
    {
      badge: "07 — E-Mail-Einrichtung",
      title: "Deine E-Mail,\nüberall einsatzbereit",
      subtitle: "Postfach in Minuten verbinden.",
      description:
        "Finde hier deine persönlichen E-Mail-Konfigurationsdaten — Serveradresse, Port und Zugangsdaten — und folge der Schritt-für-Schritt-Anleitung, um dein Repraesent-Postfach mit Outlook, Apple Mail oder einem anderen E-Mail-Client zu verbinden.",
    },
    {
      badge: "08 — Einstellungen",
      title: "Mach es ganz\nzu deinem",
      subtitle: "Dein Bereich, deine Regeln.",
      description:
        "Passe deinen Bereich-Namen an, verwalte Teammitglieder und deren Rollen und konfiguriere deine öffentliche Buchungsseite. Jedes Detail lässt sich an deine Marke und deinen Workflow anpassen.",
    },
    {
      badge: "Migration",
      title: "Deine Doorboost-\nDaten mitnehmen",
      subtitle: "Kampagnen, Leads & Team — ein Klick.",
      description:
        "Wir haben dein Doorboost-Konto erkannt. Importiere alle historischen Kampagnen, Leads, Notizen und Teammitglieder mit einer einzigen Synchronisierung nach re:praesent. Deine Daten sind sicher und nichts geht verloren.",
    },
  ],
};

interface ActiveService {
  service_slug: string | null;
  service_type: string | null;
}

function hasService(services: ActiveService[], key: string): boolean {
  return services.some((s) => s.service_slug === key || s.service_type === key);
}

function buildSteps(
  locale: string,
  services: ActiveService[],
  isDoorboost = false,
): Step[] {
  const lang: "en" | "de" = locale?.startsWith("de") ? "de" : "en";
  const content = STEP_CONTENT[lang];

  // Re-number badges dynamically after filtering
  const filtered = STEP_META.filter((meta) => {
    if (meta.id === "doorboost-migration") return isDoorboost;
    return (
      meta.requiredServices === null ||
      meta.requiredServices.every((svc) => hasService(services, svc))
    );
  });

  // Renumber non-welcome steps sequentially
  let featureIndex = 0;
  return filtered.map((meta) => {
    const base = content[STEP_META.indexOf(meta)];
    if (meta.id === "welcome") return { ...meta, ...base };
    if (meta.id === "doorboost-migration") return { ...meta, ...base };
    featureIndex += 1;
    const paddedNum = String(featureIndex).padStart(2, "0");
    const badgeLabel =
      lang === "de"
        ? base.badge.replace(/^\d{2} — /, `${paddedNum} — `)
        : base.badge.replace(/^\d{2} — /, `${paddedNum} — `);
    return { ...meta, ...base, badge: badgeLabel };
  });
}

/* ─────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────── */
interface OnboardingTourProps {
  onDone: () => void;
  locale?: string;
  services?: ActiveService[];
  isDoorboost?: boolean;
  onDoorboostSync?: () => void;
  onDoorboostIgnore?: () => void;
}

const UI_STRINGS = {
  en: {
    startTour: "Start Tour →",
    skipForNow: "Skip for now",
    skipTour: "Skip tour",
    back: "← Back",
    next: "Next →",
    getStarted: "Get Started ✦",
    syncData: "Sync My Data ✦",
    skipSync: "Maybe later",
  },
  de: {
    startTour: "Tour starten →",
    skipForNow: "Jetzt überspringen",
    skipTour: "Tour überspringen",
    back: "← Zurück",
    next: "Weiter →",
    getStarted: "Loslegen ✦",
    syncData: "Daten synchronisieren ✦",
    skipSync: "Vielleicht später",
  },
} as const;

/* ─────────────────────────────────────────────────────────
   Particle — tiny floating orb for the welcome screen
───────────────────────────────────────────────────────── */
function Particle({
  x,
  y,
  delay,
  size,
  color,
}: {
  x: number;
  y: number;
  delay: number;
  size: number;
  color: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity: 0,
        animation: `ot-float ${3 + Math.random() * 2}s ease-in-out ${delay}s infinite`,
        pointerEvents: "none",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   Laptop mockup that hosts the screenshot
───────────────────────────────────────────────────────── */
function LaptopMockup({
  src,
  alt,
  visible,
}: {
  src: string;
  alt: string;
  visible: boolean;
}) {
  return (
    <div
      className="ot-laptop-scaler"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(14px) scale(0.97)",
        opacity: visible ? 1 : 0,
        transition:
          "transform 0.5s cubic-bezier(.22,.68,0,1.2), opacity 0.4s ease",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.7))",
      }}
    >
      {/* ── Screen lid ──────────────────────────────────── */}
      <div
        style={{
          width: 468,
          background: "#1a1a20",
          borderRadius: "12px 12px 4px 4px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 8px 6px",
          position: "relative",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        {/* camera dot */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: "50%",
            transform: "translateX(-50%)",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#2a2a32",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
        {/* screen area */}
        <div
          style={{
            width: "100%",
            height: 270,
            borderRadius: 6,
            overflow: "hidden",
            background: "#0d0d10",
            position: "relative",
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top left",
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const parent = e.currentTarget.parentElement!;
              if (!parent.querySelector(".ot-placeholder")) {
                const ph = document.createElement("div");
                ph.className = "ot-placeholder";
                ph.style.cssText =
                  "width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:#131318;";
                ph.innerHTML =
                  '<div style="width:44px;height:44px;border-radius:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);display:flex;align-items:center;justify-content:center;font-size:18px;">📸</div><span style="font-size:10px;color:rgba(255,255,255,0.28);font-family:Plus Jakarta Sans,sans-serif;text-align:center;">Screenshot coming soon</span>';
                parent.appendChild(ph);
              }
            }}
          />
          {/* subtle inner shadow to blend screen edges */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 6,
              boxShadow:
                "inset 0 0 0 1px rgba(0,0,0,0.4), inset 0 2px 8px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* ── Hinge line ──────────────────────────────────── */}
      <div
        style={{
          width: 480,
          height: 3,
          background:
            "linear-gradient(90deg, #111115, #222228 20%, #2a2a32 50%, #222228 80%, #111115)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      {/* ── Keyboard base ───────────────────────────────── */}
      <div
        style={{
          width: 492,
          height: 20,
          background: "linear-gradient(180deg, #1e1e25 0%, #181820 100%)",
          borderRadius: "0 0 10px 10px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "none",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* trackpad hint */}
        <div
          style={{
            width: 60,
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        />
        {/* bottom reflection */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "10%",
            width: "80%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            borderRadius: "0 0 10px 10px",
          }}
        />
      </div>

      {/* ── Desk reflection ─────────────────────────────── */}
      <div
        style={{
          width: 420,
          height: 8,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
          borderRadius: "0 0 50% 50%",
          marginTop: 1,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Step dots progress indicator
───────────────────────────────────────────────────────── */
function StepDots({
  total,
  current,
  onGoto,
}: {
  total: number;
  current: number;
  onGoto: (i: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGoto(i)}
          aria-label={`Go to step ${i + 1}`}
          style={{
            width: i === current ? 24 : 6,
            height: 6,
            borderRadius: 3,
            background:
              i === current
                ? "#f59e0b"
                : i < current
                  ? "rgba(245,158,11,0.4)"
                  : "rgba(255,255,255,0.15)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────── */
export function OnboardingTour({
  onDone,
  locale = "de",
  services = [],
  isDoorboost = false,
  onDoorboostSync,
  onDoorboostIgnore,
}: OnboardingTourProps) {
  const lang: "en" | "de" = locale?.startsWith("de") ? "de" : "en";
  const steps = buildSteps(locale, services, isDoorboost);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1); // 1=forward, -1=backward
  const [animKey, setAnimKey] = useState(0);
  const [closing, setClosing] = useState(false);
  const [imageVisible, setImageVisible] = useState(true);

  const isWelcome = step === 0;
  const isLast = step === steps.length - 1;
  const current = steps[step];
  const isDoorboostStep = current?.id === "doorboost-migration";

  const goTo = useCallback(
    (next: number) => {
      if (next === step) return;
      setDirection(next > step ? 1 : -1);
      setImageVisible(false);
      setTimeout(() => {
        setStep(next);
        setAnimKey((k) => k + 1);
        setTimeout(() => setImageVisible(true), 60);
      }, 180);
    },
    [step]
  );

  const handleNext = useCallback(() => {
    if (isDoorboostStep) {
      // On doorboost step, "Sync" triggers the migration then closes
      onDoorboostSync?.();
      handleDone();
      return;
    }
    if (isLast) {
      handleDone();
    } else {
      goTo(step + 1);
    }
  }, [isLast, isDoorboostStep, step, goTo, onDoorboostSync]);

  const handleBack = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  const handleDone = useCallback(async () => {
    setClosing(true);
    try {
      await completeOnboarding();
    } catch {
      // silently ignore — worst case they see it again on next visit
    }
    setTimeout(onDone, 400);
  }, [onDone]);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDone();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDone]);

  return (
    <>
      {/* ── keyframes ─────────────────────────────────────── */}
      <style>{`
        @keyframes ot-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ot-modal-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ot-modal-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        @keyframes ot-content-in-fwd {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ot-content-in-bwd {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ot-float {
          0%,100% { opacity: 0; transform: translateY(0px) scale(1); }
          30%      { opacity: 0.7; }
          50%      { opacity: 0.9; transform: translateY(-18px) scale(1.1); }
          70%      { opacity: 0.6; }
        }
        @keyframes ot-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ot-shine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ot-welcome-glow {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 0.7; }
        }
        @media (max-width: 540px) {
          .ot-laptop-panel {
            height: 185px !important;
            padding-top: 0 !important;
            align-items: flex-start !important;
          }
          .ot-laptop-scaler {
            transform: scale(0.57) !important;
            transform-origin: top center !important;
          }
          .ot-welcome-container {
            padding: 36px 24px 28px !important;
            min-height: 300px !important;
          }
          .ot-step-content {
            padding: 20px 20px 20px !important;
          }
          .ot-step-desc {
            padding-right: 0 !important;
          }
          .ot-nav-row {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 14px !important;
          }
          .ot-nav-row > div:last-child {
            margin-left: 0 !important;
          }
        }
        .ot-btn-primary {
          position: relative;
          overflow: hidden;
        }
        .ot-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
          background-size: 200% auto;
          animation: ot-shine 2.5s linear infinite;
          border-radius: inherit;
        }
      `}</style>

      {/* ── Backdrop ───────────────────────────────────────── */}
      <div
        onClick={handleDone}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 9998,
          animation: closing
            ? "ot-backdrop-in 0.35s ease reverse forwards"
            : "ot-backdrop-in 0.35s ease forwards",
        }}
      />

      {/* ── Modal ─────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: isWelcome ? 520 : 580,
            background: "#0e0e12",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 50px 120px rgba(0,0,0,0.8), 0 0 80px rgba(245,158,11,0.04)",
            overflow: "hidden",
            animation: closing
              ? "ot-modal-out 0.35s cubic-bezier(.22,.68,0,1.2) forwards"
              : "ot-modal-in 0.45s cubic-bezier(.22,.68,0,1.2) forwards",
            transition: "max-width 0.4s cubic-bezier(.22,.68,0,1.2)",
          }}
        >
          {isWelcome ? (
            <WelcomeScreen
              step={current}
              lang={lang}
              onNext={handleNext}
              onSkip={handleDone}
            />
          ) : (
            <StepScreen
              key={animKey}
              step={current}
              stepIndex={step}
              totalSteps={steps.length}
              direction={direction}
              isLast={isLast}
              isDoorboostStep={isDoorboostStep}
              imageVisible={imageVisible}
              lang={lang}
              onNext={handleNext}
              onBack={handleBack}
              onSkip={isDoorboostStep ? () => { onDoorboostIgnore?.(); handleDone(); } : handleDone}
              onGoto={goTo}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Welcome Screen
───────────────────────────────────────────────────────── */
function WelcomeScreen({
  step,
  lang,
  onNext,
  onSkip,
}: {
  step: Step;
  lang: "en" | "de";
  onNext: () => void;
  onSkip: () => void;
}) {
  const particles = [
    { x: 8, y: 20, delay: 0, size: 5, color: "rgba(245,158,11,0.7)" },
    { x: 88, y: 15, delay: 0.6, size: 4, color: "rgba(139,92,246,0.7)" },
    { x: 75, y: 75, delay: 1.2, size: 6, color: "rgba(245,158,11,0.5)" },
    { x: 15, y: 80, delay: 0.3, size: 3, color: "rgba(255,255,255,0.4)" },
    { x: 50, y: 10, delay: 0.9, size: 4, color: "rgba(139,92,246,0.5)" },
    { x: 92, y: 55, delay: 1.5, size: 3, color: "rgba(245,158,11,0.6)" },
    { x: 5, y: 50, delay: 0.7, size: 5, color: "rgba(255,255,255,0.25)" },
    { x: 60, y: 88, delay: 0.2, size: 4, color: "rgba(139,92,246,0.4)" },
  ];

  return (
    <div
      className="ot-welcome-container"
      style={{
        position: "relative",
        padding: "52px 48px 44px",
        overflow: "hidden",
        minHeight: 380,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 0,
      }}
    >
      {/* ambient glow */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)",
          animation: "ot-welcome-glow 3s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* floating particles */}
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* close button */}
      <button
        onClick={onSkip}
        aria-label="Skip tour"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.1)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.7)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.06)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.4)";
        }}
      >
        ✕
      </button>

      {/* logo/icon badge */}
      <div
        style={{
          position: "relative",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(139,92,246,0.15))",
            border: "1px solid rgba(245,158,11,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            boxShadow: "0 0 40px rgba(245,158,11,0.15)",
          }}
        >
          ✦
        </div>
        {/* pulse ring */}
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: 28,
            border: "1px solid rgba(245,158,11,0.3)",
            animation: "ot-pulse-ring 2s ease-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -16,
            borderRadius: 36,
            border: "1px solid rgba(245,158,11,0.15)",
            animation: "ot-pulse-ring 2s ease-out 0.6s infinite",
          }}
        />
      </div>

      {/* title */}
      <h2
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 36,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          margin: "0 0 12px",
        }}
      >
        {step.title}
      </h2>

      {/* subtitle */}
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 15,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "-0.01em",
          margin: "0 0 8px",
          fontWeight: 500,
        }}
      >
        {step.subtitle}
      </p>

      {/* description */}
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 14,
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.7,
          maxWidth: 360,
          margin: "0 0 40px",
        }}
      >
        {step.description}
      </p>

      {/* CTA */}
      <button
        onClick={onNext}
        className="ot-btn-primary"
        style={{
          height: 48,
          paddingInline: 32,
          borderRadius: 12,
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          border: "none",
          color: "#000",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "-0.01em",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform =
            "scale(1.03)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 28px rgba(245,158,11,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 20px rgba(245,158,11,0.35)";
        }}
      >
        {UI_STRINGS[lang].startTour}
      </button>

      {/* skip link */}
      <button
        onClick={onSkip}
        style={{
          marginTop: 16,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 12,
          cursor: "pointer",
          letterSpacing: "-0.01em",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.5)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.25)")
        }
      >
        {UI_STRINGS[lang].skipForNow}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Step Screen (steps 1–8) — vertical: laptop top, content bottom
───────────────────────────────────────────────────────── */
function StepScreen({
  step,
  stepIndex,
  totalSteps,
  direction,
  isLast,
  isDoorboostStep = false,
  imageVisible,
  lang,
  onNext,
  onBack,
  onSkip,
  onGoto,
}: {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  direction: 1 | -1;
  isLast: boolean;
  isDoorboostStep?: boolean;
  imageVisible: boolean;
  lang: "en" | "de";
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onGoto: (i: number) => void;
}) {
  const contentAnim =
    direction === 1 ? "ot-content-in-fwd" : "ot-content-in-bwd";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Top: laptop visual panel ────────────────────── */}
      <div
        className="ot-laptop-panel"
        style={{
          background: "linear-gradient(180deg, #111116 0%, #0c0c11 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingTop: 28,
          paddingBottom: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ambient glow behind laptop */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 400,
            height: 160,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {step.screenshot ? (
          <LaptopMockup
            src={step.screenshot}
            alt={step.screenshotAlt}
            visible={imageVisible}
          />
        ) : step.id === "doorboost-migration" ? (
          /* Doorboost migration — animated data flow visual */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "32px 0",
              opacity: imageVisible ? 1 : 0,
              transform: imageVisible ? "translateY(0)" : "translateY(14px)",
              transition: "all 0.5s cubic-bezier(.22,.68,0,1.2)",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(139,92,246,0.1))",
                  border: "1px solid rgba(245,158,11,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  boxShadow: "0 0 60px rgba(245,158,11,0.12)",
                }}
              >
                🔄
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: -12,
                  borderRadius: 36,
                  border: "1px solid rgba(245,158,11,0.2)",
                  animation: "ot-pulse-ring 2.5s ease-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: -24,
                  borderRadius: 48,
                  border: "1px solid rgba(245,158,11,0.1)",
                  animation: "ot-pulse-ring 2.5s ease-out 0.8s infinite",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              {["📊", "👥", "📋"].map((emoji, i) => (
                <div
                  key={i}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    opacity: 0,
                    animation: `ot-float ${2.5 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`,
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* placeholder laptop outline when no screenshot */
          <div
            className="ot-laptop-scaler"
            style={{
              width: 468,
              height: 290,
              borderRadius: "12px 12px 4px 4px",
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.12)",
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Preview
          </div>
        )}
      </div>

      {/* ── Bottom: content panel ────────────────────────── */}
      <div
        className="ot-step-content"
        style={{
          padding: "28px 36px 28px",
          display: "flex",
          flexDirection: "column",
          animation: `${contentAnim} 0.35s cubic-bezier(.22,.68,0,1.2) forwards`,
          position: "relative",
        }}
      >
        {/* badge + title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              flexShrink: 0,
              height: 22,
              paddingInline: 9,
              borderRadius: 6,
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "#f59e0b",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              alignItems: "center",
            }}
          >
            {step.badge}
          </span>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              margin: 0,
              whiteSpace: "pre-line",
            }}
          >
            {step.title.replace("\n", " ")}
          </h2>
        </div>

        {/* description */}
        <p
          className="ot-step-desc"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.48)",
            lineHeight: 1.7,
            margin: "0 0 20px",
          }}
        >
          {step.description}
        </p>

        {/* bottom row: dots + navigation */}
        <div
          className="ot-nav-row"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <StepDots total={totalSteps} current={stepIndex} onGoto={onGoto} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {stepIndex > 0 && (
              <button
                onClick={onBack}
                style={{
                  height: 36,
                  paddingInline: 16,
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.09)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(255,255,255,0.6)";
                }}
              >
                {UI_STRINGS[lang].back}
              </button>
            )}

            <button
              onClick={onNext}
              className="ot-btn-primary"
              style={{
                height: 36,
                paddingInline: 20,
                borderRadius: 9,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                color: "#000",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                boxShadow: "0 2px 12px rgba(245,158,11,0.3)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1.04)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 20px rgba(245,158,11,0.45)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 2px 12px rgba(245,158,11,0.3)";
              }}
            >
              {isDoorboostStep
                ? UI_STRINGS[lang].syncData
                : isLast
                  ? UI_STRINGS[lang].getStarted
                  : UI_STRINGS[lang].next}
            </button>
          </div>
        </div>

        {/* skip link — centered below nav row */}
        <button
          onClick={onSkip}
          style={{
            marginTop: 14,
            alignSelf: "center",
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.22)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 11,
            cursor: "pointer",
            letterSpacing: "0.01em",
            transition: "color 0.15s",
            padding: "4px 8px",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.45)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.22)")
          }
        >
          {isDoorboostStep ? UI_STRINGS[lang].skipSync : UI_STRINGS[lang].skipTour}
        </button>
      </div>
    </div>
  );
}
