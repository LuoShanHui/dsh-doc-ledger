#!/usr/bin/env node
/**
 * Standalone report generator: reads persisted session logs, folds each one with
 * the same ledger engine the plugin uses, and writes one static HTML page.
 *
 * Usage:
 *   node tools/report.mjs [--out report.html] [--limit 20] [--root <dsh home>]
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import * as zlib from "node:zlib";
import { buildLedger } from "../lib/ledger.js";
import { renderHtml } from "../lib/ui.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf("--" + name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

const root = arg("root", process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const limit = Number(arg("limit", "20"));
const out = resolve(arg("out", join(HERE, "..", "report.html")));
const only = arg("session", "");

/** Decode a log that concatenates one zstd frame per append. */
function decodeLog(file) {
  const raw = readFileSync(file);
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const offsets = [];
  let from = 0;
  while (true) {
    const at = raw.indexOf(magic, from);
    if (at < 0) break;
    offsets.push(at);
    from = at + 4;
  }
  let text = "";
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i];
    const end = i + 1 < offsets.length ? offsets[i + 1] : raw.length;
    try {
      text += zlib.zstdDecompressSync(raw.subarray(start, end)).toString("utf8");
    } catch {
      if (i === 0) return [];
    }
  }
  const events = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try { events.push(JSON.parse(line)); } catch { /* torn tail line */ }
  }
  return events;
}

function cachedMeta(rootDir, sessionId) {
  const file = join(rootDir, "storages", "session_projcache", "sessions", sessionId + ".json");
  if (!existsSync(file)) return null;
  try {
    const record = JSON.parse(readFileSync(file, "utf8")).record;
    return {
      title: record?.rows?.title?.val ?? null,
      createdAt: record?.identity?.createdAt ?? null,
      cwd: record?.identity?.cwd ?? null,
    };
  } catch {
    return null;
  }
}

function titleFromEvents(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "session/title" && typeof event.data?.title === "string" && event.data.title.trim() !== "") {
      return event.data.title.trim();
    }
  }
  for (const event of events) {
    if (event.type === "user/message") {
      const text = JSON.stringify(event.data ?? "").replace(/\\n/g, " ").slice(0, 70);
      if (text.length > 0) return text;
    }
  }
  return null;
}

function listLogs(rootDir) {
  const sessionsRoot = join(rootDir, "sessions");
  if (!existsSync(sessionsRoot)) return [];
  const logs = [];
  for (const project of readdirSync(sessionsRoot)) {
    const projectDir = join(sessionsRoot, project);
    let entries;
    try { entries = readdirSync(projectDir); } catch { continue; }
    for (const entry of entries) {
      const file = join(projectDir, entry, "session.v4.jsonl.zstd");
      if (!existsSync(file)) continue;
      const id = entry.startsWith("session-") ? entry : "session-" + entry;
      try { logs.push({ id, file, mtime: statSync(file).mtimeMs }); } catch { /* ignore */ }
    }
  }
  logs.sort((a, b) => b.mtime - a.mtime);
  return logs;
}

export { decodeLog, listLogs };

/** Build the report payload and write it. Exported so the plugin and tests can reuse it. */
export function buildReport(options = {}) {
  const reportRoot = options.root ?? root;
  const reportLimit = options.limit ?? limit;
  const reportOnly = options.session ?? only;
  const logs = reportOnly === "" ? listLogs(reportRoot).slice(0, reportLimit) : listLogs(reportRoot).filter((log) => log.id.includes(reportOnly));
  const sessions = [];
  for (const log of logs) {
    const events = decodeLog(log.file);
    if (events.length === 0) continue;
    const meta = cachedMeta(reportRoot, log.id);
    const header = events.find((event) => event.type === "session") ?? {};
    const ledger = buildLedger(events);
    if (ledger.counts.files === 0) continue;
    sessions.push({
      sessionId: ledger.sessionId || log.id,
      title: meta?.title ?? titleFromEvents(events) ?? log.id,
      createdAt: meta?.createdAt ?? header.createdAt ?? log.mtime,
      cwd: ledger.cwd || meta?.cwd || "",
      agentPreset: ledger.agentPreset,
      counts: ledger.counts,
      files: ledger.files,
    });
  }
  sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const data = { generatedAt: Date.now(), currentSessionId: sessions[0]?.sessionId ?? null, sessions };
  const target = options.out ?? out;
  writeFileSync(target, renderHtml(data, "static"), "utf8");
  return { out: target, data, scanned: logs.length };
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = buildReport({});
  const { data } = result;
  console.log("wrote " + result.out);
  console.log("scanned " + result.scanned + " sessions, kept " + data.sessions.length + ", files " + data.sessions.reduce((sum, s) => sum + s.files.length, 0));
  for (const session of data.sessions.slice(0, 10)) {
    console.log("  - " + String(session.title || "").slice(0, 42) + " | files " + session.files.length + " | used " + session.counts.used + " | created " + session.counts.created);
  }
}
