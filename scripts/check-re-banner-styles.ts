/**
 * Runs the shared re:banner style fixtures against the dashboard's copy of the
 * schema. `app/lib/wordpress/re-banner-styles.fixtures.json` is a copy of
 * `plugins/re-banner/tests/fixtures/styles.json`; the plugin's PHP tests and
 * the API's spec run the same file, which is what keeps the three
 * implementations from drifting.
 *
 * Run: yarn check:re-banner-styles
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  normalizeStyles,
  stylesToCss,
} from "../app/lib/wordpress/re-banner-styles";

type Fixture = {
  label: string;
  id: number;
  variant: string;
  input: unknown;
  expected: Record<string, unknown>;
  css: string;
  align?: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(here, "../app/lib/wordpress/re-banner-styles.fixtures.json"), "utf8"),
) as Fixture[];

let failed = 0;
function check(label: string, expected: unknown, actual: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
    return;
  }
  failed++;
  console.log(`  FAIL ${label}\n         expected: ${e}\n         actual:   ${a}`);
}

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v as object)
            .sort()
            .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
        )
      : v;

for (const f of fixtures) {
  const normalized = normalizeStyles(f.input);
  check(`normalize: ${f.label}`, sortKeys(f.expected), sortKeys(normalized));
  check(`css: ${f.label}`, f.css, stylesToCss({ id: f.id, variant: f.variant, styles: normalized, align: f.align }));
  check(`idempotent: ${f.label}`, normalized, normalizeStyles(normalized));
}

console.log(`\n${fixtures.length * 3} assertions, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
