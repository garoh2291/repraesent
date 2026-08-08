import { Check, Globe, Languages, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Brand palette — the same five the app's charts and status dots draw from. */
const CONFETTI_COLORS = [
  "#f59e0b",
  "#5265f3",
  "#f5d74f",
  "#34d399",
  "#e25f77",
];

const PIECES = 26;

/**
 * Deterministic pseudo-random.
 *
 * `Math.random()` here would re-roll on every render and, worse, differ between
 * the server and the client. This is stable for a given index, so the confetti
 * looks scattered but renders identically every time.
 */
function noise(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The payoff. The builder's light chrome gives way to a dark celebration —
 * the lights go down, the confetti comes out, and the modal becomes one
 * continuous dark surface with the transport bar below it.
 *
 * The badge deliberately reuses the app's existing celebration language from
 * `sync-complete-modal.tsx`: an emerald-to-amber gradient tile with a pulse
 * ring and an overshoot pop. The confetti is new — `scm-confetti` over there is
 * a misnomer, it is only a pop.
 */
export function DemoCelebration() {
  const { t } = useTranslation();

  // A recap of what was just demonstrated — not artifacts of a real form.
  // An earlier version showed a public URL, which invited people to copy a link
  // to a form that does not exist.
  const chips = [
    { icon: <LayoutGrid className="h-3.5 w-3.5" />, label: t("forms.intro.celebrate.chipBuild") },
    { icon: <Languages className="h-3.5 w-3.5" />, label: t("forms.intro.celebrate.chipTranslate") },
    { icon: <Globe className="h-3.5 w-3.5" />, label: t("forms.intro.celebrate.chipPublish") },
  ];

  return (
    <div className="relative flex min-h-[640px] flex-col items-center justify-center overflow-hidden bg-[#0e0e12] px-8 text-center">
      <CelebrationStyles />

      {/* Ambient glow behind the badge */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.16) 0%, rgba(245,158,11,0.08) 45%, transparent 70%)",
        }}
      />

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: PIECES }, (_, i) => {
          const left = noise(i, 1) * 100;
          const delay = noise(i, 2) * 2.2;
          const duration = 2.6 + noise(i, 3) * 1.8;
          const drift = (noise(i, 4) - 0.5) * 160;
          const spin = 360 + noise(i, 5) * 540;
          const size = 6 + Math.round(noise(i, 6) * 5);
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          const round = i % 3 === 0;

          return (
            <span
              key={i}
              className="fi-confetti"
              style={
                {
                  left: `${left}%`,
                  width: size,
                  height: round ? size : size * 1.8,
                  background: color,
                  borderRadius: round ? "9999px" : "2px",
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                  "--fi-drift": `${drift}px`,
                  "--fi-spin": `${spin}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      <div className="relative flex flex-col items-center">
        <div className="relative mb-6">
          <div
            className="fi-badge flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-emerald-400/25 text-emerald-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(245,158,11,0.16))",
              boxShadow: "0 0 40px rgba(16,185,129,0.14)",
            }}
          >
            <Check className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <span
            aria-hidden
            className="fi-ring absolute rounded-[28px] border border-emerald-400/25"
            style={{ inset: -8 }}
          />
          <span
            aria-hidden
            className="fi-ring absolute rounded-[34px] border border-emerald-400/15"
            style={{ inset: -16, animationDelay: "1s" }}
          />
        </div>

        <h2 className="fi-rise text-[28px] font-semibold leading-tight tracking-tight text-white">
          {t("forms.intro.celebrate.title")}
        </h2>
        <p className="fi-rise fi-d1 mt-2 max-w-md text-sm leading-relaxed text-white/55">
          {t("forms.intro.celebrate.body")}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {chips.map((chip, i) => (
            <span
              key={chip.label}
              className={`fi-rise fi-d${i + 2} inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300`}
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CelebrationStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.fi-confetti {
  position: absolute;
  top: -24px;
  opacity: 0;
  animation-name: fi-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes fi-fall {
  0%   { opacity: 0; transform: translate3d(0, -30px, 0) rotate(0deg); }
  8%   { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--fi-drift), 700px, 0) rotate(var(--fi-spin)); }
}

/* Overshoot pop, matching sync-complete-modal's badge. */
.fi-badge { animation: fi-pop .6s cubic-bezier(.22,.68,0,1.2) both; }
@keyframes fi-pop {
  0%   { opacity: 0; transform: translateY(10px) scale(.5); }
  40%  { opacity: 1; transform: translateY(-8px) scale(1.1); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.fi-ring { animation: fi-ring 2s ease-out infinite; }
@keyframes fi-ring {
  0%, 100% { transform: scale(1); opacity: .55; }
  50%      { transform: scale(1.7); opacity: 0; }
}

.fi-rise { animation: fi-rise .5s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes fi-rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fi-d1 { animation-delay: .10s } .fi-d2 { animation-delay: .18s }
.fi-d3 { animation-delay: .26s } .fi-d4 { animation-delay: .32s }
.fi-d5 { animation-delay: .38s }

@media (prefers-reduced-motion: reduce) {
  .fi-confetti { display: none; }
  .fi-badge, .fi-ring, .fi-rise { animation: none; opacity: 1; transform: none; }
}
`,
      }}
    />
  );
}
