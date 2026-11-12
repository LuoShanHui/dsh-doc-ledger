/**
 * Theme factory regression.
 *
 * `70-styles.js` defines four themes that must all produce the SAME set of style keys:
 * a component reads `S.xxx`, so a theme that omits a key (or adds one) would silently
 * drop or orphan a style. This loads the real fragment in a vm with a react stub and
 * asserts every theme yields the identical key set, non-empty objects, and a distinct
 * look (at least one key differs from `compact`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");

const sandbox = {
  react: { useState: () => [null, () => {}], useEffect: () => {} },
  Set,
  Object,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "70-styles.js" });

const cases = [];
function check(name, body) { cases.push([name, body]); }

const themes = Object.keys(sandbox.STYLE_THEMES);
check("定义了四套主题（卡片为默认）", () => {
  assert.deepEqual(themes.sort(), ["card", "compact", "grid", "timeline"]);
});

const keysOf = (styles) => Object.keys(styles).sort();
check("所有主题的 key 集合一致", () => {
  const base = keysOf(sandbox.STYLE_THEMES.compact());
  for (const id of themes) {
    assert.deepEqual(keysOf(sandbox.STYLE_THEMES[id]()), base, id + " differs from compact");
  }
  assert.ok(base.length >= 55, "expected the full style key set, got " + base.length);
});

// A handful of keys are semantic color strings for imperative handlers (focus ring, hover
// wash, check mark) rather than style objects — the only two shapes the table holds.
const COLOR_KEYS = ["focusRing", "hoverWash", "ghostLabel", "menuHover", "checkMark"];

check("每个主题每个 key 都是非空对象或颜色字符串", () => {
  for (const id of themes) {
    const styles = sandbox.STYLE_THEMES[id]();
    for (const key of Object.keys(styles)) {
      const value = styles[key];
      if (COLOR_KEYS.includes(key)) {
        assert.equal(typeof value, "string", id + "." + key + " must be a color string");
        assert.ok(value.length > 0, id + "." + key + " must not be empty");
        continue;
      }
      // A key may be null when a theme deliberately draws nothing for it (cardRail).
      if (value === null) continue;
      assert.ok(typeof value === "object" && Object.keys(value).length > 0,
        id + "." + key + " must be a non-empty style object");
    }
  }
});

check("非 compact 主题至少有一处与 compact 不同", () => {
  const compact = sandbox.STYLE_THEMES.compact();
  for (const id of ["card", "grid", "timeline"]) {
    const other = sandbox.STYLE_THEMES[id]();
    const diff = Object.keys(compact).filter((key) => JSON.stringify(compact[key]) !== JSON.stringify(other[key]));
    assert.ok(diff.length > 0, id + " must differ from compact");
  }
});

check("四套主题两两可区分（不允许只差一两个数值）", () => {
  // Two themes that differ only in a radius read as "the same look", which is exactly the
  // report that made this check exist: cycling four themes felt like two.
  const ids = ["compact", "timeline", "grid", "card"];
  const built = Object.fromEntries(ids.map((id) => [id, sandbox.STYLE_THEMES[id]()]));
  const differingKeys = (a, b) =>
    Object.keys(built[a]).filter((key) => JSON.stringify(built[a][key]) !== JSON.stringify(built[b][key]));
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const diff = differingKeys(ids[i], ids[j]);
      assert.ok(diff.length >= 6,
        ids[i] + " vs " + ids[j] + " differ in only " + diff.length + " keys; each theme needs its own identity");
    }
  }
});

check("setStyleTheme 会切换并拒绝未知 id", () => {
  vm.runInContext('setStyleTheme("card")', sandbox);
  assert.equal(sandbox.styleTheme(), "card");
  vm.runInContext('setStyleTheme("not-a-theme")', sandbox);
  assert.equal(sandbox.styleTheme(), "card", "unknown id must fall back to the default (card)");
});

check("配色跟随宿主 token，并为每个 token 备好回退字面量", () => {
  // The host is the source of truth: DSH defines its colours as custom properties on <body>,
  // including a user's own theme, so following them is what "follow the DSH appearance" means.
  // The literals only serve the harness and the static report, which have no host.
  const src = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");
  const host = src.slice(src.indexOf("var HOST = {"), src.indexOf("var prefersDark = readDarkScheme();"));
  const entries = [...host.matchAll(/^\s{6}(\w+):\s*"var\((--dsw-[a-z0-9-]+),\s*(#[0-9a-f]{3,8})\)"/gm)];
  assert.ok(entries.length >= 12, "expected every palette entry to be a var() with a fallback, got " + entries.length);
  // Both literal tables must cover exactly the same keys, or one scheme has a hole.
  const light = src.slice(src.indexOf("var LIGHT = {"), src.indexOf("var DARK = {"));
  const dark = src.slice(src.indexOf("var DARK = {"), src.indexOf("/** Theme tokens first"));
  const keysOf = (block) => [...block.matchAll(/(\w+):\s*"#/g)].map((m) => m[1]).sort();
  assert.deepEqual(keysOf(light), keysOf(dark), "the light and dark fallbacks must define the same keys");
});

check("样式表里没有写死的十六进制或 rgba 颜色", () => {
  // Every colour has to come from the palette so it can follow light/dark. The palette and the
  // two-scheme ACCENT constant are the only places allowed to hold a literal.
  const source = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");
  const body = source.slice(source.indexOf("function compactStyles"));
  const literals = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);
  assert.deepEqual(literals, [], "hardcoded colours outside the palette: " + literals.slice(0, 5).join(", "));
});

check("强调色与背景层次由自己派生，不依赖宿主的 ink/白", () => {
  // Pinned because "follow the host faithfully" produced a black rail on a white card: the
  // host's brand token is ink and its two surface levels are both #fff.
  const source = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");
  assert.ok(/function accentFor\(dark\)/.test(source), "the accent must come from its own two-scheme pair");
  assert.ok(/var ACCENT = accentFor\(prefersDark\)/.test(source), "ACCENT must be built from that pair");
  assert.ok(source.includes("var backdrop = dark"), "the backdrop must be derived from the surface");
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " theme checks");
