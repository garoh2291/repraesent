import { useAuthContext } from "~/providers/auth-provider";
import { useMemberAvatarLookup } from "~/lib/hooks/useWorkspaceMembers";
import { cn } from "~/lib/utils";

const BOX_CLASSES = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

const TEXT_CLASSES = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  lg: "text-[11px]",
} as const;

/**
 * A workspace user's avatar: real picture when the member has one, initials
 * circle otherwise — one atom so every task chip, note author and history
 * actor looks identical. Resolves the picture client-side from the shared
 * workspace-member cache (["workspace-detail"]), so payloads only need a
 * user id or email, never an avatar field.
 */
export function UserAvatar({
  userId,
  email,
  firstName,
  lastName,
  deleted = false,
  size = "xs",
  className,
  fallbackClassName,
  title,
}: {
  userId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  deleted?: boolean;
  size?: keyof typeof BOX_CLASSES;
  className?: string;
  /** Overrides the initials circle's colors (e.g. the composer's primary tint). */
  fallbackClassName?: string;
  title?: string;
}) {
  const { user } = useAuthContext();
  const lookup = useMemberAvatarLookup();

  const avatarUrl =
    (userId ? lookup.byUserId.get(userId) : undefined) ??
    (email ? lookup.byEmail.get(email.toLowerCase()) : undefined) ??
    (userId && user?.id === userId ? (user?.avatar_url ?? undefined) : undefined) ??
    null;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        title={title}
        className={cn(
          "shrink-0 rounded-full border border-border object-cover",
          BOX_CLASSES[size],
          deleted && "opacity-50",
          className,
        )}
      />
    );
  }

  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() ||
    (email ? email.slice(0, 2).toUpperCase() : "?");

  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        BOX_CLASSES[size],
        TEXT_CLASSES[size],
        deleted
          ? "bg-muted/50 text-muted-foreground/60"
          : "bg-muted text-muted-foreground",
        fallbackClassName,
        className,
      )}
    >
      {initials}
    </span>
  );
}
