import axios from "axios";
import { CheckCircle2, MailX } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

/**
 * Public unsubscribe landing page. Raw axios on purpose: the shared apiClient
 * injects auth headers and refresh-token handling that must never run for an
 * email recipient who has no account here.
 *
 * GET shows who/what before anything happens; the button POSTs the actual
 * unsubscribe (same endpoint Gmail's native one-click uses).
 */

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8001/api")
  .toString()
  .replace(/\/+$/, "");

interface UnsubscribeInfo {
  workspace_name: string;
  email_masked: string;
  already_unsubscribed: boolean;
}

export default function UnsubscribePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<UnsubscribeInfo | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "submitting" | "done" | "invalid"
  >("loading");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    axios
      .get<UnsubscribeInfo>(`${API_BASE}/public/email/unsubscribe/${token}`)
      .then(({ data }) => {
        setInfo(data);
        setState(data.already_unsubscribed ? "done" : "ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      await axios.post(`${API_BASE}/public/email/unsubscribe/${token}`);
      setState("done");
    } catch {
      setState("invalid");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {state === "loading" ? (
          <p className="text-sm text-muted-foreground">
            {t("emailCampaigns.unsubscribe.loading", {
              defaultValue: "One moment…",
            })}
          </p>
        ) : null}

        {state === "invalid" ? (
          <>
            <MailX className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h1 className="text-lg font-semibold">
              {t("emailCampaigns.unsubscribe.invalidTitle", {
                defaultValue: "This link is not valid",
              })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("emailCampaigns.unsubscribe.invalidHint", {
                defaultValue:
                  "The unsubscribe link may be incomplete or expired. You can also reply to the email and ask to be removed.",
              })}
            </p>
          </>
        ) : null}

        {state === "ready" || state === "submitting" ? (
          <>
            <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">
              {t("emailCampaigns.unsubscribe.title", {
                defaultValue: "Unsubscribe from emails?",
              })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("emailCampaigns.unsubscribe.body", {
                defaultValue:
                  "{{email}} will no longer receive marketing emails from {{workspace}}.",
                email: info?.email_masked ?? "",
                workspace: info?.workspace_name ?? "",
              })}
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={state === "submitting"}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {state === "submitting"
                ? t("emailCampaigns.unsubscribe.submitting", {
                    defaultValue: "Unsubscribing…",
                  })
                : t("emailCampaigns.unsubscribe.confirm", {
                    defaultValue: "Unsubscribe",
                  })}
            </button>
          </>
        ) : null}

        {state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-semibold">
              {t("emailCampaigns.unsubscribe.doneTitle", {
                defaultValue: "You're unsubscribed",
              })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("emailCampaigns.unsubscribe.doneBody", {
                defaultValue:
                  "{{email}} will not receive marketing emails from {{workspace}} any more.",
                email: info?.email_masked ?? "",
                workspace: info?.workspace_name ?? "",
              })}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
