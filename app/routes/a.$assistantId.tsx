/**
 * The hosted assistant page: /a/:assistantId — what widget_type "page"
 * publishes to. Public, unauthenticated, noindex.
 *
 * The page itself is deliberately thin: a business-name header and a host
 * element the widget script mounts into. Everything conversational is the
 * widget's job, so the hosted page and the embedded section stay identical.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { DocumentScheme } from "~/components/forms/PublicShell";
import i18n from "~/i18n";
import { apiClient } from "~/lib/api/axios-instance";

export function meta() {
  return [
    { title: i18n.t("publicAssistant.metaTitle") },
    { name: "robots", content: "noindex" },
  ];
}

interface PublicAssistantConfig {
  id: string;
  business_name: string;
  persona: { display_name: string };
  appearance: {
    primary_color: string;
    theme: "auto" | "light" | "dark";
    avatar_mode: "initial" | "image";
    avatar_url?: string;
  };
}

const apiBase = (apiClient.defaults.baseURL ?? "").replace(/\/$/, "");

declare global {
  interface Window {
    __raAssistant?: Record<string, unknown>;
    raAssistant?: {
      mount?: (host: HTMLElement) => void;
      unmount?: (host: HTMLElement) => void;
      rescan?: () => void;
    };
  }
}

export default function PublicAssistantRoute() {
  const { assistantId } = useParams();
  const { t, i18n: i18next } = useTranslation();
  const locale = (i18next.language || "en").split("-")[0];

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-assistant", assistantId],
    queryFn: async () => {
      const res = await fetch(
        `${apiBase}/public/ai-assistants/${assistantId}/config?locale=${locale}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as PublicAssistantConfig;
    },
    enabled: !!assistantId,
    retry: false,
  });

  const hostRef = useRef<HTMLDivElement | null>(null);

  // The widget script is loaded once per assistant; it finds the host element
  // by data-ra-assistant and mounts the page variant into it.
  //
  // On a client-side navigation back to this route the script tag and the
  // instance registry both survive, so nothing re-injects and the fresh host
  // element would stay empty. Hence the explicit mount/unmount: the route owns
  // its host, the script only bootstraps.
  useEffect(() => {
    if (!data || !assistantId) return;
    const mount = () => window.raAssistant?.mount?.(hostRef.current!);

    if (!document.querySelector(`script[data-ra-assistant="${assistantId}"]`)) {
      const s = document.createElement("script");
      s.src = `${apiBase}/public/ai-assistants/widget.js`;
      s.async = true;
      s.dataset.raAssistant = assistantId;
      s.addEventListener("load", mount, { once: true });
      document.body.appendChild(s);
    } else {
      mount();
    }

    const host = hostRef.current;
    return () => {
      if (host) window.raAssistant?.unmount?.(host);
    };
  }, [data, assistantId]);

  const dark =
    data?.appearance.theme === "dark" ||
    (data?.appearance.theme === "auto" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const bg = dark ? "#0f0f11" : "#f7f7f8";
  const fg = dark ? "#f4f4f5" : "#111111";
  const line = dark ? "#27272a" : "#e5e7eb";

  if (isLoading) {
    return (
      <>
        <DocumentScheme background={bg} />
        <main className="mx-auto min-h-dvh w-full max-w-[760px] p-6">
          <div
            className="h-8 w-40 animate-pulse rounded bg-stone-300/40"
            aria-hidden
          />
        </main>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <DocumentScheme background="#f7f7f8" />
        <main className="flex min-h-dvh items-center justify-center p-6">
          <div className="max-w-md space-y-2 text-center">
            <h1 className="text-xl font-semibold text-stone-900">
              {t("publicAssistant.unavailable")}
            </h1>
            <p className="text-sm text-stone-500">
              {t("publicAssistant.unavailableHint")}
            </p>
          </div>
        </main>
      </>
    );
  }

  const accent = data.appearance.primary_color || "#111111";
  const initial = (data.persona.display_name || data.business_name || "A")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <style>{`html,body{background:${bg};color-scheme:${dark ? "dark" : "light"};}`}</style>
      <main
        className="mx-auto flex h-dvh w-full max-w-[760px] flex-col overflow-hidden"
        style={{ color: fg }}
      >
        <header
          className="flex shrink-0 items-center gap-3 px-5 py-3 sm:px-6"
          style={{ borderBottom: `1px solid ${line}` }}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            {data.appearance.avatar_mode === "image" &&
            data.appearance.avatar_url ? (
              <img
                src={data.appearance.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
          <h1 className="truncate text-base font-semibold tracking-tight">
            {data.business_name}
          </h1>
        </header>
        {/* min-h-0 is what lets the widget's internal thread scroll instead of
            growing the page: a flex child defaults to min-height:auto, which
            refuses to shrink below its content. */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
          <div
            ref={hostRef}
            data-ra-assistant={assistantId}
            data-ra-mode="page"
            className="flex min-h-0 flex-1 flex-col"
          />
        </div>
      </main>
    </>
  );
}
