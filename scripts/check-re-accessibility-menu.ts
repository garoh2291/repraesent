/**
 * Runs the plugin's menu fixtures against the preview's port of
 * `Re_Accessibility_Frontend::css_vars()` / `root_classes()`.
 * `app/components/wordpress/re-accessibility/menu-vars.fixtures.json` is a copy of
 * `plugins/re-accessibility/tests/fixtures/menu-vars.json`; the plugin's PHP tests
 * run the same file, so the preview can't drift from what the site prints.
 *
 * Run: yarn check:re-accessibility-menu
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  DEFAULTS,
  type ReAccessibilitySettings,
} from "../app/components/wordpress/re-accessibility/settings";
import {
  menuClasses,
  menuVars,
  resolveForPreview,
} from "../app/components/wordpress/re-accessibility/menu-markup";

type Fixture = {
  name: string;
  settings: Partial<ReAccessibilitySettings>;
  vars: string;
  classes: string[];
};

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(
    join(here, "../app/components/wordpress/re-accessibility/menu-vars.fixtures.json"),
    "utf8",
  ),
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
  console.log(`  FAIL ${label}\n       expected ${e}\n       actual   ${a}`);
}

for (const f of fixtures) {
  const s = resolveForPreview({ ...DEFAULTS, ...f.settings });
  check(`vars: ${f.name}`, f.vars, menuVars(s));
  check(`classes: ${f.name}`, f.classes, menuClasses(s));
}

console.log(`\n${fixtures.length * 2} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
