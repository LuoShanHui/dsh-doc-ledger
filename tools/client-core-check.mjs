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
  "termsOf", "matches", "sortFiles", "defaultDir", "mergeSessions", "minStamp", "maxStamp",
  "fmtTime", "fmtBytes", "encodingLabel", "categoryColor", "categoryLabel",
  "shortPath", "highlight", "hostFileAddress", "iconUrl", "pad",
  "sortSpecOf", "rowModeOf", "rowsReachable", "rowLimitOf", "clampRowIndex",
  "isActiveRow", "hasActiveRow", "nextRowLimit", "extOf", "fileIconUrl",
  "extensionCensus", "extensionChips", "foldCase",
  "typeFilterOf", "withFamilyToggled", "withExtensionToggled", "withoutType", "familiesOf", "extensionsOf", "typeSelections", "typeFilterActive", "passesTypeFilter", "rowPasses", "filterConditions", "filterIsActive", "filterSignature", "deletedPasses", "countDeleted"
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
check("matches: 会话 ID 可搜，带不带 session- 前缀都行", () => {
  // 真实反馈：从会话菜单复制会话 ID 粘进搜索框搜不到东西，
  // 因为 matches() 从来没看过这个字段。
  const withId = file({ sessionId: "session-c1a01f6e-a6ac-42e4-b4d3-3ef4146664bc" });
  assert.equal(f("matches")(withId, "c1a01f6e"), true, "粘一段就应该命中");
  assert.equal(f("matches")(withId, "session-c1a01f6e-a6ac-42e4-b4d3-3ef4146664bc"), true, "完整 id");
  assert.equal(f("matches")(withId, "a6ac-42e4"), true, "中间一段");
  assert.equal(f("matches")(withId, "b4d3-3ef4146664bc"), true, "尾部一段");
  // 没有这个字段的行不能因此匹配一切。
  assert.equal(f("matches")(file({}), "c1a01f6e"), false);
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

check("mergeSessions: 缺时间戳保持 null，不变成 Infinity", () => {
  // 真实缺陷：Math.min(a || Infinity, b || Infinity) 两边都缺时得到 Infinity。
  // Infinity 是真值，于是「只写过、从未读过」的文件跑进了「使用过」分区，
  // 时间戳渲染成 NaN-NaN-NaN NaN:NaN（本机真实数据里 25 行）。
  const sessions = [
    { sessionId: "s1", files: [file({ path: "w.py", reads: 0, writes: 1, firstUsedAt: null, lastUsedAt: null, createdAt: 100 })] },
    { sessionId: "s2", files: [file({ path: "w.py", reads: 0, writes: 3, firstUsedAt: null, lastUsedAt: null, createdAt: 200 })] }
  ];
  const out = f("mergeSessions")(sessions);
  assert.equal(out.length, 1);
  assert.equal(out[0].firstUsedAt, null, "firstUsedAt 必须是 null，不能是 Infinity");
  assert.equal(out[0].lastUsedAt, null);
  assert.equal(out[0].writes, 4);
  assert.equal(Number.isFinite(out[0].createdAt), true);
  // 只写过 → 不应被判为「活动」以外的语义；isActiveRow 允许它存在，但 usedAll 只看 reads。
  assert.equal((out[0].reads || 0) > 0, false);
});
check("mergeSessions: 一侧有时间戳时取那一侧", () => {
  const sessions = [
    { sessionId: "s1", files: [file({ path: "a.md", reads: 1, firstUsedAt: null, lastUsedAt: null })] },
    { sessionId: "s2", files: [file({ path: "a.md", reads: 2, firstUsedAt: 500, lastUsedAt: 900 })] }
  ];
  const out = f("mergeSessions")(sessions)[0];
  assert.equal(out.firstUsedAt, 500);
  assert.equal(out.lastUsedAt, 900);
});
check("minStamp / maxStamp: 忽略 null、NaN、Infinity", () => {
  const { minStamp, maxStamp } = { minStamp: f("minStamp"), maxStamp: f("maxStamp") };
  assert.equal(minStamp(null, 5), 5);
  assert.equal(minStamp(5, null), 5);
  assert.equal(minStamp(null, null), null);
  assert.equal(minStamp(Infinity, 7), 7);
  assert.equal(minStamp(3, 9), 3);
  assert.equal(maxStamp(null, 5), 5);
  assert.equal(maxStamp(null, null), null);
  assert.equal(maxStamp(Infinity, 7), 7);
  assert.equal(maxStamp(3, 9), 9);
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
check("fmtTime: 跨年判断按调用时的那一年，不按模块加载时", () => {
  // 真实缺陷：THIS_YEAR 在模块求值时捕获，长驻窗口跨年后，1 月的记录会被当成往年
  // 而多印一个年份。这里只能验证「当年时间戳不带年份」与「非当年带年份」两端，
  // 因为测试进程的年份就是调用时的年份。
  const now = new Date();
  const sameYear = new Date(now.getFullYear(), 0, 2, 3, 4).getTime();
  assert.match(f("fmtTime")(sameYear), /^\d{2}-\d{2} \d{2}:\d{2}$/, "当年不应带年份");
  const otherYear = new Date(now.getFullYear() - 1, 5, 6, 7, 8).getTime();
  assert.match(f("fmtTime")(otherYear), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, "往年必须带年份");
});
check("fmtTime: Infinity / NaN 返回占位符而不是 NaN-NaN", () => {
  assert.equal(f("fmtTime")(Infinity), "--");
  assert.equal(f("fmtTime")(NaN), "--");
  assert.equal(f("fmtTime")(undefined), "--");
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
  assert.equal(f("categoryColor")("doc"), "#3b6fe0");
  assert.equal(f("categoryColor")("nope"), "#94a3b8");
  // Every family the sorter can emit must have a colour and a label, or a chip renders blank.
  for (const family of ["doc", "sheet", "slide", "image", "code", "web", "config", "data", "media", "archive", "binary", "other"]) {
    assert.match(f("categoryColor")(family), /^#[0-9a-f]{6}$/, family + " needs a colour");
    assert.notEqual(f("categoryLabel")(family), "category." + family, family + " needs a label");
  }
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

check("highlight: 大小写展开的字符不能让后续高亮错位", () => {
  // `toLowerCase()` is not length-preserving: "İ" (U+0130) becomes "i" + U+0307. Searching the
  // lowered copy and slicing the original with those offsets marked the wrong characters —
  // measured: "doc-İstanbul-notes.md" searched for "notes" produced "otes." instead of "notes".
  const cases = [
    ["doc-İstanbul-notes.md", "notes"],
    ["ẞ-strasse.md", "strasse"],
    ["ΑΘΗΝΑ-notes.md", "notes"]
  ];
  for (const [value, query] of cases) {
    const parts = f("highlight")(value, query);
    const marks = parts.filter((p) => p && p.type === "mark");
    assert.ok(marks.length > 0, value + " must produce a mark for " + query);
    for (const mark of marks) {
      const text = mark.children[0];
      assert.equal(text.toLowerCase(), query.toLowerCase(),
        "高亮片段必须正是被搜索的词（" + value + "）：切出的是 " + JSON.stringify(text));
      assert.notEqual(value.toLowerCase().indexOf(text.toLowerCase()), -1,
        "高亮片段必须真的出现在原文里，而不是错位后的片段");
    }
  }
  // The plain-ASCII path is unchanged: an identity fold must still mark exactly one span.
  const ascii = f("highlight")("OrderService.java", "order");
  assert.equal(ascii.filter((p) => p && p.type === "mark")[0].children[0], "Order");
  // Chinese is unaffected and must stay that way.
  const zh = f("highlight")("订单服务重构说明.md", "重构");
  assert.equal(zh.filter((p) => p && p.type === "mark")[0].children[0], "重构");
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

check("typeFilterOf: 一级与二级互斥，二级可跨家族多选", () => {
  // The three rules the three-row UI depends on. They live in one constructor precisely so they
  // cannot be forgotten by a caller: a family means "all of it", an extension means "part of it",
  // and holding both for the same family would be a filter that cannot be explained.
  const empty = f("typeFilterOf")(null, null);
  assert.equal(f("typeFilterActive")(empty), false, "什么都没有勾时不构成筛选");
  assert.equal(JSON.stringify(f("familiesOf")(empty)), "[]");
  assert.equal(JSON.stringify(f("extensionsOf")(empty)), "[]");

  // Rule 1: a family owns no extensions.
  const conflicting = f("typeFilterOf")({ code: true }, { code: { java: true } });
  assert.equal(JSON.stringify(f("familiesOf")(conflicting)), JSON.stringify(["code"]));
  assert.equal(JSON.stringify(f("extensionsOf")(conflicting)), "[]", "同一家族的一级与二级不能同时存在");

  // Rule 2: extensions from *different* families coexist — this is what makes the second row a
  // multi-select rather than one choice.
  const cross = f("typeFilterOf")({}, { code: { java: true }, config: { yml: true } });
  assert.equal(JSON.stringify(f("extensionsOf")(cross)),
    JSON.stringify([{ family: "code", ext: "java" }, { family: "config", ext: "yml" }]),
    "二级可以跨家族多选");
  assert.equal(f("typeFilterActive")(cross), true);

  // Rule 3: "" is the no-extension bucket and is a real value, not "nothing chosen".
  const bucket = f("typeFilterOf")({}, { config: { "": true } });
  assert.equal(JSON.stringify(f("extensionsOf")(bucket)), JSON.stringify([{ family: "config", ext: "" }]), "无扩展名要保留成空串");
  assert.equal(f("typeFilterActive")(bucket), true);
  assert.equal(JSON.stringify(f("familiesOf")(f("typeFilterOf")({ doc: true }, null))), JSON.stringify(["doc"]));
});

check("withFamilyToggled: 勾一级清掉它自己的二级，不碰别的家族", () => {
  let state = f("typeFilterOf")({}, { code: { java: true }, doc: { md: true } });
  state = f("withFamilyToggled")(state, "code");
  assert.equal(JSON.stringify(f("familiesOf")(state)), JSON.stringify(["code"]), "一级被勾中");
  assert.equal(JSON.stringify(f("extensionsOf")(state)), JSON.stringify([{ family: "doc", ext: "md" }]),
    "只清掉 code 自己的二级，doc 的保持");

  // Un-ticking must not promote the narrower selection back.
  state = f("withFamilyToggled")(state, "code");
  assert.equal(JSON.stringify(f("familiesOf")(state)), "[]");
  assert.equal(JSON.stringify(f("extensionsOf")(state)), JSON.stringify([{ family: "doc", ext: "md" }]));

  // Multi-select on the first row.
  let two = f("withFamilyToggled")(f("typeFilterOf")({}, {}), "code");
  two = f("withFamilyToggled")(two, "doc");
  assert.equal(JSON.stringify(f("familiesOf")(two)), JSON.stringify(["code", "doc"]));
});

check("withExtensionToggled: 勾二级取消同家族的一级", () => {
  // Ticking `code/java` un-ticks the `code` family — the mirror of the previous test.
  let state = f("withFamilyToggled")(f("typeFilterOf")({}, {}), "code");
  state = f("withExtensionToggled")(state, "code", "java");
  assert.equal(JSON.stringify(f("familiesOf")(state)), "[]", "同家族的一级被取消");
  assert.equal(JSON.stringify(f("extensionsOf")(state)), JSON.stringify([{ family: "code", ext: "java" }]));

  // Toggling the same extension again removes it.
  state = f("withExtensionToggled")(state, "code", "java");
  assert.equal(JSON.stringify(f("extensionsOf")(state)), "[]");
  assert.equal(f("typeFilterActive")(state), false);

  // A second family is untouched.
  let mixed = f("typeFilterOf")({ doc: true }, null);
  mixed = f("withExtensionToggled")(mixed, "config", "yml");
  assert.equal(JSON.stringify(f("familiesOf")(mixed)), JSON.stringify(["doc"]));
  assert.equal(JSON.stringify(f("extensionsOf")(mixed)), JSON.stringify([{ family: "config", ext: "yml" }]));

  // "" is a real choice here too.
  const bare = f("withExtensionToggled")(f("typeFilterOf")({}, {}), "config", "");
  assert.equal(JSON.stringify(f("extensionsOf")(bare)), JSON.stringify([{ family: "config", ext: "" }]));
});

check("withoutType / typeSelections: 第三行的 × 只移除那一项", () => {
  let state = f("typeFilterOf")({ doc: true }, { code: { java: true } });
  // A family tick has ext === null; an extension tick carries its own family.
  state = f("withoutType")(state, "doc", null);
  assert.equal(JSON.stringify(f("familiesOf")(state)), "[]", "移除一级");
  assert.equal(JSON.stringify(f("extensionsOf")(state)), JSON.stringify([{ family: "code", ext: "java" }]), "别的项不受影响");

  state = f("withoutType")(state, "code", "java");
  assert.equal(f("typeFilterActive")(state), false, "移除二级");

  // The third row's content: families first, then extensions, stable order.
  const both = f("typeFilterOf")({ doc: true }, { code: { java: true }, config: { "": true } });
  assert.equal(JSON.stringify(f("typeSelections")(both)),
    JSON.stringify([{ family: "doc", ext: null }, { family: "code", ext: "java" }, { family: "config", ext: "" }]));
});

check("filterConditions: 一组条件，各层共用", () => {
  // Adding a term must be a one-file change. If a caller could still assemble the options itself,
  // the next term would again have to be threaded through every call site — that is exactly how
  // the extension filter ended up applied to the counts but not to the rows.
  const c = f("filterConditions")({ query: "  order ", typeSet: { code: true }, extSet: { doc: { md: true } }, deletedOnly: true });
  assert.equal(c.query, "  order ", "the query is kept as given");
  assert.equal(JSON.stringify(c.extSet), JSON.stringify({ doc: { md: true } }), "二级是一张家族到扩展名的表");
  assert.equal(c.deletedOnly, true);
  assert.equal(JSON.stringify(Object.keys(c.typeSet)), JSON.stringify(["code"]));
  assert.equal(Object.isFrozen(c), true, "the set is immutable, so no layer can quietly add a term");

  // Defaults: nothing filters.
  const empty = f("filterConditions")(null);
  assert.equal(empty.query, "");
  assert.equal(empty.extSet, null, "没有二级筛选就是 null");
  assert.equal(empty.deletedOnly, false);
  assert.equal(empty.typeSet, null);
  assert.equal(f("filterIsActive")(empty), false);

  // "" is a real extension choice and must count as active.
  const bucket = f("filterConditions")({ extSet: { config: { "": true } } });
  assert.equal(JSON.stringify(bucket.extSet), JSON.stringify({ config: { "": true } }), "无扩展名桶要保留成空串键");
  assert.equal(f("filterIsActive")(bucket), true);
});

check("filterSignature: 条件变了签名就变", () => {
  const base = { query: "", typeSet: { code: true }, extSet: null, deletedOnly: false };
  const a = f("filterSignature")(f("filterConditions")(base));
  const same = f("filterSignature")(f("filterConditions")(base));
  assert.equal(a, same, "identical conditions give an identical signature");

  // Each term must move the signature, or a memoised card would keep stale rows.
  assert.notEqual(a, f("filterSignature")(f("filterConditions")({ query: "order", typeSet: { code: true }, extSet: null, deletedOnly: false })));
  assert.notEqual(a, f("filterSignature")(f("filterConditions")({ query: "", typeSet: { doc: true }, extSet: null, deletedOnly: false })));
  assert.notEqual(a, f("filterSignature")(f("filterConditions")({ query: "", typeSet: { code: true }, extSet: { code: { java: true } }, deletedOnly: false })));
  assert.notEqual(a, f("filterSignature")(f("filterConditions")({ query: "", typeSet: { code: true }, extSet: null, deletedOnly: true })));

  // Family order must not matter.
  const one = f("filterSignature")(f("filterConditions")({ typeSet: { code: true, doc: true }, query: "" }));
  const two = f("filterSignature")(f("filterConditions")({ typeSet: { doc: true, code: true }, query: "" }));
  assert.equal(one, two, "the signature sorts the families");

  // Tick order must not change the signature either, or every second click would rebuild the list.
  const extA = f("filterSignature")(f("filterConditions")({ query: "", typeSet: null, extSet: { code: { java: true, py: true } } }));
  const extB = f("filterSignature")(f("filterConditions")({ query: "", typeSet: null, extSet: { code: { py: true, java: true } } }));
  assert.equal(extA, extB, "the signature sorts the extensions");
});

check("rowPasses 只接受条件集，不接受散装参数", () => {
  // A structural guard: the predicate reads `query` / `typeSet` / `extFilter` / `deletedOnly` from
  // the set. Passing a condition set is the only supported shape, and an empty one filters nothing.
  const any = file({ name: "a.java", path: "C:/w/a.java", category: "code" });
  assert.equal(f("rowPasses")(any, f("filterConditions")(null)), true);
  const narrowed = f("filterConditions")({ extSet: { doc: { md: true } } });
  assert.equal(f("rowPasses")(any, narrowed), false);
});

check("rowPasses: 一级与二级是并集，命中任一即通过", () => {
  // The rows are a union. An extension tick admits that extension, a family tick admits the whole
  // family, and a file needs to match only one. An intersection would make multi-select useless:
  // ticking two families would list nothing.
  const java = file({ name: "A.java", path: "C:/w/A.java", category: "code" });
  const py = file({ name: "b.py", path: "C:/w/b.py", category: "code" });
  const md = file({ name: "c.md", path: "C:/w/c.md", category: "doc" });

  // One extension: only files with it.
  const onlyJava = f("filterConditions")({ extSet: { code: { java: true } } });
  assert.equal(f("rowPasses")(java, onlyJava), true);
  assert.equal(f("rowPasses")(py, onlyJava), false, "另一个扩展名不该通过");
  assert.equal(f("rowPasses")(md, onlyJava), false);

  // Two extensions in one family: both pass, the rest do not.
  const javaOrPy = f("filterConditions")({ extSet: { code: { java: true, py: true } } });
  assert.equal(f("rowPasses")(java, javaOrPy), true);
  assert.equal(f("rowPasses")(py, javaOrPy), true);
  assert.equal(f("rowPasses")(md, javaOrPy), false);

  // Extensions from two different families: union across families.
  const crossExt = f("filterConditions")({ extSet: { code: { java: true }, doc: { md: true } } });
  assert.equal(f("rowPasses")(java, crossExt), true);
  assert.equal(f("rowPasses")(md, crossExt), true, "二级跨家族也是并集");
  assert.equal(f("rowPasses")(py, crossExt), false);

  // Two families ticked: union, so both kinds are listed.
  const twoFamilies = f("filterConditions")({ typeSet: { code: true, doc: true } });
  assert.equal(f("rowPasses")(java, twoFamilies), true);
  assert.equal(f("rowPasses")(md, twoFamilies), true, "勾两个一级得到并集，不是空集");

  // "" is the no-extension bucket, keyed as a value.
  const bare = file({ name: "NOTES", path: "C:/w/NOTES", category: "config" });
  const yml = file({ name: "a.yml", path: "C:/w/a.yml", category: "config" });
  const noExt = f("filterConditions")({ extSet: { config: { "": true } } });
  assert.equal(f("rowPasses")(bare, noExt), true);
  assert.equal(f("rowPasses")(yml, noExt), false);

  // No ticks at all means no type filter.
  const none = f("filterConditions")(null);
  assert.equal(f("rowPasses")(java, none), true);
  assert.equal(f("rowPasses")(md, none), true);
});

check("rowPasses: 删除与搜索两项仍与类型叠加", () => {
  // rel/sessionTitle must be emptied: the fixture defaults them to values containing "Order",
  // which would let the negative case match through those fields instead.
  const base = { rel: "", path: "", sessionTitle: "", sessionId: "" };
  const hit = file(Object.assign({}, base, { name: "order-notes.java", path: "C:/w/order-notes.java", category: "code" }));
  const miss = file(Object.assign({}, base, { name: "zeta.java", path: "C:/w/zeta.java", category: "code" }));

  assert.equal(f("rowPasses")(hit, f("filterConditions")({ typeSet: { code: true }, query: "order" })), true);
  assert.equal(f("rowPasses")(miss, f("filterConditions")({ typeSet: { code: true }, query: "order" })), false, "搜索仍然生效");
  assert.equal(f("rowPasses")(miss, f("filterConditions")({ query: "order" })), false, "去掉类型后搜索仍然收窄");

  const docRow = file(Object.assign({}, base, { name: "order.md", path: "C:/w/order.md", category: "doc" }));
  assert.equal(f("rowPasses")(docRow, f("filterConditions")({ typeSet: { code: true }, query: "" })), false, "家族仍然收窄");

  // deletedOnly stacks with the type filter.
  const gone = file({ name: "g.java", path: "C:/w/g.java", category: "code", exists: false });
  assert.equal(f("rowPasses")(gone, f("filterConditions")({ deletedOnly: true })), true);
  assert.equal(f("rowPasses")(hit, f("filterConditions")({ deletedOnly: true })), false);
  assert.equal(f("rowPasses")(hit, f("filterConditions")({ typeSet: { doc: true }, deletedOnly: true })), false, "类型与已删除叠加");
});
check("countDeleted: 「已删除」芯片的计数必须与它打开的行数一致", () => {
  // The reported bug: with the "code" family ticked the chip still read "deleted 1" (it counted
  // every `exists === false` row), while clicking it produced zero rows under "no documents".
  // A count and the list it describes must share one predicate.
  const goneJava = file({ name: "gone.java", path: "C:/w/gone.java", category: "code", exists: false });
  const goneMd = file({ name: "gone.md", path: "C:/w/gone.md", category: "doc", exists: false });
  const liveJava = file({ name: "live.java", path: "C:/w/live.java", category: "code", exists: true });
  const sessions = [{ files: [goneJava, goneMd, liveJava] }];

  // Nothing else narrowed: both deleted files are candidates.
  assert.equal(f("countDeleted")(sessions, f("filterConditions")(null)), 2);

  // The "code" family narrows the count, exactly as it narrows the rows.
  const codeOnly = f("filterConditions")({ typeSet: { code: true } });
  assert.equal(f("countDeleted")(sessions, codeOnly), 1, "只有 code 家族的已删除文件才算数");
  const rowsUnderCode = [goneJava, goneMd, liveJava]
    .filter((entry) => f("rowPasses")(entry, f("filterConditions")({ typeSet: { code: true }, deletedOnly: true })));
  assert.equal(rowsUnderCode.length, 1, "同一组条件下行数必须与芯片计数相等");
  assert.equal(rowsUnderCode[0].name, "gone.java");

  // A query term narrows it too, through the same `matches` the rows use.
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ query: "gone.java" })), 1);
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ query: "zeta" })), 0);

  // The extension level applies as well, and it is a union like the predicate.
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ extSet: { code: { java: true } } })), 1);
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ extSet: { code: { py: true } } })), 0);
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ extSet: { code: { java: true }, doc: { md: true } } })), 2,
    "跨家族二级筛选应当同时算上两边的已删除文件");

  // The chip is the control that arms `deletedOnly`, so its own count must not depend on it.
  assert.equal(f("countDeleted")(sessions, f("filterConditions")({ typeSet: { code: true }, deletedOnly: true })), 1,
    "计数不能被它自己控制的那一项影响");

  // An empty board is 0, not a crash.
  assert.equal(f("countDeleted")([], f("filterConditions")(null)), 0);
  assert.equal(f("countDeleted")(null, f("filterConditions")(null)), 0);
});
check("extensionCensus: 按数据统计，不预设任何语言", () => {
  // The point of deriving this instead of declaring it: a project that is 90% .java and one that
  // is 90% .md must both get a useful second level, with no code change.
  const javaHeavy = [
    file({ name: "a.java", path: "C:/w/a.java", category: "code" }),
    file({ name: "b.java", path: "C:/w/b.java", category: "code" }),
    file({ name: "c.java", path: "C:/w/c.java", category: "code" }),
    file({ name: "d.js", path: "C:/w/d.js", category: "code" })
  ];
  const census = f("extensionCensus")(javaHeavy, "code");
  // The sandbox is another realm, so compare through JSON rather than object identity.
  assert.equal(JSON.stringify(Array.from(census, (e) => ({ ext: e.ext, count: e.count }))),
    JSON.stringify([{ ext: "java", count: 3 }, { ext: "js", count: 1 }]), "most frequent first");

  const mdHeavy = [
    file({ name: "a.md", path: "C:/w/a.md", category: "doc" }),
    file({ name: "b.md", path: "C:/w/b.md", category: "doc" })
  ];
  assert.equal(JSON.stringify(Array.from(f("extensionCensus")(mdHeavy, "doc"), (e) => ({ ext: e.ext, count: e.count }))),
    JSON.stringify([{ ext: "md", count: 2 }]), "a single extension is fine");

  // A family filter must exclude other families, or the row would show chips that match nothing.
  assert.deepEqual(f("extensionCensus")(javaHeavy, "doc"), [], "no docs means no chips");
  // null family censuses everything.
  assert.equal(f("extensionCensus")(javaHeavy, null).length, 2);
  // Extension-less files are their own bucket, keyed "".
  assert.equal(JSON.stringify(Array.from(f("extensionCensus")([file({ name: "LICENSE", path: "C:/w/LICENSE", category: "doc" })], "doc"), (e) => ({ ext: e.ext, count: e.count }))),
    JSON.stringify([{ ext: "", count: 1 }]), "extension-less files bucket under \"\"");
});

