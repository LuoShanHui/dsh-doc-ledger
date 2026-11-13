/**
 * Regression checks for the PTC program scanner and the created/modified decision.
 *
 * The shapes below are shortened copies of real session programs: they are the cases
 * that used to be misread, so they are pinned here instead of being re-discovered.
 *
 *   node tools/ledger-scan-check.mjs
 */
import assert from "node:assert/strict";
import { buildLedger, scanProgram } from "../lib/ledger.js";

const cwd = "E:\\work";
const session = { type: "session", id: "s1", cwd, createdAt: 1_700_000_000_000 };

function program(code, time) {
  return { type: "tool/call", seq: 1, time, data: { name: "run_code", callId: "c1", arguments: JSON.stringify({ code }) } };
}

function ledgerOf(events) {
  return buildLedger([session, ...events]);
}

/** Path bound to a variable, then written with fs: the reported OrderDraft.java case. */
const CREATE_VIA_VARIABLE = `
const target = "demo-app/src/main/java/com/example/demo/OrderDraft.java";
const content = ["package com.x.bean.tpl;", "", "public class OrderDraft {", "}"].join("\\n");
fs.writeFileSync(target, content, "utf8");
console.log("created:", target);
`;

/** Nested tools.edit calls with the path in a variable, followed by an unrelated grep. */
const EDIT_VIA_VARIABLE = `
const p = "demo-app/src/main/java/com/example/demo/OrderService.java";
await tools.edit({ file_path: p, old_string: "a", new_string: "b" });
const g = await tools.grep({ pattern: "OrderDraft", path: "." });
`;

/** Absolute literal, written through an fs call. */
const ABSOLUTE_WRITE = `
fs.writeFileSync("E:\\\\work\\\\demo-app\\\\src\\\\main\\\\java\\\\com\\\\example\\\\demo\\\\A.java", "class A {}", "utf8");
`;

const cases = [];

{
  const found = scanProgram(CREATE_VIA_VARIABLE);
  assert.equal(found.length, 1, "one write expected");
  assert.equal(found[0].path, "demo-app/src/main/java/com/example/demo/OrderDraft.java");
  assert.equal(found[0].op, "write");
  cases.push("variable + fs.writeFileSync -> write");
}

{
  const found = scanProgram(EDIT_VIA_VARIABLE);
  assert.equal(found.length, 1, "one edit expected");
  for (const entry of found) {
    assert.equal(entry.path, "demo-app/src/main/java/com/example/demo/OrderService.java");
    assert.equal(entry.op, "edit");
  }
  cases.push("nested tools.edit + later tools.grep -> no phantom path");
}

{
  const found = scanProgram(ABSOLUTE_WRITE);
  assert.ok(found.some((entry) => entry.path.endsWith("A.java") && entry.op === "write"));
  cases.push("absolute literal fs write -> write");
}

{
  // Write first, read later (verification) must still count as created.
  const ledger = ledgerOf([
    program(CREATE_VIA_VARIABLE, 1000),
    { type: "tool/call", seq: 2, time: 5000, data: { name: "read", callId: "c2", arguments: JSON.stringify({ file_path: "demo-app/src/main/java/com/example/demo/OrderDraft.java" }) } },
  ]);
  const file = ledger.files.find((entry) => entry.name === "OrderDraft.java");
  assert.equal(file.created, "inferred");
  assert.equal(file.createdAt, 1000);
  assert.equal(file.reads, 1);
  assert.equal(file.writes, 1);
  cases.push("write then read -> created (inferred)");
}

{
  // Read first, write later is a modification.
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "read", callId: "c1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\B.java" }) } },
    { type: "tool/call", seq: 2, time: 2000, data: { name: "edit", callId: "c2", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\B.java" }) } },
  ]);
  const file = ledger.files.find((entry) => entry.name === "B.java");
  assert.equal(file.created, null);
  assert.equal(file.writes, 1);
  cases.push("read then edit -> modified (not created)");
}

{
  // An edit as the first touch implies the file already existed.
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "edit", callId: "c1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\C.java" }) } },
  ]);
  assert.equal(ledger.files.find((entry) => entry.name === "C.java").created, null);
  cases.push("edit first -> modified");
}

{
  // Written *and* presented is a confirmed creation.
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "write", callId: "c1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\D.md" }) } },
    { type: "deliverables/presented", seq: 2, time: 2000, data: { files: [{ path: "E:\\\\work\\\\D.md" }] } },
  ]);
  assert.equal(ledger.files.find((entry) => entry.name === "D.md").created, "confirmed");
  cases.push("written + presented -> confirmed");
}

{
  // Presented without a write is *not* a creation: the session only handed over a document it
  // read. 14 of 38 confirmed rows on this machine were exactly this (writes 0, created shown).
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "read", callId: "c1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\E.md" }) } },
    { type: "deliverables/presented", seq: 2, time: 2000, data: { files: [{ path: "E:\\\\work\\\\E.md" }] } },
  ]);
  const file = ledger.files.find((entry) => entry.name === "E.md");
  assert.equal(file.created, null, "只展示不写，不算创建");
  assert.equal(file.presented, 1, "展示事实仍然记录");
  assert.equal(file.createdAt, null, "没有创建时间可报");
  cases.push("仅 presented -> 不算创建");
}

