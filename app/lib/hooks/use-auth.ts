import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  requestMagicLink,
  getUserContext,
  logout,
  type User,
  type WorkspaceContext,
  type UserContextResponse,
} from "~/lib/api/auth";
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "~/lib/api/axios-instance";

export interface AuthState {
  user: User | null;
  workspaces: WorkspaceContext[];
  currentWorkspace: WorkspaceContext | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const clearStoredAuth = (): void => {
  if (typeof window === "undefined") return;
  clearStoredToken();
  clearStoredWorkspaceId();
};

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
        };
      }

      try {
        const context = await getUserContext();

        if (!context.workspaces?.length) {
          return {
            user: context.user,
            workspaces: [],
            currentWorkspace: null,
            token,
            isAuthenticated: true,
            isLoading: false,
          };
        }

        const storedWorkspaceId = getStoredWorkspaceId();
        let currentWorkspace: WorkspaceContext | null = null;

        if (context.workspaces.length === 1) {
          currentWorkspace = context.workspaces[0];
          setStoredWorkspaceId(context.workspaces[0].id);
        } else if (storedWorkspaceId) {
          currentWorkspace =
            context.workspaces.find((w) => w.id === storedWorkspaceId) ?? null;
        }

        return {
          user: context.user,
          workspaces: context.workspaces,
          currentWorkspace,
          token,
          isAuthenticated: true,
          isLoading: false,
        };
      } catch {
        clearStoredAuth();
        return {
          user: null,
          workspaces: [],
          currentWorkspace: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        };
      }
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const requestMagicLinkMutation = useMutation({
    mutationFn: requestMagicLink,
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
      });
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const setCurrentWorkspace = (workspaceId: string) => {
    const workspaces = authState?.workspaces ?? [];
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    setStoredWorkspaceId(workspaceId);

    queryClient.setQueryData<AuthState>(["auth"], (prev) =>
      prev
        ? { ...prev, currentWorkspace: workspace }
        : prev
    );

    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
  };

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