check("extensionChips: 超出上限时折叠，且折叠项可展开", () => {
  // The inline extension row has no natural ceiling. Measured on a real polyglot ledger: 43
  // extensions at 325px wide wrapped into 13 rows and took 332px — 44% of the panel, leaving the
  // list almost invisible. This cap is the only thing standing between the reader and that.
  const many = Array.from({ length: 12 }, (_, i) => ({ ext: "e" + i, count: 12 - i }));
  const split = f("extensionChips")(many, 8);
  assert.equal(split.shown.length, 8, "shows the cap");
  assert.equal(split.hidden, 4, "counts the rest");
  assert.equal(split.hiddenFiles, 4 + 3 + 2 + 1, "the hidden ones still carry their totals (counts 4,3,2,1)");
  // The folded entries come back so "+N" can expand in place instead of only reporting a number.
  assert.equal(split.rest.length, 4, "the folded entries are returned, not just counted");
  assert.equal(split.rest[0].ext, "e8", "rest holds the entries past the cap, in order");

  // At or below the cap nothing is folded, so the row never shows a pointless "1 more".
  assert.equal(f("extensionChips")(many.slice(0, 8), 8).hidden, 0);
  assert.equal(f("extensionChips")(many.slice(0, 9), 8).hidden, 0, "one over the cap is still not worth folding");
  assert.equal(f("extensionChips")([], 8).shown.length, 0);
  assert.equal(f("extensionChips")(null, 8).shown.length, 0);

  // The real shape that broke the layout: 43 extensions must not all be rendered.
  const fortyThree = Array.from({ length: 43 }, (_, i) => ({ ext: "x" + i, count: 1 }));
  const capped = f("extensionChips")(fortyThree, 8);
  assert.equal(capped.shown.length, 8, "43 extensions render 8 + one counter, not 43 chips");
  assert.equal(capped.hidden, 35);
  assert.equal(capped.shown.length + 1, 9, "the row grows by exactly one counter chip");
});

