import { useState } from "react";
import axios from "axios";
import { Loader2, Play } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function DevSyncTrigger() {
  const [triggerState, setTriggerState] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  const handleTrigger = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
    const cronKey = import.meta.env.VITE_CRON_API_KEY || "";
    setTriggerState("loading");
    setTriggerResult(null);
    try {
      const res = await axios.post(
        `${apiUrl}/internal/process-historical-sync`,
        {},
        { headers: { "x-cron-api-key": cronKey } },
      );
      setTriggerResult(JSON.stringify(res.data));
      setTriggerState("ok");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : String(err);
      setTriggerResult(msg);
      setTriggerState("error");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-500/70 flex items-center gap-1.5">
        <Play className="h-3 w-3" /> Dev: run historical sync
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleTrigger}
        disabled={triggerState === "loading"}
        className="h-7 w-full gap-1.5 text-[11px] border-amber-500/20 text-amber-500/80 hover:bg-amber-500/10"
      >
        {triggerState === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Run now
      </Button>
      {triggerResult && (
        <p
          className={cn(
            "text-[10px] font-mono break-all leading-relaxed",
            triggerState === "ok" ? "text-emerald-500" : "text-red-400",
          )}
        >
          {triggerResult}
        </p>
      )}
    </div>
  );
}
