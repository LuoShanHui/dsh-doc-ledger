/**
 * Row time regression.
 *
 * A row prints exactly ONE timestamp, chosen by the section it sits in (see rowTime):
 * last-used in "Used", updated in "Modified", created in "Created". Printing both stamps
 * was what pushed rows to two lines and widened every row past the panel. This evaluates
 * the real fragment (90-widgets also defines components, so only rowTime is exercised
 * through the vm after the runtime/format fragments establish `t`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "src", "client");

const sandbox = {
  react: { createElement: () => null, memo: (fn) => fn, useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({ current: null }), useCallback: (fn) => fn, useMemo: (fn) => fn() },
  Set,
  Map,
  Object,
  Array,
  String,
  Number,
  Math,
  Date,
  isFinite,
  encodeURIComponent,
  console
};
vm.createContext(sandbox);

// The pieces rowTime needs: the translator, its fallback dictionary, and fmtTime.
const source = ["05-runtime.js", "10-locale.js", "40-format.js", "90-widgets.js"]
  .map((name) => readFileSync(join(dir, name), "utf8"))
  .join("\n");
vm.runInContext(source, sandbox, { filename: "row-time-fragments.js" });
vm.runInContext("setFallback({ zh: zh, en: en }); setTranslator(null, 'en');", sandbox);

const rowTime = sandbox.rowTime;
assert.equal(typeof rowTime, "function", "rowTime must exist in 90-widgets");

const cases = [];
function check(name, body) { cases.push([name, body]); }

// fmtTime renders in the machine's local zone, so build the fixtures locally — a UTC
// timestamp would shift by the offset here and the assertion would test the offset too.
const at = (day, hour, minute) => new Date(2026, 10, day, hour, minute, 0, 0).getTime();

const file = (extra = {}) => Object.assign({
  name: "a.md", path: "C:/w/a.md", rel: "a.md",
  reads: 1, writes: 0,
  firstUsedAt: at(1, 8, 0),
  lastUsedAt: at(2, 9, 30),
  createdAt: at(3, 10, 0),
  updatedAt: at(4, 11, 15)
}, extra);

check("used 分组显示最近使用，不是创建/修改", () => {
  const out = rowTime(file(), "used");
  assert.match(out, /11-02 09:30/, "used row must show lastUsedAt, got: " + out);
  assert.ok(!out.includes("11-03"), "used row must not also print createdAt");
});

check("created 分组显示创建时间", () => {
  assert.match(rowTime(file(), "created"), /11-03 10:00/);
});

check("modified 分组显示更新时间", () => {
  assert.match(rowTime(file(), "modified"), /11-04 11:15/);
});

check("每行只输出一个时间戳", () => {
  for (const mode of ["used", "created", "modified"]) {
    const hits = rowTime(file(), mode).match(/\d{2}-\d{2} \d{2}:\d{2}/g) || [];
    assert.equal(hits.length, 1, mode + " must print exactly one stamp, got " + hits.length);
  }
});

check("缺字段时降级而不是渲染 null", () => {
  assert.equal(rowTime(file({ createdAt: null }), "created"), "", "no createdAt must render empty");
  assert.equal(rowTime(file({ updatedAt: null }), "modified"), "", "no updatedAt must render empty");
  const usedFallback = rowTime(file({ lastUsedAt: null }), "used");
  assert.match(usedFallback, /11-04 11:15/, "used must fall back to updatedAt");
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " row-time checks");
