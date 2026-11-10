/**
 * i18n integrity regression.
 *
 * Reads the REAL dictionary fragment through a vm (it is `var zh = {...}` inside the
 * factory closure, not an ESM export), then checks:
 *  - zh / en have exactly the same key set;
 *  - no empty values or TODO placeholders;
 *  - every t("key") in the source fragments resolves to a dictionary key;
 *  - every dictionary key is referenced (with an explicit allowlist for keys reached
 *    only through dynamic tables: CATEGORY_LABEL and the sort-key arrays);
 *  - the {placeholder} sets of zh and en match for every key.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "src", "client");
const names = [
  "00-head.js", "05-runtime.js", "10-locale.js", "20-assets.js", "30-network.js",
  "40-format.js", "50-host.js", "60-search.js", "70-styles.js", "80-core.js",
  "90-widgets.js", "100-sections.js", "110-frame.js", "120-frame-inner.js", "130-apply.js"
];

// Evaluate only the locale fragment to get the two objects.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(dir, "10-locale.js"), "utf8"), sandbox, { filename: "10-locale.js" });
const zh = sandbox.zh;
const en = sandbox.en;
assert.ok(zh && en, "locale fragment must define zh and en");

const zhKeys = Object.keys(zh).sort();
const enKeys = Object.keys(en).sort();
assert.deepEqual(zhKeys, enKeys, "zh and en key sets must match exactly");

const placeholders = (value) => {
  const out = [];
  for (const m of String(value).matchAll(/\{(\w+)\}/g)) out.push(m[1]);
  return out.sort().join(",");
};

for (const key of zhKeys) {
  assert.ok(typeof zh[key] === "string" && zh[key] !== "", "empty zh value: " + key);
  assert.ok(typeof en[key] === "string" && en[key] !== "", "empty en value: " + key);
  assert.ok(!/TODO|待译|XXX/i.test(zh[key] + en[key]), "TODO placeholder in: " + key);
  assert.equal(placeholders(zh[key]), placeholders(en[key]), "placeholder mismatch: " + key);
}

// Keys referenced only through runtime tables (not a literal t("...") in source).
const DYNAMIC = new Set([
  "category.doc", "category.sheet", "category.slide", "category.image", "category.code",
  "category.web", "category.config", "category.data", "category.archive", "category.other",
  "sort.lastUsed", "sort.firstUsed", "sort.reads", "sort.exists", "sort.type", "sort.path",
  "sort.createdAt", "sort.updatedAt", "sort.writes"
]);

const referenced = new Set();
for (const name of names) {
  const text = readFileSync(join(dir, name), "utf8");
  for (const m of text.matchAll(/\bt\("([^"]+)"/g)) referenced.add(m[1]);
}
// Dynamic tables store keys as string values inside the fragment: count them too.
const categoryText = readFileSync(join(dir, "40-format.js"), "utf8");
for (const m of categoryText.matchAll(/"(category\.\w+)"/g)) referenced.add(m[1]);
const sectionsText = readFileSync(join(dir, "100-sections.js"), "utf8");
for (const m of sectionsText.matchAll(/label: "(sort\.\w+)"/g)) referenced.add(m[1]);

const dangling = [...referenced].filter((k) => !zhKeys.includes(k));
const unused = zhKeys.filter((k) => !referenced.has(k) && !DYNAMIC.has(k));
assert.deepEqual(dangling, [], "t() references keys missing from the dictionaries");
assert.deepEqual(unused, [], "dictionary keys never referenced (add to DYNAMIC if reached through a table)");

console.log("ok - " + zhKeys.length + " i18n keys, " + referenced.size + " referenced, zh/en + placeholders match");
