import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";
import {
  getUserContextWithRetry,
  MagicLinkError,
  verifyMagicCode,
} from "~/lib/api/auth";
import { clearStoredToken, setStoredToken } from "~/lib/api/axios-instance";
import { clearOnboardingSession } from "~/lib/onboarding/session-draft";
import { routeAfterAuth } from "~/lib/auth/route-after-auth";

const RESEND_COOLDOWN_S = 30;
const KNOWN_ERRORS = new Set(["CODE_INVALID", "CODE_EXPIRED", "CODE_TOO_MANY", "MAGIC_LINK_INELIGIBLE"]);

const SLOT =
  "num h-12 w-11 rounded-lg border border-stone-300 bg-white text-xl font-semibold text-foreground shadow-none first:rounded-lg last:rounded-lg data-[active=true]:border-foreground data-[active=true]:ring-foreground/15";

/**
 * The 6-digit code from the login email. It is how the installed iPhone app
 * signs in (a home-screen app doesn't share Safari's storage, so the link
 * would open in Safari instead), and it works on the web too.
 */
export function LoginCodeBox({
  email,
  returnUrl,
  onResend,
  onSigningIn,
}: {
  email: string;
  returnUrl: string | null;
  /** Sends a fresh email (same request as the Send button). */
  onResend: () => Promise<void>;
  /** Tells the page a code sign-in owns the redirect from here on. */
  onSigningIn: (active: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const busy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (busy.current || value.length !== 6) return;
    busy.current = true;
    setVerifying(true);
    setError(null);
    setNotice(null);
    onSigningIn(true);
    try {
      const auth = await verifyMagicCode(email, value);
      setStoredToken(auth.access_token);
      // Same clean start as the link: another person may have used this tab.
      clearOnboardingSession();
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      const context = await getUserContextWithRetry();
      routeAfterAuth(context, { navigate, queryClient, redirectParam: returnUrl });
    } catch (err) {
      const code = err instanceof MagicLinkError ? err.code : null;
      if (!(err instanceof MagicLinkError)) {
        // Signed in, but the account could not be opened: start clean.
        clearStoredToken();
      }
      setError(t(`auth.login.code.errors.${code && KNOWN_ERRORS.has(code) ? code : "fallback"}`));
      setCode("");
      setVerifying(false);
      busy.current = false;
      onSigningIn(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await onResend();
      setCode("");
      setNotice(t("auth.login.code.resent"));
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("auth.login.somethingWrong"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white px-4 py-5 sm:px-5">
      <div className="space-y-1">
        <p id="login-code-title" className="text-[15px] font-semibold text-foreground">
          {t("auth.login.code.title")}
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{t("auth.login.code.hint")}</p>
      </div>

      <InputOTP
        maxLength={6}
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v: string) => void submit(v)}
        pattern={REGEXP_ONLY_DIGITS}
        // "123 456", "123-456", "Code: 123456" all paste as the six digits.
        pasteTransformer={(pasted) => pasted.replace(/\D/g, "").slice(0, 6)}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        disabled={verifying}
        aria-labelledby="login-code-title"
        aria-invalid={!!error}
        containerClassName="justify-center gap-3"
        // 16px on the (hidden) input: iOS zooms the whole page into any
        // focused field smaller than that, which pushed the boxes off-screen.
        className="text-base!"
      >
        <InputOTPGroup className="gap-1.5">
          <InputOTPSlot index={0} className={SLOT} />
          <InputOTPSlot index={1} className={SLOT} />
          <InputOTPSlot index={2} className={SLOT} />
        </InputOTPGroup>
        <span aria-hidden className="h-px w-2.5 bg-stone-400" />
        <InputOTPGroup className="gap-1.5">
          <InputOTPSlot index={3} className={SLOT} />
          <InputOTPSlot index={4} className={SLOT} />
          <InputOTPSlot index={5} className={SLOT} />
        </InputOTPGroup>
      </InputOTP>

      <div aria-live="polite" className="min-h-5 text-center text-[13px] leading-snug">
        {verifying ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("auth.login.code.verifying")}
          </span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : notice ? (
          <span className="text-muted-foreground">{notice}</span>
        ) : null}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || resending || verifying}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13.5px] font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        >
          {resending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {cooldown > 0 ? t("auth.login.code.resendIn", { s: cooldown }) : t("auth.login.code.resend")}
        </button>
      </div>
    </div>
  );
}
