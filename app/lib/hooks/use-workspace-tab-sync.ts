import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import { WORKSPACE_ID_KEY } from "~/lib/api/axios-instance";

/** Pages that hold their own flow — switch the state, but don't pull them away. */
const STAY_PREFIXES = ["/brand", "/onboarding", "/auth"];
/** One notice at a time — a newer switch replaces (or clears) the last one. */
const TOAST_ID = "workspace-tab-sync";

/**
 * Keeps this tab on the same area as the others.
 *
 * The chosen workspace lives in localStorage, which every tab shares, and the
 * axios interceptor reads it on every request. So when another tab switches
 * area, this tab's requests already go to the new one — while its sidebar and
 * cache still show the old one. A task created here would land in an area the
 * screen doesn't show.
 *
 * The `storage` event fires in every OTHER tab on that write (hidden ones
 * too), so this tab adopts the switch right away: same cache wipe as a normal
 * switch, back to the start page (the open record may belong to the old
 * area), and a short line saying why.
 */
export function useWorkspaceTabSync() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWorkspace, workspaces, setCurrentWorkspace, refetchAuth } =
    useAuthContext();

  // The listener is attached once; it reads the latest values from here.
  const latest = useRef({ currentWorkspace, workspaces, setCurrentWorkspace, refetchAuth, path: location.pathname });
  latest.current = { currentWorkspace, workspaces, setCurrentWorkspace, refetchAuth, path: location.pathname };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = async (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage || e.key !== WORKSPACE_ID_KEY) return;
      const nextId = e.newValue;
      // Cleared = signed out elsewhere; the auth checks handle that.
      if (!nextId) return;

      const cur = latest.current;
      if (cur.currentWorkspace?.id === nextId) return;

      // A workspace this tab has never heard of (joined or created in the
      // other tab) — reload the list first.
      let list = cur.workspaces;
      if (!list.some((w) => w.id === nextId)) {
        const res = await cur.refetchAuth();
        list = res.data?.workspaces ?? [];
      }
      const workspace = list.find((w) => w.id === nextId);
      if (!workspace) return;

      latest.current.setCurrentWorkspace(nextId, { persist: false, workspaces: list });

      const path = latest.current.path;
      if (STAY_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
        toast.dismiss(TOAST_ID);
        return;
      }
      navigate("/", { replace: true });
      toast(t("switchWorkspace.otherTab", { name: workspace.name }), { id: TOAST_ID });
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [navigate, t]);
}
