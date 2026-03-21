import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { getServiceConfig } from "~/lib/api/workspaces";

export function meta() {
  return [
    { title: i18n.t("analytics.metaTitle") },
    { name: "description", content: i18n.t("analytics.metaDescription") },
  ];
}

const PLAUSIBLE_SCRIPT = "https://plausible0.gagadomains.com/js/embed.host.js";

export default function Analytics() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const analyticsService = currentWorkspace?.services?.find(
    (s) => s.service_type === "analytics",
  );

  const { data: serviceConfig, isPending } = useQuery({
    queryKey: ["service-config", analyticsService?.service_id],
    queryFn: () => getServiceConfig(analyticsService!.service_id),
    enabled: !!analyticsService?.service_id,
  });

  const sharedLink = serviceConfig?.shared_link as string | undefined;

  useEffect(() => {
    if (!sharedLink) return;
    if (document.querySelector(`script[src="${PLAUSIBLE_SCRIPT}"]`)) return;

    const script = document.createElement("script");
    script.src = PLAUSIBLE_SCRIPT;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.querySelector(`script[src="${PLAUSIBLE_SCRIPT}"]`)?.remove();
    };
  }, [sharedLink]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.setAttribute("plausible-embed", "");
    }
  }, []);

  if (!analyticsService && !isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("analytics.notEnabled")}</p>
      </div>
    );
  }

  if (!sharedLink && !isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("analytics.notConfigured")}</p>
      </div>
    );
  }

  const embedSrc = `${sharedLink}&embed=true&theme=light&background=%23f5f4f1`;

  return (
    <div className="w-full h-full overflow-auto relative">
      {(isLoading || isPending) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">{t("analytics.loading")}</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={embedSrc}
        scrolling="no"
        frameBorder="0"
        loading="lazy"
        style={{
          width: "1px",
          minWidth: "100%",
          height: "1600px",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
        title={t("analytics.iframeTitle")}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
