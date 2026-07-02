import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  Check,
  RefreshCw,
  Mail,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import i18n from "~/i18n";
import {
  getBccAddress,
  regenerateBccAddress,
  type BccAddress,
} from "~/lib/api/bcc-logs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: `${i18n.t("settings.bcc.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.bcc.metaDescription") },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

/* -------------------------------------------------------------------------- */
/* The "picture": an animated flow from the user's email app to the contact.  */
/* -------------------------------------------------------------------------- */

function FlowDiagram({ address }: { address: string | undefined }) {
  const { t } = useTranslation();
  const shown = address ?? "…";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* atmospheric dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 50%, #000 40%, transparent 100%)",
        }}
      />

      <div className="relative grid grid-cols-1 items-stretch gap-0 p-5 sm:p-8 lg:grid-cols-[1fr_auto_1fr]">
        {/* Stage 1 — compose window */}
        <figure className="app-fade-up flex flex-col">
          <div className="rounded-xl border border-border bg-background shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-18px_rgba(19,21,21,0.25)]">
            <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5">
              <span className="size-2.5 rounded-full bg-[#f6564e]/80" />
              <span className="size-2.5 rounded-full bg-[#f5b83d]/80" />
              <span className="size-2.5 rounded-full bg-[#4bb861]/80" />
              <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">
                {t("settings.bcc.flowComposeTitle")}
              </span>
            </div>
            <div className="space-y-2.5 p-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="w-9 shrink-0 uppercase tracking-wider text-muted-foreground">
                  {t("settings.bcc.flowFieldTo")}
                </span>
                <span className="truncate text-foreground/80">
                  {t("settings.bcc.flowFieldToValue")}
                </span>
              </div>
              {/* the highlighted BCC line */}
              <div className="flex items-center gap-3 rounded-lg bg-primary/[0.07] px-2.5 py-2 ring-1 ring-inset ring-primary/25">
                <span className="w-9 shrink-0 text-xs font-semibold uppercase tracking-wider text-primary">
                  {t("settings.bcc.flowBccLabel")}
                </span>
                <span className="truncate font-mono text-[12px] text-foreground">
                  {shown}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-1.5 pt-0.5">
                <div className="h-2 w-3/4 rounded bg-muted" />
                <div className="h-2 w-1/2 rounded bg-muted" />
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("settings.bcc.flowCaptionCompose")}
          </figcaption>
        </figure>

        {/* Connector */}
        <div className="app-fade-up app-fade-up-d1 relative flex items-center justify-center py-4 lg:px-8 lg:py-0">
          {/* horizontal on desktop, vertical on mobile */}
          <div className="relative flex h-14 w-full items-center justify-center lg:h-full lg:w-14">
            <div className="bcc-path absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 lg:block" />
            <div className="bcc-path-v absolute bottom-0 top-0 left-1/2 w-px -translate-x-1/2 lg:hidden" />
            <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary shadow-sm">
              <Mail className="size-3" />
              {t("settings.bcc.flowBadge")}
            </span>
            {/* travelling pulse */}
            <span className="bcc-spark absolute size-1.5 rounded-full bg-primary lg:top-1/2" />
          </div>
        </div>

        {/* Stage 2 — the contact record */}
        <figure className="app-fade-up app-fade-up-d2 flex flex-col">
          <div className="rounded-xl border border-border bg-background shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-18px_rgba(19,21,21,0.25)]">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
                AF
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {t("settings.bcc.flowContactName")}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("settings.bcc.flowContactMeta")}
                </p>
              </div>
            </div>
            {/* mini tab bar */}
            <div className="flex items-center gap-4 border-b border-border px-4">
              <span className="border-b-2 border-transparent py-2 text-xs text-muted-foreground">
                {t("settings.bcc.flowTabInfo")}
              </span>
              <span className="-mb-px border-b-2 border-primary py-2 text-xs font-semibold text-foreground">
                {t("settings.bcc.flowTabEmails")}
              </span>
            </div>
            {/* the arrived email */}
            <div className="p-3">
              <div className="bcc-arrive flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {t("settings.bcc.flowEmailSubject")}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t("settings.bcc.flowEmailSnippet")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("settings.bcc.flowCaptionArrive")}
          </figcaption>
        </figure>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .bcc-path{background:repeating-linear-gradient(to right,var(--primary) 0 6px,transparent 6px 12px);opacity:.5}
          .bcc-path-v{background:repeating-linear-gradient(to bottom,var(--primary) 0 6px,transparent 6px 12px);opacity:.5}
          @keyframes bccSpark{0%{left:0;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:100%;opacity:0}}
          @keyframes bccArrive{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
          .bcc-spark{display:none}
          @media (min-width:1024px){
            .bcc-spark{display:block;transform:translateY(-50%);animation:bccSpark 2.8s cubic-bezier(.4,0,.2,1) infinite}
          }
          .bcc-arrive{animation:bccArrive .5s ease-out .5s both}
          @media (prefers-reduced-motion:reduce){
            .bcc-spark{animation:none}.bcc-arrive{animation:none}
          }
        `,
        }}
      />
    </div>
  );
}

export default function SettingsBcc() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.bcc.metaTitle",
    descriptionKey: "settings.bcc.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const {
    data: address,
    isLoading,
    isError,
  } = useQuery<BccAddress>({
    queryKey: ["bcc-address"],
    queryFn: getBccAddress,
  });

  const regenerateMutation = useMutation({
    mutationFn: regenerateBccAddress,
    onSuccess: (next) => {
      queryClient.setQueryData(["bcc-address"], next);
      toast.success(t("settings.bcc.regenerated"));
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      toast.success(t("settings.bcc.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  return (
    <div className="space-y-8 app-fade-up app-fade-up-d2">
      {/* How it works — the picture */}
      <div className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.bcc.howToTitle")}</SectionLabel>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("settings.bcc.sectionDescription")}
          </p>
        </div>
        <FlowDiagram address={address?.address} />
      </div>

      {/* The address */}
      <div className="space-y-4">
        <SectionLabel>{t("settings.bcc.sectionTitle")}</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("settings.bcc.addressLabel")}
            </label>

            {isLoading ? (
              <Skeleton className="h-11 w-full rounded-lg" />
            ) : isError ? (
              <p className="text-sm text-destructive">
                {t("settings.bcc.loadError")}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-lg border border-border bg-background font-mono text-sm text-foreground overflow-x-auto">
                  <Mail className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{address?.address}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-11 px-4 shrink-0"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {t("settings.bcc.copy")}
                </Button>
              </div>
            )}
          </div>

          {address && (
            <div className="flex justify-end pt-4 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={regenerateMutation.isPending}
                    className="h-10 px-4 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-4" />
                    {t("settings.bcc.regenerate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("settings.bcc.regenerateConfirmTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.bcc.regenerateConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t("settings.bcc.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => regenerateMutation.mutate()}
                    >
                      {t("settings.bcc.regenerateConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {/* Where to check */}
      <div className="space-y-4">
        <SectionLabel>{t("settings.bcc.whereTitle")}</SectionLabel>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
            {t("settings.bcc.whereBreadcrumbContacts")}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
            {t("settings.bcc.whereBreadcrumbContact")}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-semibold text-primary ring-1 ring-inset ring-primary/20">
            <Mail className="size-3.5" />
            {t("settings.bcc.whereBreadcrumbTab")}
          </span>
          <ArrowRight className="ml-auto hidden size-4 text-muted-foreground sm:block" />
        </div>
      </div>
    </div>
  );
}
