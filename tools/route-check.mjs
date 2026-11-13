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
import { createServer, request } from "node:http";
import { connect } from "node:net";
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

/**
 * A request with a hand-written `Host` header.
 *
 * `fetch` derives Host from the URL and refuses to override it, but Host is exactly what the
 * DNS-rebinding guard has to inspect — an attacker page reaches 127.0.0.1 while sending
 * `Host: attacker.test`. So this path bypasses fetch and speaks HTTP directly.
 */
function callRaw(host, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        method: "GET",
        path: "/doc-ledger" + path,
        headers: Object.assign({ host }, headers)
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(body); } catch { json = null; }
          resolve({ status: res.statusCode, json, body });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
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

// --- DNS rebinding ----------------------------------------------------------
// The Origin/Host pair below is what an attacker page sends: both name the attacker's own
// domain while the connection actually lands on 127.0.0.1. Comparing the two against each
// other therefore proves nothing; only a fixed loopback allowlist rejects them.
check("rebinding：Host 与 Origin 同为外部域名被 403", async () => {
  const r = await callRaw("attacker.test:60580", "/api/all", {
    origin: "http://attacker.test:60580",
    "sec-fetch-site": "same-origin"
  });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /Host/);
});

check("rebinding：只伪造 Host 也被 403", async () => {
  const r = await callRaw("evil.example:60580", "/api/all", { "sec-fetch-site": "same-origin" });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /Host/);
});

check("rebinding：伪造 Host 读 /api/file 被 403（不回文件正文）", async () => {
  const r = await callRaw("attacker.test", "/api/file?path=" + encodeURIComponent(root), {
    origin: "http://attacker.test",
    "sec-fetch-site": "same-origin"
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.ok, false);
  assert.ok(!r.body.includes("doc-ledger"), "响应体不得包含文件内容");
});

check("rebinding：伪造 Host 调 /api/open 被 403", async () => {
  const r = await callRaw("attacker.test", "/api/open?mode=open&path=" + encodeURIComponent(OUTSIDER), {
    origin: "http://attacker.test",
    "sec-fetch-site": "same-origin"
  });
  assert.equal(r.status, 403);
});

check("rebinding：伪造 Host 取 /icon 被 403", async () => {
  const r = await callRaw("attacker.test", "/icon?path=" + encodeURIComponent(OUTSIDER));
  assert.equal(r.status, 403);
});

check("回环 Host（127.0.0.1 / localhost / [::1]）都放行", async () => {
  for (const host of ["127.0.0.1:" + server.address().port, "localhost:" + server.address().port, "[::1]:" + server.address().port]) {
    const r = await callRaw(host, "/api/config");
    assert.equal(r.status, 200, host + " 应被接受");
    assert.equal(r.json.ok, true);
  }
});

check("缺少 Host 头（HTTP/1.0）被 403", async () => {
  // node's http client always synthesises a Host header, so this case needs a raw socket.
  const r = await new Promise((resolve, reject) => {
    const socket = connect(server.address().port, "127.0.0.1", () => {
      socket.write("GET /doc-ledger/api/config HTTP/1.0\r\n\r\n");
    });
    let body = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => { body += chunk; });
    socket.on("end", () => resolve({ status: Number((body.match(/^HTTP\/1\.[01] (\d{3})/) ?? [])[1]), body }));
    socket.on("error", reject);
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error("timeout")); });
  });
  assert.equal(r.status, 403);
  assert.match(r.body, /Host/);
});

check("/api/file 缺 path 回 400", async () => {
  const r = await call("/api/file");
  assert.equal(r.status, 400);
});

// The allowlist runs before any stat, so these three used to leak "does this path exist"
// (403 / 404 / 400). They must all answer 403 now: the caller learns nothing about disk.
check("/api/file 指向目录回 403（不再是 400）", async () => {
  const r = await call("/api/file?path=" + encodeURIComponent(root));
  assert.equal(r.status, 403);
});

check("/api/file 指向不存在的文件回 403（不再是 404）", async () => {
  const r = await call("/api/file?path=" + encodeURIComponent(MISSING));
  assert.equal(r.status, 403);
});

check("/api/file 不暴露路径存在性（存在与不存在给出同样的回应）", async () => {
  const exists = await call("/api/file?path=" + encodeURIComponent(OUTSIDER));
  const absent = await call("/api/file?path=" + encodeURIComponent(MISSING));
  assert.equal(exists.status, absent.status, "存在与不存在必须是同一个状态码");
  assert.equal(exists.json.error, absent.json.error, "错误文案也不能区分");
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

check("/icon 只接受「打开方式」枚举过的程序（不认系统里任意 exe）", async () => {
  // 提取图标会启动 PowerShell，所以这条路由不能对任意 .exe 开放：
  // rebinding 页面实测用它拉起过 powershell.exe。只允许 openwith 枚举的结果。
  const foreign = process.env.SystemRoot ? join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "";
  if (foreign === "") return; // 非 Windows 环境跳过
  const r = await call("/icon?path=" + encodeURIComponent(foreign));
  assert.equal(r.status, 404, "未枚举过的 exe 不给图标，也不启动 PowerShell");
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
