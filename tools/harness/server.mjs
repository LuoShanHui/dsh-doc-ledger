/**
 * Local UI harness for the panel.
 *
 * The GUI answers 401 to automation, so this serves the real `client.js` against a fake
 * cordis context and a synthetic ledger. It exists so UI work (keyboard handling, search,
 * menus, the preview hand-off) can be checked in a browser instead of by eye in the real
 * window, and so a scripted assertion has something to drive.
 *
 * Run: `node tools/harness/server.mjs` then open http://127.0.0.1:8899
 *
 * React: the page needs the UMD builds. The server looks for them in
 * `DOC_LEDGER_REACT_DIR`, then in `<repo>/node_modules/react/umd`, and otherwise redirects
 * to unpkg (dev machine with network). Nothing here runs in CI.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(dirname(HERE));
const PORT = Number(process.env.DOC_LEDGER_HARNESS_PORT || 8899);
const NOW = Date.UTC(2026, 10, 6, 9, 0, 0);

/**
 * A 16x16 PNG of a solid tint, built with zlib only.
 *
 * The harness serves tier B of the file glyph (the plugin extracts real shell icons; there is
 * no shell here), so it needs *some* image bytes. A solid square is enough: what the test cares
 * about is that the <img> loads, that a 404 falls back to tier C, and that both occupy the same
 * 16px box without shifting the row.
 */
