"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { AssistantLevel } from "~/lib/api/onboarding-chat";
import { cn } from "~/lib/utils";

/**
 * The three onboarding assistants as illustrated portraits (AI_ONBOARDING_PLAN.md, Phase 6):
 * Jonas (at home with tech), Mara (a tech person helps), Clara (keep it simple).
 *
 * One SVG rig, three looks. Head-and-shoulders in a coloured disc, calm real proportions (no
 * big cartoon eyes), app colours. Every motion is a transform on a separate part:
 *
 *   mood      idle (breathing) · listening (leans in, looks down at what you type) ·
 *             thinking (looks up, head tilt, dots) · speaking (mouth moves)
 *   reaction  one-shot, keyed by id: happy (nod + sparkles) · celebrate (bounce + confetti) ·
 *             confused (tilt + ?) · wave (hand comes up) · giggle · spin (a little head shake)
 *
 * Reduced motion: a still portrait; reactions become a short fade, no particles.
 */

export type FaceMood = "idle" | "listening" | "thinking" | "speaking";
export type FaceReactionKind = "happy" | "celebrate" | "confused" | "wave" | "giggle" | "spin";
export type FaceReaction = { kind: FaceReactionKind; id: number } | null;

const INK = "#131515";
const YELLOW = "#f5d74f";
const YELLOW_DEEP = "#e6bf2e";
const CONFETTI = [YELLOW, INK, "#a4dab8", "#c9a27a", YELLOW_DEEP];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface Look {
  disc: string;
  skin: string;
  shade: string;
  lip: string;
  hair: string;
  top: string;
  collar: string;
}

const LOOKS: Record<AssistantLevel, Look> = {
  // Jonas: short dark hair with a side part, round glasses, stubble, ink crew-neck.
  tech: { disc: YELLOW, skin: "#e8c3a2", shade: "#c99b78", lip: "#a86a55", hair: "#2a211c", top: "#23272a", collar: "#3a4044" },
  // Mara: long auburn waves, camel blazer over a white shirt.
  assisted: { disc: "#a4dab8", skin: "#d8a07c", shade: "#b67e5d", lip: "#9b5646", hair: "#6e3a22", top: "#c9a27a", collar: "#fbfaf7" },
  // Clara: dark curls, small yellow earrings, green knit.
  simple: { disc: "#f2c9a8", skin: "#8e5c3f", shade: "#6f4430", lip: "#5b3326", hair: "#211612", top: "#3f7d5c", collar: "#356b4e" },
};

