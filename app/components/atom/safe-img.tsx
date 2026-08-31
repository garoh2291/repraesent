import { useEffect, useState } from "react";

/**
 * An <img> that can never show the browser's broken-image glyph: when the
 * source fails to load (object deleted from storage, legacy avatar without
 * a thumb, network error), the provided fallback renders instead —
 * initials, a letter tile, whatever the call site already had.
 */
export function SafeImg({
  src,
  fallback,
  alt = "",
  ...imgProps
}: {
  src: string;
  fallback: React.ReactNode;
  alt?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const [failed, setFailed] = useState(false);

  // A new src gets a fresh chance (e.g. picture replaced after a failure).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return <>{fallback}</>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...imgProps} />;
}
