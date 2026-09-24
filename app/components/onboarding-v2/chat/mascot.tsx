"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "~/lib/utils";

/**
 * Lena, the armchair. The onboarding assistant's face (AI_ONBOARDING_PLAN.md, Phase 5).
 *
 * An SVG rig in app colours — ink frame, yellow cushions — built from separate parts with
 * fixed pivots so every motion is a transform: legs (hop), armrests (wave), backrest/face
 * (tilt), lids (blink), pupils (gaze, spring-driven), mouth (talk).
 *
 *   mood      idle · listening (looks down at what you type) · thinking (eyes up, dots) · speaking
 *   reaction  one-shot, keyed by id: happy (hop + sparkles) · celebrate (jump + confetti)
 *             · confused (tilt + ?) · wave · giggle · spin
 *
 * Reduced motion: a still, friendly pose; reactions become a short fade, no confetti.
 */

export type MascotMood = "idle" | "listening" | "thinking" | "speaking";
export type MascotReactionKind = "happy" | "celebrate" | "confused" | "wave" | "giggle" | "spin";
export type MascotReaction = { kind: MascotReactionKind; id: number } | null;

const INK = "#131515";
const YELLOW = "#f5d74f";
const YELLOW_DEEP = "#e6bf2e";
const CONFETTI = [YELLOW, INK, "#a4dab8", "#c9a27a", YELLOW_DEEP];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function Mascot({
  size = 96,
  mood = "idle",
  reaction = null,
  interactive = false,
  trackPointer = false,
  simple = false,
  label,
  className,
}: {
  size?: number;
  mood?: MascotMood;
  reaction?: MascotReaction;
  /** Tap/click plays a random reaction (renders as a button). */
  interactive?: boolean;
  /** Pupils follow the pointer. */
  trackPointer?: boolean;
  /** Tiny face next to a message: blinks only. */
  simple?: boolean;
  /** Accessible name when interactive. */
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const [blink, setBlink] = useState(false);
  const [tap, setTap] = useState<MascotReaction>(null);
  const [finishedId, setFinishedId] = useState<number | null>(null);
  const latest = tap && (!reaction || tap.id > reaction.id) ? tap : reaction;
  // The body plays a reaction once, then goes back to its mood (effects keep their own lifetime).
  const active = latest && latest.id !== finishedId ? latest : null;

  // Blinks at a human, irregular rhythm.
  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, 2600 + Math.random() * 3400);
    };
    loop();
    return () => clearTimeout(timer);
  }, [reduce]);

  // Gaze: pointer when idle/speaking, fixed looks for listening/thinking. Springs keep it soft.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const gx = useSpring(px, { stiffness: 170, damping: 18 });
  const gy = useSpring(py, { stiffness: 170, damping: 18 });
  useEffect(() => {
    if (mood === "listening") {
      px.set(-0.6);
      py.set(2.6);
    } else if (mood === "thinking") {
      px.set(2);
      py.set(-2.6);
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
      const dy = e.clientY - (r.top + r.height * 0.35);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 260);
      px.set((dx / d) * 3 * k);
      py.set((dy / d) * 2.4 * k);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [trackPointer, reduce, simple, px, py]);

  const playTap = () => {
    const kinds: MascotReactionKind[] = ["wave", "giggle", "spin", "happy"];
    setTap({ kind: kinds[Math.floor(Math.random() * kinds.length)], id: Date.now() });
  };

  // Whole-body motion for the current reaction (keyed, so each one plays once).
  const body = reduce
    ? { opacity: active ? [1, 0.7, 1] : 1 }
    : active?.kind === "happy"
      ? { y: [0, -9, 0, -3, 0], scaleY: [1, 0.94, 1.04, 0.98, 1] }
      : active?.kind === "celebrate"
        ? { y: [0, -16, 0, -6, 0], rotate: [0, -6, 6, 0, 0], scaleY: [1, 0.9, 1.06, 0.97, 1] }
        : active?.kind === "giggle"
          ? { rotate: [0, -5, 5, -4, 4, 0] }
          : active?.kind === "spin"
            ? { rotate: [0, 360], y: [0, -6, 0] }
            : active?.kind === "confused"
              ? { rotate: [0, -8, -8, 0] }
              : mood === "speaking"
                ? { y: [0, -1.2, 0] }
                : { scaleY: [1, 1.025, 1] };
  const bodyTransition = reduce
    ? { duration: 0.3 }
    : active
      ? { duration: active.kind === "spin" ? 0.8 : active.kind === "confused" ? 1.2 : 0.7, ease: EASE_OUT }
      : mood === "speaking"
        ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 4, repeat: Infinity, ease: "easeInOut" as const };

  const headTilt = reduce ? 0 : mood === "thinking" ? -6 : mood === "listening" ? 4 : 0;
  const waving = !reduce && active?.kind === "wave";
  const talking = !reduce && mood === "speaking";

  const svg = (
    <motion.svg viewBox="0 0 120 120" width={size} height={size} className="overflow-visible" aria-hidden>
      {/* floor shadow */}
      <motion.ellipse
        cx="60"
        cy="112"
        rx="34"
        ry="4.5"
        fill={INK}
        opacity={0.12}
        animate={!reduce && (active?.kind === "happy" || active?.kind === "celebrate") ? { scaleX: [1, 0.7, 1] } : { scaleX: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      />
      <motion.g
        key={active ? `r${active.id}` : `m${mood}`}
        style={{ originX: 0.5, originY: 1 }}
        animate={body}
        transition={bodyTransition}
        onAnimationComplete={() => active && setFinishedId(active.id)}
      >
        {/* legs */}
        <rect x="30" y="94" width="8" height="15" rx="3" fill={INK} />
        <rect x="82" y="94" width="8" height="15" rx="3" fill={INK} />
        {/* backrest + face: tilts from its base */}
        <motion.g style={{ originX: 0.5, originY: 1 }} animate={{ rotate: headTilt }} transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}>
          <rect x="20" y="14" width="80" height="66" rx="22" fill={INK} />
          <rect x="28" y="21" width="64" height="50" rx="16" fill={YELLOW} />
          {/* cheeks */}
          <circle cx="38" cy="54" r="4.5" fill={YELLOW_DEEP} opacity={0.9} />
          <circle cx="82" cy="54" r="4.5" fill={YELLOW_DEEP} opacity={0.9} />
          {/* eyes */}
          {[45, 75].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy="42" rx="7.5" ry="8.5" fill="#fff" />
              <motion.g style={{ x: gx, y: gy }}>
                <circle cx={cx} cy="42" r="4.2" fill={INK} />
                <circle cx={cx + 1.6} cy="40.2" r="1.3" fill="#fff" />
              </motion.g>
              {/* lid: drops for a blink */}
              <motion.rect
                x={cx - 8.5}
                y="32.5"
                width="17"
                height="19"
                rx="8"
                fill={YELLOW}
                style={{ originY: 0 }}
                initial={false}
                animate={{ scaleY: blink ? 1 : 0 }}
                transition={{ duration: 0.07 }}
              />
            </g>
          ))}
          {/* brows carry most of the expression */}
          {!simple
            ? ([
                [45, -1],
                [75, 1],
              ] as const).map(([cx, side]) => (
                <motion.path
                  key={`b${cx}`}
                  d={`M${cx - 6} 30 Q${cx} 27 ${cx + 6} 30`}
                  stroke={INK}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  fill="none"
                  initial={false}
                  animate={
                    reduce
                      ? { y: 0, rotate: 0 }
                      : active?.kind === "confused"
                        ? { y: side < 0 ? -2 : 1, rotate: side * -12 }
                        : active?.kind === "happy" || active?.kind === "celebrate" || active?.kind === "wave"
                          ? { y: -3, rotate: 0 }
                          : mood === "thinking"
                            ? { y: side > 0 ? -3 : 0, rotate: side > 0 ? 8 : 0 }
                            : mood === "listening"
                              ? { y: -1.5, rotate: side * 4 }
                              : { y: 0, rotate: 0 }
                  }
                  transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
                />
              ))
            : null}
          {/* mouth: smile, opens while talking, "o" when confused */}
          {active?.kind === "confused" && !reduce ? (
            <circle cx="60" cy="60" r="3" fill={INK} />
          ) : (
            <motion.path
              d="M52 57 Q60 65 68 57"
              stroke={INK}
              strokeWidth="3.2"
              strokeLinecap="round"
              fill={talking ? INK : "none"}
              style={{ originY: 0 }}
              animate={talking ? { scaleY: [1, 1.5, 0.8, 1.3, 1] } : { scaleY: 1 }}
              transition={talking ? { duration: 0.42, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            />
          )}
        </motion.g>
        {/* seat cushion */}
        <rect x="24" y="70" width="72" height="24" rx="11" fill={YELLOW} stroke={INK} strokeWidth="4" />
        <line x1="60" y1="74" x2="60" y2="90" stroke={YELLOW_DEEP} strokeWidth="2" strokeLinecap="round" />
        {/* armrests: pivot on the seat; the left one waves */}
        <motion.g
          style={{ originX: 0.5, originY: 1 }}
          animate={waving ? { rotate: [0, -42, -18, -42, -10, 0] } : { rotate: 0 }}
          transition={waving ? { duration: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
        >
          <rect x="8" y="52" width="18" height="44" rx="9" fill={INK} />
          <rect x="11" y="55" width="12" height="11" rx="5.5" fill={YELLOW} />
        </motion.g>
        <rect x="94" y="52" width="18" height="44" rx="9" fill={INK} />
        <rect x="97" y="55" width="12" height="11" rx="5.5" fill={YELLOW} />
      </motion.g>
      {/* thinking dots */}
      {!simple && !reduce && mood === "thinking" ? (
        <g>
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={86 + i * 9}
              cy={8 - i * 3}
              r={2.6 + i * 0.6}
              fill={YELLOW_DEEP}
              animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            />
          ))}
        </g>
      ) : null}
    </motion.svg>
  );

  const effects = !simple && !reduce && latest ? <Effects key={latest.id} kind={latest.kind} size={size} /> : null;

  const body_ = (
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
          {body_}
        </button>
      </span>
    );
  }
  return (
    <span ref={ref} className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {body_}
    </span>
  );
}

/** One-shot particles around the mascot: sparkles, confetti or a question mark. */
function Effects({ kind, size }: { kind: MascotReactionKind; size: number }) {
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
