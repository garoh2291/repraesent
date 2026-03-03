/**
 * Extracts the last segment of a UUID string.
 * @param uuid - A UUID string (e.g., "143f79b3-d2f6-4f5b-b2b9-d836423464d2")
 * @returns The last segment after the final hyphen (e.g., "d836423464d2")
 */
export function shortLeadId(uuid: string): string {
  if (!uuid) return "";
  const parts = uuid.split("-");
  return parts[parts.length - 1] || "";
}
