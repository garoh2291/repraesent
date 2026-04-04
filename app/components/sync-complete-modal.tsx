import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TrendingUp, Users, FileText, ArrowRight } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getHistoricalData,
  markHistoricalDataNotified,
} from "~/lib/api/historical-data";

export function SyncCompleteModal() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);

  const isDoorboost =
    currentWorkspace?.was_doorboost_client === true &&
    !!currentWorkspace?.doorboost_partner_house_id;

  const { data: record } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: isDoorboost,
  });

  const markMutation = useMutation({
    mutationFn: markHistoricalDataNotified,
    onSuccess: (data) => {
      queryClient.setQueryData(["historical-data", currentWorkspace?.id], data);
    },
  });

  // Should show: finished + not yet notified
  const shouldShow =
    isDoorboost &&
    record?.status === "finished" &&
    record?.user_click_notified === false;

  const metadata = record?.metadata as
    | { campaigns: boolean; leads: boolean; users: string[] }
    | undefined;

  const handleGoToAds = () => {
    setClosing(true);
    markMutation.mutate();
    setTimeout(() => navigate("/social-ads"), 350);
  };

  const handleDismiss = () => {
    setClosing(true);
    markMutation.mutate();
  };

  if (!shouldShow) return null;

  return (
    <>
      <style>{`
        @keyframes scm-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scm-modal-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scm-modal-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        @keyframes scm-confetti {
          0%   { opacity: 0; transform: translateY(10px) scale(0.5); }
          40%  { opacity: 1; transform: translateY(-8px) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scm-pulse {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.8); opacity: 0; }
        }
        @keyframes scm-shine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 9998,
          animation: closing
            ? "scm-backdrop-in 0.35s ease reverse forwards"
            : "scm-backdrop-in 0.35s ease forwards",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 480,
            background: "#0e0e12",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 50px 120px rgba(0,0,0,0.8), 0 0 80px rgba(245,158,11,0.06)",
            overflow: "hidden",
            animation: closing
              ? "scm-modal-out 0.35s cubic-bezier(.22,.68,0,1.2) forwards"
              : "scm-modal-in 0.45s cubic-bezier(.22,.68,0,1.2) forwards",
          }}
        >
          {/* Content */}
          <div
            style={{
              position: "relative",
              padding: "44px 40px 36px",
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            {/* Ambient glow */}
            <div
              style={{
                position: "absolute",
                top: -60,
                left: "50%",
                transform: "translateX(-50%)",
                width: 350,
                height: 250,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Success icon */}
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(245,158,11,0.15))",
                  border: "1px solid rgba(16,185,129,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  boxShadow: "0 0 40px rgba(16,185,129,0.12)",
                  animation: "scm-confetti 0.6s cubic-bezier(.22,.68,0,1.2) forwards",
                }}
              >
                ✓
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: 28,
                  border: "1px solid rgba(16,185,129,0.25)",
                  animation: "scm-pulse 2s ease-out infinite",
                }}
              />
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 28,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                margin: "0 0 8px",
              }}
            >
              {t("historicalData.completeTitle")}
            </h2>
            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 14,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.6,
                margin: "0 0 28px",
                maxWidth: 340,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {t("historicalData.completeDescription")}
            </p>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginBottom: 32,
              }}
            >
              <StatCard
                icon={<TrendingUp style={{ width: 16, height: 16 }} />}
                label={t("historicalData.stepCampaigns")}
                color="#f59e0b"
                delay="0.15s"
              />
              {metadata?.leads && (
                <StatCard
                  icon={<FileText style={{ width: 16, height: 16 }} />}
                  label={t("historicalData.stepLeads")}
                  color="#10b981"
                  delay="0.25s"
                />
              )}
              {(metadata?.users?.length ?? 0) > 0 && (
                <StatCard
                  icon={<Users style={{ width: 16, height: 16 }} />}
                  label={t("historicalData.stepUsers")}
                  color="#6366f1"
                  delay="0.35s"
                />
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleGoToAds}
              style={{
                position: "relative",
                overflow: "hidden",
                height: 48,
                paddingInline: 32,
                borderRadius: 12,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                color: "#000",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 28px rgba(245,158,11,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 20px rgba(245,158,11,0.35)";
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
                  backgroundSize: "200% auto",
                  animation: "scm-shine 2.5s linear infinite",
                  borderRadius: "inherit",
                }}
              />
              <span style={{ position: "relative" }}>
                {t("historicalData.completeGoToAds")}
              </span>
              <ArrowRight style={{ width: 16, height: 16, position: "relative" }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  delay: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "12px 16px",
        borderRadius: 12,
        background: `${color}10`,
        border: `1px solid ${color}20`,
        minWidth: 80,
        opacity: 0,
        animation: `scm-confetti 0.5s cubic-bezier(.22,.68,0,1.2) ${delay} forwards`,
      }}
    >
      <span style={{ color }}>{icon}</span>
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
