/**
 * Client core regression.
 *
 * The client bundle is one big factory closure: its helpers are not exported and the
 * host's `require` only resolves "react", so they cannot be imported as ESM modules.
 * Instead of duplicating the logic in a test file (which would let the real code drift),
 * this script reads the actual source fragments and evaluates them in a `vm` context
 * with tiny stubs for the closure's dependencies, then asserts the real functions.
 *
 * If a fragment is renamed, update SOURCES below. No deps, no bundler, no browser.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "src", "client");
const SOURCES = ["05-runtime.js", "10-locale.js", "40-format.js", "50-host.js", "60-search.js", "80-core.js"];

// Minimal stand-ins for what the factory closure supplies.
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children })
};
const sandbox = {
  BASE: "/doc-ledger",
  S: { mark: { background: "yellow" }, appIcon: {} },
  react: reactStub,
  report: () => {},
  workspaceNav: null,
  hostSidebar: null,
  Date,
  Math,
  String,
  Number,
  Object,
  Array,
  Map,
  Infinity,
  isFinite,
  encodeURIComponent,
  console
};
vm.createContext(sandbox);
const source = SOURCES.map((name) => readFileSync(join(dir, name), "utf8")).join("\n");
vm.runInContext(source, sandbox, { filename: "client-core-fragments.js" });
// Install the Chinese fallback so format helpers resolve through real dictionary values.
vm.runInContext("setFallback(zh)", sandbox);

const f = (name) => sandbox[name];
for (const name of [
  "termsOf", "matches", "sortFiles", "defaultDir", "mergeSessions",
  "fmtTime", "fmtBytes", "encodingLabel", "categoryColor", "categoryLabel",
  "shortPath", "highlight", "hostFileAddress", "iconUrl", "pad"
]) {
  assert.equal(typeof f(name), "function", "missing function from fragments: " + name);
}

const cases = [];
function check(name, body) { cases.push([name, body]); }
const file = (extra = {}) => Object.assign({
  name: "OrderService.java", rel: "src/OrderService.java", path: "C:\\work\\src\\OrderService.java",
  category: "code", sessionTitle: "订单服务", reads: 1, writes: 0,
  firstUsedAt: 100, lastUsedAt: 200, createdAt: null, updatedAt: null, exists: true
}, extra);

// --- termsOf / matches ------------------------------------------------------
check("termsOf: 空查询返回空数组", () => {
  assert.deepEqual(Array.from(f("termsOf")("")), []);
  assert.deepEqual(Array.from(f("termsOf")("   ")), []);
  assert.deepEqual(Array.from(f("termsOf")(null)), []);
  assert.deepEqual(Array.from(f("termsOf")(undefined)), []);
});
check("termsOf: 大小写归一 + 空格分词", () => {
  assert.deepEqual(Array.from(f("termsOf")("  Order   MD  ")), ["order", "md"]);
});
check("matches: 空查询匹配一切", () => {
  assert.equal(f("matches")(file(), ""), true);
  assert.equal(f("matches")(file(), "   "), true);
});
check("matches: 单词命中文件名/路径/类型/会话标题", () => {
  assert.equal(f("matches")(file(), "order"), true);
  assert.equal(f("matches")(file(), "src"), true);
  assert.equal(f("matches")(file(), "code"), true);
  assert.equal(f("matches")(file(), "订单"), true);
});
check("matches: 多词 AND，缺一词即不匹配", () => {
  assert.equal(f("matches")(file({ name: "order-notes.md" }), "order md"), true);
  assert.equal(f("matches")(file({ name: "order-notes.md" }), "order zzz"), false);
});
check("matches: 大小写不敏感", () => {
  assert.equal(f("matches")(file(), "ORDERSERVICE"), true);
});

// --- sortFiles / defaultDir -------------------------------------------------
check("defaultDir: 类型/路径/存在状态升序，其余降序", () => {
  assert.equal(f("defaultDir")("type"), "asc");
  assert.equal(f("defaultDir")("path"), "asc");
  assert.equal(f("defaultDir")("exists"), "asc");
  assert.equal(f("defaultDir")("lastUsed"), "desc");
  assert.equal(f("defaultDir")("reads"), "desc");
});
check("sortFiles: 不修改原数组", () => {
  const list = [file({ name: "b" }), file({ name: "a" })];
  const copy = list.slice();
  f("sortFiles")(list, { key: "path", dir: "asc" });
  assert.deepEqual(list.map((x) => x.name), copy.map((x) => x.name));
});
check("sortFiles: 按 lastUsedAt 降序/升序", () => {
  const list = [file({ name: "old", lastUsedAt: 10 }), file({ name: "new", lastUsedAt: 99 })];
  assert.deepEqual(f("sortFiles")(list, { key: "lastUsedAt", dir: "desc" }).map((x) => x.name), ["new", "old"]);
  assert.deepEqual(f("sortFiles")(list, { key: "lastUsedAt", dir: "asc" }).map((x) => x.name), ["old", "new"]);
});
check("sortFiles: 数值键 reads/writes/createdAt/updatedAt/firstUsed", () => {
  const list = [file({ name: "lo", reads: 1, writes: 1, createdAt: 1, updatedAt: 1, firstUsedAt: 1 }),
                file({ name: "hi", reads: 9, writes: 9, createdAt: 9, updatedAt: 9, firstUsedAt: 9 })];
  for (const key of ["reads", "writes", "createdAt", "updatedAt", "firstUsed"]) {
    assert.deepEqual(f("sortFiles")(list, { key, dir: "desc" }).map((x) => x.name), ["hi", "lo"], key);
  }
});
check("sortFiles: 缺字段按 0 处理", () => {
  const list = [file({ name: "a", reads: undefined }), file({ name: "b", reads: 3 })];
  assert.deepEqual(f("sortFiles")(list, { key: "reads", dir: "desc" }).map((x) => x.name), ["b", "a"]);
});
check("sortFiles: exists=false 排在后面（asc）", () => {
  const list = [file({ name: "missing", exists: false }), file({ name: "here", exists: true })];
  assert.deepEqual(f("sortFiles")(list, { key: "exists", dir: "asc" }).map((x) => x.name), ["here", "missing"]);
});
check("sortFiles: 字符串键用 localeCompare，同值按名字定序", () => {
  const list = [file({ name: "b", category: "code" }), file({ name: "a", category: "doc" })];
  // asc: "code" < "doc", so the code row comes first even though its name sorts later.
  assert.deepEqual(f("sortFiles")(list, { key: "type", dir: "asc" }).map((x) => x.name), ["b", "a"]);
  assert.deepEqual(f("sortFiles")(list, { key: "type", dir: "desc" }).map((x) => x.name), ["a", "b"]);
  const same = [file({ name: "z", category: "code" }), file({ name: "a", category: "code" })];
  assert.deepEqual(f("sortFiles")(same, { key: "type", dir: "asc" }).map((x) => x.name), ["a", "z"]);
});

// --- mergeSessions ----------------------------------------------------------
check("mergeSessions: 按路径去重并累计读写", () => {
  const sessions = [
    { sessionId: "s1", title: "会话一", files: [file({ reads: 2, writes: 1, lastUsedAt: 100 })] },
    { sessionId: "s2", title: "会话二", files: [file({ reads: 3, writes: 4, lastUsedAt: 500 })] }
  ];
  const out = f("mergeSessions")(sessions);
  assert.equal(out.length, 1);
  assert.equal(out[0].reads, 5);
  assert.equal(out[0].writes, 5);
  assert.equal(out[0].lastUsedAt, 500);
  assert.equal(out[0].firstUsedAt, 100);
  assert.equal(out[0].sessionId, "s1");
  assert.equal(out[0].sessionTitle, "会话一");
});
check("mergeSessions: 空会话与空 files 安全", () => {
  assert.deepEqual(f("mergeSessions")([]), []);
  assert.equal(f("mergeSessions")([{ sessionId: "x" }]).length, 0);
});
check("mergeSessions: 不同路径保留", () => {
  const sessions = [{ sessionId: "s", files: [file({ path: "a" }), file({ path: "b" })] }];
  assert.equal(f("mergeSessions")(sessions).length, 2);
});

// --- formatting -------------------------------------------------------------
check("pad: 个位补零", () => {
  assert.equal(f("pad")(3), "03");
  assert.equal(f("pad")(12), "12");
});
check("fmtTime: 0/空返回占位符", () => {
  assert.equal(f("fmtTime")(0), "--");
  assert.equal(f("fmtTime")(null), "--");
});
check("fmtTime: 本年省略年份，跨年带年份", () => {
  const year = new Date().getFullYear();
  const thisOne = new Date(year, 2, 4, 9, 5).getTime();
  const oldOne = new Date(year - 1, 2, 4, 9, 5).getTime();
  assert.equal(f("fmtTime")(thisOne), "03-04 09:05");
  assert.ok(f("fmtTime")(oldOne).startsWith(String(year - 1) + "-"));
});
check("fmtBytes: 非法值返回空串", () => {
  assert.equal(f("fmtBytes")(-1), "");
  assert.equal(f("fmtBytes")("x"), "");
  assert.equal(f("fmtBytes")(NaN), "");
});
check("fmtBytes: B / KB / MB 边界", () => {
  assert.equal(f("fmtBytes")(0), "0 B");
  assert.equal(f("fmtBytes")(1023), "1023 B");
  assert.equal(f("fmtBytes")(1024), "1.0 KB");
  assert.equal(f("fmtBytes")(1024 * 1024), "1.0 MB");
});
check("encodingLabel: 纯 UTF-8 返回 null", () => {
  assert.equal(f("encodingLabel")("utf-8"), null);
  assert.equal(f("encodingLabel")(null), null);
});
check("encodingLabel: 三种非 UTF-8 标签", () => {
  assert.equal(f("encodingLabel")("utf-8+gb18030"), "GB18030 混合解码");
  assert.equal(f("encodingLabel")("utf-16le"), "UTF-16LE");
  assert.equal(f("encodingLabel")("utf-16be"), "UTF-16BE");
});
check("categoryColor / categoryLabel: 已知值与回退", () => {
  assert.equal(f("categoryColor")("doc"), "#4f7cf7");
  assert.equal(f("categoryColor")("nope"), "#94a3b8");
  assert.equal(f("categoryLabel")("doc"), "文档");
  // Unknown categories fall back to the localized "other" label rather than
  // echoing the raw key to the user.
  assert.equal(f("categoryLabel")("nope"), "其他");
  assert.equal(f("categoryLabel")(null), "其他");
});
check("shortPath: 短路径原样，长路径截尾加省略号", () => {
  assert.equal(f("shortPath")("", 10), "");
  assert.equal(f("shortPath")("abc", 10), "abc");
  assert.equal(f("shortPath")("abcdefghij", 5), "…ghij");
});

// --- highlight --------------------------------------------------------------
check("highlight: 无查询原样返回字符串", () => {
  assert.equal(f("highlight")("OrderService.java", ""), "OrderService.java");
});
check("highlight: 单词命中产出 mark 元素", () => {
  const parts = f("highlight")("OrderService.java", "order");
  assert.ok(Array.isArray(parts));
  assert.equal(parts.filter((p) => p && p.type === "mark").length, 1);
  assert.equal(parts.filter((p) => p && p.type === "mark")[0].children[0], "Order");
});
check("highlight: 重叠词合并，不嵌套 mark", () => {
  const parts = f("highlight")("order-notes.md", "ord order");
  const marks = parts.filter((p) => p && p.type === "mark");
  assert.equal(marks.length, 1, "ord+order must merge into one span");
  assert.equal(marks[0].children[0], "order");
});
check("highlight: 多词分别高亮", () => {
  const parts = f("highlight")("order-notes.md", "order md");
  assert.equal(parts.filter((p) => p && p.type === "mark").length, 2);
});

// --- host address / icon URL ------------------------------------------------
check("hostFileAddress: 反斜杠归一 + 盘符冒号保留", () => {
  const addr = f("hostFileAddress")("sess-1", "C:\\work\\a b.txt");
  assert.ok(addr.startsWith("dsh-resource://file/session/sess-1/"));
  assert.ok(addr.includes("C:"));
  assert.ok(!addr.includes("%3A"));
  assert.ok(addr.includes("a%20b.txt"));
});
check("hostFileAddress: 去掉开头的 ./", () => {
  assert.ok(!f("hostFileAddress")("s", "./a/b").includes("/./"));
});
check("iconUrl: 路径被 URL 编码", () => {
  assert.equal(f("iconUrl")("C:\\Program Files\\a.exe"), "/doc-ledger/icon?path=C%3A%5CProgram%20Files%5Ca.exe");
});

let passed = 0;
for (const [name, body] of cases) {
  body();
  passed += 1;
  console.log("  · " + name);
}
console.log("ok - " + passed + " client-core checks");
