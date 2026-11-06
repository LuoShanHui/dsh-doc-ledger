/**
 * Host route + security regression.
 *
 * These routes are the plugin's whole attack surface: they sit on the loopback port with
 * no GUI login in front of them, so the contract is "same origin only, only paths this
 * session's ledger knows about, launching is POST-only". This script mounts the real
 * handler from index.js on a real HTTP server and asserts that contract, so a refactor
 * cannot silently drop one of the guards.
 *
 * Dependency-free: a fake cordis context, a real server, and fetch.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply } from "../index.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PNG = join(root, "docs", "overview.png");
const MISSING = join(root, "definitely-not-here.txt");
// A file that exists but can never appear in any ledger: the "not in the ledger" branches
// must be tested against something the real cache on a developer machine cannot contain.
const scratch = mkdtempSync(join(tmpdir(), "doc-ledger-route-"));
const OUTSIDER = join(scratch, "outsider.txt");
writeFileSync(OUTSIDER, "not part of any ledger\n", "utf8");

const cleanups = [];
const registrations = [];
const ctx = {
  effect: (fn) => {
    const dispose = fn();
    if (typeof dispose === "function") cleanups.push(dispose);
    return dispose;
  },
  // No sessionQuery in the fake context: the routes must answer with empty data and a
  // warning instead of throwing.
  get: () => undefined,
  webServer: {
    register: (spec) => {
      registrations.push(spec);
      return () => {};
    }
  },
  logger: { info() {}, warn() {}, error() {} }
};

apply(ctx, { debug: false });
assert.equal(registrations.length, 1, "the plugin must register exactly one prefix route");
const route = registrations[0];
assert.equal(route.kind, "prefix");
assert.equal(route.path, "/doc-ledger");

const server = createServer((req, res) => route.handler(req, res));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/doc-ledger";

async function call(path, init = {}) {
  const response = await fetch(base + path, init);
  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  return { status: response.status, json, body };
}

const cases = [];
function check(name, body) {
  cases.push([name, body]);
}

check("同源 /api/all 返回 200 且带 sessions[]", async () => {
  const r = await call("/api/all?scope=all", { headers: { "sec-fetch-site": "same-origin" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(Array.isArray(r.json.data.sessions), "data.sessions must be an array");
});

check("Sec-Fetch-Site: cross-site 被 403 拒绝", async () => {
  const r = await call("/api/all", { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(r.status, 403);
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /跨站/);
});

check("外部 Origin 被 403 拒绝", async () => {
  const r = await call("/api/all", { headers: { origin: "https://evil.example" } });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /Origin/);
});

check("Origin: null 被 403 拒绝", async () => {
  const r = await call("/api/all", { headers: { origin: "null" } });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /Origin: null/);
});

check("/api/file 缺 path 回 400", async () => {
  const r = await call("/api/file");
  assert.equal(r.status, 400);
});

check("/api/file 指向目录回 400", async () => {
  const r = await call("/api/file?path=" + encodeURIComponent(root));
  assert.equal(r.status, 400);
});

check("/api/file 指向不存在的文件回 404", async () => {
  const r = await call("/api/file?path=" + encodeURIComponent(MISSING));
  assert.equal(r.status, 404);
});

check("/api/file 指向台账外但存在的文件回 403", async () => {
  const r = await call("/api/file?path=" + encodeURIComponent(OUTSIDER));
  assert.equal(r.status, 403);
  assert.match(r.json.error, /台账/);
});

check("/api/openwith 指向台账外文件回 403", async () => {
  const r = await call("/api/openwith?path=" + encodeURIComponent(OUTSIDER));
  assert.equal(r.status, 403);
});

check("/api/open 拒绝 GET（405）", async () => {
  const r = await call("/api/open?mode=open&path=" + encodeURIComponent(OUTSIDER));
  assert.equal(r.status, 405);
  assert.match(r.json.error, /POST/);
});

check("/api/open POST 到台账外文件回 403", async () => {
  const r = await call("/api/open?mode=open&path=" + encodeURIComponent(OUTSIDER), { method: "POST" });
  assert.equal(r.status, 403);
});

check("/api/open 缺 path 回 400", async () => {
  const r = await call("/api/open?mode=open", { method: "POST" });
  assert.equal(r.status, 400);
});

check("/icon 只接受可执行文件（png 回 404）", async () => {
  const r = await call("/icon?path=" + encodeURIComponent(PNG));
  assert.equal(r.status, 404);
});

check("未知路由回 404", async () => {
  const r = await call("/api/nope");
  assert.equal(r.status, 404);
});

let passed = 0;
try {
  for (const [name, body] of cases) {
    await body();
    passed += 1;
    console.log("  · " + name);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  for (const dispose of cleanups) {
    try {
      dispose();
    } catch {
      /* disposal must not mask a failure */
    }
  }
  rmSync(scratch, { recursive: true, force: true });
}

console.log("ok - " + passed + " route checks");
