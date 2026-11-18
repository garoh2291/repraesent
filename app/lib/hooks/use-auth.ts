import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearOnboardingSession } from "~/lib/onboarding/session-draft";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import i18n from "~/i18n";
import { endSwitch, startSwitch } from "~/components/notebook/switch-splash";
import {
  requestMagicLink,
  getUserContextWithRetry,
  getWorkspaceContext,
  isAuthRejection,
  logout,
  type User,
  type WorkspaceContext,
  type UserContextResponse,
  type BrandInfo,
  type BrandWorkspace,
  type AgencyChild,
} from "~/lib/api/auth";
import type { SupportedLocale } from "~/i18n/locales";
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
  getLastWorkspaceId,
  setStoredWorkspaceId,
  clearStoredSelectedView,
  setStoredSelectedView,
  WORKSPACE_ACCESS_LOST_EVENT,
} from "~/lib/api/axios-instance";

export interface AuthState {
  user: User | null;
  workspaces: WorkspaceContext[];
  currentWorkspace: WorkspaceContext | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  brand: BrandInfo | null;
  brandWorkspaces: BrandWorkspace[];
  /** Businesses reached through the person's agencies (not their own). */
  agencyChildren: AgencyChild[];
}

export const clearStoredAuth = (): void => {
  if (typeof window === "undefined") return;
  clearStoredToken();
  clearStoredWorkspaceId();
  clearStoredSelectedView();
  // The next person in this tab must not inherit an onboarding draft.
  clearOnboardingSession();
};

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const childPickRef = useRef(0);

  const {
    data: authState,
    isLoading: isVerifying,
    isFetching: isFetchingAuth,
    refetch: refetchAuth,
  } = useQuery<AuthState>({
    queryKey: ["auth"],
    queryFn: async () => {
      const token = getStoredToken();

      if (!token) {
        return {
          user: null,
          workspaces: [],
          currentWorkspace: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          brand: null,
          brandWorkspaces: [],
          agencyChildren: [],
        };
      }

      try {
        // Retries 5xx / network with backoff; only a real 401/403 signs out.
        const context = await getUserContextWithRetry([1000, 2000, 4000]);

        // Brand context (if user is brand) is returned alongside workspaces —
        // brand users may also be workspace members and switch between views.
        const brand = context.brand ?? null;
        const brandWorkspaces = context.brandWorkspaces ?? [];
        const workspaces = context.workspaces ?? [];
        const agencyChildren = context.agency_children ?? [];

        if (!workspaces.length) {
          return {
            user: context.user,
            workspaces: [],
            currentWorkspace: null,
            token,
            isAuthenticated: true,
            isLoading: false,
            brand,
            brandWorkspaces,
            agencyChildren,
          };
        }

        const storedWorkspaceId = getStoredWorkspaceId();
        let currentWorkspace: WorkspaceContext | null = null;

        // Agency mode: this tab is inside a business reached through the
        // person's agency. Its context comes from its own endpoint; if access
        // is gone (detached, paused), fall back to the normal choice below.
        const childId =
          storedWorkspaceId && !workspaces.some((w) => w.id === storedWorkspaceId)
            ? (agencyChildren.find((c) => c.id === storedWorkspaceId)?.id ?? null)
            : null;
        if (childId) {
          try {
            currentWorkspace = await getWorkspaceContext(childId);
          } catch {
            currentWorkspace = null;
          }
        }

        if (currentWorkspace) {
          // chosen above
        } else if (workspaces.length === 1) {
          currentWorkspace = workspaces[0];
          setStoredWorkspaceId(workspaces[0].id);
        } else {
          // This tab's workspace, else where the last tab was (e.g. this tab
          // still holds a workspace of someone who signed out elsewhere).
          const lastWorkspaceId = getLastWorkspaceId();
          currentWorkspace =
            (storedWorkspaceId ? workspaces.find((w) => w.id === storedWorkspaceId) : undefined) ??
            (lastWorkspaceId ? workspaces.find((w) => w.id === lastWorkspaceId) : undefined) ??
            null;
          if (currentWorkspace && currentWorkspace.id !== storedWorkspaceId) {
            setStoredWorkspaceId(currentWorkspace.id);
          }
        }

        return {
          user: context.user,
          workspaces,
          currentWorkspace,
          token,
          isAuthenticated: true,
          isLoading: false,
          brand,
          brandWorkspaces,
          agencyChildren,
        };
      } catch (error) {
        // A transient failure (DB pool timeout, network) keeps the stored
        // token so the next load recovers; only an auth rejection clears it.
        if (isAuthRejection(error)) clearStoredAuth();
        return {
          user: null,
          workspaces: [],
          currentWorkspace: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          brand: null,
          brandWorkspaces: [],
          agencyChildren: [],
        };
      }
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const requestMagicLinkMutation = useMutation({
    mutationFn: (vars: { email: string; locale?: SupportedLocale }) =>
      requestMagicLink(vars.email, vars.locale),
    onError: (error) => {
      console.error("Magic link request error:", error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearStoredAuth();
      queryClient.setQueryData<AuthState>(["auth"], {
        user: null,
        workspaces: [],
        currentWorkspace: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        brand: null,
        brandWorkspaces: [],
        agencyChildren: [],
      });
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  /**
   * `persist: false` switches the in-memory state only, without touching
   * storage. `workspaces` overrides the list when the caller has just
   * refetched it.
   */
  const setCurrentWorkspace = (
    workspaceId: string,
    opts: { persist?: boolean; workspaces?: WorkspaceContext[] } = {},
  ) => {
    const workspaces = opts.workspaces ?? authState?.workspaces ?? [];
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      // A business reached through the person's agency: store the choice and
      // reload the context, which fetches that business's own context.
      const child = (authState?.agencyChildren ?? []).find((c) => c.id === workspaceId);
      if (!child) return;
      // Load that business's context first (it needs no workspace header),
      // then switch in one step, like a normal switch. If access is gone,
      // reload the whole context so the list is current again.
      // Two quick picks: only the latest one may land.
      const pick = ++childPickRef.current;
      // The business's context can take seconds: the re:praesent screen covers
      // it (switch-splash.tsx) until the business's Today is there.
      const splash = startSwitch(child.name);
      void getWorkspaceContext(workspaceId)
        .then((ctx) => {
          if (pick !== childPickRef.current) return;
          setStoredWorkspaceId(workspaceId);
          setStoredSelectedView(workspaceId);
          const notAuthQ = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== "auth";
          queryClient.cancelQueries({ predicate: notAuthQ });
          queryClient.setQueryData<AuthState>(["auth"], (prev) => (prev ? { ...prev, currentWorkspace: ctx } : prev));
          queryClient.removeQueries({ predicate: notAuthQ });
          // Land on the business's own Today, never on the page we came from.
          navigate("/", { replace: true });
        })
        .catch(() => {
          if (pick !== childPickRef.current) return;
          toast.error(i18n.t("agency.switchFailed", { business: child.name }));
          void refetchAuth();
        })
        .finally(() => endSwitch(splash));
      return;
    }

    childPickRef.current++;
    if (opts.persist !== false) {
      setStoredWorkspaceId(workspaceId);
      setStoredSelectedView(workspaceId);
    }

    queryClient.setQueryData<AuthState>(["auth"], (prev) =>
      prev
        ? { ...prev, currentWorkspace: workspace }
        : prev
    );

    // Invalidating is not enough here. Almost no query key in the app carries
    // a workspace id — ["forms"], ["leads", page, …], ["deals-pipeline", …] —
    // so every cache entry is a slot SHARED between tenants. Invalidation only
    // marks entries stale and refetches the active ones, which left every
    // inactive entry holding the previous workspace's rows, ready to be
    // repainted the moment its route remounted.
    //
    // Cancel first: a request issued before the switch went out with the old
    // X-Workspace-Id and would otherwise resolve into the new workspace's slot.
    // Then drop the data outright, so components paint their loading state
    // rather than someone else's data. Removing an observed query makes its
    // observer refetch immediately, so the callers' navigate() still lands on
    // fresh data with no reload.
    //
    // ["auth"] survives — it is the query holding the workspace list we just
    // read `workspace` out of.
    const notAuth = (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] !== "auth";
    queryClient.cancelQueries({ predicate: notAuth });
    queryClient.removeQueries({ predicate: notAuth });
  };

  // Agency mode: the tab is inside a business reached through an agency and
  // the API says access has ended (detached / paused). Fall back to the
  // person's own workspace instead of leaving every request failing.
  const currentViaAgency = authState?.currentWorkspace?.via_agency_id
    ? authState.currentWorkspace.id
    : null;
  useEffect(() => {
    if (!currentViaAgency || typeof window === "undefined") return;
    const onLost = (e: Event) => {
      const ws = (e as CustomEvent<string | null>).detail;
      if (ws && ws !== currentViaAgency) return;
      clearStoredWorkspaceId();
      const notAuthQ = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== "auth";
      queryClient.cancelQueries({ predicate: notAuthQ });
      queryClient.removeQueries({ predicate: notAuthQ });
      void refetchAuth();
    };
    window.addEventListener(WORKSPACE_ACCESS_LOST_EVENT, onLost);
    return () => window.removeEventListener(WORKSPACE_ACCESS_LOST_EVENT, onLost);
  }, [currentViaAgency, queryClient, refetchAuth]);

  const currentToken = getStoredToken();
  const hasTokenButNoUser = !!currentToken && !authState?.user;

  const isLoading =
    isVerifying ||
    isFetchingAuth ||
    requestMagicLinkMutation.isPending ||
    hasTokenButNoUser;

  return {
    user: authState?.user ?? null,
    workspaces: authState?.workspaces ?? [],
    currentWorkspace: authState?.currentWorkspace ?? null,
    token: authState?.token ?? null,
    isAuthenticated: authState?.isAuthenticated ?? false,
    isLoading,
    brand: authState?.brand ?? null,
    brandWorkspaces: authState?.brandWorkspaces ?? [],
    agencyChildren: authState?.agencyChildren ?? [],
    requestMagicLink: requestMagicLinkMutation.mutate,
    requestMagicLinkAsync: requestMagicLinkMutation.mutateAsync,
    isRequestingMagicLink: requestMagicLinkMutation.isPending,
    magicLinkError: requestMagicLinkMutation.error,
    setCurrentWorkspace,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetchAuth,
  };
}
