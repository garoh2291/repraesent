/** Won and lost deals are done; everything else should have a next step. */
export function isOpenDeal(deal: {
  status?: string | null;
  won_at?: string | Date | null;
  lost_at?: string | Date | null;
}): boolean {
  return (
    !deal.won_at &&
    !deal.lost_at &&
    deal.status !== "won" &&
    deal.status !== "lost"
  );
}
