import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  X,
  AlertTriangle,
  Megaphone,
  UserRound,
  Layers,
} from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getHistoricalData,
  createHistoricalData,
  getHistoricalDataCounts,
} from "~/lib/api/historical-data";

/* ── Localised copy ── */
const COPY = {
  en: {
    badge: "Data Migration",
    title: "Your Doorboost data\nis ready to import",
    description:
      "All your historical campaigns, leads, and team members are waiting. One sync brings everything into Repraesent — nothing gets left behind.",
    pendingTitle: "Syncing your Doorboost data",
    pendingDesc:
      "Campaigns, leads and team members are being transferred. This may take a few minutes.",
    resumeTitle: "Continue your data migration",
    resumeDesc:
      "You started the setup — finish it to bring all your data across.",
    ctaStart: "Start migration",
    ctaResume: "Continue setup",
    ctaDismiss: "Skip",
    statCampaigns: "Campaigns",
    statLeads: "Leads",
    statUsers: "Team members",
    statLoading: "—",
    inProgress: "In progress",
    // Modal
    modalTitle: "Skip data migration?",
    modalSubtitle: "You will permanently lose access to:",
    modalCampaigns: (n: number) => `${n} campaign${n !== 1 ? "s" : ""}`,
    modalLeads: (n: number) => `${n} lead${n !== 1 ? "s" : ""}`,
    modalUsers: (n: number) => `${n} team member${n !== 1 ? "s" : ""}`,
    modalWarning:
      "This action cannot be undone. Your Doorboost data will not be imported.",
    modalConfirm: "Yes, skip migration",
    modalCancel: "Cancel",
  },
  de: {
    badge: "Datenmigration",
    title: "Deine Doorboost-Daten\nwarten auf den Import",
    description:
      "Alle historischen Kampagnen, Leads und Teammitglieder sind bereit. Eine Synchronisierung bringt alles in Repraesent — nichts geht verloren.",
    pendingTitle: "Deine Doorboost-Daten werden synchronisiert",
    pendingDesc:
      "Kampagnen, Leads und Teammitglieder werden übertragen. Das kann einige Minuten dauern.",
    resumeTitle: "Datenmigration fortsetzen",
    resumeDesc:
      "Du hast die Einrichtung begonnen — schließe sie ab, um alle Daten zu übertragen.",
    ctaStart: "Migration starten",
    ctaResume: "Einrichtung fortsetzen",
    ctaDismiss: "Überspringen",
    statCampaigns: "Kampagnen",
    statLeads: "Leads",
    statUsers: "Teammitglieder",
    statLoading: "—",
    inProgress: "Läuft",
    // Modal
    modalTitle: "Migration überspringen?",
    modalSubtitle: "Du verlierst dauerhaft den Zugriff auf:",
    modalCampaigns: (n: number) => `${n} Kampagne${n !== 1 ? "n" : ""}`,
    modalLeads: (n: number) => `${n} Lead${n !== 1 ? "s" : ""}`,
    modalUsers: (n: number) => `${n} Teammitglied${n !== 1 ? "er" : ""}`,
    modalWarning:
      "Diese Aktion kann nicht rückgängig gemacht werden. Deine Doorboost-Daten werden nicht importiert.",
    modalConfirm: "Ja, Migration überspringen",
    modalCancel: "Abbrechen",
  },
} as const;

/* ── Animated pulse icon ── */
function PulseIcon({ syncing }: { syncing: boolean }) {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <span
        className="absolute inset-0 rounded-full border border-amber-500/25"
        style={{ animation: "db-pulse 2.2s ease-out infinite" }}
      />
      <span
        className="absolute inset-[-10px] rounded-full border border-amber-500/10"
        style={{ animation: "db-pulse 2.2s ease-out 0.7s infinite" }}
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
        <svg
          width="24"
          height="24"
          viewBox="0 0 20 20"
          fill="none"
          className={syncing ? "text-amber-400" : "text-amber-500"}
          style={
            syncing ? { animation: "db-spin 2s linear infinite" } : undefined
          }
        >
          {syncing ? (
            <circle
              cx="10"
              cy="10"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="22 22"
            />
          ) : (
            <>
              <ellipse
                cx="10"
                cy="6"
                rx="7"
                ry="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M3 6v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M3 10v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>
      </span>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({
  icon,
  label,
  value,
  loading,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  delay: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 14,
        padding: "14px 16px",
        background: "rgba(245,158,11,0.04)",
        border: "1px solid rgba(245,158,11,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        animation: "db-chip-in 0.5s ease both",
        animationDelay: `${delay}s`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            color: "rgba(245,158,11,0.55)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(245,158,11,0.55)",
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: loading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.92)",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          transition: "color 0.3s ease",
        }}
      >
        {loading ? "—" : (value?.toLocaleString() ?? "—")}
      </span>
    </div>
  );
}