check("扩展名折叠：展开后可收起，且可见项按频次优先", () => {
  // Two defects found by testing the fold itself:
  //   1. expanding passed a limit of 9999, so `hidden` came back 0 and the collapse branch was
  //      unreachable — expanding was a one-way door that only a reload could undo.
  //   2. candidates arrive in family order and were sorted only by "is ticked", so the visible 8
  //      were all one-file families while the largest family was folded away entirely.
  const dir0 = join(dir, "120-frame-inner.js");
  const source = readFileSync(dir0, "utf8");

  // Guard 1: the fold must always be computed against the real cap, never a lifted one.
  assert.ok(/\), EXT_CHIP_MAX\);/.test(source),
    "折叠必须始终按真实上限计算，不能用放大后的上限（否则 hidden 恒为 0）");
  assert.ok(source.indexOf("? 9999 :") === -1, "不得再出现 9999 这种伪上限");
  // Both branches must key off the same capability flag.
  assert.ok(/canFold = extFold\.hidden > 0/.test(source), "两个分支要共用同一个 canFold");
  assert.ok(/extExpanded !== true && canFold === true/.test(source), "展开入口");
  assert.ok(/extExpanded === true && canFold === true/.test(source), "收起入口必须可达");

  // Guard 2: the sort must break ties by count, or the biggest family loses its chips.
  assert.ok(/right\.entry\.count \|\| 0\) - \(left\.entry\.count \|\| 0\)/.test(source)
      || /right\.entry\.count - left\.entry\.count/.test(source),
    "可见项要按使用频次排序，不能只按家族顺序");

  // Behavioural check of the same rule through the pure helper: capped input still reports hidden.
  const many = Array.from({ length: 43 }, (_, i) => ({ ext: "e" + i, count: 43 - i }));
  const fold = f("extensionChips")(many, 8);
  assert.equal(fold.hidden, 35, "43 个扩展名折叠后仍有 35 个被隐藏，收起判断才成立");
  assert.ok(fold.hidden > 0, "能折叠就必须能收起");
});
check("每个被测的纯函数在 client.js 里都至少有一个调用点", () => {
  // The failure mode this catches: `extensionChips` had four green assertions while the UI never
  // called it — a refactor turned it into dead code and the tests supplied false confidence. The
  // same shape nearly happened to the highlight query, where the pure function was right and the
  // wiring was missing.
  //
  // Testing a function proves it works, never that anything uses it. One grep per name is cheap
  // and turns "green but unreachable" into a failure.
  const bundle = readFileSync(join(dir, "..", "..", "client.js"), "utf8");

  // Functions that are legitimately only called by the test file or are entry points.
  const EXEMPT = new Set([
    "apply", "applyInner", "TabTitle",            // host entry points, called by the loader
    "extensionChips",                              // called indirectly via the render path below
    "familiesOf", "extensionsOf", "typeSelections" // called from the frame and from each other
  ]);

  const names = [
    "defaultDir", "sortFiles", "termsOf", "matches", "mergeSessions", "minStamp", "maxStamp",
    "fmtTime", "fmtBytes", "encodingLabel", "categoryColor", "categoryLabel", "shortPath",
    "highlight", "hostFileAddress", "iconUrl", "pad", "sortSpecOf", "rowModeOf", "rowsReachable",
    "rowLimitOf", "clampRowIndex", "isActiveRow", "hasActiveRow", "nextRowLimit", "extOf",
    "fileIconUrl", "typeFilterOf", "withFamilyToggled", "withExtensionToggled", "withoutType",
    "typeFilterActive", "passesTypeFilter", "rowPasses", "filterConditions", "filterIsActive",
    "filterSignature", "deletedPasses", "countDeleted", "foldCase"
  ];

  const unreferenced = names.filter((name) => {
    if (EXEMPT.has(name) === true) return false;
    // A definition alone is not a call: require the name to appear at least twice.
    const hits = bundle.split(name).length - 1;
    return hits < 2;
  });
  assert.deepEqual(unreferenced, [], "这些函数只有定义、没有任何调用点：" + unreferenced.join(", "));
});
check("渲染接线：高亮必须从 conditions 取查询词，不能有第二条通道", () => {
  // The defect this guards lived for four rounds: `highlight()` was correct while `<mark>` never
  // appeared, because `Section` read a `props.query` that `cardProps` never passed. Every other
  // assertion here tests pure functions, so a broken prop is invisible to all of them.
  //
  // The first guard only grepped for `query:` in the props builder, which a rename or a spread
  // would defeat or falsely satisfy. The fix that makes it structural is removing the second
  // channel entirely: the term now lives in `conditions`, the object that already carries every
  // other filter, so there is nothing left to forget to pass.
  const sections = readFileSync(join(dir, "100-sections.js"), "utf8");
  const frame = readFileSync(join(dir, "120-frame-inner.js"), "utf8");

  // 1. The consumer reads the query out of the condition set.
  assert.ok(/conditions\.query/.test(sections),
    "Section 必须从 props.conditions.query 取查询词");
  // 2. There is no second channel left to drift. A mention inside a comment is fine (the comment
  //    explains what went wrong); a live read is not.
  const codeOnly = sections
    .split("\n")
    .filter((line) => line.trim().startsWith("//") === false && line.trim().startsWith("*") === false)
    .join("\n");
  assert.equal(/props\.query\b/.test(codeOnly), false,
    "不得再出现 props.query 这第二条通道——它正是断掉的那条");
  assert.equal(/^\s*query:\s*query\b/m.test(frame), false,
    "cardProps 不应再单独传 query，conditions 已经带着它");

  // 3. The same object still reaches the card, or step 1 would read nothing.
  const start = frame.indexOf("var cardProps = function");
  assert.notEqual(start, -1, "cardProps is where a card's props are built");
  const body = frame.slice(start, start + 3000);
  assert.ok(/\bconditions:\s*conditions\b/.test(body),
    "cardProps 必须把 conditions 原样交给卡片");
});
check("extOf: 从路径取小写扩展名，无扩展名返回空", () => {
  assert.equal(f("extOf")("C:\\w\\a\\notes.md"), "md");
  assert.equal(f("extOf")("/home/u/Doc.TXT"), "txt");
  assert.equal(f("extOf")("archive.tar.gz"), "gz", "only the last segment counts");
  assert.equal(f("extOf")("Makefile"), "", "no dot means no extension");
  assert.equal(f("extOf")(".gitignore"), "", "a leading dot is a dotfile, not an extension marker");
  assert.equal(f("extOf")("trailing."), "", "a trailing dot is not an extension");
  assert.equal(f("extOf")(""), "");
  assert.equal(f("extOf")(null), "");
});

check("fileIconUrl: 指向宿主端点并转义扩展名", () => {
  assert.equal(f("fileIconUrl")("md"), "/doc-ledger/fileicon?ext=md");
  assert.equal(f("fileIconUrl")("MD"), "/doc-ledger/fileicon?ext=md", "lowercased");
  assert.equal(f("fileIconUrl")(""), "/doc-ledger/fileicon?ext=");
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
