/**
 * Everything the Webhooks tab needs to show a payload BEFORE anything is sent:
 * the mapped `data` object built from the server's example keys, and a tiny
 * JSON tinter for the preview pane. No network, no i18n — pure functions.
 */

import type {
  FormWebhookEvent,
  FormWebhookFieldMap,
  PayloadKeyGroup,
} from "~/lib/api/form-webhooks";

/** Mirror of the server's applyFieldMap: exclude, rename, first writer wins. */
export function applyFieldMap(
  source: Record<string, unknown>,
  map: FormWebhookFieldMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    const rule = map.keys[key];
    const include = rule ? rule.include : map.default === "include";
    if (!include) continue;
    const target = rule?.as?.trim() || key;
    if (target in out) continue;
    out[target] = value;
  }
  return out;
}

/** The flat source the preview maps: every example key by group. */
export function exampleSource(
  groups: PayloadKeyGroup[],
  event: FormWebhookEvent,
): Record<string, unknown> {
  const source: Record<string, unknown> = {};
  for (const group of groups) {
    // Checkout stamps only exist on the lead once a payment happened.
    if (group.group === "checkout" && event === "form.submitted") continue;
    for (const key of group.keys) source[key.key] = key.example;
  }
  return source;
}

/**
 * Swap the envelope's example `data` (and checkout block presence) for the
 * mapped one, keeping everything else the server sent.
 */
export function buildPreview(
  envelope: Record<string, unknown>,
  groups: PayloadKeyGroup[],
  map: FormWebhookFieldMap,
  event: FormWebhookEvent,
): Record<string, unknown> {
  const {
    checkout: _checkout,
    data: _data,
    ...rest
  } = envelope as Record<string, unknown> & {
    checkout?: unknown;
    data?: unknown;
  };
  void _checkout;
  void _data;
  const out: Record<string, unknown> = { ...rest, event };
  if (event !== "form.submitted") {
    out.checkout = {
      status: event === "checkout.expired" ? "expired" : "complete",
      payment_status:
        event === "checkout.completed"
          ? "paid"
          : event === "checkout.failed"
            ? "failed"
            : "unpaid",
      mode: "payment",
      amount_subtotal: 8700,
      amount_total: 8700,
      currency: "eur",
      stripe_session_id: "cs_test_a1B2c3D4e5F6",
      stripe_customer_id: event === "checkout.completed" ? "cus_ABC123" : null,
      payment_intent_id: event === "checkout.completed" ? "pi_3ABC123" : null,
      subscription_id: null,
      line_items: [
        {
          price_id: "price_123",
          product_id: "prod_123",
          name: "Sample product",
          quantity: 1,
          unit_amount: 8700,
          currency: "eur",
          type: "one_time",
        },
      ],
      billing_address:
        event === "checkout.completed"
          ? {
              line1: "Musterstraße 1",
              city: "Berlin",
              postal_code: "10115",
              country: "DE",
            }
          : null,
      shipping: null,
      completed_at:
        event === "checkout.completed" ? "2026-09-02T10:14:03.000Z" : null,
    };
  }
  out.data = applyFieldMap(exampleSource(groups, event), map);
  return out;
}

/** Source keys whose target name changed, keyed by TARGET, for the ghost comments. */
export function renamedTargets(
  map: FormWebhookFieldMap,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [source, rule] of Object.entries(map.keys)) {
    if (
      rule.include &&
      rule.as &&
      rule.as.trim() &&
      rule.as.trim() !== source
    ) {
      out[rule.as.trim()] = source;
    }
  }
  return out;
}

/**
 * Target keys claimed by more than one DIFFERENT source key (invalid map).
 * Source keys are deduplicated first: a key listed twice is still one key,
 * not a collision with itself.
 */
export function collidingTargets(
  map: FormWebhookFieldMap,
  allKeys: string[],
): Set<string> {
  const owners = new Map<string, string[]>();
  for (const key of new Set(allKeys)) {
    const rule = map.keys[key];
    const include = rule ? rule.include : map.default === "include";
    if (!include) continue;
    const target = rule?.as?.trim() || key;
    owners.set(target, [...(owners.get(target) ?? []), key]);
  }
  return new Set(
    [...owners.entries()].filter(([, o]) => o.length > 1).map(([t]) => t),
  );
}

export const TARGET_KEY_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

export type JsonToken =
  | { kind: "key"; text: string }
  | { kind: "string"; text: string }
  | { kind: "number"; text: string }
  | { kind: "literal"; text: string }
  | { kind: "punct"; text: string };

export interface JsonLine {
  tokens: JsonToken[];
  /** The object key this line defines, when it is a `data` entry. */
  dataKey?: string;
}

/**
 * Pretty-print JSON into lines of typed tokens so the preview can tint keys,
 * strings, numbers and literals without a highlighter library. Tracks which
 * lines are direct children of `data` so renames can be annotated.
 */
export function tokenizeJson(value: unknown): JsonLine[] {
  const lines: JsonLine[] = [];
  const walk = (
    v: unknown,
    indent: number,
    key: string | null,
    trailing: string,
    inData: boolean,
  ) => {
    const pad = "  ".repeat(indent);
    const head: JsonToken[] = [{ kind: "punct", text: pad }];
    if (key !== null) {
      head.push({ kind: "key", text: JSON.stringify(key) });
      head.push({ kind: "punct", text: ": " });
    }
    const line = (tokens: JsonToken[]) =>
      lines.push({
        tokens,
        ...(inData && key !== null ? { dataKey: key } : {}),
      });

    if (Array.isArray(v)) {
      if (v.length === 0) {
        line([...head, { kind: "punct", text: `[]${trailing}` }]);
        return;
      }
      line([...head, { kind: "punct", text: "[" }]);
      v.forEach((item, i) =>
        walk(item, indent + 1, null, i < v.length - 1 ? "," : "", false),
      );
      lines.push({ tokens: [{ kind: "punct", text: `${pad}]${trailing}` }] });
      return;
    }
    if (v !== null && typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length === 0) {
        line([...head, { kind: "punct", text: `{}${trailing}` }]);
        return;
      }
      line([...head, { kind: "punct", text: "{" }]);
      entries.forEach(([k, child], i) =>
        walk(
          child,
          indent + 1,
          k,
          i < entries.length - 1 ? "," : "",
          key === "data" && indent === 0,
        ),
      );
      lines.push({ tokens: [{ kind: "punct", text: `${pad}}${trailing}` }] });
      return;
    }
    const token: JsonToken =
      typeof v === "string"
        ? { kind: "string", text: JSON.stringify(v) }
        : typeof v === "number"
          ? { kind: "number", text: String(v) }
          : { kind: "literal", text: String(v) };
    line([...head, token, { kind: "punct", text: trailing }]);
  };
  walk(value, 0, null, "", false);
  return lines;
}

/** The Node snippet shown under "Verify the signature". */
export function verifySnippet(): string {
  return `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRepraesent(rawBody, signatureHeader, secret) {
  // X-Repraesent-Signature: t=<unix seconds>,v1=<hex>
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const expected = createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return (
    fresh &&
    timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex"))
  );
}`;
}
