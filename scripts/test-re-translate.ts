/**
 * Unit tests for the rules the re:translate screens share. The marker check
 * runs the same fixture as the plugin's PHP tests and the API's spec
 * (plugins/re-translate/test/fixtures/tokens.json): the editor must never let
 * through a wording the site would refuse, nor refuse one it would accept.
 *
 * Run: yarn test:re-translate
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { flagSrc } from "../app/components/wordpress/re-translate/flags";
import { applyLanguages, applyOptions } from "../app/lib/hooks/useReTranslate";
import type { ReTranslateOverview } from "../app/lib/api/re-translate";
import { baseOf, flagOf, menuName, minutesFor, px, shortName } from "../app/components/wordpress/re-translate/logic";
import { flagWords, reasonWords } from "../app/components/wordpress/re-translate/page-view";
import { fromEditable, hasMarkers, plainText, toEditable, tokensMatch } from "../app/components/wordpress/re-translate/sentence-text";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = join(here, "../../plugins/re-translate");
const fixture = existsSync(join(plugin, "test/fixtures/tokens.json"))
  ? (JSON.parse(readFileSync(join(plugin, "test/fixtures/tokens.json"), "utf8")) as { cases: Array<{ text: string }>; matches: Array<{ a: string; b: string; ok: boolean }> })
  : null;

test("markers: the editor agrees with the site on every shared case", { skip: !fixture && "plugin checkout not next to this app" }, () => {
  assert.ok(fixture!.matches.length > 0);
  for (const m of fixture!.matches) assert.equal(tokensMatch(m.a, m.b), m.ok, `${m.a} vs ${m.b}`);
});

test("markers: every real sentence survives the editor unchanged", { skip: !fixture && "plugin checkout not next to this app" }, () => {
  for (const c of fixture!.cases) {
    const editable = toEditable(c.text);
    assert.ok(!/<\/?\d+\/?>/.test(editable), `no raw markers left in ${editable}`);
    assert.equal(fromEditable(editable), c.text);
    assert.ok(tokensMatch(c.text, fromEditable(editable)));
  }
});

test("markers: what a person typing can get wrong", () => {
  const source = "Go <1>here</1> now<2/> ⟦0⟧";
  assert.equal(toEditable(source), "Go 〔1〕here〔/1〕 now〔2/〕 ⟦0⟧");
  assert.ok(tokensMatch(source, fromEditable("⟦0⟧ 〔2/〕〔1〕hier〔/1〕 jetzt")), "markers may move");
  assert.ok(!tokensMatch(source, fromEditable("Go here now ⟦0⟧")), "a lost link is caught");
  assert.ok(!tokensMatch(source, fromEditable("〔1〕a〔/1〕 〔1〕b〔/1〕〔2/〕 ⟦0⟧")), "a doubled link is caught");
  assert.ok(!tokensMatch(source, fromEditable("Go 〔1〕here〔/1〕 now〔2/〕 ⟦1⟧")), "a changed placeholder is caught");
  assert.ok(!tokensMatch(source, fromEditable("Go 〔1〕here now〔2/〕 ⟦0⟧")), "a half-deleted link is caught");
  assert.ok(tokensMatch("plain", "einfach"));
});

test("plain words for lists and search", () => {
  assert.equal(plainText("A <1>b</1>&nbsp;&amp; ⟦0⟧ c<2/>"), "A b & c");
  assert.equal(plainText("&lt;tag&gt; &quot;q&quot; &#39;s&#39;"), "<tag> \"q\" 's'");
  assert.equal(plainText(null), "");
  assert.equal(plainText(""), "");
  assert.ok(hasMarkers("a <1>b</1>"));
  assert.ok(hasMarkers("a<3/>"));
  assert.ok(!hasMarkers("a ⟦0⟧ < 1 >"));
});

test("time: about 45 s a page, four at once, never '0 minutes'", () => {
  assert.equal(minutesFor(0), 1);
  assert.equal(minutesFor(1), 1);
  assert.equal(minutesFor(4), 1);
  assert.equal(minutesFor(8), 2);
  assert.equal(minutesFor(40), 8);
  assert.equal(minutesFor(-3), 1);
});

test("flags: the chosen one, none, or the language's region", () => {
  assert.equal(flagOf({ flag: "AT", bcp47: "de-DE" }), "AT");
  assert.equal(flagOf({ flag: "none", bcp47: "de-DE" }), undefined);
  assert.equal(flagOf({ bcp47: "ar-AE" }), "AE");
  assert.equal(flagOf({ flag: "", bcp47: "hy-AM" }), "AM");
  assert.equal(flagOf({ bcp47: "hy" }), undefined);
});

test("flags: the dashboard can draw every flag the plugin can", { skip: !existsSync(join(plugin, "assets/flags")) && "plugin checkout not next to this app" }, () => {
  const countries = readdirSync(join(plugin, "assets/flags")).filter((f) => /^[A-Z]{2}\.svg$/.test(f)).map((f) => f.slice(0, 2));
  assert.ok(countries.length > 80);
  for (const c of countries) assert.ok(flagSrc(c)?.startsWith("data:image/svg+xml"), `flag ${c}`);
  assert.equal(flagSrc("XX"), null);
  assert.equal(flagSrc(undefined), null);
  assert.equal(flagSrc("none"), null);
});

test("menu names: as the plugin writes them (Switcher::name_for)", () => {
  const tags = ["de-DE", "hy-AM", "ar-AE"];
  assert.equal(menuName("Deutsch (Deutschland)", "German", "de-DE", tags), "Deutsch");
  assert.equal(menuName("Deutsch (Österreich)", undefined, "de-AT", [...tags, "de-AT"]), "Deutsch (Österreich)");
  assert.equal(menuName(undefined, "Armenian (Eastern)", "hy-AM", tags), "Armenian");
  assert.equal(menuName(undefined, undefined, "xx-YY", tags), "XX");
  assert.equal(menuName("(nur Klammern)", undefined, "de-DE", tags), "(nur Klammern)", "never an empty label");
  assert.equal(shortName("(nur Klammern)"), "(nur Klammern)");
  assert.equal(shortName("Français (France)"), "Français");
  assert.equal(baseOf("AR-ae"), "ar");
});

test("menu sizes: empty is the default, a number is pixels", () => {
  assert.equal(px("", 8), 8);
  assert.equal(px("0", 8), 0);
  assert.equal(px("12", 8), 12);
});

test("checker words: every rule a site owner can see has plain words", () => {
  const t = (key: string) => key;
  const known: Array<[string, string]> = [
    ["parity.numbers", "numbers"],
    ["parity.currency", "currency"],
    ["parity.link: https://x", "link"],
    ["parity.entity", "name"],
    ["consistency.entity", "name"],
    ["parity.question", "question"],
    ["consistency.term", "consistency"],
    ["fit.button", "long"],
    ["fit.untranslated", "same"],
    ["marketing.hype", "hype"],
    ["marketing.bare-cta", "cta"],
    ["slop.em-dash", "slop"],
    ["untranslated", "missing"],
    ["parity.tokens", "missing"],
    ["untranslated.recovered", "other"],
    ["something-new", "other"],
  ];
  for (const [rule, word] of known) assert.equal(flagWords(t, rule), `wordpress.reTranslate.flag.${word}`, rule);
  for (const reason of ["untranslated_parts", "too_long", "numbers_changed", "names", "links", "low_score"] as const) {
    assert.match(reasonWords(t, reason), /^wordpress\.reTranslate\.reason\./, reason);
  }
});

// ---- optimistic writes: what the screen shows before the site answers must equal what the site stores

const lang = (locale: string, enabled = true) => ({ locale, prefix: locale.slice(0, 2), bcp47: locale, rtl: false, name: locale, native: locale, enabled });
const overview = {
  settings: {
    source: { locale: "de-DE", bcp47: "de-DE", name: "German", native: "Deutsch" },
    languages: [lang("hy-AM"), lang("fr-FR", false)],
    paused: false,
    switcher: { mode: "plugin", layout: "dropdown", show: "flag_name", position: "bottom-left", hide_current: false, colors: { text: "#000", bg: "#fff", border: "#ccc", active_text: "#fff", active_bg: "#000" }, radius: "8", pad_y: "8", pad_x: "12", offset_y: "16", offset_x: "16", site: null },
  },
  locales: [lang("de-DE"), lang("hy-AM"), lang("fr-FR"), lang("ar-GULF")],
} as unknown as ReTranslateOverview;

test("optimistic: adding a language turns it on and keeps the others", () => {
  const s = applyLanguages(overview, { targets: ["hy-AM", "ar-GULF"] });
  assert.deepEqual(s.languages.map((l) => [l.locale, l.enabled]), [["hy-AM", true], ["ar-GULF", true], ["fr-FR", false]]);
});

test("optimistic: a removed language stays stored but switched off, and one added back keeps its place", () => {
  const off = applyLanguages(overview, { targets: [] });
  assert.deepEqual(off.languages.map((l) => [l.locale, l.enabled]), [["hy-AM", false], ["fr-FR", false]]);
  const back = applyLanguages(overview, { targets: ["fr-FR"] });
  assert.equal(back.languages.find((l) => l.locale === "fr-FR")?.enabled, true);
});

test("optimistic: a new original language replaces the source, the same one keeps its flag", () => {
  assert.equal(applyLanguages(overview, { source: "fr-FR", targets: ["hy-AM"] }).source.locale, "fr-FR");
  const flagged = { ...overview, settings: { ...overview.settings, source: { ...overview.settings.source, flag: "de" } } } as ReTranslateOverview;
  assert.equal(applyLanguages(flagged, { source: "de-DE", targets: ["hy-AM"] }).source.flag, "de");
});

test("optimistic: options merge the way the API merges them", () => {
  const s = applyOptions(overview.settings, { paused: true, switcher: { position: "top-right", colors: { bg: "#111" } }, flags: { "hy-AM": "am", source: "none" } });
  assert.equal(s.paused, true);
  assert.equal(s.switcher.position, "top-right");
  assert.equal(s.switcher.colors.bg, "#111");
  assert.equal(s.switcher.colors.text, "#000");
  assert.equal(s.source.flag, "none");
  assert.equal(s.languages.find((l) => l.locale === "hy-AM")?.flag, "am");
  assert.equal(s.languages.find((l) => l.locale === "fr-FR")?.flag, undefined);
});
