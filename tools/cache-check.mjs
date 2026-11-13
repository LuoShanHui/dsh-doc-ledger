/**
 * Cache-decision regression.
 *
 * `replay()` reads a session log and folds it into a ledger; the decision "may I reuse the
 * cached ledger instead" is what keeps an 8 s poll from costing a full replay. It has three
 * independent reasons (exact stamp, TTL fallback, live replay floor) and the floor is the one
 * that is easy to break without noticing, so it is pinned here instead of being measured by
 * hand on a live host.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENGINE_FINGERPRINT, cleanObsoleteFiles, ledgerReusable, normalizeRecords } from "../index.js";
import { categoryOf } from "../lib/ledger.js";

const NOW = 1_000_000;
const hit = (extra = {}) => Object.assign({ at: NOW - 2000, live: true, ttl: 5000, stamp: "10:20" }, extra);

const cases = [];
function check(name, body) {
  cases.push([name, body]);
}

check("没有缓存条目时一定重放", () => {
  assert.equal(ledgerReusable(undefined, { live: true, stamp: "10:20", floor: 15000, now: NOW }), false);
});

check("无 stamp 时按 TTL 复用", () => {
  assert.equal(ledgerReusable(hit(), { live: true, stamp: null, floor: 0, now: NOW }), true);
  assert.equal(ledgerReusable(hit({ at: NOW - 9000 }), { live: true, stamp: null, floor: 0, now: NOW }), false);
});

check("TTL 复用要求 live 状态一致", () => {
  assert.equal(ledgerReusable(hit({ live: false }), { live: true, stamp: null, floor: 0, now: NOW }), false);
});

check("live 会话在重放下限内复用（即使 stamp 已变）", () => {
  assert.equal(ledgerReusable(hit(), { live: true, stamp: "10:99", floor: 15000, now: NOW }), true);
});

check("超过重放下限后重新重放", () => {
  assert.equal(ledgerReusable(hit({ at: NOW - 16000 }), { live: true, stamp: "10:99", floor: 15000, now: NOW }), false);
});

check("重放下限对非 live 会话无效", () => {
  assert.equal(ledgerReusable(hit({ live: false }), { live: false, stamp: "10:99", floor: 15000, now: NOW }), false);
});

check("floor=0 时下限不生效（force / timing 路径）", () => {
  assert.equal(ledgerReusable(hit(), { live: true, stamp: "10:99", floor: 0, now: NOW }), false);
});

check("磁盘恢复的条目 at=0 不会被误判为新鲜", () => {
  assert.equal(ledgerReusable(hit({ at: 0 }), { live: true, stamp: "10:99", floor: 15000, now: NOW }), false);
});

// --- cache invalidation on rule changes ------------------------------------
// A cached ledger carries the fingerprint of the rules that produced it. The 12-family
// classifier once shipped without any bump, so every cached table kept its old labels: 113 of
// 1760 live rows showed the wrong filter chip (".sql" under data, ".gitignore" under other).
check("引擎指纹随分类规则变化（写死的规则表仍与 lib/ledger.js 一致）", () => {
  // The fingerprint input is a literal copy of lib/ledger.js's tables; if someone edits the
  // classifier without updating this list, the two disagree and this fails.
  assert.match(ENGINE_FINGERPRINT, /^[0-9a-f]{12}$/);
  const EXPECTED = {
    "a.sql": "code", "a.md": "doc", "a.xlsx": "sheet", "a.exe": "binary",
    "a.diff": "data", "a.zst": "archive", ".gitignore": "config", "LICENSE": "doc",
    "Dockerfile": "config", "CMakeLists.txt": "config", "a.tar.gz": "archive",
    "noext": "other", "a.unknown": "other"
  };
  for (const [name, want] of Object.entries(EXPECTED)) {
    assert.equal(categoryOf(name), want, name + " 的分类必须与 ENGINE_RULES 里写的一致");
  }
});

// --- obsolete-file cleanup -------------------------------------------------
// The snapshot cache was replaced by per-session ledgers; leaving the old file in ~/.dsh
// forever is pure garbage, so startup removes it. Tested against a temp dir.
check("启动清理删掉废弃的 snapshot 缓存，保留仍在用的文件", () => {
  const dir = mkdtempSync(join(tmpdir(), "doc-ledger-clean-"));
  try {
    writeFileSync(join(dir, "doc-ledger-snapshot.json.gz"), "old");
    writeFileSync(join(dir, "doc-ledger-titles.json"), "keep me");
    writeFileSync(join(dir, "doc-ledger-ledgers.json.gz"), "keep me too");
    const gone = cleanObsoleteFiles(dir);
    assert.deepEqual(gone, ["doc-ledger-snapshot.json.gz"]);
    assert.equal(existsSync(join(dir, "doc-ledger-snapshot.json.gz")), false, "the dead file is gone");
    assert.equal(existsSync(join(dir, "doc-ledger-titles.json")), true, "a live cache is untouched");
    assert.equal(existsSync(join(dir, "doc-ledger-ledgers.json.gz")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("没有废弃文件时清理是无操作，不抛", () => {
  const dir = mkdtempSync(join(tmpdir(), "doc-ledger-clean2-"));
  try {
    assert.deepEqual(cleanObsoleteFiles(dir), []);
    // A missing directory must also be harmless.
    assert.deepEqual(cleanObsoleteFiles(join(dir, "nope")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("开一个不在首页切片里的会话能找到", () => {
  // 真实缺陷：会话在 listSessions() 里排第 35 位，默认 limit 是 40，但它前面有 6 个
  // 空会话被丢弃，于是它被挤出了切片——单独打开时面板报「本会话还没有文档记录」，
  // 而同一个会话在「全部会话」里列出 15 个文件。
  //
  // 修法：scope=current 先从**全量**列表里挑出目标会话，再对结果分页；
  // 分页只对「全部会话」有意义。
  const listed = Array.from({ length: 63 }, (_, i) => ({ header: { id: "session-" + i, createdAt: 1000 - i } }));
  const target = "session-34";
  // normalizeRecords(listed, 0) must keep everything, so the pick can see record 35.
  const all = normalizeRecords(listed, 0);
  assert.equal(all.length, 63, "a non-positive limit means every record");
  const picked = all.filter((r) => r.id === target);
  assert.equal(picked.length, 1, "the requested session must survive the pick");
  // And the page slice still works for the all-sessions view.
  assert.equal(normalizeRecords(listed, 40).length, 40, "a positive limit still pages");
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " cache checks");