export function Portrait({
  level,
  size = 96,
  mood = "idle",
  reaction = null,
  interactive = false,
  trackPointer = false,
  simple = false,
  label,
  className,
}: {
  level: AssistantLevel;
  size?: number;
  mood?: FaceMood;
  reaction?: FaceReaction;
  /** Tap/click plays a random reaction (renders as a button). */
  interactive?: boolean;
  /** Eyes follow the pointer. */
  trackPointer?: boolean;
  /** Tiny face next to a message: blinks only. */
  simple?: boolean;
  /** Accessible name when interactive. */
  label?: string;
  className?: string;
}) {
  const look = LOOKS[level];
  const clip = useId().replace(/:/g, "");
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const [blink, setBlink] = useState(false);
  const [tap, setTap] = useState<FaceReaction>(null);
  const [finishedId, setFinishedId] = useState<number | null>(null);
  const latest = tap && (!reaction || tap.id > reaction.id) ? tap : reaction;
  const active = latest && latest.id !== finishedId ? latest : null;

  // Blinks at a human, irregular rhythm.
  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        loop();
      }, 2800 + Math.random() * 3600);
    };
    loop();
    return () => clearTimeout(timer);
  }, [reduce]);

  // Gaze in "look units" (-1…1), springs keep it soft; eyes move a little, the head a touch.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const gx = useSpring(px, { stiffness: 160, damping: 18 });
  const gy = useSpring(py, { stiffness: 160, damping: 18 });
  const eyeX = useTransform(gx, (v) => v * 1.3);
  const eyeY = useTransform(gy, (v) => v * 1.1);
  const headX = useTransform(gx, (v) => v * 1.2);
  useEffect(() => {
    if (mood === "listening") {
      px.set(-0.3);
      py.set(1);
    } else if (mood === "thinking") {
      px.set(0.8);
      py.set(-1);
    } else if (!trackPointer || reduce) {
      px.set(0);
      py.set(0);
    }
  }, [mood, trackPointer, reduce, px, py]);
  useEffect(() => {
    if (!trackPointer || reduce || simple) return;
    const onMove = (e: PointerEvent) => {
      if (moodRef.current === "listening" || moodRef.current === "thinking") return;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.45);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 280);
      px.set((dx / d) * k);
      py.set((dy / d) * k);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [trackPointer, reduce, simple, px, py]);

  const playTap = () => {
    const kinds: FaceReactionKind[] = ["wave", "giggle", "happy", "spin"];
    setTap({ kind: kinds[Math.floor(Math.random() * kinds.length)], id: Date.now() });
  };

  // Head + shoulders move together for a reaction; the head alone tilts for a mood.
  const person = reduce
    ? { opacity: active ? [1, 0.7, 1] : 1 }
    : active?.kind === "happy"
      ? { y: [0, 3, -1, 2, 0] }
      : active?.kind === "celebrate"
        ? { y: [0, -7, 0, -3, 0], scale: [1, 1.03, 1, 1.01, 1] }
        : active?.kind === "giggle"
          ? { rotate: [0, -3, 3, -2, 2, 0] }
          : active?.kind === "spin"
            ? { x: [0, -2, 2, -1.5, 1.5, 0] }
            : mood === "speaking"
              ? { y: [0, -0.6, 0] }
              : { y: [0, -0.8, 0] };
  const personTransition = reduce
    ? { duration: 0.3 }
    : active
      ? { duration: active.kind === "celebrate" ? 0.8 : 0.6, ease: EASE_OUT }
      : mood === "speaking"
        ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 4.2, repeat: Infinity, ease: "easeInOut" as const };

  const headTilt = reduce
    ? 0
    : active?.kind === "confused"
      ? -9
      : active?.kind === "happy"
        ? 4
        : mood === "thinking"
          ? -5
          : mood === "listening"
            ? 4
            : 0;
  const waving = !reduce && active?.kind === "wave";
  const talking = !reduce && mood === "speaking";
  const pleased = active?.kind === "happy" || active?.kind === "celebrate" || active?.kind === "wave";

  const svg = (
    <svg viewBox="0 0 120 120" width={size} height={size} className="overflow-visible" aria-hidden>
      <defs>
        <clipPath id={`disc-${clip}`}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="56" fill={look.disc} />
      <g clipPath={`url(#disc-${clip})`}>
        {/* The figure fills the disc a little more than its drawing grid. */}
        <g transform="translate(60 66) scale(1.16) translate(-60 -66)">
        <motion.g
          key={active ? `r${active.id}` : "still"}
          style={{ originX: 0.5, originY: 1 }}
          animate={person}
          transition={personTransition}
          onAnimationComplete={() => active && setFinishedId(active.id)}
        >
          <Shoulders level={level} look={look} />
          {/* head: tilts from the neck */}
          <motion.g
            style={{ originX: 0.5, originY: 1, x: headX }}
            animate={{ rotate: headTilt }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
          >
            <HairBack level={level} look={look} />
            <ellipse cx="38.5" cy="58" rx="3.6" ry="5.5" fill={look.skin} />
            <ellipse cx="81.5" cy="58" rx="3.6" ry="5.5" fill={look.skin} />
            <path d="M39 52 C39 34 48 28 60 28 C72 28 81 34 81 52 C81 70 72 83 60 83 C48 83 39 70 39 52 Z" fill={look.skin} />
            {level === "tech" ? <path d="M43 66 C46 78 53 83 60 83 C67 83 74 78 77 66 C72 73 66 75 60 75 C54 75 48 73 43 66 Z" fill={INK} opacity={0.09} /> : null}
            {level === "simple" ? (
              <>
                <circle cx="38.5" cy="64.5" r="1.9" fill={YELLOW} />
                <circle cx="81.5" cy="64.5" r="1.9" fill={YELLOW} />
              </>
            ) : null}
            {/* eyes */}
            {[51, 69].map((cx) => (
              <g key={cx}>
                <motion.ellipse cx={cx} cy="55" rx="2.4" ry="2.9" fill={INK} style={{ x: eyeX, y: eyeY }} />
                <motion.rect
                  x={cx - 4}
                  y="51"
                  width="8"
                  height="8"
                  fill={look.skin}
                  style={{ originY: 0 }}
                  initial={false}
                  animate={{ scaleY: blink ? 1 : 0 }}
                  transition={{ duration: 0.06 }}
                />
              </g>
            ))}
            {/* brows carry the expression */}
            {([
              [51, -1],
              [69, 1],
            ] as const).map(([cx, side]) => (
              <motion.path
                key={`b${cx}`}
                d={`M${cx - 4.5} 48.5 Q${cx} 46.3 ${cx + 4.5} 48.2`}
                stroke={look.hair}
                strokeWidth="1.9"
                strokeLinecap="round"
                fill="none"
                initial={false}
                animate={
                  reduce || simple
                    ? { y: 0, rotate: 0 }
                    : active?.kind === "confused"
                      ? { y: side < 0 ? -1.5 : 0.5, rotate: side * -10 }
                      : pleased
                        ? { y: -1.6, rotate: 0 }
                        : mood === "thinking"
                          ? { y: side > 0 ? -1.8 : 0, rotate: side > 0 ? 6 : 0 }
                          : mood === "listening"
                            ? { y: -0.8, rotate: side * 3 }
                            : { y: 0, rotate: 0 }
                }
                transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
              />
            ))}
            {level === "tech" ? (
              <g fill="none" stroke={INK} strokeWidth="1.4">
                <circle cx="51" cy="55" r="6" />
                <circle cx="69" cy="55" r="6" />
                <path d="M57 54.5 Q60 53 63 54.5 M45 54 L40 52.5 M75 54 L80 52.5" />
              </g>
            ) : null}
            {/* nose */}
            <path d="M60 56 C59.4 60 58.2 62.4 57.6 63.4 C58.6 64.4 60.6 64.4 61.8 63.8" stroke={look.shade} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* mouth: soft smile; a small opening that moves around its own centre while talking;
                small "o" when confused. Every scale uses the part's own box as origin. */}
            {active?.kind === "confused" && !reduce ? (
              <ellipse cx="60" cy="71" rx="2.2" ry="2.6" fill={look.lip} />
            ) : talking ? (
              <motion.ellipse
                cx="60"
                cy="71"
                rx="3.6"
                ry="1.9"
                fill={look.lip}
                style={{ originX: 0.5, originY: 0.5 }}
                initial={{ scaleY: 0.7 }}
                animate={{ scaleY: [0.7, 1.35, 0.9, 1.2, 0.7], scaleX: [1, 0.92, 1, 0.95, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : (
              <path
                d={pleased ? "M53.5 69.5 Q60 76.5 66.5 69.5 Q60 72.5 53.5 69.5 Z" : "M54.5 70 Q60 74.5 65.5 70"}
                stroke={look.lip}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={pleased ? look.lip : "none"}
              />
            )}
            <HairFront level={level} look={look} />
          </motion.g>
          {/* hand comes up for a wave */}
          <motion.g
            initial={false}
            style={{ originX: 0.5, originY: 1 }}
            animate={waving ? { y: [44, 0, 0, 0, 44], rotate: [0, 0, -12, 8, 0] } : { y: 44, rotate: 0 }}
            transition={waving ? { duration: 1.4, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] } : { duration: 0 }}
          >
            <rect x="21" y="92" width="18" height="30" rx="7" fill={look.top} />
            <ellipse cx="30" cy="88" rx="8" ry="9.5" fill={look.skin} />
            <path d="M24.5 81 L24.5 86 M28 79.5 L28 85 M31.8 79.5 L31.8 85 M35.2 81 L35.2 86" stroke={look.shade} strokeWidth="1.1" strokeLinecap="round" />
          </motion.g>
        </motion.g>
        </g>
      </g>
      {/* thinking dots */}
      {!simple && !reduce && mood === "thinking" ? (
        <g>
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={92 + i * 8}
              cy={14 - i * 4}
              r={2.4 + i * 0.6}
              fill={INK}
              animate={{ opacity: [0.2, 0.9, 0.2], y: [0, -3, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            />
          ))}
        </g>
      ) : null}
    </svg>
  );

  const effects = !simple && !reduce && latest ? <Effects key={latest.id} kind={latest.kind} size={size} /> : null;
  const body = (
    <>
      {svg}
      <AnimatePresence>{effects}</AnimatePresence>
    </>
  );

  if (interactive) {
    return (
      <span ref={ref} className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
        <button
          type="button"
          onClick={playTap}
          aria-label={label}
          className="relative inline-flex rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 active:scale-[0.96]"
        >
          {body}
        </button>
      </span>
    );
  }
  return (
    <span ref={ref} className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {body}
    </span>
  );
}

function Shoulders({ level, look }: { level: AssistantLevel; look: Look }) {
  return (
    <g>
      <rect x="52" y="74" width="16" height="18" fill={look.skin} />
      <path d="M52 84 Q60 90 68 84 L68 88 Q60 93 52 88 Z" fill={look.shade} opacity={0.5} />
      <path d="M14 124 C14 102 30 92 50 89 L70 89 C90 92 106 102 106 124 Z" fill={look.top} />
      {level === "tech" ? <path d="M49 89 Q60 97 71 89 L71 91.5 Q60 100 49 91.5 Z" fill={look.collar} /> : null}
      {level === "assisted" ? (
        <>
          <path d="M50 89 L60 106 L70 89 Z" fill={look.collar} />
          <path d="M50 89 L44 92 L55 114 L60 106 Z M70 89 L76 92 L65 114 L60 106 Z" fill="#b38b62" />
        </>
      ) : null}
      {level === "simple" ? (
        <>
          <path d="M48 89.5 Q60 99 72 89.5 Q60 95 48 89.5 Z" fill={look.collar} />
          {[30, 42, 78, 90].map((x) => (
            <path key={x} d={`M${x} 104 L${x} 124`} stroke={look.collar} strokeWidth="1.2" opacity={0.7} />
          ))}
        </>
      ) : null}
    </g>
  );
}

function HairBack({ level, look }: { level: AssistantLevel; look: Look }) {
  if (level === "assisted") {
    return <path d="M36 58 C31 34 44 22 60 22 C77 22 90 34 85 58 C88 72 90 86 86 96 C80 99 74 94 72 86 L48 86 C46 94 40 99 34 96 C30 86 32 72 36 58 Z" fill={look.hair} />;
  }
  if (level === "simple") {
    return (
      <g fill={look.hair}>
        {[
          [40, 40, 10],
          [50, 31, 11],
          [62, 28, 12],
          [74, 32, 11],
          [82, 42, 10],
          [36, 52, 8],
          [85, 53, 8],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    );
  }
  return null;
}

function HairFront({ level, look }: { level: AssistantLevel; look: Look }) {
  if (level === "tech") {
    return <path d="M38.5 53 C36 34 46 25 60 25 C75 25 85 33 82 52 C80 45 77 40 72 38 C64 41 52 40 45 36 C42 40 40 46 38.5 53 Z" fill={look.hair} />;
  }
  if (level === "assisted") {
    return <path d="M39 50 C40 33 52 26 62 27 C74 28 82 36 81.5 50 C77 41 70 36 62 35 C54 36 46 41 39 50 Z" fill={look.hair} />;
  }
  return (
    <g fill={look.hair}>
      <circle cx="47" cy="35" r="6.5" />
      <circle cx="56" cy="32" r="6" />
      <circle cx="66" cy="32" r="6" />
      <circle cx="74.5" cy="36" r="6" />
    </g>
  );
}

/** One-shot particles around the portrait: sparkles, confetti or a question mark. */
function Effects({ kind, size }: { kind: FaceReactionKind; size: number }) {
  if (kind === "confused") {
    return (
      <motion.span
        className="pointer-events-none absolute -top-1 right-0 font-semibold text-foreground"
        style={{ fontSize: Math.max(12, size * 0.22) }}
        initial={{ opacity: 0, transform: "translateY(6px) scale(0.6)" }}
        animate={{ opacity: [0, 1, 1, 0], transform: ["translateY(6px) scale(0.6)", "translateY(0px) scale(1)", "translateY(0px) scale(1)", "translateY(-6px) scale(1)"] }}
        transition={{ duration: 1.3, ease: EASE_OUT }}
      >
        ?
      </motion.span>
    );
  }
  const count = kind === "celebrate" ? 18 : kind === "happy" ? 6 : 0;
  if (!count) return null;
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = (kind === "celebrate" ? 0.9 : 0.62) * size * (0.7 + Math.random() * 0.4);
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.75 - size * 0.15,
      fall: kind === "celebrate" ? size * 0.35 : 0,
      color: kind === "celebrate" ? CONFETTI[i % CONFETTI.length] : YELLOW_DEEP,
      rot: Math.random() * 360,
      w: kind === "celebrate" ? 6 + Math.random() * 4 : 7,
    };
  });
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/3"
          style={{
            width: p.w,
            height: kind === "celebrate" ? p.w * 0.45 : p.w,
            background: p.color,
            borderRadius: kind === "celebrate" ? 2 : 999,
            clipPath: kind === "happy" ? "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)" : undefined,
          }}
          initial={{ opacity: 0, transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)" }}
          animate={{
            opacity: [0, 1, 1, 0],
            transform: [
              "translate(-50%, -50%) scale(0.4) rotate(0deg)",
              `translate(calc(-50% + ${p.x * 0.8}px), calc(-50% + ${p.y * 0.8}px)) scale(1) rotate(${p.rot * 0.5}deg)`,
              `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y + p.fall}px)) scale(1) rotate(${p.rot}deg)`,
              `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y + p.fall * 1.4}px)) scale(0.8) rotate(${p.rot}deg)`,
            ],
          }}
          transition={{ duration: kind === "celebrate" ? 1.2 : 0.8, ease: EASE_OUT, times: [0, 0.3, 0.8, 1] }}
        />
      ))}
    </span>
  );
}

/** Two or three faces overlapping, for places that talk about "the team" (intro, form header). */
export function PortraitStack({ levels, size = 32, className }: { levels: readonly AssistantLevel[]; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} aria-hidden>
      {levels.map((l, i) => (
        <span key={l} className="rounded-full ring-2 ring-background" style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: levels.length - i }}>
          <Portrait level={l} size={size} simple />
        </span>
      ))}
    </span>
  );
}
