import {
  getNotes,
  getNotesForContact,
  getNotesForDeal,
  type Note,
} from "~/lib/api/notes";
import {
  getTasksForLead,
  getTasksForContact,
  getTasksForDeal,
  type Task,
} from "~/lib/api/tasks";
import {
  getBccMessages,
  getDealEmailSegment,
  type PaginatedBccMessages,
  type DealEmailSegment,
} from "~/lib/api/bcc-logs";
import {
  getPendingOutboundEmails,
  type PendingOutboundEmail,
} from "~/lib/api/outbound-mail";

/** Entity context shared by the panel, timeline and emails list. */
export interface ActivityContext {
  /** Notes/tasks read against a lead when the contact has a linked lead. */
  leadId?: string;
  /** Notes/tasks read against a contact when there is no lead. */
  contactId?: string;
  /** Notes/tasks read against a deal (pipeline page). */
  dealId?: string;
  /** History invalidation companion when notes are lead-scoped on a contact page. */
  linkedContactId?: string;
  historyContactId?: string;
  /** Emails source on the contact page (the resolved contact id). */
  emailContactId?: string;
}

export type Variant = "contact" | "deal";

/** These keys MUST match LeadNotesSection / LeadTasksSection / ContactEmailsSection so the cache is shared. */
export function notesQuery(ctx: ActivityContext): {
  key: readonly unknown[];
  fn: () => Promise<Note[]>;
} {
  if (ctx.leadId)
    return { key: ["lead-notes", ctx.leadId], fn: () => getNotes(ctx.leadId!) };
  if (ctx.dealId)
    return {
      key: ["deal-notes", ctx.dealId],
      fn: () => getNotesForDeal(ctx.dealId!),
    };
  return {
    key: ["customer-notes", ctx.contactId!],
    fn: () => getNotesForContact(ctx.contactId!),
  };
}

export function tasksQuery(ctx: ActivityContext): {
  key: readonly unknown[];
  fn: () => Promise<Task[]>;
} {
  if (ctx.leadId)
    return {
      key: ["lead-tasks", ctx.leadId],
      fn: () => getTasksForLead(ctx.leadId!),
    };
  if (ctx.dealId)
    return {
      key: ["deal-tasks", ctx.dealId],
      fn: () => getTasksForDeal(ctx.dealId!),
    };
  return {
    key: ["contact-tasks", ctx.contactId!],
    fn: () => getTasksForContact(ctx.contactId!),
  };
}

export function emailsQuery(
  ctx: ActivityContext,
  variant: Variant,
): {
  key: readonly unknown[];
  fn: () => Promise<PaginatedBccMessages>;
  id?: string;
} {
  if (variant === "deal") {
    return {
      // Fetch all deal emails so sub-tab counts + the timeline are complete.
      key: ["deal-emails", ctx.dealId!],
      fn: () => getBccMessages({ dealId: ctx.dealId, pageSize: 100 }),
      id: ctx.dealId,
    };
  }
  return {
    key: ["contact-emails", ctx.emailContactId!],
    fn: () => getBccMessages({ contactId: ctx.emailContactId }),
    id: ctx.emailContactId,
  };
}

/**
 * Emails sent from the composer whose BCC copy has not been ingested yet.
 *
 * Separate from the message list on purpose: the server only returns
 * unreconciled rows, so the placeholder card disappears by itself when the real
 * message arrives and nothing has to de-duplicate the two.
 */
export function pendingOutboundQuery(
  ctx: ActivityContext,
  variant: Variant,
): {
  key: readonly unknown[];
  fn: () => Promise<PendingOutboundEmail[]>;
  id?: string;
} {
  if (variant === "deal") {
    return {
      key: ["outbound-pending", "deal", ctx.dealId!],
      fn: () => getPendingOutboundEmails({ dealId: ctx.dealId }),
      id: ctx.dealId,
    };
  }
  return {
    key: ["outbound-pending", "contact", ctx.emailContactId!],
    fn: () => getPendingOutboundEmails({ contactId: ctx.emailContactId }),
    id: ctx.emailContactId,
  };
}

/** Query keys every send has to refresh, whichever surface opened the composer. */
export function composeInvalidateKeys(
  ctx: ActivityContext,
  variant: Variant,
): readonly (readonly unknown[])[] {
  const keys: (readonly unknown[])[] = [
    pendingOutboundQuery(ctx, variant).key,
    ["mail-messages"],
  ];
  if (ctx.dealId) keys.push(["deal-emails", ctx.dealId]);
  if (ctx.emailContactId) keys.push(["contact-emails", ctx.emailContactId]);
  return keys;
}

export function hasNotesTasksContext(ctx: ActivityContext): boolean {
  return !!(ctx.leadId || ctx.dealId || ctx.contactId);
}

/** Deal email segment (inclusion filter) — shared key so editor + lists sync. */
export function dealEmailSegmentQuery(dealId: string): {
  key: readonly unknown[];
  fn: () => Promise<DealEmailSegment>;
} {
  return {
    key: ["deal-email-segment", dealId],
    fn: () => getDealEmailSegment(dealId),
  };
}

/** Timestamp used to sort each entity in the merged timeline. */
export function noteTs(n: Note): number {
  return new Date(n.version > 1 ? n.updated_at : n.created_at).getTime();
}
export function taskTs(tk: Task): number {
  return new Date(tk.created_at).getTime();
}
