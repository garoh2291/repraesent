import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "~/lib/hooks/use-auth";
import type { User, WorkspaceContext } from "~/lib/api/auth";

interface AuthContextType {
  user: User | null;
  workspaces: WorkspaceContext[];
  currentWorkspace: WorkspaceContext | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requestMagicLink: (email: string) => void;
  requestMagicLinkAsync: (email: string) => Promise<void>;
  isRequestingMagicLink: boolean;
  magicLinkError: Error | null;
  setCurrentWorkspace: (workspaceId: string) => void;
  logout: () => void;
  isLoggingOut: boolean;
  refetchAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
