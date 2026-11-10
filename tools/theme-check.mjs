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

check("每个主题每个 key 都是非空对象", () => {
  for (const id of themes) {
    const styles = sandbox.STYLE_THEMES[id]();
    for (const key of Object.keys(styles)) {
      assert.ok(styles[key] !== null && typeof styles[key] === "object" && Object.keys(styles[key]).length > 0,
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

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " theme checks");
