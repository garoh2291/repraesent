/**
 * Run: npx vite-node app/lib/calendar/calendar-label.test.ts
 *
 * The app has no test runner; this exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { calendarLabel } from "./calendar-label";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const caldav = {
  display_name: "The Amara Estate",
  google_email: "info@theamaraestate.gagadomains.com",
  user_name: "Garnik H",
  is_own: true,
  provider: "caldav" as const,
};

test("names a generic CalDAV calendar after its account, not the person who connected it", () => {
    const label = calendarLabel(caldav, { id: "https://dav1.example.com/dav.php/calendars/info/default/", summary: "Default calendar" });
    assert.equal(label.name, "The Amara Estate");
    assert.equal(label.full, "The Amara Estate · info@theamaraestate.gagadomains.com");
    assert.ok(!label.full.includes("Garnik"));
});

test("keeps a real calendar name and says which account it is in", () => {
    const label = calendarLabel(caldav, { id: "x", summary: "Viewings" });
    assert.equal(label.full, "Viewings · The Amara Estate · info@theamaraestate.gagadomains.com");
});

test("falls back from a URL tail to the account name", () => {
    assert.equal(calendarLabel(caldav, { id: "https://dav.example.com/cal/abc123/", summary: "abc123" }).name, "The Amara Estate");
});

test("a Google calendar is named by its address, never the profile name", () => {
  const google = { display_name: "Garnik Hovsepyan", google_email: "garnik@dendritecorp.com", user_name: "Garnik Hovsepyan", is_own: true, provider: "google" as const };
  assert.equal(calendarLabel(google, { id: "garnik@dendritecorp.com", summary: "garnik@dendritecorp.com" }).full, "garnik@dendritecorp.com");
  assert.equal(calendarLabel(google, { id: "x@group.calendar.google.com", summary: "T9 Meeting Room" }).full, "T9 Meeting Room · garnik@dendritecorp.com");
  assert.equal(calendarLabel(google, { id: "william@playmade.co.uk", summary: "william@playmade.co.uk" }).name, "william@playmade.co.uk");
});

test("adds the team member only for someone else's calendar", () => {
  const google = { display_name: "Mara", google_email: "mara@example.com", user_name: "Mara Klein", is_own: false, provider: "google" as const };
  assert.equal(calendarLabel(google, { id: "mara@example.com", summary: "mara@example.com" }).full, "mara@example.com · Mara Klein");
});

console.log(`${passed} passed`);
