import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";

/**
 * Chrome shared by the ported WordPress plugin admin screens. Kept separate
 * from any one plugin so each settings page can reuse it.
 *
 * This used to also export PluginSettingsFormError / PluginSettingsFormSuccess.
 * They were never imported anywhere, and they were styled with var(--danger),
 * var(--success-soft) etc. — custom properties that only existed inside a
 * `.wpm-plugin-settings-root` class that was itself never applied, so they would
 * have rendered with no background and no colour had anyone used them. Use the
 * app's own `~/components/ui/alert` instead.
 */
export function PluginSettingsBackLink({ label }: { label: string }) {
  return (
    <Link
      to="/website"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}
