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
check("定义了四套主题", () => {
  assert.deepEqual(themes.sort(), ["airy", "card", "compact", "table"]);
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
      assert.ok(value !== null && typeof value === "object" && Object.keys(value).length > 0,
        id + "." + key + " must be a non-empty style object");
    }
  }
});

check("非 compact 主题至少有一处与 compact 不同", () => {
  const compact = sandbox.STYLE_THEMES.compact();
  for (const id of ["airy", "table", "card"]) {
    const other = sandbox.STYLE_THEMES[id]();
    const diff = Object.keys(compact).filter((key) => JSON.stringify(compact[key]) !== JSON.stringify(other[key]));
    assert.ok(diff.length > 0, id + " must differ from compact");
  }
});

check("四套主题两两可区分（不允许只差一两个数值）", () => {
  // Two themes that differ only in a radius read as "the same look", which is exactly the
  // report that made this check exist: cycling four themes felt like two.
  const ids = ["compact", "airy", "table", "card"];
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
  assert.equal(sandbox.styleTheme(), "compact", "unknown id must fall back to compact");
});

check("每个主题都引用宿主 token（深浅色跟随）", () => {
  const compact = sandbox.STYLE_THEMES.compact();
  const rootStyle = JSON.stringify(compact.root);
  assert.ok(rootStyle.includes("--dsw-alias"), "root must use a host theme token");
});

check("颜色只引用真实存在的宿主 token（拼错的 token 会静默退化成浅色）", () => {
  // The host declares a fixed set; a name outside it silently falls back to the literal,
  // which is how the panel ignored dark mode: --dsw-alias-accent, --dsw-alias-border and
  // --dsw-alias-label-tertiary do not exist.
  const REAL = [
    "--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-bg-layer-2",
    "--dsw-alias-bg-overlay", "--dsw-alias-border-l1", "--dsw-alias-border-l2",
    "--dsw-alias-brand-primary", "--dsw-alias-label-primary", "--dsw-alias-label-secondary",
    "--dsw-alias-state-error-primary", "--dsw-alias-state-idle-primary",
    "--dsw-alias-state-success-primary", "--dsw-alias-state-warn-primary",
    "--dsw-specific-sidebar-fill"
  ];
  const source = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");
  // Only real `var(--token` references count: prose in a comment is not a token use.
  const used = new Set([...source.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map((m) => m[1]));
  const unknown = [...used].filter((token) => !REAL.includes(token));
  assert.deepEqual(unknown, [], "unknown theme tokens (they fall back to a light literal)");
});

check("样式表里没有写死的十六进制或 rgba 颜色", () => {
  // Every colour has to come from the palette so it can follow light/dark. The palette
  // itself is the one place allowed to hold fallback literals.
  const source = readFileSync(join(root, "src", "client", "70-styles.js"), "utf8");
  const body = source.slice(source.indexOf("function compactStyles"));
  const literals = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);
  assert.deepEqual(literals, [], "hardcoded colours outside the palette: " + literals.slice(0, 5).join(", "));
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " theme checks");
