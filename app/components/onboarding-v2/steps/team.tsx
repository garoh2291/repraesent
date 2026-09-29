"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AtSign, Globe, Loader2, Mail, MailX, Plus, X } from "lucide-react";
import {
  detectDomain,
  NOTIFICATION_KEYS,
  type DomainDetectResult,
  saveInvites,
  type Invite,
  type NotificationKey,
} from "~/lib/api/onboarding-v2";
import { displayHost, EMAIL_RE, PROFILE_ENUMS, suggestEmail } from "~/lib/onboarding/helpers";
import { cn } from "~/lib/utils";
import {
  ActionBar,
  ChipQuestion,
  ChoiceCard,
  ChoiceGroup,
  Field,
  FormError,
  inputCls,
  SelectInput,
  Segmented,
  SkipLink,
  StepHeading,
  TextInput,
} from "../primitives";
import { useWizard } from "../wizard-context";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

// ── Email ────────────────────────────────────────────────────────────────────

export function StepEmail() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const current = state?.profile?.data?.email_setup?.provider as string | undefined;
  const domainGuess =
    (state?.profile?.data?.email_setup?.domain as string | undefined) ?? displayHost(state?.workspace?.website);
  const [picked, setPicked] = useState<string | null>(current ?? null);

  // Picking only selects (people change their mind); Continue saves and moves on.
  const submit = () => {
    if (!picked) return;
    void save({
      step: "email",
      profile: {
        email_setup: {
          provider: picked,
          has_business_email: picked !== "none",
          domain: picked !== "none" && domainGuess ? domainGuess : null,
        },
      },
    });
  };

  return (
    <div>
      <StepHeading title={t("onb.email.title")} sub={t("onb.email.sub")} />
      <ChoiceGroup label={t("onb.email.title")}>
        <ChoiceCard selected={picked === "google_workspace"} onSelect={() => setPicked("google_workspace")} icon={<GoogleMark />} title="Google Workspace" description={t("onb.email.google")} />
        <ChoiceCard selected={picked === "microsoft_365"} onSelect={() => setPicked("microsoft_365")} icon={<MicrosoftMark />} title="Microsoft 365" description={t("onb.email.microsoft")} />
        <ChoiceCard selected={picked === "other"} onSelect={() => setPicked("other")} icon={<AtSign className="size-4" />} title={t("onb.email.other")} description={t("onb.email.otherDesc")} />
        <ChoiceCard selected={picked === "none"} onSelect={() => setPicked("none")} icon={<MailX className="size-4" />} title={t("onb.email.none")} description={t("onb.email.noneDesc")} />
      </ChoiceGroup>
      <p className="mt-4 text-[13px] text-muted-foreground">{t("onb.email.later")}</p>
      <ActionBar onBack={back} busy={saving} primaryType="button" primaryLabel={t("onb.continue")} primaryDisabled={!picked} onPrimary={submit} />
    </div>
  );
}

// ── Domain ───────────────────────────────────────────────────────────────────

/**
 * Where their domain lives and who can touch it — what our team needs to plan
 * a move. The registrar is looked up on the server (registry RDAP, then the
 * nameservers) and pre-selected; the customer only confirms. Every question
 * has "Not sure", and the whole step is optional.
 */
