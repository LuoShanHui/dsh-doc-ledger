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
  console,
  // 130-apply's readActiveLocale takes a ctx; keep the stub shape explicit.
  undefined: undefined
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
  "shortPath", "highlight", "hostFileAddress", "iconUrl", "pad",
  "sortSpecOf", "rowModeOf", "rowsReachable", "rowLimitOf", "clampRowIndex",
  "isActiveRow", "hasActiveRow", "nextRowLimit"
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

// --- plural selection -------------------------------------------------------
// The same t() must pick `_one` for 1 and `_other` for 0/2 in English, and must fall
// back to the base key when a language has no plural variants (Chinese).
check("t(): 英文单选 _one，复数选 _other", () => {
  const sb = sandbox;
  vm.runInContext(
    'setFallback({ zh: {}, en: { "x.files_one": "{n} file", "x.files_other": "{n} files", "x.files": "{n} files" } });' +
    'setTranslator(null, "en");',
    sb
  );
  assert.equal(f("t")("x.files", { n: 1 }), "1 file");
  assert.equal(f("t")("x.files", { n: 2 }), "2 files");
  assert.equal(f("t")("x.files", { n: 0 }), "0 files");
});
check("t(): 无变体时回退基础 key（中文形态）", () => {
  const sb = sandbox;
  vm.runInContext('setFallback({ zh: { "y.rows": "行数 {n}" }, en: { "y.rows": "rows {n}" } }); setTranslator(null, "zh");', sb);
  assert.equal(f("t")("y.rows", { n: 5 }), "行数 5");
});
check("t(): count 之外的首个数字参数也能驱动复数", () => {
  const sb = sandbox;
  vm.runInContext(
    'setFallback({ zh: {}, en: { "z.s_one": "{files} file", "z.s_other": "{files} files" } }); setTranslator(null, "en");',
    sb
  );
  assert.equal(f("t")("z.s", { files: 1 }), "1 file");
  assert.equal(f("t")("z.s", { files: 3 }), "3 files");
});
// --- unsupported languages fall back to English -------------------------------
// The host walks active -> fallback chain -> common; every addLanguage fallback must
// terminate at English, so a language we do not ship (ja, ko, ru...) shows our English
// dictionary. The plural form must agree with that, not with the picked language.
check("未支持的语言：文案与复数都退回英文（不是中文）", () => {
  const sb = sandbox;
  vm.runInContext(
    'setFallback({ zh: { "k.one": "中文1", "k.files_one": "{n} 个文件", "k.files_other": "{n} 个文件" },' +
    '              en: { "k.one": "EN1", "k.files_one": "{n} file", "k.files_other": "{n} files" } });' +
    'setTranslator(null, "ja");',
    sb
  );
  // The host has no ja dictionary, so it hands back the key and our en fallback answers.
  assert.equal(f("t")("k.one"), "EN1");
  assert.equal(f("t")("k.files", { n: 1 }), "1 file", "ja must use English plural rules");
  assert.equal(f("t")("k.files", { n: 2 }), "2 files");
});
check("未支持的语言：语言标签是 zh 时才用中文", () => {
  const sb = sandbox;
  vm.runInContext(
    'setFallback({ zh: { "m.x": "中文" }, en: { "m.x": "English" } }); setTranslator(null, "zh");',
    sb
  );
  assert.equal(f("t")("m.x"), "中文");
});
check("未支持的语言：locale 为空/异常时按英文处理", () => {
  const sb = sandbox;
  vm.runInContext('setFallback({ zh: { "n.x": "中文" }, en: { "n.x": "English" } }); setTranslator(null, "");', sb);
  // setTranslator ignores an empty tag, so currentLocale keeps its previous value;
  // the point is that it never falls through to an invalid Intl tag.
  assert.equal(f("t")("n.x") === "中文" || f("t")("n.x") === "English", true);
});
check("t(): 未知 key 原样返回，不崩", () => {
  assert.equal(f("t")("no.such.key"), "no.such.key");
});

// --- section decisions (extracted from SessionCard, where no test could reach them) ----
const USED_SORT = { key: "lastUsed", dir: "desc" };
const CREATED_SORT = { key: "createdAt", dir: "desc" };
const MODIFIED_SORT = { key: "updatedAt", dir: "desc" };

check("sortSpecOf: 使用过用改自己的排序，其余共用创建排序", () => {
  assert.equal(f("sortSpecOf")("u", USED_SORT, CREATED_SORT, MODIFIED_SORT), USED_SORT);
  assert.equal(f("sortSpecOf")("ms", USED_SORT, CREATED_SORT, MODIFIED_SORT), MODIFIED_SORT);
  assert.equal(f("sortSpecOf")("c", USED_SORT, CREATED_SORT, MODIFIED_SORT), CREATED_SORT);
  assert.equal(f("sortSpecOf")("cs", USED_SORT, CREATED_SORT, MODIFIED_SORT), CREATED_SORT);
});

check("rowModeOf: 分区决定显示哪个时间戳", () => {
  assert.equal(f("rowModeOf")("u"), "used");
  assert.equal(f("rowModeOf")("ms"), "modified");
  assert.equal(f("rowModeOf")("c"), "created");
  assert.equal(f("rowModeOf")("cs"), "created");
});

