/**
 * Run: npx vite-node app/lib/workflows/timing.test.ts
 *
 * The app has no test runner; this exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import type { TriggerConfig } from "~/lib/api/workflows";
import {
  appointmentChoiceOf,
  applyAppointmentChoice,
  offsetToParts,
  partsToOffset,
  triggerSentence,
  withDirection,
} from "./timing";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

test("1440 before is 1 day before", () => {
  assert.deepEqual(offsetToParts(-1440), { amount: 1, unit: "days", direction: "before" });
});

test("-120 is 2 hours before, not 0 days", () => {
  assert.deepEqual(offsetToParts(-120), { amount: 2, unit: "hours", direction: "before" });
});

test("90 stays minutes", () => {
  assert.deepEqual(offsetToParts(90), { amount: 90, unit: "minutes", direction: "after" });
});

test("empty offset reads as 0 hours after", () => {
  assert.deepEqual(offsetToParts(undefined), { amount: 0, unit: "hours", direction: "after" });
});

test("round trip is exact for every unit and direction", () => {
  for (const m of [-10080, -1440, -120, -45, 0, 30, 60, 1500, 2880]) {
    assert.equal(partsToOffset(offsetToParts(m)), m === 0 ? 0 : m);
  }
});

test("partsToOffset clamps negative and fractional amounts", () => {
  assert.equal(partsToOffset({ amount: -3, unit: "hours", direction: "after" }), 0);
  assert.equal(partsToOffset({ amount: 2.7, unit: "hours", direction: "before" }), -120);
});

const appt = (over: Partial<TriggerConfig>): TriggerConfig => ({
  type: "record_created",
  entity: "appointments",
  ...over,
});

test("plain choices round-trip through the generic trigger types", () => {
  for (const choice of ["booked", "before", "after", "moved", "cancelled"] as const) {
    assert.equal(appointmentChoiceOf(applyAppointmentChoice(appt({}), choice)), choice);
  }
});

test("before keeps the timing already set", () => {
  const next = applyAppointmentChoice(appt({ type: "date_field_relative", offsetMinutes: 120 }), "before");
  assert.equal(next.offsetMinutes, -120);
  assert.equal(next.dateField, "starts_at");
});

test("after defaults the anchor to the end", () => {
  const next = withDirection(
    appt({ type: "date_field_relative", dateField: "starts_at", offsetMinutes: -60 }),
    "after",
  );
  assert.equal(next.offsetMinutes, 60);
  assert.equal(next.dateField, "ends_at");
});

test("a non-appointment date keeps its field when flipping direction", () => {
  const next = withDirection(
    { type: "date_field_relative", entity: "deals", dateField: "expected_close_date", offsetMinutes: -1440 },
    "after",
  );
  assert.equal(next.dateField, "expected_close_date");
  assert.equal(next.offsetMinutes, 1440);
});

test("custom appointment triggers are not mistaken for a plain choice", () => {
  assert.equal(appointmentChoiceOf(appt({ type: "record_updated", columns: ["notes"] })), null);
  assert.equal(appointmentChoiceOf(appt({ type: "date_field_relative", dateField: "created_at" })), null);
});

test("card sentence", () => {
  const t = (key: string, o?: Record<string, unknown>) => `${key}${o ? JSON.stringify(o) : ""}`;
  const s = triggerSentence(appt({ type: "date_field_relative", dateField: "starts_at", offsetMinutes: -1440 }), t);
  assert.equal(s, 'workflows.timing.cardAppointment_before{"duration":"workflows.timing.amount_days{\\"count\\":1}"}');
});

console.log(`${passed} passed`);
