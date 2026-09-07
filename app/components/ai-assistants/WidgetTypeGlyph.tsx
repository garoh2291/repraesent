import type { WidgetType } from "~/lib/api/ai-assistants";

/** Miniature page thumbnails: where each widget type lives on a site. */
export function WidgetTypeGlyph({ type }: { type: WidgetType }) {
  const frame = (
    <rect x="1" y="1" width="70" height="42" rx="4" className="stroke-border" />
  );
  if (type === "bubble") {
    return (
      <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
        {frame}
        <rect
          x="8"
          y="8"
          width="30"
          height="3"
          rx="1.5"
          className="fill-muted-foreground/40"
        />
        <rect
          x="8"
          y="15"
          width="44"
          height="2"
          rx="1"
          className="fill-muted-foreground/20"
        />
        <rect
          x="8"
          y="20"
          width="38"
          height="2"
          rx="1"
          className="fill-muted-foreground/20"
        />
        <circle cx="60" cy="33" r="6" className="fill-foreground" />
        <circle cx="58" cy="33" r="0.8" className="fill-background" />
        <circle cx="60.5" cy="33" r="0.8" className="fill-background" />
        <circle cx="63" cy="33" r="0.8" className="fill-background" />
      </svg>
    );
  }
  if (type === "section") {
    return (
      <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
        {frame}
        <rect
          x="8"
          y="7"
          width="26"
          height="3"
          rx="1.5"
          className="fill-muted-foreground/40"
        />
        <rect
          x="8"
          y="14"
          width="56"
          height="22"
          rx="3"
          className="fill-foreground/90"
        />
        <rect
          x="14"
          y="19"
          width="24"
          height="2.5"
          rx="1.25"
          className="fill-background/80"
        />
        <rect
          x="14"
          y="24"
          width="16"
          height="2"
          rx="1"
          className="fill-background/40"
        />
        <rect
          x="14"
          y="29"
          width="44"
          height="4"
          rx="2"
          className="fill-background/25"
        />
      </svg>
    );
  }
  if (type === "bar") {
    return (
      <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
        {frame}
        <rect
          x="8"
          y="7"
          width="26"
          height="3"
          rx="1.5"
          className="fill-muted-foreground/40"
        />
        <rect
          x="8"
          y="15"
          width="56"
          height="8"
          rx="4"
          className="fill-foreground/90"
        />
        <rect
          x="13"
          y="18"
          width="30"
          height="2"
          rx="1"
          className="fill-background/50"
        />
        <circle cx="59" cy="19" r="2.5" className="fill-background/80" />
        <rect
          x="8"
          y="28"
          width="44"
          height="2"
          rx="1"
          className="fill-muted-foreground/20"
        />
        <rect
          x="8"
          y="33"
          width="38"
          height="2"
          rx="1"
          className="fill-muted-foreground/20"
        />
      </svg>
    );
  }
  return (
    <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
      {frame}
      <rect
        x="1"
        y="1"
        width="70"
        height="8"
        rx="4"
        className="fill-muted-foreground/15"
      />
      <circle cx="8" cy="5" r="1.5" className="fill-muted-foreground/50" />
      <rect
        x="13"
        y="4"
        width="18"
        height="2"
        rx="1"
        className="fill-muted-foreground/50"
      />
      <rect
        x="20"
        y="15"
        width="32"
        height="3"
        rx="1.5"
        className="fill-foreground/80"
      />
      <rect
        x="14"
        y="22"
        width="44"
        height="14"
        rx="3"
        className="fill-foreground/90"
      />
      <rect
        x="19"
        y="27"
        width="20"
        height="2"
        rx="1"
        className="fill-background/60"
      />
      <rect
        x="19"
        y="31"
        width="34"
        height="2.5"
        rx="1.25"
        className="fill-background/30"
      />
    </svg>
  );
}