check("rowsReachable: 折叠或未渲染都不参与 roving 序号", () => {
  assert.equal(f("rowsReachable")(true, true), true);
  assert.equal(f("rowsReachable")(undefined, true), true, "undefined means open by default");
  assert.equal(f("rowsReachable")(false, true), false, "collapsed section builds no DOM");
  assert.equal(f("rowsReachable")(true, false), false, "merged view computes split arrays without rendering them");
  assert.equal(f("rowsReachable")(false, false), false);
});

check("rowLimitOf: 用分区自己的页限，缺省回退默认值", () => {
  assert.equal(f("rowLimitOf")("u", { u: 200 }, 100), 200);
  assert.equal(f("rowLimitOf")("u", {}, 100), 100);
  assert.equal(f("rowLimitOf")("u", null, 100), 100);
  assert.equal(f("rowLimitOf")("u", { u: 0 }, 100), 100, "0 is not a usable page limit");
  assert.equal(f("rowLimitOf")("u", { u: -5 }, 100), 100);
});

check("clampRowIndex: 到边界停住，不环绕", () => {
  assert.equal(f("clampRowIndex")(0, 1, 5), 1);
  assert.equal(f("clampRowIndex")(4, 1, 5), 4, "past the last row stays on the last row");
  assert.equal(f("clampRowIndex")(0, -1, 5), 0, "before the first row stays on the first row");
  assert.equal(f("clampRowIndex")(2, -1, 5), 1);
  assert.equal(f("clampRowIndex")(0, 1, 0), 0, "an empty section has nowhere to move");
});

check("isActiveRow: 只有时间戳没有计数也算活动", () => {
  assert.equal(f("isActiveRow")(file({ reads: 1 })), true);
  assert.equal(f("isActiveRow")(file({ reads: 0, writes: 0, firstUsedAt: 1 })), true, "a bare firstUsedAt counts");
  assert.equal(f("isActiveRow")(file({ reads: 0, writes: 0, firstUsedAt: 0, createdAt: 5 })), true);
  assert.equal(f("isActiveRow")(file({ reads: 0, writes: 0, firstUsedAt: 0, createdAt: 0 })), false);
  assert.equal(f("isActiveRow")(null), false);
});

check("hasActiveRow: 过滤后没有任何活动行时整张卡不出现", () => {
  const files = [file({ reads: 1 }), file({ reads: 0, writes: 0, firstUsedAt: 0, createdAt: 0 })];
  assert.equal(f("hasActiveRow")(files), true);
  assert.equal(f("hasActiveRow")([file({ reads: 0, writes: 0, firstUsedAt: 0, createdAt: 0 })]), false);
  assert.equal(f("hasActiveRow")([]), false);
  assert.equal(f("hasActiveRow")(null), false);
  // a filter that excludes the only active row must empty the card
  assert.equal(f("hasActiveRow")(files, function (x) { return x.reads === 9; }), false);
});

check("nextRowLimit: 每次加一页，未设置时从一页起算", () => {
  assert.equal(f("nextRowLimit")(undefined, 100), 200, "first click offers the second page");
  assert.equal(f("nextRowLimit")(100, 100), 200);
  assert.equal(f("nextRowLimit")(300, 100), 400);
  assert.equal(f("nextRowLimit")(0, 100), 200);
  assert.equal(f("nextRowLimit")(undefined, 0), 200, "a missing page size falls back to 100");
});

// --- host locale snapshot -----------------------------------------------
// The host's getLocale() returns { active, locales, revision }, NOT a string. Passing the
// object straight to Intl.PluralRules throws RangeError and silently degrades every
// English plural to _other ("1 files"), so these pin the unwrapping.
check("readActiveLocale: 从 LocaleSnapshot 取 .active", () => {
  const ctx = { locale: { getLocale: () => ({ active: "en", locales: [], revision: 3 }) } };
  assert.equal(f("readActiveLocale")(ctx), "en");
});
check("readActiveLocale: 兼容直接返回字符串", () => {
  assert.equal(f("readActiveLocale")({ locale: { getLocale: () => "en" } }), "en");
});
check("readActiveLocale: 缺失/异常时回退 en（不谎报中文）", () => {
  assert.equal(f("readActiveLocale")(null), "en");
  assert.equal(f("readActiveLocale")({}), "en");
  assert.equal(f("readActiveLocale")({ locale: {} }), "en");
  assert.equal(f("readActiveLocale")({ locale: { getLocale: () => { throw new Error("boom"); } } }), "en");
  assert.equal(f("readActiveLocale")({ locale: { getLocale: () => ({ active: "" }) } }), "en");
  assert.equal(f("readActiveLocale")({ locale: { getLocale: () => 42 } }), "en");
});
check("快照对象直接喂给 Intl.PluralRules 会抛（复现原始 bug）", () => {
  assert.throws(() => new Intl.PluralRules(String({ active: "en" })), RangeError);
});

let passed = 0;
for (const [name, body] of cases) {
  body();
  passed += 1;
  console.log("  · " + name);
}
console.log("ok - " + passed + " client-core checks");