{
  // One fs call, one use. The second fs pass used to record the same call again under a
  // different name, so a single readFileSync became two reads (515 duplicate pairs across
  // this machine, 150 extra uses in 10 sessions).
  const found = scanProgram(`
fs.readFileSync("E:\\\\work\\\\a.md", "utf8");
fs.writeFileSync("E:\\\\work\\\\b.md", "x");
`);
  assert.equal(found.length, 2, "one entry per fs call, not two");
  assert.deepEqual(found.map((entry) => entry.op).sort(), ["read", "write"]);
  const ledger = ledgerOf([program(`
fs.readFileSync("E:\\\\work\\\\a.md", "utf8");
`, 1000)]);
  assert.equal(ledger.files.find((entry) => entry.name === "a.md").reads, 1, "reads must not double count");
  cases.push("one fs call -> exactly one use（不再重复计数）");
}

{
  // `"dir" + name` names a directory prefix, not a document. Recording it put 8 folders
  // (app.asar, os-services, …) into real ledgers as unopenable "documents".
  const found = scanProgram(`
for (const f of files) {
  const r = await tools.read({ file_path: "E:\\\\work\\\\src\\\\" + f });
}
fs.readFileSync("E:\\\\work\\\\" + name);
`);
  assert.deepEqual(found, [], "a concatenated literal must not become a document");
  cases.push("拼接路径不产生伪文档（目录前缀）");
}

{
  // A literal that is not concatenated still has to work, and a bound variable too.
  const found = scanProgram(`
const p = "E:\\\\work\\\\real.md";
fs.writeFileSync(p, "y");
await tools.read({ file_path: "E:\\\\work\\\\other.md" });
`);
  assert.equal(found.length, 2);
  assert.ok(found.some((entry) => entry.path.endsWith("real.md") && entry.op === "write"));
  assert.ok(found.some((entry) => entry.path.endsWith("other.md") && entry.op === "read"));
  cases.push("普通字面量与变量绑定仍然识别");
}

{
  // Directories and bundles must not become documents. Real rows that used to appear:
  // app.asar (stat-ed, never opened), os-services and the workspace roots (readdir targets).
  const statOnly = scanProgram(`
const p = "C:\\\\Program Files\\\\App\\\\resources\\\\app.asar";
const st = fs.statSync(p);
`);
  assert.deepEqual(statOnly, [], "a stat-ed path is not a document read");
  const listed = scanProgram(`
fs.readdirSync("E:\\\\work\\\\os-services", { withFileTypes: true });
`);
  assert.deepEqual(listed, [], "a readdir target is not a document read");
  // …but a path that is stat-ed and then actually read still counts.
  const both = scanProgram(`
const p = "E:\\\\work\\\\x.md";
if (fs.existsSync(p)) { fs.readFileSync(p, "utf8"); }
`);
  assert.equal(both.length, 1);
  assert.equal(both[0].op, "read");
  cases.push("stat/readdir 目标不算文档，stat 后真读仍算");
}

{
  // A program that throws must not keep its scanned rows. Before the fix, `program: true`
  // carried no id to roll back, so 73 failed programs left 146 rows behind.
  const bad = `fs.writeFileSync("E:\\\\work\\\\Gone.md", "x");`;
  const ledger = buildLedger([
    session,
    { type: "tool/call", seq: 1, time: 1000, data: { name: "run_code", callId: "p1", arguments: JSON.stringify({ code: bad }) } },
    { type: "tool/result", seq: 2, time: 1200, data: { toolCallId: "p1", isError: true } },
  ]);
  assert.equal(ledger.files.length, 0, "a failed program leaves no rows");
  // …while a successful one keeps them, and an unrelated earlier call survives the rollback.
  const mixed = buildLedger([
    session,
    { type: "tool/call", seq: 1, time: 900, data: { name: "read", callId: "ok", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\Keep.md" }) } },
    { type: "tool/result", seq: 2, time: 950, data: { toolCallId: "ok" } },
    { type: "tool/call", seq: 3, time: 1000, data: { name: "run_code", callId: "p2", arguments: JSON.stringify({ code: bad }) } },
    { type: "tool/result", seq: 4, time: 1200, data: { toolCallId: "p2", isError: true } },
  ]);
  assert.deepEqual(mixed.files.map((entry) => entry.name), ["Keep.md"]);
  assert.equal(mixed.files[0].reads, 1);
  cases.push("失败的程序调用回滚，成功的不受影响");
}

{
  // Tools the tables used to miss. `read_image` alone was 164 real calls on this machine,
  // and the IDE write tools created files that never appeared in any ledger.
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "read_image", callId: "i1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\shot.png" }) } },
    { type: "tool/call", seq: 2, time: 1100, data: { name: "modlens_read_image", callId: "i2", arguments: JSON.stringify({ path: "E:\\\\work\\\\chart.png" }) } },
    { type: "tool/call", seq: 3, time: 1200, data: { name: "mcp__intellij__create_new_file", callId: "w1", arguments: JSON.stringify({ pathInProject: "src/New.java" }) } },
    { type: "tool/call", seq: 4, time: 1300, data: { name: "mcp__index__ide_refactor_safe_delete", callId: "w2", arguments: JSON.stringify({ file: "src/Old.java" }) } },
  ]);
  assert.equal(ledger.files.find((entry) => entry.name === "shot.png").reads, 1, "read_image 是文档读取");
  assert.equal(ledger.files.find((entry) => entry.name === "chart.png").reads, 1, "modlens_read_image 也是");
  const created = ledger.files.find((entry) => entry.name === "New.java");
  assert.equal(created.writes, 1, "IDE 新建文件要记账");
  assert.equal(created.created, "inferred");
  assert.equal(ledger.files.find((entry) => entry.name === "Old.java").writes, 1, "IDE 删除是写类操作");
  cases.push("read_image / IDE 写工具不再漏记");
}

console.log("ok - " + cases.length + " checks");
for (const name of cases) console.log("  · " + name);
