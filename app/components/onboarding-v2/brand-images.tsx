import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageIcon, ImageOff, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { errorCodeOf, type FieldSource, type ProfileData } from "~/lib/api/onboarding-v2";
import { removeProfileImage, uploadProfileImage, type ProfileImageKind } from "~/lib/api/workspace-profile";
import { SourceChip } from "./primitives";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT: Record<ProfileImageKind, string> = {
  logo: "image/png,image/jpeg,image/webp",
  favicon: "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico",
};
const PATH: Record<ProfileImageKind, string> = { logo: "identity.logo_url", favicon: "identity.favicon_url" };

/**
 * Logo and favicon in Settings → Business details. The website read fills
 * them when the site clearly marks them; the customer can upload their own or
 * remove them. Each change is saved straight away (like the business picture).
 */
export function BrandImages({ data, sources }: { data: ProfileData; sources: Record<string, FieldSource> | undefined }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} aria-describedby={`${id}-hint`} className="space-y-4 border-t border-border pt-4">
      <div className="space-y-0.5">
        <p id={id} className="text-[13px] font-semibold text-foreground">{t("settings.businessProfile.images.title")}</p>
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">{t("settings.businessProfile.images.hint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["logo", "favicon"] as const).map((kind) => (
          <ImageTile
            key={kind}
            kind={kind}
            initialUrl={(data.identity?.[PATH[kind].split(".")[1]] as string | undefined) ?? null}
            source={sources?.[PATH[kind]] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function ImageTile({ kind, initialUrl, source }: { kind: ProfileImageKind; initialUrl: string | null; source: FieldSource | null }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`settings.businessProfile.images.${key}`);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = (next: string | null) => {
    setUrl(next);
    setLoaded(false);
    setBroken(false);
  };

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    // Some browsers report no type for .ico files.
    const typed = !file.type && /\.ico$/i.test(file.name) ? new File([file], file.name, { type: "image/x-icon" }) : file;
    const allowed = ACCEPT[kind].split(",").filter((a) => a.includes("/"));
    if (!allowed.includes(typed.type)) return setError(k(`${kind}WrongType`));
    if (typed.size > MAX_BYTES) return setError(k("tooLarge"));
    setError(null);
    setBusy("upload");
    try {
      const res = await uploadProfileImage(kind, typed);
      show(res.url);
      toast.success(k(`${kind}Saved`));
    } catch (e) {
      const code = errorCodeOf(e);
      setError(code === "IMAGE_TYPE" ? k(`${kind}WrongType`) : code === "IMAGE_TOO_LARGE" ? k("tooLarge") : k("failed"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy("remove");
    try {
      await removeProfileImage(kind);
      show(null);
      toast.success(k(`${kind}Removed`));
    } catch {
      setError(k("failed"));
    } finally {
      setBusy(null);
    }
  };

  const label = k(kind);
  return (
    <div className="@container min-w-0 space-y-1.5">
      <div className="flex h-5 items-center justify-between gap-2">
        <label htmlFor={inputId} className="truncate text-[13px] font-medium text-foreground">
          {label}
          <span className="ml-1.5 font-normal text-muted-foreground">{t("onb.optional")}</span>
        </label>
        {/* The chip names where a found image came from; it goes once the customer replaces it. */}
        {url && url === initialUrl ? <SourceChip source={source} /> : null}
      </div>
      {/* Fixed-size preview: the box never changes height while an image loads, fails or is replaced. */}
      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40" aria-busy={!!busy}>
        {url && !broken ? (
          <>
            {!loaded ? <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> : null}
            <img
              key={url}
              src={url}
              alt={label}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              className={cn(
                "relative object-contain transition-opacity duration-150",
                kind === "logo" ? "max-h-16 max-w-[85%]" : "size-12",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-[13px] text-muted-foreground">
            {broken ? <ImageOff className="size-5" aria-hidden /> : <ImageIcon className="size-5" aria-hidden />}
            {broken ? k("broken") : k(`${kind}Empty`)}
          </span>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-card/70">
            <Loader2 className="size-5 animate-spin text-foreground/70" aria-hidden />
            <span className="sr-only">{k(busy === "upload" ? "uploading" : "removing")}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT[kind]}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" className="h-10 rounded-lg max-sm:h-11" disabled={!!busy} onClick={() => input.current?.click()}>
          {url ? k("replace") : k("upload")}
        </Button>
        {/* Kept in the layout when there is nothing to remove, so the row never shifts. */}
        <Button
          type="button"
          variant="ghost"
          className={cn("h-10 rounded-lg max-sm:h-11", !url && "invisible")}
          disabled={!!busy || !url}
          aria-hidden={!url}
          onClick={() => void remove()}
        >
          {k("remove")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">{k(`${kind}Types`)}</p>
      )}
    </div>
  );
}
