"use client";

import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import type { Lead } from "~/lib/api/leads";
import type { Note } from "~/lib/api/notes";
import { useAuthContext } from "~/providers/auth-provider";
import {
  makeDealFromLead,
  recordContactAttempt,
  recordLeadOutcome,
  type ContactChannel,
  type MakeDealInput,
  type RecordOutcomeInput,
} from "~/lib/api/lead-outcomes";
import {
  useInvalidateLeadAttempt,
  useInvalidateWork,
} from "~/lib/hooks/useToday";

export function useContactAttempt() {
  const invalidate = useInvalidateLeadAttempt();
  return useMutation({
    mutationFn: (v: { leadId: string; channel: ContactChannel }) =>
      recordContactAttempt(v.leadId, v.channel),
    onSuccess: invalidate,
  });
}

/** Every cached query for this lead under a key root, e.g. ["lead", id] and ["lead", scope, id]. */
function forLead(root: string, leadId: string) {
  return {
    predicate: (q: Query) =>
      q.queryKey[0] === root && q.queryKey[q.queryKey.length - 1] === leadId,
  };
}

export function useLeadOutcomeMutation() {
  const invalidate = useInvalidateWork();
  const qc = useQueryClient();
  const { user } = useAuthContext();
  return useMutation({
    mutationFn: (v: { leadId: string } & RecordOutcomeInput) => {
      const { leadId, ...input } = v;
      return recordLeadOutcome(leadId, input);
    },
    // Show the answer immediately — the note in the notes list and the
    // outcome badge — instead of waiting for the save and a refetch.
    onMutate: (v) => {
      const now = new Date().toISOString();
      if (v.note?.trim()) {
        const temp: Note = {
          id: `pending-${Date.now()}`,
          version: 1,
          content: v.note.trim(),
          created_at: now,
          updated_at: now,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
          user_first_name: user?.first_name ?? null,
          user_last_name: user?.last_name ?? null,
          user_email: user?.email ?? null,
          user_is_deleted: false,
        };
        qc.setQueriesData<Note[]>(forLead("lead-notes", v.leadId), (old) =>
          Array.isArray(old) ? [temp, ...old] : old,
        );
      }
      qc.setQueriesData<Lead>(forLead("lead", v.leadId), (old) =>
        old
          ? {
              ...old,
              contact_state: {
                first_contacted_at: old.contact_state?.first_contacted_at ?? now,
                attempts: old.contact_state?.attempts ?? 0,
                outcome: v.outcome,
                outcome_at: now,
              },
            }
          : old,
      );
    },
    onSuccess: (res, v) => {
      // The server's view of the lead (new stage, task counts) right away.
      qc.setQueriesData<Lead>(forLead("lead", v.leadId), (old) =>
        old ? { ...old, ...res.lead } : old,
      );
      invalidate();
    },
    // On failure, drop the optimistic note / badge by refetching the truth.
    onError: invalidate,
  });
}

export function useMakeDeal() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: (v: { leadId: string } & MakeDealInput) => {
      const { leadId, ...input } = v;
      return makeDealFromLead(leadId, input);
    },
    onSuccess: invalidate,
  });
}
