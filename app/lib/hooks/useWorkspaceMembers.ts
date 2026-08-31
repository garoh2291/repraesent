"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceDetail } from "~/lib/api/workspaces";

/**
 * Workspace members, shared app-wide. Uses the exact query key the eleven
 * existing getWorkspaceDetail call sites already use, so on any CRM screen
 * this is a cache read, not a request.
 */
export function useWorkspaceMembers() {
  return useQuery({
    queryKey: ["workspace-detail"],
    queryFn: getWorkspaceDetail,
    staleTime: 60_000,
  });
}

export interface MemberAvatarLookup {
  byUserId: Map<string, string>;
  byEmail: Map<string, string>;
}

/**
 * user_id -> avatar_url and lowercased email -> avatar_url for every member
 * that has a picture. Feeds the UserAvatar atom.
 */
export function useMemberAvatarLookup(): MemberAvatarLookup {
  const { data } = useWorkspaceMembers();

  return useMemo(() => {
    const byUserId = new Map<string, string>();
    const byEmail = new Map<string, string>();
    for (const m of data?.members ?? []) {
      const url = m.user_avatar_thumb_url ?? m.user_avatar_url;
      if (!url) continue;
      byUserId.set(m.user_id, url);
      if (m.user_email) byEmail.set(m.user_email.toLowerCase(), url);
    }
    return { byUserId, byEmail };
  }, [data?.members]);
}
