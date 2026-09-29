import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { CoachHint, hintPrimaryClass } from "~/components/notebook/coach-hint";

/**
 * First time on this device: point once at search (the header button on
 * phones, the sidebar search on the web). Tapping "Got it", the search itself
 * or anywhere else puts it away for good. The look lives in coach-hint.tsx.
 */

const storageKey = (userId: string) => `rp-search-hint:${userId}`;

function seen(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true; // Storage blocked: never nag.
  }
}

function markSeen(userId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function SearchHint() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const [show, setShow] = useState(false);

  // Decided in an effect: localStorage isn't there during server rendering.
  useEffect(() => {
    setShow(!!userId && !seen(userId));
  }, [userId]);

  const dismiss = useCallback(() => {
    if (userId) markSeen(userId);
    setShow(false);
  }, [userId]);

  if (!show) return null;
  return (
    <CoachHint
      selector="[data-search-hint]"
      icon={<Search className="size-4 text-foreground" aria-hidden />}
      title={t("searchHint.title", "Find anything here")}
      body={t("searchHint.body", "People, deals, tasks and pages — tap to search.")}
      onDismiss={dismiss}
      actions={
        <button type="button" onClick={dismiss} className={hintPrimaryClass}>
          {t("searchHint.ok", "Got it")}
        </button>
      }
    />
  );
}
