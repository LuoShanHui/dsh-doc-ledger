/**
 * Static report smoke test: the one code path CI never ran.
 *
 * `tools/report.mjs` decodes persisted logs with `zlib.zstdDecompressSync`, which only exists
 * from Node 22.15 — while `engines` claimed >=18 and CI ran the suite on 18/20/22 without ever
 * invoking the report. So the generator could have been broken on every supported version and
 * nothing would have failed. This runs it against a synthetic DSH home.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { zstdCompressSync } from "node:zlib";

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), "doc-ledger-report-"));

const cases = [];
function check(name, body) { cases.push([name, body]); }

check("report 生成器能把一份日志折成 HTML 报告", async () => {
  const home = join(work, "home");
  const sessionDir = join(home, "sessions", "--C-work--", "session-abc");
  mkdirSync(sessionDir, { recursive: true });
  const events = [
    { type: "session", seq: 1, time: 1, data: { id: "session-abc", cwd: "C:\\work", createdAt: 1 } },
    { type: "tool/call", seq: 2, time: 1000, data: { name: "read", callId: "c1", arguments: JSON.stringify({ file_path: "C:\\work\\a.md" }) } },
    { type: "tool/call", seq: 3, time: 2000, data: { name: "write", callId: "c2", arguments: JSON.stringify({ file_path: "C:\\work\\b.md" }) } }
  ];
  // The runtime appends one zstd frame per batch; one frame with every line is equivalent.
  const lines = Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
  writeFileSync(join(sessionDir, "session.v4.jsonl.zstd"), zstdCompressSync(lines));
  const out = join(work, "report.html");
  const { buildReport } = await import(pathToFileURL(join(root, "tools", "report.mjs")).href);
  const result = buildReport({ root: home, out, limit: 5 });
  assert.ok(existsSync(out), "报告文件必须写出来");
  const html = readFileSync(out, "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.equal(result.data.sessions.length, 1);
  assert.equal(result.data.sessions[0].files.length, 2);
});

check("engines 声明的 Node 版本真的带 zstd 解压", async () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const min = String(pkg.engines?.node ?? "").replace(/^>=/, "").split(".").map(Number);
  const [major, minor] = min;
  const zlib = await import("node:zlib");
  const hasZstd = typeof zlib.zstdDecompressSync === "function";
  if (hasZstd) {
    assert.ok(major > 22 || (major === 22 && minor >= 15), "engines 不能低于真正提供 zstd 的版本");
  }
});

try {
  for (const [name, body] of cases) {
    await body();
    console.log("  · " + name);
  }
  console.log("ok - " + cases.length + " report checks");
} finally {
  rmSync(work, { recursive: true, force: true });
}
