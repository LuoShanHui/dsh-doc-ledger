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
import { cleanObsoleteFiles, ledgerReusable } from "../index.js";

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

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " cache checks");
