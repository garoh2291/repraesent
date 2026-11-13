/**
 * Run: npx vite-node app/lib/time/zones.test.ts
 *
 * The app has no test runner; this exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { COMMON_ZONES, ZONES, isValidZone, matchesZone, zoneEntry, zoneOffsetLabel, zoneOptions } from "./zones";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const winter = new Date("2030-01-15T12:00:00Z");
const summer = new Date("2030-07-15T12:00:00Z");

test("every listed zone is a real zone, listed once", () => {
  const seen = new Set<string>();
  for (const z of ZONES) {
    assert.ok(isValidZone(z.zone), z.zone);
    assert.ok(!seen.has(z.zone), `duplicate ${z.zone}`);
    seen.add(z.zone);
  }
  for (const z of COMMON_ZONES) assert.ok(seen.has(z), `common ${z} not listed`);
});

test("offsets follow summer time", () => {
  assert.equal(zoneOffsetLabel("Europe/Berlin", winter), "GMT+1");
  assert.equal(zoneOffsetLabel("Europe/Berlin", summer), "GMT+2");
  assert.equal(zoneOffsetLabel("Asia/Yerevan", summer), "GMT+4");
  assert.equal(zoneOffsetLabel("Asia/Kolkata", winter), "GMT+5:30");
});

test("search finds people's words", () => {
  const opts = zoneOptions("de", null, winter);
  const find = (q: string) => opts.filter((o) => matchesZone(o, q)).map((o) => o.zone);
  assert.ok(find("Deutschland").includes("Europe/Berlin"));
  assert.ok(find("munchen").includes("Europe/Berlin"));
  assert.ok(find("Armenia").includes("Asia/Yerevan"));
  assert.ok(find("Brüssel").includes("Europe/Brussels"));
  assert.ok(find("gmt+1").includes("Europe/Paris"));
  assert.ok(find("Central European").includes("Europe/Amsterdam"));
  assert.ok(find("Pacific Time").includes("America/Los_Angeles"));
});

test("sorted west to east", () => {
  const opts = zoneOptions("en", null, winter);
  for (let i = 1; i < opts.length; i += 1) assert.ok(opts[i - 1].offsetMinutes <= opts[i].offsetMinutes);
});

test("an older stored zone stays selectable", () => {
  const opts = zoneOptions("en", "America/Tijuana", winter);
  const t = opts.find((o) => o.zone === "America/Tijuana");
  assert.ok(t);
  assert.equal(t.city, "Tijuana");
  assert.equal(zoneEntry("Nope/Nowhere").city, "Nowhere");
  assert.ok(!zoneOptions("en", "Nope/Nowhere", winter).some((o) => o.zone === "Nope/Nowhere"));
});

console.log(`\n${passed} passed`);
