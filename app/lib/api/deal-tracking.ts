import { publicClient } from "./public-client";

export interface TrackingStage {
  key: string;
  /**
   * The public name, else the internal one, else null — meaning the stage was
   * never renamed, so the built-in translation for the key is the right name
   * and it is resolved on the client, in the reader's language.
   */
  label: string | null;
  /** Palette token — mapped by `~/lib/pipeline-stages/colors`, as elsewhere. */
  color: string | null;
  category: string;
  position: number;
  reached: boolean;
  reachedAt: string | null;
  current: boolean;
}

export interface TrackingProduct {
  name: string | null;
  imageUrl: string | null;
  quantity: number;
  /** Minor units. */
  unitAmount: number | null;
  currency: string | null;
}

export interface DealTrackingView {
  reference: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: { name: string; logoUrl: string | null };
  stages: TrackingStage[];
  currentStage: TrackingStage | null;
  products: TrackingProduct[];
  outcome: "won" | "lost" | "open";
}

/**
 * The one public call this page makes.
 *
 * Throws on 404 — which the endpoint returns identically for an unknown token,
 * a pipeline with tracking switched off and a deleted deal, so the page has
 * exactly one "this link is not active" state to draw and cannot accidentally
 * tell a stranger which of the three happened.
 */
export async function getDealTracking(
  token: string,
): Promise<DealTrackingView> {
  const response = await publicClient.get<DealTrackingView>(
    `/public/deal-tracking/${encodeURIComponent(token)}`,
  );
  return response.data;
}
