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
  // A presented deliverable is a confirmed creation.
  const ledger = ledgerOf([
    { type: "tool/call", seq: 1, time: 1000, data: { name: "write", callId: "c1", arguments: JSON.stringify({ file_path: "E:\\\\work\\\\D.md" }) } },
    { type: "deliverables/presented", seq: 2, time: 2000, data: { files: [{ path: "E:\\\\work\\\\D.md" }] } },
  ]);
  assert.equal(ledger.files.find((entry) => entry.name === "D.md").created, "confirmed");
  cases.push("presented -> confirmed");
}

console.log("ok - " + cases.length + " checks");
for (const name of cases) console.log("  · " + name);
