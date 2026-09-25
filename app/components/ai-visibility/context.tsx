import { createContext, useContext } from "react";
import type { ProjectState } from "~/lib/api/ai-visibility";

/** The active project state, provided once by the /ai-visibility layout. */
export const AiVisibilityContext = createContext<{ state: ProjectState; canEdit: boolean } | null>(null);

export function useAiVisibilityContext(): { state: ProjectState; canEdit: boolean } {
  const ctx = useContext(AiVisibilityContext);
  if (!ctx) throw new Error("useAiVisibilityContext must be used inside the /ai-visibility layout");
  return ctx;
}
