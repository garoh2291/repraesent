import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  getDoorboostEligibility,
  previewCounts,
  previewUsers,
  submitDoorboostRestore,
  type DoorboostEligibility,
  type DoorboostUser,
  type RetailerCounts,
} from "~/lib/api/doorboost-restore";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";
import { useAuthContext } from "~/providers/auth-provider";

// "attribution" was removed: the current user is always used as the note
// fallback (the backend already handles unmatched authors that way), so
// surfacing the choice would just be noise.
type Step = "name" | "scope" | "users" | "confirm";
const STEPS: Step[] = ["name", "scope", "users", "confirm"];

export default function OnboardingDoorboostRestore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refetchAuth } = useAuthContext();

  const [step, setStep] = useState<Step>("name");
  const [workspaceName, setWorkspaceName] = useState("");
  const [importCampaigns, setImportCampaigns] = useState(true);
  const [importLeads, setImportLeads] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [notifyUsers, setNotifyUsers] = useState(true);

  const { data: eligibility, isLoading: eligLoading } =
    useQuery<DoorboostEligibility>({
      queryKey: ["doorboost-eligibility"],
      queryFn: getDoorboostEligibility,
      // Pin the eligibility once the wizard has it. Without this, any
      // background refetch (focus, reconnect, navigation) can briefly drop
      // the cached value and the redirect-on-not-eligible effect below would
      // unmount the wizard mid-flow — which is exactly the "state crash"
      // the user reported when going forward then back.
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });

  // Eligibility expired or already restored → bounce back. Ref-guarded so
  // we never redirect twice during the same session.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (
      !eligLoading &&
      eligibility &&
      !eligibility.eligible &&
      !redirectedRef.current
    ) {
      redirectedRef.current = true;
      navigate("/onboarding/workspace", { replace: true });
    }
  }, [eligLoading, eligibility, navigate]);

  // Prefill workspace name from retailer name once.
  useEffect(() => {
    if (eligibility?.retailer?.name && !workspaceName) {
      setWorkspaceName(eligibility.retailer.name);
    }
  }, [eligibility, workspaceName]);

  const retailerId = eligibility?.retailer?.id ?? null;

  const { data: counts } = useQuery<RetailerCounts>({
    queryKey: ["doorboost-restore-counts", retailerId],
    queryFn: () => previewCounts(retailerId!),
    enabled: !!retailerId,
    staleTime: 5 * 60_000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<
    DoorboostUser[]
  >({
    queryKey: ["doorboost-restore-users", retailerId, user?.email],
    queryFn: () => previewUsers(retailerId!, user?.email),
    // Keep the query mounted once we've fetched it. `step === 'users'` would
    // unmount/remount on every back-nav, dropping the previous list and
    // making the checkbox state look like it crashed. Pinning the query
    // means the second visit is instant from cache.
    enabled: !!retailerId,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitDoorboostRestore({
        workspace_name: workspaceName.trim(),
        retailer_id: retailerId!,
        campaigns: importCampaigns,
        leads: importLeads,
        users: selectedUserIds,
        notify_users: notifyUsers,
        // No fallback_note_user: backend treats unmatched note authors as
        // the current user (workspace owner) by default.
      }),
    onSuccess: ({ workspace_id }) => {
      setStoredWorkspaceId(workspace_id);
      refetchAuth();
      navigate("/onboarding/sync-pending", { replace: true });
    },
  });

  // Synthetic "me" row prepended to the users list. The current user is
  // always the workspace owner — we surface them disabled+checked so the
  // wizard reads as "you, plus optional teammates" instead of an empty list
  // when the doorboost workspace has no other users.
  // NB: this hook MUST sit above the early-return below; otherwise React
  // sees a different hook count between the loading and loaded renders
  // ("Rendered more hooks than during the previous render").
  const meRow = useMemo<DoorboostUser | null>(() => {
    if (!user?.email) return null;
    return {
      id: user.id || `__me__${user.email}`,
      email: user.email,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
    };
  }, [user]);

  if (eligLoading || !eligibility?.eligible) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stepIdx = STEPS.indexOf(step);
  const canBack = stepIdx > 0;
  const canForward = (() => {
    if (step === "name") return workspaceName.trim().length > 0;
    if (step === "scope") return importCampaigns || importLeads;
    if (step === "users") return true;
    return false;
  })();

  function next() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }
  function back() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  return (
    <div className="min-h-[80vh] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/onboarding/doorboost-choice")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />{" "}
          {t("doorboost_restore.wizard_back", "Back")}
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                i <= stepIdx
                  ? "w-8 bg-amber-500"
                  : "w-4 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6">
          <header className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-400/10 text-amber-500 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">
                {t(
                  "doorboost_restore.wizard_title",
                  "Restore from Doorboost",
                )}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {eligibility.retailer?.name} ·{" "}
                <span className="font-mono">{retailerId}</span>
              </p>
            </div>
          </header>

          {/* STEP: name */}
          {step === "name" && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                {t("doorboost_restore.wizard_step_name", "Name your workspace")}
              </h2>
              <div className="space-y-2">
                <Label>
                  {t(
                    "doorboost_restore.wizard_workspace_name_label",
                    "Workspace name",
                  )}
                </Label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={eligibility.retailer?.name}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    "doorboost_restore.wizard_workspace_name_help",
                    "We pre-filled this with your retailer name. Edit if you'd like.",
                  )}
                </p>
              </div>
            </div>
          )}

          {/* STEP: scope */}
          {step === "scope" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {t("doorboost_restore.wizard_step_campaigns", "Campaigns") +
                  " & " +
                  t("doorboost_restore.wizard_step_leads", "Leads")}
              </h2>
              <ScopeRow
                label={t(
                  "doorboost_restore.wizard_step_campaigns",
                  "Campaigns",
                )}
                caption={
                  counts?.campaigns == null
                    ? "…"
                    : t("doorboost_restore.scope_available", {
                        count: counts.campaigns,
                        defaultValue: "{{count}} available in Doorboost",
                      })
                }
                checked={importCampaigns}
                onChange={setImportCampaigns}
                Icon={Megaphone}
              />
              <ScopeRow
                label={t("doorboost_restore.wizard_step_leads", "Leads")}
                caption={
                  counts?.leads == null
                    ? "…"
                    : t("doorboost_restore.scope_available", {
                        count: counts.leads,
                        defaultValue: "{{count}} available in Doorboost",
                      })
                }
                checked={importLeads}
                onChange={setImportLeads}
                Icon={Users}
              />
            </div>
          )}

          {/* STEP: users */}
          {step === "users" && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                {t("doorboost_restore.wizard_step_users", "Users")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "doorboost_restore.wizard_users_help",
                  "Pick teammates to add to your workspace. We'll send each a magic-link invitation.",
                )}
              </p>

              {usersLoading && users.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-md bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <ul className="divide-y">
                    {meRow && (
                      <li
                        key={meRow.id}
                        className="flex items-center gap-3 px-3 py-2 bg-muted/20"
                      >
                        <input
                          type="checkbox"
                          checked
                          disabled
                          readOnly
                          aria-label={t(
                            "doorboost_restore.wizard_users_you_label",
                            "You (workspace owner — required)",
                          )}
                          className="w-4 h-4 opacity-60 cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            <span className="truncate">
                              {meRow.first_name} {meRow.last_name}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-amber-400/15 text-amber-600 px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold">
                              {t("doorboost_restore.wizard_users_you", "You")}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {meRow.email}
                          </div>
                        </div>
                      </li>
                    )}
                    {users.length === 0 && !meRow ? (
                      <li className="px-3 py-3 text-sm text-muted-foreground">
                        {t(
                          "doorboost_restore.wizard_users_none",
                          "No teammates found in your Doorboost workspace.",
                        )}
                      </li>
                    ) : (
                      users.map((u) => {
                        const checked = selectedUserIds.includes(u.id);
                        return (
                          <li
                            key={u.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                          >
                            <input
                              type="checkbox"
                              id={`u-${u.id}`}
                              checked={checked}
                              onChange={(e) => {
                                setSelectedUserIds((prev) =>
                                  e.target.checked
                                    ? [...prev, u.id]
                                    : prev.filter((x) => x !== u.id),
                                );
                              }}
                              className="w-4 h-4"
                            />
                            <label
                              htmlFor={`u-${u.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="text-sm font-medium">
                                {u.first_name} {u.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            </label>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              )}

              {users.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Label
                    htmlFor="notify-users"
                    className="text-sm cursor-pointer flex-1"
                  >
                    {t(
                      "doorboost_restore.wizard_send_invites",
                      "Send invitation emails immediately",
                    )}
                  </Label>
                  <Switch
                    id="notify-users"
                    checked={notifyUsers}
                    onCheckedChange={setNotifyUsers}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP: confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {t("doorboost_restore.wizard_step_confirm", "Confirm")}
              </h2>
              <ul className="space-y-2 text-sm">
                <SummaryRow
                  label={t(
                    "doorboost_restore.summary_workspace_name",
                    "Workspace name",
                  )}
                  value={workspaceName}
                />
                <SummaryRow
                  label={t("doorboost_restore.summary_campaigns", "Campaigns")}
                  value={
                    importCampaigns
                      ? t("doorboost_restore.summary_import_count", {
                          value: counts?.campaigns ?? "—",
                          defaultValue: "Import ({{value}})",
                        })
                      : t("doorboost_restore.summary_skip", "Skip")
                  }
                />
                <SummaryRow
                  label={t("doorboost_restore.summary_leads", "Leads")}
                  value={
                    importLeads
                      ? t("doorboost_restore.summary_import_count", {
                          value: counts?.leads ?? "—",
                          defaultValue: "Import ({{value}})",
                        })
                      : t("doorboost_restore.summary_skip", "Skip")
                  }
                />
                <SummaryRow
                  label={t("doorboost_restore.summary_users", "Users")}
                  value={
                    selectedUserIds.length > 0
                      ? `${t("doorboost_restore.summary_users_selected", {
                          count: selectedUserIds.length,
                          defaultValue: "{{count}} selected",
                        })}${
                          notifyUsers
                            ? ` · ${t(
                                "doorboost_restore.summary_invites_on",
                                "invites on",
                              )}`
                            : ""
                        }`
                      : t("doorboost_restore.summary_none", "None")
                  }
                />
              </ul>
              {submitMutation.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {(submitMutation.error as Error)?.message ??
                    t(
                      "doorboost_restore.submit_failed",
                      "Submission failed",
                    )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={back}
              disabled={!canBack || submitMutation.isPending}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />{" "}
              {t("doorboost_restore.wizard_back", "Back")}
            </Button>

            {step === "confirm" ? (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="bg-amber-500 hover:bg-amber-500/90 text-amber-950"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {t("doorboost_restore.wizard_submit", "Start restore")}
              </Button>
            ) : (
              <Button onClick={next} disabled={!canForward}>
                {t("doorboost_restore.wizard_next", "Next")}{" "}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScopeRow({
  label,
  caption,
  checked,
  onChange,
  Icon,
}: {
  label: string;
  caption: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  Icon: typeof Users;
}) {
  return (
    <label className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 transition-colors">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-muted text-muted-foreground shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {caption}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b last:border-0 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </li>
  );
}
