import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "motion/react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "~/lib/utils";
import { canRecordAudio, startWavRecorder, type WavRecorder } from "~/lib/audio/wav-recorder";
import { transcribeOutcomeVoice, type VoiceOutcomeResult } from "~/lib/api/lead-outcomes";
import { browserTimeZone } from "~/lib/api/today";
import { isoDay } from "~/components/notebook/day-field";
import { extractErrorCode } from "~/lib/api/axios-instance";

const MAX_SECONDS = 60;
/** Held longer than this → releasing stops (hold to talk); shorter → tap mode. */
const HOLD_MS = 450;

type Phase = "idle" | "starting" | "listening" | "uploading";

/**
 * "Say how it went" (MOBILE_PACKAGE_PLAN.md C2): tap to talk (tap again to
 * stop) or hold to talk. The answer fills the outcome form — nothing is saved
 * until the owner taps Save, and typing always keeps working.
 */
export function VoiceNoteButton<T = VoiceOutcomeResult>({
  leadId,
  onResult,
  transcribe,
  label,
  hint,
  className,
}: {
  /** The inquiry for an outcome voice note (default transcriber). */
  leadId?: string;
  onResult: (res: T) => void;
  /** Another transcriber, e.g. a plain note for a deal or contact. */
  transcribe?: (audio: Blob) => Promise<T>;
  /** Button text instead of "Say how it went". */
  label?: string;
  hint?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<WavRecorder | null>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const downAt = useRef(0);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  // After hydration only: the server can't know about the mic.
  useEffect(() => setSupported(canRecordAudio()), []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      rec.current?.cancel();
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  if (!supported) return null;

  const setLevel = (level: number) => {
    const el = ring.current;
    if (!el) return;
    if (reduced) el.style.opacity = String(0.25 + level * 0.75);
    else el.style.transform = `scale(${1 + level * 0.45})`;
  };

  const errorFor = (err: unknown): string => {
    const name = (err as { name?: string } | null)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return t(
        "voice.errors.blocked",
        "The microphone is blocked. Allow it for this site in your browser's settings, then tap again.",
      );
    }
    if (name === "NotFoundError") return t("voice.errors.noMic", "No microphone found on this device.");
    switch (extractErrorCode(err)) {
      case "VOICE_DAILY_CAP":
        return t("voice.errors.cap", "Voice notes are used up for today. Type the note instead — it's back tomorrow.");
      case "VOICE_UNCLEAR":
        return t("voice.errors.unclear", "We couldn't hear anything clear. Try again a bit closer, or type it.");
      case "VOICE_TOO_LONG":
        return t("voice.errors.tooLong", "That was too long. Keep it under a minute, or type it.");
      case "VOICE_NOT_READY":
        return t("voice.errors.notReady", "Voice notes aren't switched on yet. Type the note for now.");
      default:
        return t("voice.errors.generic", "That didn't work. Try again, or type the note.");
    }
  };

  const clearTimer = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    clearTimer();
    setLevel(0);
    setPhase("uploading");
    try {
      const { blob, seconds: len } = await r.stop();
      if (len < 0.6) {
        if (alive.current) {
          setPhase("idle");
          setError(t("voice.errors.short", "Too short — tap and say how it went."));
        }
        return;
      }
      const res = transcribe
        ? await transcribe(blob)
        : ((await transcribeOutcomeVoice(leadId!, blob, {
            tz: browserTimeZone(),
            today: isoDay(new Date()),
          })) as T);
      if (!alive.current) return;
      setPhase("idle");
      onResult(res);
    } catch (err) {
      if (!alive.current) return;
      setPhase("idle");
      setError(errorFor(err));
    }
  };

  const start = async () => {
    setError(null);
    setPhase("starting");
    try {
      const r = await startWavRecorder(setLevel);
      if (!alive.current) {
        r.cancel();
        return;
      }
      rec.current = r;
      startedAt.current = Date.now();
      setSeconds(0);
      setPhase("listening");
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) void stop();
      }, 250);
    } catch (err) {
      setPhase("idle");
      setError(errorFor(err));
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    downAt.current = Date.now();
    if (phase === "idle") void start();
    else if (phase === "listening") void stop();
  };
  const onPointerUp = () => {
    // Hold to talk: the recording started during this press and it was long.
    if (
      phase === "listening" &&
      startedAt.current >= downAt.current &&
      Date.now() - downAt.current > HOLD_MS
    ) {
      void stop();
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (phase === "idle") void start();
    else if (phase === "listening") void stop();
  };

  const listening = phase === "listening";
  const busy = phase === "uploading" || phase === "starting";
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        disabled={phase === "uploading"}
        aria-pressed={listening}
        aria-label={
          listening ? t("voice.stop", "Stop recording") : label ?? t("voice.start", "Say how it went")
        }
        className={cn(
          "press relative flex size-12 shrink-0 touch-none select-none items-center justify-center rounded-full border transition-colors",
          "[-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
          listening
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground hover:border-foreground/30",
        )}
      >
        {listening ? (
          <span
            ref={ring}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-foreground/20 transition-transform duration-75 ease-out"
          />
        ) : null}
        {phase === "uploading" || phase === "starting" ? (
          <Loader2 className="relative size-5 app-spin" aria-hidden />
        ) : listening ? (
          <Square className="relative size-4 fill-current" aria-hidden />
        ) : (
          <Mic className="relative size-5" aria-hidden />
        )}
      </button>
      <div className="min-w-0 text-left" aria-live="polite">
        <p className="text-[13.5px] font-medium text-foreground">
          {listening
            ? t("voice.listening", "Listening…")
            : phase === "uploading"
              ? t("voice.writing", "Writing it down…")
              : label ?? t("voice.start", "Say how it went")}
          {listening ? <span className="num ml-2 text-muted-foreground">{clock}</span> : null}
        </p>
        <p className={cn("text-[12px] leading-snug", error ? "text-overdue" : "text-muted-foreground")}>
          {error ??
            (listening
              ? t("voice.tapToStop", "Tap to stop — or let go if you're holding")
              : busy
                ? t("voice.nothingSaved", "Nothing is saved until you tap Save.")
                : hint ?? t("voice.hint", "Tap or hold to talk. Up to a minute."))}
        </p>
      </div>
    </div>
  );
}