/* ── Dismiss confirmation modal ── */
function DismissModal({
  campaignCount,
  leadCount,
  userCount,
  onConfirm,
  onCancel,
  isPending,
  copy,
}: {
  campaignCount: number | undefined;
  leadCount: number | undefined;
  userCount: number | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  copy: (typeof COPY)["en"] | (typeof COPY)["de"];
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "db-chip-in 0.2s ease both",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "linear-gradient(145deg, #111116 0%, #0c0c10 100%)",
          border: "1px solid rgba(245,158,11,0.22)",
          borderRadius: 22,
          padding: "28px 28px 24px",
          maxWidth: 420,
          width: "100%",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          animation: "db-modal-in 0.25s cubic-bezier(.22,.68,0,1.2) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top shimmer line */}
        <div
          style={{
            height: 1,
            marginBottom: 24,
            background:
              "linear-gradient(90deg, transparent, rgba(245,158,11,0.5) 50%, transparent)",
            marginTop: -28,
            marginLeft: -28,
            marginRight: -28,
            borderRadius: "22px 22px 0 0",
          }}
        />

        {/* Warning icon */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} style={{ color: "rgba(239,68,68,0.9)" }} />
          </div>
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
                marginBottom: 4,
                lineHeight: 1.3,
              }}
            >
              {copy.modalTitle}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.5,
              }}
            >
              {copy.modalSubtitle}
            </p>
          </div>
        </div>

        {/* Loss list */}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.12)",
            background: "rgba(239,68,68,0.05)",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            {
              icon: <Megaphone size={13} />,
              text:
                campaignCount !== undefined
                  ? copy.modalCampaigns(campaignCount)
                  : copy.statLoading,
            },
            {
              icon: <UserRound size={13} />,
              text:
                leadCount !== undefined
                  ? copy.modalLeads(leadCount)
                  : copy.statLoading,
            },
            {
              icon: <Layers size={13} />,
              text:
                userCount !== undefined
                  ? copy.modalUsers(userCount)
                  : copy.statLoading,
            },
          ].map(({ icon, text }, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ color: "rgba(239,68,68,0.6)", display: "flex" }}>
                {icon}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Warning text */}
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {copy.modalWarning}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.65)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.85)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.color = "rgba(255,255,255,0.65)";
            }}
          >
            {copy.modalCancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1.6,
              height: 40,
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.25)",
              background: "rgba(239,68,68,0.12)",
              color: "rgba(239,68,68,0.9)",
              fontSize: 12,
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isPending) {
                e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                e.currentTarget.style.color = "rgba(239,68,68,1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.12)";
              e.currentTarget.style.color = "rgba(239,68,68,0.9)";
            }}
          >
            {copy.modalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function DoorboostHomeSection() {
  const { i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lang: "en" | "de" = i18n.language?.startsWith("de") ? "de" : "en";
  const copy = COPY[lang];

  const [showDismissModal, setShowDismissModal] = useState(false);

  const isDoorboost =
    currentWorkspace?.was_doorboost_client === true &&
    !!currentWorkspace?.doorboost_partner_house_id;

  const { data: record, isLoading } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: isDoorboost,
    refetchInterval: isDoorboost ? 15_000 : false,
  });

  console.log("isDoorboost", isDoorboost, {
    was_doorboost_client: currentWorkspace?.was_doorboost_client,
    doorboost_partner_house_id: currentWorkspace?.doorboost_partner_house_id,
  });

  console.log("record", record);

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["historical-data-counts", currentWorkspace?.id],
    queryFn: getHistoricalDataCounts,
    enabled: isDoorboost,
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createHistoricalData,
    onSuccess: (data) => {
      queryClient.setQueryData(["historical-data", currentWorkspace?.id], data);
      if (data.status === "not_ready") navigate("/sync");
    },
  });

  if (!isDoorboost || isLoading) return null;
  if (
    record?.status === "finished" ||
    record?.status === "failed" ||
    record?.status === "ignored"
  )
    return null;

  const isSyncing =
    record?.status === "not_synced" || record?.status === "pending";
  const isResuming = record?.status === "not_ready";

  const title = isSyncing
    ? copy.pendingTitle
    : isResuming
      ? copy.resumeTitle
      : copy.title;
  const description = isSyncing
    ? copy.pendingDesc
    : isResuming
      ? copy.resumeDesc
      : copy.description;

  const campaignCount = counts?.campaigns;
  const leadCount = counts?.leads;
  const userCount = counts?.users;

  return (
    <>
      <style>{`
        @keyframes db-pulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes db-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes db-chip-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes db-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes db-modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .db-section-in {
          animation: db-chip-in 0.5s cubic-bezier(.22,.68,0,1.2) both;
        }
        .db-cta-btn:hover {
          box-shadow: 0 6px 24px rgba(245,158,11,0.5) !important;
          transform: scale(1.03) !important;
        }
        .db-cta-btn:active {
          transform: scale(0.98) !important;
        }
        .db-dismiss-btn:hover {
          color: rgba(255,255,255,0.6) !important;
          background: rgba(255,255,255,0.07) !important;
        }
      `}</style>

      {showDismissModal && (
        <DismissModal
          campaignCount={campaignCount}
          leadCount={leadCount}
          userCount={userCount}
          onConfirm={() => {
            createMutation.mutate("ignored");
            setShowDismissModal(false);
          }}
          onCancel={() => setShowDismissModal(false)}
          isPending={createMutation.isPending}
          copy={copy}
        />
      )}

      <div
        className="db-section-in rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(140deg, #0e0e13 0%, #0f0f15 55%, #0a0a0e 100%)",
          border: "1px solid rgba(245,158,11,0.15)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.45), 0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Amber shimmer top line */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.4) 35%, rgba(245,158,11,0.85) 50%, rgba(245,158,11,0.4) 65%, transparent 100%)",
            backgroundSize: "200% auto",
            animation: "db-shimmer 3.5s linear infinite",
          }}
        />

        <div className="px-5 sm:px-6 pt-5 pb-5">
          {/* Header row */}
          <div className="flex items-start gap-4">
            <PulseIcon syncing={isSyncing} />

            <div className="flex-1 min-w-0">
              {/* Badge */}
              <span
                className="inline-flex items-center mb-2"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: 99,
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  color: "#f59e0b",
                }}
              >
                {copy.badge}
              </span>

              {/* Title */}
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.3,
                  whiteSpace: "pre-line",
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </p>

              {/* Description */}
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.65,
                  maxWidth: 520,
                }}
              >
                {description}
              </p>
            </div>

            {/* Dismiss / syncing indicator — top right */}
            {!isSyncing ? (
              !isResuming && (
                <button
                  className="db-dismiss-btn"
                  onClick={() => setShowDismissModal(true)}
                  disabled={createMutation.isPending}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  title={copy.ctaDismiss}
                >
                  <X size={14} />
                </button>
              )
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(245,158,11,0.65)",
                  paddingTop: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.85)",
                    flexShrink: 0,
                    animation: "db-pulse 1.6s ease-out infinite",
                  }}
                />
                {copy.inProgress}
              </div>
            )}
          </div>

          {/* Stat cards — only when not syncing */}
          {!isSyncing && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <StatCard
                icon={<Megaphone size={12} />}
                label={copy.statCampaigns}
                value={campaignCount}
                loading={countsLoading}
                delay={0.05}
              />
              <StatCard
                icon={<UserRound size={12} />}
                label={copy.statLeads}
                value={leadCount}
                loading={countsLoading}
                delay={0.1}
              />
              <StatCard
                icon={<Layers size={12} />}
                label={copy.statUsers}
                value={userCount}
                loading={countsLoading}
                delay={0.15}
              />
            </div>
          )}

          {/* CTA button */}
          {!isSyncing && (
            <div style={{ marginTop: 18 }}>
              <button
                className="db-cta-btn"
                onClick={() =>
                  isResuming
                    ? navigate("/sync")
                    : createMutation.mutate("not_ready")
                }
                disabled={createMutation.isPending}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 40,
                  borderRadius: 12,
                  paddingLeft: 20,
                  paddingRight: 18,
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#000",
                  border: "none",
                  cursor: createMutation.isPending ? "not-allowed" : "pointer",
                  boxShadow: "0 3px 14px rgba(245,158,11,0.35)",
                  transition: "box-shadow 0.2s ease, transform 0.15s ease",
                  opacity: createMutation.isPending ? 0.7 : 1,
                }}
              >
                {/* Shine sweep */}
                <span
                  style={{
                    pointerEvents: "none",
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.22) 50%, transparent 62%)",
                    backgroundSize: "200% auto",
                    animation: "db-shimmer 2.8s linear infinite",
                  }}
                />
                <span style={{ position: "relative" }}>
                  {isResuming ? copy.ctaResume : copy.ctaStart}
                </span>
                <ArrowRight size={14} style={{ position: "relative" }} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom accent */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(245,158,11,0.07), transparent)",
          }}
        />
      </div>
    </>
  );
}