export function StepDomain() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const d = (state?.profile?.data?.domain ?? {}) as Record<string, string | undefined>;
  const knownDomain = d.name || displayHost(state?.workspace?.website).replace(/^www\./, "") || (state?.profile?.data?.email_setup?.domain as string | undefined) || null;
  const [detected, setDetected] = useState<DomainDetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [typed, setTyped] = useState(knownDomain ?? "");
  const [registrar, setRegistrar] = useState<string>(d.registrar ?? "");
  const [transfer, setTransfer] = useState<string | null>(d.transfer ?? null);
  const [login, setLogin] = useState<string | null>(d.login_access ?? null);
  const [caretaker, setCaretaker] = useState<string | null>(d.site_caretaker ?? null);
  const [contract, setContract] = useState<string | null>(d.hosting_contract ?? null);
  const asked = useRef<string | null>(null);

  const run = async (domain?: string) => {
    const key = domain ?? knownDomain ?? "";
    if (!key || asked.current === key) return;
    asked.current = key;
    setDetecting(true);
    try {
      const res = await detectDomain(domain);
      setDetected(res);
      // Pre-select what we found, never over an answer they already gave.
      setRegistrar((cur) => cur || res.registrar || (res.registrar_name ? "other" : ""));
    } catch {
      setDetected(null);
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (knownDomain) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const domain = detected?.domain ?? knownDomain;
  const registrarLabel = (key: string) => t(`onb.domain.registrars.${key}`);
  const foundText = detected
    ? detected.registrar_source === "rdap" && detected.registrar_name
      ? t("onb.domain.foundRegistrar", { name: detected.registrar_name })
      : detected.registrar_source === "nameservers" && detected.registrar
        ? t("onb.domain.foundDns", { name: registrarLabel(detected.registrar) })
        : detected.dns_host
          ? t("onb.domain.foundDnsHost", { name: detected.dns_host })
          : t("onb.domain.foundNothing")
    : null;
  const opts = (key: keyof typeof PROFILE_ENUMS, prefix: string) =>
    (PROFILE_ENUMS[key] as readonly string[]).map((v) => ({ value: v, label: t(`onb.domain.${prefix}.${v}`) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({
      step: "domain",
      profile: {
        domain: {
          ...(knownDomain ? {} : typed.trim() ? { name: typed.trim().toLowerCase() } : {}),
          registrar: registrar || null,
          transfer,
          login_access: login,
          site_caretaker: caretaker,
          hosting_contract: contract,
        },
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.domain.title")} sub={t("onb.domain.sub")} />

      {knownDomain ? (
        <div className="mb-9 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70" aria-hidden>
            <Globe className="size-5" />
          </span>
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="truncate text-[15px] font-semibold">{domain}</p>
            {detecting ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> {t("onb.domain.checking")}
              </p>
            ) : foundText ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{foundText}</p>
            ) : null}
          </div>
          {detected?.registrar || detected?.registrar_name ? (
            <span className="shrink-0 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {t("onb.domain.detected")}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mb-9">
          <Field label={t("onb.domain.nameLabel")} hint={t("onb.domain.nameHint")} optional>
            {(a) => (
              <TextInput
                id={a.id}
                aria-describedby={a.describedBy}
                inputMode="url"
                autoComplete="off"
                placeholder={t("onb.website.placeholder")}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onBlur={() => typed.trim().includes(".") && void run(typed.trim())}
              />
            )}
          </Field>
        </div>
      )}

      <div className="space-y-9">
        <Field label={t("onb.domain.registrarQ")} hint={detected?.registrar_name && !detected.registrar ? t("onb.domain.registryCalls", { name: detected.registrar_name }) : undefined}>
          {(a) => (
            <SelectInput id={a.id} aria-describedby={a.describedBy} value={registrar} onChange={(e) => setRegistrar(e.target.value)}>
              <option value="">{t("onb.choose")}</option>
              {(PROFILE_ENUMS.registrar as readonly string[]).map((k) => (
                <option key={k} value={k}>
                  {registrarLabel(k)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <ChipQuestion label={t("onb.domain.transfer.q")} hint={t("onb.domain.transfer.hint")} value={transfer} options={opts("domainTransfer", "transfer")} onChange={setTransfer} />
        <ChipQuestion label={t("onb.domain.login.q")} value={login} options={opts("loginAccess", "login")} onChange={setLogin} />
        <ChipQuestion label={t("onb.domain.caretaker.q")} value={caretaker} options={opts("siteCaretaker", "caretaker")} onChange={setCaretaker} />
        {caretaker && caretaker !== "care_nobody" ? (
          <ChipQuestion label={t("onb.domain.contract.q")} hint={t("onb.domain.contract.hint")} value={contract} options={opts("hostingContract", "contract")} onChange={setContract} />
        ) : null}
      </div>
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} />
    </form>
  );
}

// ── Team ─────────────────────────────────────────────────────────────────────

export function StepTeam() {
  const { t } = useTranslation();
  const { state, save, saving, back, setState } = useWizard();
  const me = state?.user.email ?? "";
  const [rows, setRows] = useState<Invite[]>(() =>
    state?.run?.invites?.length ? state.run.invites : [{ email: "", role: "editor" }],
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Invite>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad: Record<number, string> = {};
    const clean: Invite[] = [];
    rows.forEach((r, i) => {
      const email = r.email.trim().toLowerCase();
      if (!email) return;
      if (!EMAIL_RE.test(email)) bad[i] = t("onb.fieldErrors.invalid_email");
      else if (email === me.toLowerCase()) bad[i] = t("onb.team.self");
      else clean.push({ email, role: r.role });
    });
    if (Object.keys(bad).length) {
      setErrors(bad);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      setState(await saveInvites(clean));
      await save({ step: "team", skipped: clean.length === 0 });
    } catch {
      setFormError(t("onb.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.team.title")} sub={t("onb.team.sub")} />
      <div className="space-y-3">
        {rows.map((r, i) => {
          const suggestion = suggestEmail(r.email);
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    aria-label={t("onb.team.emailLabel", { n: i + 1 })}
                    aria-invalid={!!errors[i] || undefined}
                    value={r.email}
                    placeholder={t("onb.team.placeholder")}
                    onChange={(e) => {
                      setRow(i, { email: e.target.value });
                      setErrors((x) => ({ ...x, [i]: "" }));
                    }}
                    className={cn(inputCls, "pl-9")}
                  />
                </div>
                <SelectInput wrapperClassName="shrink-0" aria-label={t("onb.team.roleLabel")} value={r.role} onChange={(e) => setRow(i, { role: e.target.value as Invite["role"] })} className="w-auto">
                  {(["editor", "admin", "viewer"] as const).map((role) => (
                    <option key={role} value={role}>
                      {t(`onb.team.roles.${role}`)}
                    </option>
                  ))}
                </SelectInput>
                {rows.length > 1 ? (
                  <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={t("onb.remove", { item: r.email || "" })} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              {errors[i] ? (
                <p className="text-[13px] font-medium text-destructive">{errors[i]}</p>
              ) : suggestion ? (
                <button type="button" className="text-[13px] font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground" onClick={() => setRow(i, { email: suggestion })}>
                  {t("onb.didYouMean", { email: suggestion })}
                </button>
              ) : null}
            </div>
          );
        })}
        {rows.length < 10 ? (
          <button type="button" onClick={() => setRows((r) => [...r, { email: "", role: "editor" }])} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-foreground/5">
            <Plus className="size-4" /> {t("onb.team.add")}
          </button>
        ) : null}
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">{t("onb.team.whenSent")}</p>
      </div>
      <FormError message={formError} />
      <ActionBar
        onBack={back}
        busy={busy || saving}
        primaryLabel={rows.some((r) => r.email.trim()) ? t("onb.continue") : t("onb.team.alone")}
        secondary={rows.some((r) => r.email.trim()) ? <SkipLink label={t("onb.team.later")} onClick={() => void save({ step: "team", skipped: true })} /> : null}
      />
    </form>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────

export function StepNotifications() {
  const { t } = useTranslation();
  const { state, save, saving, back } = useWizard();
  const saved = state?.run?.answers.notifications;
  const invites = state?.run?.invites ?? [];
  const me = state?.user.email ?? "";
  const [keys, setKeys] = useState<NotificationKey[]>(saved?.keys ?? [...NOTIFICATION_KEYS]);
  const [audience, setAudience] = useState<"all_members" | "selected">(saved?.audience ?? "all_members");
  const [recipients, setRecipients] = useState<string[]>(saved?.recipient_emails?.length ? saved.recipient_emails : [me]);
  const toggle = (k: NotificationKey) => setKeys((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({
      step: "notifications",
      answers: { notifications: { keys, audience, recipient_emails: audience === "selected" ? recipients : [] } },
    });
  };

  const people = [me, ...invites.map((i) => i.email)];

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading title={t("onb.notif.title")} sub={t("onb.notif.sub")} />
      <ChoiceGroup label={t("onb.notif.title")} multi>
        {NOTIFICATION_KEYS.map((k) => (
          <ChoiceCard
            key={k}
            role="checkbox"
            selected={keys.includes(k)}
            onSelect={() => toggle(k)}
            title={t(`onb.notif.kinds.${k}.title`)}
            description={t(`onb.notif.kinds.${k}.desc`)}
          />
        ))}
      </ChoiceGroup>
      <p className="mt-3 text-[13px] text-muted-foreground">{t("onb.notif.instant")}</p>

      {keys.length ? (
        <div className="mt-8 space-y-3">
          <p className="text-[15px] font-medium">{t("onb.notif.who")}</p>
          <Segmented
            label={t("onb.notif.who")}
            value={audience}
            onChange={(v) => setAudience(v)}
            options={[
              { value: "all_members", label: t("onb.notif.everyone") },
              { value: "selected", label: t("onb.notif.pick") },
            ]}
          />
          {audience === "selected" ? (
            <div className="space-y-2">
              {people.map((p) => (
                <label key={p} className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--foreground)] [color-scheme:light]"
                    checked={recipients.includes(p)}
                    onChange={() => setRecipients((r) => (r.includes(p) ? r.filter((x) => x !== p) : [...r, p]))}
                  />
                  <span className="flex-1 truncate">{p}</span>
                  {p === me ? <span className="text-xs text-muted-foreground">{t("onb.notif.you")}</span> : null}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <ActionBar onBack={back} busy={saving} primaryLabel={t("onb.continue")} primaryDisabled={audience === "selected" && keys.length > 0 && recipients.length === 0} />
    </form>
  );
}
