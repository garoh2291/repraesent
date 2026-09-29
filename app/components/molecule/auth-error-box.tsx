import { AlertCircle } from "lucide-react";

/** The error box on the sign-in and register pages. */
export function AuthErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-overdue/30 bg-overdue-soft px-4 py-3 text-sm text-overdue"
    >
      <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
