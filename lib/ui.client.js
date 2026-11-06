/* doc-ledger browser app. Renders from window.__LEDGER__; polls the host in plugin mode. */
(function () {
  "use strict";

  var DATA = window.__LEDGER__ || { generatedAt: 0, sessions: [], currentSessionId: null };
  var ACTIVE = (function () { try { return new URLSearchParams(window.location.search).get("session"); } catch (error) { return null; } })();
  var MODE = window.__LEDGER_MODE__ || "static";
  var API = "/doc-ledger/api";

  var ICONS = { doc: "\uD83D\uDCC4", sheet: "\uD83D\uDCCA", slide: "\uD83D\uDCFD", image: "\uD83D\uDDBC", code: "\uD83E\uDDE9", web: "\uD83C\uDF10", config: "\u2699", data: "\uD83D\uDDC4", archive: "\uD83D\uDCE6", other: "\uD83D\uDCCE" };
  var CATEGORY_LABELS = { doc: "文档", sheet: "表格", slide: "演示", image: "图片", code: "代码", web: "网页", config: "配置", data: "数据", archive: "压缩包", other: "其他" };

  var state = {
    scope: DATA.currentSessionId ? "session" : "all",
    query: "",
    category: "",
    sortUsed: "lastUsed",
    sortCreated: "createdAt",
    groupBySession: true,
    open: {},
    data: DATA,
  };
  for (var i = 0; i < (DATA.sessions || []).length; i++) {
    var s = DATA.sessions[i];
    state.open[s.sessionId] = s.sessionId === DATA.currentSessionId;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;";
    });
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function stamp(ms) {
    if (!ms) return "—";
    var d = new Date(ms);
    return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fullStamp(ms) {
    if (!ms) return "—";
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function dirOf(rel) {
    var i = Math.max(rel.lastIndexOf("\\"), rel.lastIndexOf("/"));
    return i > 0 ? rel.slice(0, i) : "";
  }

  function baseOf(rel) {
    var i = Math.max(rel.lastIndexOf("\\"), rel.lastIndexOf("/"));
    return i >= 0 ? rel.slice(i + 1) : rel;
  }

  function sessionsOf() {
    var list = state.data.sessions || [];
    if (state.scope === "session") {
      var current = list.filter(function (item) { return item.sessionId === state.data.currentSessionId; });
      if (current.length > 0) return current;
      return list.slice(0, 1);
    }
    return list;
  }

  function matches(file, session) {
    if (state.category !== "" && file.category !== state.category) return false;
    if (state.query === "") return true;
    var q = state.query.toLowerCase();
    return (
      String(file.rel).toLowerCase().indexOf(q) >= 0 ||
      String(file.name).toLowerCase().indexOf(q) >= 0 ||
      String(file.description || "").toLowerCase().indexOf(q) >= 0 ||
      String(session.title || "").toLowerCase().indexOf(q) >= 0
    );
  }

  function collect(predicate) {
    var rows = [];
    var sessions = sessionsOf();
    for (var i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      var files = session.files || [];
      for (var j = 0; j < files.length; j++) {
        var file = files[j];
        if (!predicate(file)) continue;
        if (!matches(file, session)) continue;
        rows.push({ file: file, session: session });
      }
    }
    return rows;
  }

  var COMPARE = {
    lastUsed: function (a, b) { return (b.file.lastUsedAt || 0) - (a.file.lastUsedAt || 0); },
    firstUsed: function (a, b) { return (a.file.firstUsedAt || 0) - (b.file.firstUsedAt || 0); },
    reads: function (a, b) { return b.file.reads - a.file.reads || (b.file.lastUsedAt || 0) - (a.file.lastUsedAt || 0); },
    createdAt: function (a, b) { return (b.file.createdAt || 0) - (a.file.createdAt || 0); },
    updatedAt: function (a, b) { return (b.file.updatedAt || 0) - (a.file.updatedAt || 0); },
    type: function (a, b) {
      var c = String(a.file.category).localeCompare(String(b.file.category));
      return c !== 0 ? c : String(a.file.rel).localeCompare(String(b.file.rel));
    },
    path: function (a, b) { return String(a.file.rel).localeCompare(String(b.file.rel)); },
  };

  function sortRows(rows, key) {
    var cmp = COMPARE[key] || COMPARE.path;
    return rows.slice().sort(function (a, b) {
      var r = cmp(a, b);
      if (r !== 0) return r;
      return (b.file.lastUsedAt || 0) - (a.file.lastUsedAt || 0);
    });
  }

  function spark(file) {
    var uses = file.uses || [];
    if (uses.length === 0) return "";
    var times = uses.map(function (u) { return u.time; });
    var min = Math.min.apply(null, times);
    var max = Math.max.apply(null, times);
    var span = Math.max(1, max - min);
    var dots = "";
    for (var i = 0; i < uses.length && i < 40; i++) {
      var left = ((uses[i].time - min) / span) * 100;
      var cls = uses[i].op === "read" ? "dot" : "dot w";
      dots += '<span class="' + cls + '" style="left:' + left.toFixed(2) + '%"></span>';
    }
    return '<span class="spark" title="' + uses.length + ' 次操作"><span class="track"></span>' + dots + "</span>";
  }

  function badgesFor(file) {
    var out = [];
    if (file.created === "confirmed") out.push('<span class="badge ok">交付文件</span>');
    else if (file.created === "inferred") out.push('<span class="badge warn">新建</span>');
    else if (file.writes > 0) out.push('<span class="badge">修改</span>');
    if (file.reads > 0 && file.writes > 0) out.push('<span class="badge read">读写</span>');
    return out.join(" ");
  }

  function rowHtml(row, showSession) {
    var file = row.file;
    var dir = dirOf(file.rel);
    var tag = showSession ? '<span class="session-tag">' + esc(row.session.title || row.session.sessionId) + "</span>" : "";
    var sub = [];
    sub.push(badgesFor(file));
    if (file.reads > 0) sub.push("读 " + file.reads);
    if (file.writes > 0) sub.push("写 " + file.writes);
    if (file.firstUsedAt) sub.push("首次 " + stamp(file.firstUsedAt));
    if (file.lastUsedAt && file.lastUsedAt !== file.firstUsedAt) sub.push("最近 " + stamp(file.lastUsedAt));
    if (file.createdAt) sub.push("创建 " + stamp(file.createdAt));
    if (file.updatedAt && file.createdAt && file.updatedAt !== file.createdAt) sub.push("更新 " + stamp(file.updatedAt));
    var rightTime = file.created !== null ? file.updatedAt || file.createdAt : file.lastUsedAt;
    return (
      '<div class="row" data-session="' + esc(row.session.sessionId) + '" data-path="' + esc(file.path) + '" title="' + esc(file.path) + '">' +
        '<span class="ico">' + (ICONS[file.category] || ICONS.other) + "</span>" +
        '<span class="main">' +
          '<div class="name">' + esc(baseOf(file.rel)) + (dir ? ' <span class="dir">' + esc(dir) + "</span>" : "") + "</div>" +
          '<div class="sub">' + sub.filter(Boolean).join("<span></span>") + "</div>" +
        "</span>" +
        '<span class="right">' + tag + spark(file) + '<span class="time">' + stamp(rightTime) + "</span></span>" +
      "</div>"
    );
  }

  function listHtml(rows, key, showSession) {
    if (rows.length === 0) return '<div class="empty">没有匹配的文档</div>';
    var sorted = sortRows(rows, key);
    var html = '<div class="list">';
    for (var i = 0; i < sorted.length && i < 500; i++) html += rowHtml(sorted[i], showSession);
    return html + "</div>";
  }

  function blockHtml(title, rows, key, showSession) {
    return '<section class="block"><div class="block-head"><h2>' + esc(title) + '</h2><span class="count">' + rows.length + " 份</span></div>" + listHtml(rows, key, showSession) + "</section>";
  }

  function categoriesOf(rows) {
    var map = {};
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i].file.category;
      map[c] = (map[c] || 0) + 1;
    }
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).map(function (key) { return { key: key, count: map[key] }; });
  }

  function groupHtml(rowsUsed, rowsCreated) {
    var sessions = sessionsOf();
    var html = "";
    for (var i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      var used = rowsUsed.filter(function (r) { return r.session.sessionId === session.sessionId; });
      var created = rowsCreated.filter(function (r) { return r.session.sessionId === session.sessionId; });
      if (used.length === 0 && created.length === 0) continue;
      var open = state.open[session.sessionId] !== false;
      html +=
        '<div class="session" data-session="' + esc(session.sessionId) + '" data-open="' + String(open) + '">' +
          '<header data-role="toggle"><span class="caret">▾</span>' +
            '<span class="title">' + esc(session.title || session.sessionId) + "</span>" +
            '<span class="when">' + stamp(session.createdAt) + "</span>" +
            '<span class="stats"><span>文档 <b>' + session.files.length + "</b></span><span>使用 <b>" + used.length + "</b></span><span>创建 <b>" + created.length + "</b></span></span>" +
          "</header>" +
          '<div class="body">' +
            (created.length > 0 ? blockHtml("创建 / 修改", created, state.sortCreated, false) : "") +
            (used.length > 0 ? blockHtml("使用过", used, state.sortUsed, false) : "") +
          "</div>" +
        "</div>";
    }
    return html === "" ? '<div class="empty">没有匹配的文档</div>' : html;
  }

  function summaryHtml(rowsUsed, rowsCreated) {
    var sessions = sessionsOf();
    var reads = 0;
    var writes = 0;
    for (var i = 0; i < sessions.length; i++) {
      reads += sessions[i].counts.reads;
      writes += sessions[i].counts.writes;
    }
    return (
      '<div class="summary">' +
        "<span>会话 <b>" + sessions.length + "</b></span>" +
        "<span>使用过 <b>" + rowsUsed.length + "</b></span>" +
        "<span>创建/修改 <b>" + rowsCreated.length + "</b></span>" +
        "<span>读取 <b>" + reads + "</b> 次</span>" +
        "<span>写入 <b>" + writes + "</b> 次</span>" +
        "<span>更新于 <b>" + stamp(state.data.generatedAt) + "</b></span>" +
      "</div>"
    );
  }

  function chipsHtml(rows) {
    var cats = categoriesOf(rows);
    var html = '<button class="chip" data-cat="" aria-pressed="' + String(state.category === "") + '">全部<span class="n">' + rows.length + "</span></button>";
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      html += '<button class="chip" data-cat="' + esc(c.key) + '" aria-pressed="' + String(state.category === c.key) + '">' + (ICONS[c.key] || "") + " " + esc(CATEGORY_LABELS[c.key] || c.key) + '<span class="n">' + c.count + "</span></button>";
    }
    return html;
  }

  function render() {
    var rowsUsed = collect(function (f) { return f.reads > 0; });
    var rowsCreated = collect(function (f) { return f.created !== null || f.writes > 0; });
    var chips = document.getElementById("chips");
    if (chips) chips.innerHTML = chipsHtml(rowsUsed.concat(rowsCreated));
    var content = document.getElementById("content");
    if (!content) return;
    if (state.scope === "all" && state.groupBySession) {
      content.innerHTML = summaryHtml(rowsUsed, rowsCreated) + groupHtml(rowsUsed, rowsCreated);
    } else {
      content.innerHTML =
        summaryHtml(rowsUsed, rowsCreated) +
        (rowsCreated.length > 0 ? blockHtml("创建 / 修改", rowsCreated, state.sortCreated, state.scope === "all") : "") +
        blockHtml("使用过", rowsUsed, state.sortUsed, state.scope === "all");
    }
    var meta = document.getElementById("meta");
    if (meta) meta.textContent = "更新于 " + stamp(state.data.generatedAt);
  }

  function openFile(sessionId, path) {
    var dialog = document.getElementById("modal");
    var body = document.getElementById("modal-body");
    var title = document.getElementById("modal-path");
    var foot = document.getElementById("modal-foot");
    title.textContent = path;
    dialog.setAttribute("data-open", "true");
    if (MODE !== "plugin") {
      body.textContent = "静态报告不包含文件内容。\n\n" + path;
      foot.textContent = "插件模式下点击行内可用应用内预览";
      return;
    }
    body.textContent = "加载中…";
    foot.textContent = "";
    fetch(API + "/file?session=" + encodeURIComponent(sessionId) + "&path=" + encodeURIComponent(path))
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        if (!payload.ok) { body.textContent = "无法预览：" + (payload.error || "unknown"); return; }
        body.textContent = payload.text;
        foot.textContent = payload.bytes + " 字节" + (payload.truncated ? "（已截断）" : "");
      })
      .catch(function (error) { body.textContent = "无法预览：" + error.message; });
  }

  function closeModal() {
    document.getElementById("modal").setAttribute("data-open", "false");
  }

  function toast(text) {
    var el = document.getElementById("toast");
    el.textContent = text;
    el.setAttribute("data-open", "true");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.setAttribute("data-open", "false"); }, 1600);
  }

  function bind() {
    var scopeButtons = document.querySelectorAll("[data-scope]");
    for (var i = 0; i < scopeButtons.length; i++) {
      scopeButtons[i].addEventListener("click", function (event) {
        state.scope = event.currentTarget.getAttribute("data-scope");
        for (var j = 0; j < scopeButtons.length; j++) scopeButtons[j].setAttribute("aria-pressed", String(scopeButtons[j] === event.currentTarget));
        var group = document.getElementById("group-toggle");
        if (group) group.style.display = state.scope === "all" ? "" : "none";
        render();
      });
    }
    var search = document.getElementById("search");
    search.addEventListener("input", function (event) { state.query = event.target.value.trim(); render(); });
    var sortUsed = document.getElementById("sort-used");
    sortUsed.value = state.sortUsed;
    sortUsed.addEventListener("change", function (event) { state.sortUsed = event.target.value; render(); });
    var sortCreated = document.getElementById("sort-created");
    sortCreated.value = state.sortCreated;
    sortCreated.addEventListener("change", function (event) { state.sortCreated = event.target.value; render(); });
    var group = document.getElementById("group-by-session");
    group.checked = state.groupBySession;
    group.addEventListener("change", function (event) { state.groupBySession = event.target.checked; render(); });
    document.getElementById("refresh").addEventListener("click", function () { refresh(true); });
    document.getElementById("chips").addEventListener("click", function (event) {
      var chip = event.target.closest ? event.target.closest("[data-cat]") : null;
      if (!chip) return;
      state.category = chip.getAttribute("data-cat");
      render();
    });
    document.getElementById("content").addEventListener("click", function (event) {
      var header = event.target.closest ? event.target.closest('[data-role="toggle"]') : null;
      if (header) {
        var card = header.parentElement;
        var id = card.getAttribute("data-session");
        state.open[id] = card.getAttribute("data-open") !== "true";
        render();
        return;
      }
      var row = event.target.closest ? event.target.closest(".row") : null;
      if (row) openFile(row.getAttribute("data-session"), row.getAttribute("data-path"));
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", function (event) {
      if (event.target.id === "modal") closeModal();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeModal();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.focus();
      }
    });
    var groupWrap = document.getElementById("group-toggle");
    if (groupWrap) groupWrap.style.display = state.scope === "all" ? "" : "none";
  }

  function refresh(manual) {
    if (MODE !== "plugin") { if (manual) toast("静态报告：请用插件模式刷新"); return; }
    fetch(API + "/all" + (ACTIVE ? "?session=" + encodeURIComponent(ACTIVE) : ""))
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : "bad payload");
        state.data = payload.data;
        render();
        if (manual) toast("已刷新");
      })
      .catch(function (error) { if (manual) toast("刷新失败：" + error.message); });
  }

  function boot() {
    bind();
    render();
    if (MODE === "plugin") {
      setInterval(function () { if (!document.hidden) refresh(false); }, 4000);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
