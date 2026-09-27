import { CallQueue } from "~/components/notebook/call-queue";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import i18n from "~/i18n";

export function meta() {
  return [{ title: i18n.t("calls.metaTitle", "Calls") + " - Repraesent" }];
}

/** "Start calls" from Today: one person at a time (MOBILE_PACKAGE_PLAN.md C1). */
export default function CallsPage() {
  useDocumentMeta({ titleKey: "calls.metaTitle", titleSuffix: " - Repraesent" });
  return (
    <div className="flex flex-1 flex-col app-fade-in">
      <CallQueue />
    </div>
  );
}
