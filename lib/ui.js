/**
 * Server-side composition of the doc-ledger page: one HTML document with the
 * stylesheet, the embedded payload and the browser app inlined, so the same
 * markup renders both as a plugin route and as a standalone static report.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "ui.css"), "utf8");
const app = readFileSync(join(HERE, "ui.client.js"), "utf8");

const HEAD = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>文档台账</title>",
  "<style>",
  css,
  "</style>",
  "</head>",
].join("\n");

const SHELL_TOP = [
  '<body>',
  '<div class="app">',
  '  <div class="topbar">',
  '    <div class="brand"><h1>文档台账</h1><span class="meta" id="meta"></span></div>',
  '    <div class="seg">',
  '      <button data-scope="session" aria-pressed="true">当前会话</button>',
  '      <button data-scope="all" aria-pressed="false">全部会话</button>',
  "    </div>",
  '    <span class="spacer"></span>',
  '    <button class="btn" id="refresh">刷新</button>',
  "  </div>",
  '  <div class="toolbar">',
  '    <div class="search"><input id="search" placeholder="搜索文档路径、说明或会话…  Ctrl+K"></div>',
  '    <select id="sort-used" title="使用清单排序">',
  '      <option value="lastUsed">最近使用</option>',
  '      <option value="firstUsed">首次使用</option>',
  '      <option value="reads">使用次数</option>',
  '      <option value="type">类型</option>',
  '      <option value="path">路径</option>',
  "    </select>",
  '    <select id="sort-created" title="创建清单排序">',
  '      <option value="createdAt">创建时间</option>',
  '      <option value="updatedAt">更新时间</option>',
  '      <option value="type">类型</option>',
  '      <option value="path">路径</option>',
  "    </select>",
  '    <label class="check" id="group-toggle"><input type="checkbox" id="group-by-session"> 区分会话</label>',
  "  </div>",
  '  <div class="chips" id="chips"></div>',
  '  <div class="content" id="content"></div>',
  "</div>",
  '<div class="modal" id="modal">',
  '  <div class="card">',
  "    <header><span class=\"p\" id=\"modal-path\"></span><span class=\"spacer\"></span><button class=\"btn\" id=\"modal-close\">关闭</button></header>",
  '    <pre id="modal-body"></pre>',
  '    <div class="foot" id="modal-foot"></div>',
  "  </div>",
  "</div>",
  '<div class="toast" id="toast"></div>',
].join("\n");

/** Serialise a payload for inline script use, escaping the script terminator. */
function embed(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/**
 * Render the whole page.
 * @param data - payload of the ledger UI (generatedAt, sessions, currentSessionId).
 * @param mode - "plugin" polls the host routes, "static" is a frozen report.
 */
export function renderHtml(data, mode) {
  return [
    HEAD,
    SHELL_TOP,
    "<script>",
    "window.__LEDGER__ = " + embed(data) + ";",
    'window.__LEDGER_MODE__ = "' + mode + '";',
    "</script>",
    "<script>",
    app,
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");
}
