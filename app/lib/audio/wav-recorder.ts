/**
 * Records the microphone as a 16 kHz mono 16-bit WAV (MOBILE_PACKAGE_PLAN.md C2).
 *
 * WAV on purpose: MediaRecorder gives webm on Android and mp4 on iPhone, and
 * the audio model wants one format. Web Audio gives raw samples everywhere;
 * we downsample and wrap them ourselves. 60 s at 16 kHz × 2 bytes ≈ 1.9 MB,
 * under the server's 2 MB limit.
 */

export const TARGET_RATE = 16_000;

/** Silence guard: 30 ms frames with RMS over this count as speech. */
export const VOICE_FRAME_MS = 30;
export const VOICE_SPEECH_RMS = 0.015;
/** Less speech than this is "nothing was said": nothing is sent. */
export const VOICE_MIN_VOICED_SECONDS = 0.4;

export function canRecordAudio(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    (typeof window.AudioContext === "function" ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === "function")
  );
}

// Posts every render quantum to the main thread. Loaded from a Blob URL so no
// extra build file is needed.
const WORKLET_SRC = `
class RpCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("rp-capture", RpCapture);
`;

export interface WavRecorder {
  /**
   * Stops the mic and returns the WAV, its length, and how many of those
   * seconds were loud enough to be speech (silence guard).
   */
  stop: () => Promise<{ blob: Blob; seconds: number; voicedSeconds: number }>;
  /** Stops the mic and throws the samples away. */
  cancel: () => void;
}

export async function startWavRecorder(onLevel?: (level: number) => void): Promise<WavRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  // iOS starts contexts suspended until a gesture; we are inside one.
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  const source = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];

  // Silence guard: count 30 ms frames loud enough to be speech. Same numbers
  // as the server (nestjs-monolith lead-outcomes/voice-note.ts), so a silent
  // recording never goes to the AI — which would make up a note from it.
  const frameLen = Math.max(1, Math.round(ctx.sampleRate * (VOICE_FRAME_MS / 1000)));
  let frameSum = 0;
  let frameN = 0;
  let voicedFrames = 0;

  const onSamples = (data: Float32Array) => {
    chunks.push(data);
    for (let i = 0; i < data.length; i++) {
      frameSum += data[i] * data[i];
      frameN += 1;
      if (frameN === frameLen) {
        if (Math.sqrt(frameSum / frameN) > VOICE_SPEECH_RMS) voicedFrames += 1;
        frameSum = 0;
        frameN = 0;
      }
    }
    if (onLevel) {
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      // RMS of speech sits around 0.02–0.2; scale into 0..1.
      onLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
    }
  };

  let node: AudioNode;
  let workletUrl: string | null = null;
  // Silent sink: some browsers only pull audio through a node that reaches the output.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  try {
    if (!ctx.audioWorklet) throw new Error("no worklet");
    workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(workletUrl);
    const w = new AudioWorkletNode(ctx, "rp-capture");
    w.port.onmessage = (e: MessageEvent<Float32Array>) => onSamples(e.data);
    node = w;
  } catch {
    // Older Safari: the deprecated ScriptProcessor still works everywhere.
    const sp = ctx.createScriptProcessor(4096, 1, 1);
    sp.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
    node = sp;
  }
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);

  const teardown = () => {
    try {
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    } catch {
      /* already gone */
    }
    stream.getTracks().forEach((tr) => tr.stop());
    void ctx.close().catch(() => undefined);
    if (workletUrl) URL.revokeObjectURL(workletUrl);
  };

  return {
    cancel: teardown,
    stop: async () => {
      const rate = ctx.sampleRate;
      teardown();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        all.set(c, off);
        off += c.length;
      }
      const samples = downsample(all, rate, TARGET_RATE);
      return {
        blob: encodeWav(samples, TARGET_RATE),
        seconds: samples.length / TARGET_RATE,
        voicedSeconds: (voicedFrames * frameLen) / rate,
      };
    },
  };
}

/** Box-filter downsample: averages each output window (cheap anti-aliasing). */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