function glyphPng(/* label, tint are unused by the solid fill but kept for call-site clarity */) {
  const size = 16;
  const rgba = Buffer.alloc(size * (1 + size * 4));
  const [r, g, b] = [0x4f, 0x7c, 0xf7];
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4);
    rgba[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const at = rowStart + 1 + x * 4;
      rgba[at] = r;
      rgba[at + 1] = g;
      rgba[at + 2] = b;
      rgba[at + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rgba)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function reactDir() {
  const candidates = [
    process.env.DOC_LEDGER_REACT_DIR,
    join(REPO, "node_modules")
  ].filter((dir) => typeof dir === "string" && dir !== "");
  for (const dir of candidates) {
    const umd = join(dir, "react", "umd", "react.development.js");
    if (existsSync(umd)) return dir;
  }
  return null;
}

function file(rel, category, extra) {
  const name = rel.split("\\").pop();
  return Object.assign({
    name,
    path: "C:\\work\\demo-workspace\\" + rel,
    rel,
    category,
    reads: 2,
    writes: 1,
    createdAt: NOW - 3600000,
    updatedAt: NOW - 1800000,
    firstUsedAt: NOW - 3600000,
    lastUsedAt: NOW - 1800000,
    created: "inferred",
    exists: true
  }, extra ?? {});
}

/**
 * Three sessions, one of them a subagent child, with file names chosen so the fixtures
 * exercise multi-term search (`order md` must match only order-notes.md) and the
 * parent/child menu entries.
 */
const SESSIONS = [
  {
    sessionId: "session-a",
    title: "重构订单服务",
    createdAt: NOW - 7200000,
    parentSessionId: null,
    files: [
      file("src\\main\\java\\com\\example\\demo\\OrderService.java", "code"),
      file("src\\main\\java\\com\\example\\demo\\OrderDraft.java", "code", { created: "confirmed", writes: 4 }),
      file("docs\\order-notes.md", "doc"),
      file("docs\\2026-11-06-订单服务重构说明.md", "doc"),
      file("config\\application.yml", "config"),
      file("docs\\archive\\旧版设计稿.md", "doc", { exists: false, reads: 1, writes: 0 })
    ]
  },
  {
    sessionId: "session-child",
    title: "子任务：订单单测",
    createdAt: NOW - 3600000,
    parentSessionId: "session-a",
    files: [
      file("src\\test\\java\\com\\example\\demo\\OrderServiceTest.java", "code"),
      file("README.md", "doc")
    ]
  },
  {
    sessionId: "session-c",
    title: "缓存穿透排查",
    createdAt: NOW - 1800000,
    parentSessionId: null,
    files: [file("src\\main\\java\\com\\example\\demo\\CacheGuard.java", "code")]
  }
].map((session) => {
  const files = session.files;
  return Object.assign({}, session, {
    cwd: "C:\\work\\demo-workspace",
    agentPreset: "PTC",
    live: false,
    counts: {
      files: files.length,
      used: files.length,
      created: files.filter((f) => f.created !== null && f.created !== undefined).length,
      confirmed: files.filter((f) => f.created === "confirmed").length,
      modified: files.filter((f) => !f.created && (f.writes || 0) > 0).length,
      reads: files.reduce((n, f) => n + f.reads, 0),
      writes: files.reduce((n, f) => n + f.writes, 0)
    }
  });
});

const ALL_FILES = SESSIONS.flatMap((s) => s.files);

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": String(body.length) });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:" + PORT);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(join(HERE, "index.html")));
    return;
  }
  if (path === "/client.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(join(REPO, "client.js")));
    return;
  }
  if (path === "/react.js" || path === "/react-dom.js") {
    const dir = reactDir();
    const packageName = path === "/react.js" ? "react" : "react-dom";
    if (dir === null) {
      // Dev-machine fallback: the page pulls React from a CDN. CI never runs this.
      const target = "https://unpkg.com/" + packageName + "@18/umd/" + packageName + ".development.js";
      res.writeHead(302, { location: target });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(readFileSync(join(dir, packageName, "umd", packageName + ".development.js")));
    return;
  }
  if (path === "/doc-ledger/api/all") {
    const scope = url.searchParams.get("scope") === "current" ? "current" : "all";
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: NOW, rev: "demo", currentSessionId: "session-a", partial: false,
        totalSessions: SESSIONS.length, truncated: false, maxSessions: 40,
        sessions: scope === "current" ? [SESSIONS[0]] : SESSIONS
      }
    });
  }
  if (path === "/doc-ledger/api/file") {
    const wanted = url.searchParams.get("path") ?? "";
    const hit = ALL_FILES.find((f) => f.path === wanted);
    if (hit === undefined || hit.exists === false) {
      return json(res, 404, { ok: false, error: "文件已不存在：" + wanted });
    }
    return json(res, 200, {
      ok: true,
      data: {
        text: "# 订单服务重构说明\n\n## 目标\n- 把下单与取消的状态迁移收敛到 OrderDraft。\n- 保留原有接口，不改调用方。\n\n## 验证\n- 单测覆盖创建、取消、重复取消三条路径。\n",
        bytes: 1288291, shown: 204800, truncated: true, lines: 412,
        encoding: "utf-8+gb18030", replacements: 3, mtime: NOW
      }
    });
  }
  if (path === "/doc-ledger/api/openwith") {
    return json(res, 200, {
      ok: true,
      data: {
        ext: ".md",
        apps: [
          { exe: "C:\\Program Files\\Microsoft VS Code\\Code.exe", label: "VS Code", isDefault: true },
          { exe: "C:\\Windows\\notepad.exe", label: "记事本", isDefault: false }
        ],
        default: "C:\\Program Files\\Microsoft VS Code\\Code.exe"
      }
    });
  }
  if (path === "/doc-ledger/api/open") return json(res, 200, { ok: true, data: { ok: true } });
  if (path === "/doc-ledger/api/_clienterror") { res.writeHead(204); res.end(); return; }
  // Tier B of the file glyph: the real plugin extracts these through shell32. The harness has
  // no shell, so it serves a tiny drawn PNG per known extension and 404s the rest — which is
  // exactly the contract the client has to handle (and the way tier C gets exercised).
  if (path === "/doc-ledger/fileicon") {
    const ext = String(url.searchParams.get("ext") || "").toLowerCase();
    const known = { md: "#4f7cf7", js: "#eab308", json: "#eab308", java: "#e76f00", yml: "#64748b", yaml: "#64748b" };
    const tint = known[ext];
    if (tint === undefined) { res.writeHead(404); res.end(); return; }
    const png = glyphPng(ext.slice(0, 2).toUpperCase(), tint);
    res.writeHead(200, { "content-type": "image/png", "content-length": String(png.length), "cache-control": "no-store" });
    res.end(png);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("doc-ledger harness on http://127.0.0.1:" + PORT);
  console.log("react: " + (reactDir() === null ? "not found locally, /react.js redirects to unpkg" : reactDir()));
});
