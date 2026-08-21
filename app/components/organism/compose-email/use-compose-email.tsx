import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BccMessage } from "~/lib/api/bcc-logs";
import type { Recipient } from "./recipient-field";
import { ComposeEmailDialog } from "./index";

export interface ComposeRequest {
  /** Prefilled recipients. Everything here is removable. */
  to?: Recipient[];
  cc?: Recipient[];
  subject?: string;
  /** Prefilled body HTML (a reply quote, typically). */
  html?: string;
  /** Deal the composer was opened from — drives the guaranteed deal visibility. */
  dealId?: string;
  /** Contact the composer was opened from. */
  contactId?: string;
  /** The message being replied to, for In-Reply-To / References. */
  replyTo?: BccMessage;
  /** Shown under the dialog title so it is obvious what this email attaches to. */
  contextLabel?: string;
  /** Query keys to invalidate after a successful send. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

interface ComposeEmailContextValue {
  openCompose: (request: ComposeRequest) => void;
}

const ComposeEmailContext = createContext<ComposeEmailContextValue | null>(
  null,
);

/**
 * One composer for the whole app.
 *
 * The contact hero, the deal hero, the Emails tab header, the empty state and
 * every card's Reply button all open the same dialog instance, so there is no
 * chance of two half-written drafts existing at once.
 */
export function ComposeEmailProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ComposeRequest | null>(null);
  const [open, setOpen] = useState(false);
  // Bumped on every open so the dialog remounts with a clean form. Keying on
  // `open` instead would also remount while closing, killing the exit
  // animation and the discard confirmation with it.
  const [session, setSession] = useState(0);

  const openCompose = useCallback((next: ComposeRequest) => {
    setRequest(next);
    setSession((n) => n + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openCompose }), [openCompose]);

  return (
    <ComposeEmailContext.Provider value={value}>
      {children}
      {request && (
        <ComposeEmailDialog
          key={session}
          open={open}
          onOpenChange={setOpen}
          request={request}
        />
      )}
    </ComposeEmailContext.Provider>
  );
}

export function useComposeEmail(): ComposeEmailContextValue {
  const ctx = useContext(ComposeEmailContext);
  if (!ctx) {
    throw new Error("useComposeEmail must be used inside ComposeEmailProvider");
  }
  return ctx;
}
