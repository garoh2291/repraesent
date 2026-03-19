export function formatBillingInterval(
  recurringInterval: string | null | undefined,
  priceType?: string | null
): string {
  if (!recurringInterval || priceType === "one_time") return "One-Time";
  const map: Record<string, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
    year: "Yearly",
  };
  return map[recurringInterval] ?? recurringInterval;
}
