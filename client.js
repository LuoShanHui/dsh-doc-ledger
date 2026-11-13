/**
 * dsh-doc-ledger client plugin: the document ledger sidebar tab, rendered
 * natively in React from the host projection endpoint.
 */
window.__ModuleLoader__.load({
  id: "dsh-doc-ledger",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    var react = require("react");

    var NS = "doc-ledger";
    var TAB_ID = "dsh-doc-ledger";
    var KIND = "doc-ledger";
    var BASE = "/doc-ledger";

    /**
     * Translator installed by apply() once the host's locale service exists.
     *
     * The client is one factory closure: components are declared at evaluation time but
     * only rendered after apply(), so `t` cannot be imported as a module. Instead the
     * whole bundle calls this single `t(key, params)`; apply() swaps the underlying
     * function to `ctx.locale.bind(NS)`. Before that (and in the harness / static report,
     * which have no real locale service) it falls back to the Chinese source strings, so
     * a raw "a.b.c" key is never shown and evaluation-time constants stay readable.
     *
     * `{name}` placeholders are substituted here rather than relying on the host's
     * translator, so dictionaries and call sites do not depend on host interpolation.
     *
     * PLURALS: a caller may pass `count`. The dictionary then supplies variants under
     * `<key>_one` / `<key>_other` (plus `_few` / `_many` / `_zero` where a language needs
     * them), chosen with Intl.PluralRules. Chinese has one form, so its `_other` entry is
     * used for every count; English gets `1 file` / `2 files` without the call sites
     * knowing which language is active.
     */
    var ZH_FALLBACK = {};
    var EN_FALLBACK = {};
    var rawT = null;
    var currentLocale = "zh";
    var pluralRules = null;

    /**
     * Which dictionary our own strings actually come from.
     *
     * The host walks `<active> → its fallback chain → common` and only then shows the key,
     * so a language we do not translate (ja, ko, ru…) resolves to **English** — every
     * `addLanguage` fallback chain has to terminate there. The plural form must agree with
     * the language the *text* is in, not with the language the user picked: otherwise a
     * Japanese user gets English sentences with Japanese plural rules ("1 files").
     *
     * zh and en are the only dictionaries we ship, so everything else behaves like en.
     */
    function pluralLocale() {
      return currentLocale === "zh" ? "zh" : "en";
    }

    function lookup(key) {
      var text = rawT !== null ? rawT(key) : undefined;
      if (text === undefined || text === null || text === "" || text === key) {
        // The host answered with the key itself, so it has no entry for the active
        // language and no fallback hit: use our own dictionary for the same language
        // rather than dropping to Chinese under an English/Japanese UI.
        text = fallbackDict()[key];
      }
      return text;
    }

    function pluralForm(count) {
      try {
        if (pluralRules === null && typeof Intl !== "undefined" && Intl.PluralRules) {
          pluralRules = new Intl.PluralRules(pluralLocale());
        }
        if (pluralRules !== null) return pluralRules.select(Number(count));
      } catch (error) {
        /* an old runtime without Intl falls through to the _other form */
      }
      return "other";
    }

    /**
     * The number a plural variant should agree with: `count`, or the first numeric
     * param the call site supplied. Dictionary keys stay language-neutral, so a
     * caller that says `{ n: 3 }` or `{ files: 2 }` gets `_one` / `_other` selected
     * without declaring which of its params drives the plural.
     */
    function countOf(params) {
      if (!params) return null;
      if (typeof params.count === "number") return params.count;
      for (var name in params) {
        if (!Object.prototype.hasOwnProperty.call(params, name)) continue;
        if (typeof params[name] === "number") return params[name];
      }
      return null;
    }

    function t(key, params) {
      var text;
      var num = countOf(params);
      if (num !== null) {
        var form = pluralForm(num);
        text = lookup(key + "_" + form);
        if (text === undefined) text = lookup(key + "_other");
        if (text === undefined) text = lookup(key + "_one");
      }
      if (text === undefined) text = lookup(key);
      if (text === undefined || text === null) return String(key);
      if (!params) return String(text);
      return String(text).replace(/\{(\w+)\}/g, function (all, name) {
        return params[name] === undefined || params[name] === null ? all : String(params[name]);
      });
    }

    function setTranslator(fn, locale) {
      rawT = fn;
      if (typeof locale === "string" && locale !== "") {
        currentLocale = locale;
        pluralRules = null;
      }
    }
    /**
     * Offline fallbacks, used when the host translator cannot answer (no locale service,
     * a key we never registered, or a dictionary that has not arrived yet).
     *
     * `zh` backs `currentLocale === "zh"`; everything else falls back to `en`, matching
     * the host's own fallback chain. Passing both keeps the degraded path in the same
     * language as the sentences it sits next to.
     */
    function setFallback(dicts) {
      if (dicts !== null && typeof dicts === "object" && dicts.zh !== undefined) {
        ZH_FALLBACK = dicts.zh || {};
        EN_FALLBACK = dicts.en || {};
        return;
      }
      ZH_FALLBACK = dicts || {};
      EN_FALLBACK = {};
    }

    function fallbackDict() {
      return currentLocale === "zh" ? ZH_FALLBACK : EN_FALLBACK;
    }

    /**
     * The active language tag, read from the host's locale service.
     *
     * `getLocale()` returns a LocaleSnapshot — `{ active, locales, revision }` — not a
     * string, so it must be unwrapped through `.active`. (Passing the object straight to
     * Intl.PluralRules throws RangeError, which silently degrades every English plural to
     * the `_other` form: "1 files".) Anything unexpected falls back to zh, whose
     * dictionary has a single form.
     */
    function readActiveLocale(ctx) {
      try {
        if (ctx === null || ctx === undefined || ctx.locale === null || ctx.locale === undefined) return "en";
        if (typeof ctx.locale.getLocale !== "function") return "en";
        var snapshot = ctx.locale.getLocale();
        if (typeof snapshot === "string" && snapshot !== "") return snapshot;
        if (snapshot !== null && typeof snapshot === "object" && typeof snapshot.active === "string" && snapshot.active !== "") {
          return snapshot.active;
        }
        return "en";
      } catch (error) {
        return "en";
      }
    }
    /**
     * UI dictionaries. Every user-visible string in the panel goes through t().
     * Grouped by surface; `docs/i18n-strings.md` lists the original literals and
     * `tools/i18n-check.mjs` asserts zh/en key sets, references and placeholders.
     */
    var zh = {
      // tab / guide
      "tab.title": "文档台账",
      "guide.title": "文档台账",
      "guide.description": "按会话查看用过与创建/修改过的文档",

      // categories (also used by CATEGORY_LABEL)
      "category.doc": "文档",
      "category.sheet": "表格",
      "category.slide": "演示",
      "category.image": "图片",
      "category.code": "代码",
      "category.web": "网页",
      "category.config": "配置",
      "category.data": "数据",
      "category.media": "音视频",
      "category.archive": "压缩",
      "category.binary": "二进制",
      "category.other": "其他",

      // encoding
      "encoding.gb18030Mixed": "GB18030 混合解码",

      // search box
      "search.placeholder": "搜索文件 / 路径 / 类型 / 会话，空格分隔多个词  (Ctrl+K)",
      "search.aria": "搜索文档路径、类型或会话",

      // row (file)
      "row.missingSuffix": "（文件已不存在）",
      "row.ariaSuffix": "，回车打开预览，Shift+回车快速查看，Shift+F10 打开菜单",
      "row.missingTag": "已删除",
      "row.read": "读",
      "row.writeSlash": "/写",
      "row.onlyCreated": "建 {time}",
      "row.onlyUpdated": "改 {time}",
      "row.onlyUsed": "{time}",

      // section heads / chips
      "section.collapse": "收起这个分区",
      "section.expand": "展开这个分区",
      "section.sortTitle": "排序方式（再点一次收起）",
      "section.sortPrefix": "排序方式：",
      "section.morePrefix": "显示更多（还有 ",
      "section.moreSuffix": " 行）",
      "section.mergeTitle": "合并「创建 / 修改」",
      "section.splitTitle": "把「创建」和「修改」拆成两个分区",
      "section.merge": "合并",
      "section.split": "拆开",
      "section.cardAria": "，文档台账，右键打开会话菜单",
      "section.usedShort": "使用 ",
      "section.createdShort": " · 创建 ",
      "section.modifiedShort": " · 修改 ",
      "section.used": "使用过",
      "section.created": "创建",
      "section.modifiedOnly": "修改（仅改动）",
      "section.createdModified": "创建 / 修改",
      "section.titleWithCount": "{title}（{count}）",

      // sort menu
      "sort.menu": "操作菜单",
      "sort.lastUsed": "最近使用",
      "sort.firstUsed": "首次使用",
      "sort.reads": "读取次数",
      "sort.exists": "存在状态",
      "sort.type": "类型",
      "sort.path": "路径",
      "sort.createdAt": "创建时间",
      "sort.updatedAt": "更新时间",
      "sort.writes": "写入次数",
      "sort.directionHint": " · 点当前项切方向",
      "sort.modified": "修改排序",
      "sort.createdModified": "创建 / 修改排序",
      "sort.used": "使用过排序",

      // frame error boundary
      "frame.errorPrefix": "文档台账面板出错：",

      // toast / copy
      "toast.copiedChars": "（{n} 字符）",
      "toast.copiedChars_one": "（{n} 字符）",
      "toast.copiedChars_other": "（{n} 字符）",
      "toast.copyFailed": "复制失败：",
      "toast.copiedMd": "已复制 Markdown",
      "toast.copiedCsv": "已复制 CSV",
      "toast.copiedPaths": "已复制路径",
      "toast.copiedSummary": "已复制摘要",
      "toast.copiedSessionName": "已复制会话名称",
      "toast.copiedSessionId": "已复制会话 ID",
      "toast.switchedTo": "已切换到「{name}」",
      "toast.thisSession": "该会话",
      "toast.jumpUnsupported": "这个环境不支持跳转会话",
      "toast.copiedPath": "已复制路径",
      "toast.located": "已在资源管理器中定位",
      "toast.openWith": "已打开「打开方式」对话框",
      "toast.opened": "已交给系统打开",
      "toast.refreshed": "已刷新",
      "toast.refreshFailed": "刷新失败：",
      "ui.sep": "　·　",
      "toast.clickRetry": "　点击重试",
      "toast.backgroundFailed": "后台刷新失败，显示的是上次成功的数据",
      "toast.copiedContent": "已复制内容",

      // export
      "export.titlePrefix": "文档台账 · ",
      "export.scopeAll": "全部会话",
      "export.scopeCurrent": "当前会话",
      "export.query": " · 搜索「{q}」",
      "export.lines": "\n行数 {lines} · 使用过 {used} · 创建 {created}",
      "export.colSession": "会话",
      "export.colFile": "文件",
      "export.colRel": "相对路径",
      "export.colAbs": "绝对路径",
      "export.colRead": "读",
      "export.colWrite": "写",
      "export.colCreated": "创建时间",
      "export.colUpdated": "修改时间",
      "export.colCreatedShort": "创建",
      "export.colModified": "修改",

      "export.currentListWithCount": "导出当前清单（{n} 行）",
      "export.currentListWithCount_one": "导出当前清单（{n} 行）",
      "export.currentListWithCount_other": "导出当前清单（{n} 行）",
      "export.markdown": "复制清单（Markdown 表格）",
      "export.csv": "复制清单（CSV）",
      "export.paths": "复制全部路径",
      "export.summary": "复制摘要",

      // toolbar
      "toolbar.title": "文档台账",
      "toolbar.separate": "区分会话",
      "toolbar.autoDesc": "每 8 秒自动刷新（预览打开时暂停），点击暂停",
      "toolbar.pausedDesc": "已暂停自动刷新，点击恢复",
      "toolbar.auto": "自动刷新",
      "toolbar.paused": "已暂停",
      "toolbar.export": "导出当前清单",
      "toolbar.exportShort": "导出",
      "toolbar.refresh": "刷新",
      "theme.title": "主题：",
      "theme.compact": "紧凑",
      "theme.timeline": "时间轴",
      "theme.grid": "网格",
      "theme.card": "卡片",
      "theme.next": "主题",
      "theme.pick": "选择主题",

      // file menu
      "menu.previewInSidebar": "在侧边栏预览",
      "menu.quick": "快速查看",
      "menu.preview": "预览",
      "menu.openWith": "打开方式",
      "menu.noApps": "没有找到为这个类型注册的程序",
      "menu.default": "（默认）",
      "menu.chooseOther": "选择其他程序…",
      "menu.reveal": "在资源管理器中显示",
      "menu.copyFullPath": "复制完整路径",
      "menu.copySessionName": "复制会话名称",
      "menu.copySessionId": "复制会话 ID",
      "menu.jumpToSession": "跳转到这个会话",
      "menu.jumpToParentWith": "跳到父会话：",
      "menu.jumpToParent": "跳到父会话",
      "menu.jumpToChildWith": "跳到子会话：",

      // quick-look modal
      "preview.defaultApp": "默认程序",
      "preview.lines": " {n} 行",
      "preview.lines_one": " {n} 行",
      "preview.lines_other": " {n} 行",
      "preview.createdAt": "创建于 ",
      "preview.updatedAt": "改于 ",
      "preview.readWrite": "读 {reads} 写 {writes}",
      "preview.truncated": "只显示前 {shown}（共 {total}），完整内容请用上面的按钮打开",
      "preview.undecodable": " {n} 个字符无法解码",
      "preview.undecodable_one": " {n} 个字符无法解码",
      "preview.undecodable_other": " {n} 个字符无法解码",
      "preview.aria": "预览 ",
      "preview.openWith": "用 {app} 打开",
      "preview.chooseOther": "选择其他程序",
      "preview.sidebarTitle": "在侧边栏的文档预览中打开（图片 / PDF / Office / Markdown 都由宿主渲染）",
      "preview.sidebar": "侧边栏",
      "preview.reloadTitle": "重新读取这个文件（没变时宿主只回 304，不重传正文）",
      "preview.copyTruncated": "复制可见内容（文件已截断）",
      "preview.copyContent": "复制文件内容",
      "preview.copy": "复制",
      "preview.close": "关闭",
      "preview.loading": "加载中…",
      "preview.copyPathHint": "（点击复制完整路径）",
      "preview.esc": "　·　Esc 关闭",

      // summary line
      "enter.back": "返回全部会话",
      "enter.hint": "当前只显示这一个会话",
      "summary.line": "会话 {sessions} · 使用 {used} · 创建 {created} · 读 {reads} 次 · 写 {writes} 次",
      "summary.filteredLine": "　·　筛选后{files} /{sessions}",
      "summary.countFiles": " {n} 个文件",
      "summary.countFiles_one": " {n} 个文件",
      "summary.countFiles_other": " {n} 个文件",
      "summary.countSessions": " {n} 个会话",
      "summary.countSessions_one": " {n} 个会话",
      "summary.countSessions_other": " {n} 个会话",
      "summary.onlyRecentLine": "　（仅最近 {shown} 个会话，共 {total}）",
      "summary.onlyRecentLine_one": "　（仅最近 {shown} 个会话，共 {total}）",
      "summary.onlyRecentLine_other": "　（仅最近 {shown} 个会话，共 {total}）",
      "summary.loadEarlier": "加载更早的会话",

      // empty / filter / expand
      "empty.mergeAll": "全部合并（按路径去重）",
      "empty.noCurrent": "本会话还没有文档记录",
      "empty.noDocs": "没有文档记录",
      "empty.noMatch": "没有同时匹配「{terms}」的文档",
      "empty.readFailed": "读取失败：",
      "filter.only": "只看 {type}（{count} 个文件）",
      "filter.extLabel": "扩展名",
      "filter.allExts": "全部",
      "filter.noExt": "无扩展名",
      "filter.onlyExt": "只看 .{ext}（{count} 个文件）",
      "filter.onlyExt_one": "只看 .{ext}（{count} 个文件）",
      "filter.onlyExt_other": "只看 .{ext}（{count} 个文件）",
      "filter.moreExts": "另 {n} 种",
      "filter.moreExts_one": "另 {n} 种",
      "filter.moreExts_other": "另 {n} 种",
      "filter.only_one": "只看 {type}（{count} 个文件）",
      "filter.only_other": "只看 {type}（{count} 个文件）",
      "filter.missingTitle": "只看磁盘上已经不存在的文件",
      "filter.clearTitle": "清除类型与「已删除」筛选（搜索框里的词保留）",
      "filter.clearAria": "清除筛选条件",
      "filter.clear": "清除筛选",
      "expand.collapseTitle": "收起所有会话卡片",
      "expand.expandTitle": "展开所有会话卡片",
      "expand.collapse": "全部折叠",
      "expand.expand": "全部展开",
      "toast.close": "点击关闭"
    };

    var en = {
      "tab.title": "Doc ledger",
      "guide.title": "Doc ledger",
      "guide.description": "Documents used and created per session",

      "category.doc": "Docs",
      "category.sheet": "Sheets",
      "category.slide": "Slides",
      "category.image": "Images",
      "category.code": "Code",
      "category.web": "Web",
      "category.config": "Config",
      "category.data": "Data",
      "category.media": "Media",
      "category.archive": "Archives",
      "category.binary": "Binaries",
      "category.other": "Other",

      "encoding.gb18030Mixed": "GB18030 mixed decoding",

      "search.placeholder": "Search files / paths / types / sessions, space-separated terms  (Ctrl+K)",
      "search.aria": "Search document paths, types or sessions",

      "row.missingSuffix": " (file no longer exists)",
      "row.ariaSuffix": ", Enter to preview, Shift+Enter for quick look, Shift+F10 for menu",
      "row.missingTag": "Deleted",
      "row.read": "R",
      "row.writeSlash": "/W",
      "row.onlyCreated": "created {time}",
      "row.onlyUpdated": "updated {time}",
      "row.onlyUsed": "{time}",

      "section.collapse": "Collapse this section",
      "section.expand": "Expand this section",
      "section.sortTitle": "Sort by (click again to close)",
      "section.sortPrefix": "Sort by: ",
      "section.morePrefix": "Show more (",
      "section.moreSuffix": " more)",
      "section.mergeTitle": "Merge Created / Modified",
      "section.splitTitle": "Split Created and Modified into two sections",
      "section.merge": "Merge",
      "section.split": "Split",
      "section.cardAria": ", document ledger, right-click for the session menu",
      "section.usedShort": "Used ",
      "section.createdShort": " · Created ",
      "section.modifiedShort": " · Modified ",
      "section.used": "Used",
      "section.created": "Created",
      "section.modifiedOnly": "Modified (only)",
      "section.createdModified": "Created / Modified",
      "section.titleWithCount": "{title} ({count})",

      "sort.menu": "Actions",
      "sort.lastUsed": "Recently used",
      "sort.firstUsed": "First used",
      "sort.reads": "Read count",
      "sort.exists": "Exists",
      "sort.type": "Type",
      "sort.path": "Path",
      "sort.createdAt": "Created time",
      "sort.updatedAt": "Updated time",
      "sort.writes": "Write count",
      "sort.directionHint": " · click again to reverse",
      "sort.modified": "Modified sort",
      "sort.createdModified": "Created / Modified sort",
      "sort.used": "Used sort",

      "frame.errorPrefix": "Document ledger panel error: ",

      "toast.copiedChars": " ({n} chars)",
      "toast.copiedChars_one": " ({n} char)",
      "toast.copiedChars_other": " ({n} chars)",
      "toast.copyFailed": "Copy failed: ",
      "toast.copiedMd": "Markdown copied",
      "toast.copiedCsv": "CSV copied",
      "toast.copiedPaths": "Paths copied",
      "toast.copiedSummary": "Summary copied",
      "toast.copiedSessionName": "Session name copied",
      "toast.copiedSessionId": "Session ID copied",
      "toast.switchedTo": "Switched to {name}",
      "toast.thisSession": "this session",
      "toast.jumpUnsupported": "Session switching is unavailable here",
      "toast.copiedPath": "Path copied",
      "toast.located": "Revealed in Explorer",
      "toast.openWith": "Open-with dialog shown",
      "toast.opened": "Handed to the system",
      "toast.refreshed": "Refreshed",
      "toast.refreshFailed": "Refresh failed: ",
      "ui.sep": "  ·  ",
      "toast.clickRetry": "  click to retry",
      "toast.backgroundFailed": "Background refresh failed; showing last successful data",
      "toast.copiedContent": "Content copied",

      "export.titlePrefix": "Doc ledger · ",
      "export.scopeAll": "All sessions",
      "export.scopeCurrent": "Current session",
      "export.query": " · search \"{q}\"",
      "export.lines": "\nRows {lines} · used {used} · created {created}",
      "export.colSession": "Session",
      "export.colFile": "File",
      "export.colRel": "Relative path",
      "export.colAbs": "Absolute path",
      "export.colRead": "R",
      "export.colWrite": "W",
      "export.colCreated": "Created",
      "export.colUpdated": "Updated",
      "export.colCreatedShort": "Created",
      "export.colModified": "Modified",
      "export.currentListWithCount": "Export current list ({n} rows)",
      "export.currentListWithCount_one": "Export current list ({n} row)",
      "export.currentListWithCount_other": "Export current list ({n} rows)",
      "export.markdown": "Copy list (Markdown table)",
      "export.csv": "Copy list (CSV)",
      "export.paths": "Copy all paths",
      "export.summary": "Copy summary",

      "toolbar.title": "Doc ledger",
      "toolbar.separate": "Group by session",
      "toolbar.autoDesc": "Auto-refresh every 8s (paused while previewing); click to pause",
      "toolbar.pausedDesc": "Auto-refresh paused; click to resume",
      "toolbar.auto": "Auto",
      "toolbar.paused": "Paused",
      "toolbar.export": "Export current list",
      "toolbar.exportShort": "Export",
      "toolbar.refresh": "Refresh",
      "theme.title": "Theme: ",
      "theme.compact": "Compact",
      "theme.timeline": "Timeline",
      "theme.grid": "Grid",
      "theme.card": "Card",
      "theme.next": "Theme",
      "theme.pick": "Choose a theme",

      "menu.previewInSidebar": "Preview in sidebar",
      "menu.quick": "Quick look",
      "menu.preview": "Preview",
      "menu.openWith": "Open with",
      "menu.noApps": "No program registered for this file type",
      "menu.default": " (default)",
      "menu.chooseOther": "Choose another program…",
      "menu.reveal": "Reveal in Explorer",
      "menu.copyFullPath": "Copy full path",
      "menu.copySessionName": "Copy session name",
      "menu.copySessionId": "Copy session ID",
      "menu.jumpToSession": "Jump to this session",
      "menu.jumpToParentWith": "Jump to parent: ",
      "menu.jumpToParent": "Jump to parent",
      "menu.jumpToChildWith": "Jump to child: ",

      "preview.defaultApp": "Default program",
      "preview.lines": " {n} lines",
      "preview.lines_one": " {n} line",
      "preview.lines_other": " {n} lines",
      "preview.createdAt": "Created ",
      "preview.updatedAt": "Updated ",
      "preview.readWrite": "R {reads} W {writes}",
      "preview.truncated": "Showing first {shown} of {total}; use the buttons above for the full file",
      "preview.undecodable": " {n} undecodable chars",
      "preview.undecodable_one": " {n} undecodable char",
      "preview.undecodable_other": " {n} undecodable chars",
      "preview.aria": "Preview ",
      "preview.openWith": "Open with {app}",
      "preview.chooseOther": "Choose another program",
      "preview.sidebarTitle": "Open in the sidebar preview (host renders images / PDF / Office / Markdown)",
      "preview.sidebar": "Sidebar",
      "preview.reloadTitle": "Re-read this file (unchanged files get a 304, no body re-sent)",
      "preview.copyTruncated": "Copy visible content (file truncated)",
      "preview.copyContent": "Copy file content",
      "preview.copy": "Copy",
      "preview.close": "Close",
      "preview.loading": "Loading…",
      "preview.copyPathHint": " (click to copy the full path)",
      "preview.esc": "  ·  Esc to close",

      "enter.back": "All sessions",
      "enter.hint": "Showing this session only",
      "summary.line": "Sessions {sessions} · used {used} · created {created} · R {reads} · W {writes}",
      "summary.filteredLine": "  ·  filtered{files} /{sessions}",
      "summary.countFiles": " {n} files",
      "summary.countFiles_one": " {n} file",
      "summary.countFiles_other": " {n} files",
      "summary.countSessions": " {n} sessions",
      "summary.countSessions_one": " {n} session",
      "summary.countSessions_other": " {n} sessions",
      "summary.onlyRecentLine": "  (latest {shown} sessions of {total})",
      "summary.onlyRecentLine_one": "  (latest {shown} session of {total})",
      "summary.onlyRecentLine_other": "  (latest {shown} sessions of {total})",
      "summary.loadEarlier": "Load earlier sessions",

      "empty.mergeAll": "Merge all (dedupe by path)",
      "empty.noCurrent": "No document records for this session yet",
      "empty.noDocs": "No document records",
      "empty.noMatch": "No documents matching all of: {terms}",
      "empty.readFailed": "Read failed: ",
      "filter.only": "Only {type} ({count} files)",
      "filter.extLabel": "Extension",
      "filter.allExts": "All",
      "filter.noExt": "(none)",
      "filter.onlyExt": "Only .{ext} ({count} files)",
      "filter.onlyExt_one": "Only .{ext} ({count} file)",
      "filter.onlyExt_other": "Only .{ext} ({count} files)",
      "filter.moreExts": "{n} more",
      "filter.moreExts_one": "{n} more",
      "filter.moreExts_other": "{n} more",
      "filter.only_one": "Only {type} ({count} file)",
      "filter.only_other": "Only {type} ({count} files)",
      "filter.missingTitle": "Only files that no longer exist on disk",
      "filter.clearTitle": "Clear type / deleted filters (keeps the search text)",
      "filter.clearAria": "Clear filters",
      "filter.clear": "Clear filters",
      "expand.collapseTitle": "Collapse all session cards",
      "expand.expandTitle": "Expand all session cards",
      "expand.collapse": "Collapse all",
      "expand.expand": "Expand all",
      "toast.close": "Click to dismiss"
    };

    var artwork = {};
    try {
      artwork = require("@deepseek-ai/dsh-client-ui-primitives") || {};
    } catch (error) {
      artwork = {};
    }
    var tabIcon = artwork.GuideArtworkFiles || artwork.PluginArtworkDefault || null;

    /** App icons reuse the shell's own probe so the menu matches the workspace menus. */
    /** Shell icon ids differ from our own: the host serves "intellij" and "gitbash". */
    var APP_ICON = { explorer: "explorer", vscode: "vscode", idea: "intellij", "git-bash": "gitbash", finder: "finder" };

    /**
     * Client diagnostics.
     *
     * Everything is opt-in through the host's `debug: true`, because a normal session should not
     * pay a POST per lifecycle step. The flag arrives asynchronously (see enableDiagnostics in
     * 130-apply), so reports are queued while it is still unknown and flushed once it resolves:
     * the most interesting ones — bundle evaluation, apply, tab registration — happen before the
     * answer arrives, and dropping them made the log look empty even with debug on.
     */
    var REPORT_QUEUE = [];
    var REPORT_QUEUE_MAX = 200;

    function reportFlush() {
      var queued = REPORT_QUEUE.splice(0, REPORT_QUEUE.length);
      for (var i = 0; i < queued.length; i += 1) reportSend(queued[i][0], queued[i][1]);
    }

    function reportSend(step, detail) {
      try {
        var body = JSON.stringify({ step: step, detail: String(detail === undefined ? "" : detail), href: String(location.href).slice(0, 200) });
        if (typeof fetch === "function") fetch(BASE + "/api/_clienterror", { method: "POST", body: body, keepalive: true }).catch(function () {});
      } catch (error) {
        /* diagnostics must never throw */
      }
    }

    /** Called once the host answers /api/config: true enables, false discards the queue. */
    function reportEnable(enabled) {
      if (enabled === true) {
        if (typeof window !== "undefined") window.__DOC_LEDGER_DEBUG__ = true;
        reportFlush();
        return;
      }
      REPORT_QUEUE.length = 0;
    }

    function report(step, detail) {
      if (typeof window === "undefined") return;
      if (window.__DOC_LEDGER_DEBUG__ === true) { reportSend(step, detail); return; }
      if (window.__DOC_LEDGER_DEBUG__ === false) return;
      // Undecided: buffer until the flag resolves.
      if (REPORT_QUEUE.length < REPORT_QUEUE_MAX) REPORT_QUEUE.push([step, detail]);
    }

    function decodeJson(response) {
      return response.json().catch(function () { return null; }).then(function (payload) {
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error((payload && payload.error) || "HTTP " + response.status);
        }
        return payload.data;
      });
    }

    /**
     * `cache` defaults to "no-store" because the list is polled and must never be
     * served stale; the preview passes "no-cache" so the browser revalidates with the
     * host's ETag and an unchanged file costs a 304 instead of a full body.
     */
    function getJson(path, init) {
      var options = { headers: { accept: "application/json" }, cache: "no-store" };
      if (init !== null && typeof init === "object") {
        for (var key in init) {
          if (Object.prototype.hasOwnProperty.call(init, key)) options[key] = init[key];
        }
      }
      return fetch(BASE + path, options).then(decodeJson);
    }

    /**
     * Launching is a POST: the host refuses a GET there so a cross-site <img> cannot run a
     * program on the user's machine.
     */
    function postJson(path) {
      return fetch(BASE + path, { method: "POST", headers: { accept: "application/json" }, cache: "no-store" }).then(decodeJson);
    }

    /**
     * The active session id. Slot bodies receive it directly as the standard
     * "sessionId" prop; the snapshot selector is only a fallback.
     */
    function readSessionId(props) {
      try {
        var direct = props && (props.sessionId || (props.session && props.session.id));
        if (typeof direct === "string" && direct !== "") return direct;
        var useSession = props && props.useSession;
        if (typeof useSession !== "function") return null;
        var picked = useSession(function (state) {
          if (state === null || state === undefined) return null;
          if (typeof state === "string") return state;
          return state.sessionId || state.id || (state.session && state.session.id) || null;
        });
        if (typeof picked === "string" && picked !== "") return picked;
      } catch (error) {
        report("session-hook", (error && error.stack) || error);
      }
      return null;
    }

    var CATEGORY_COLOR = {
      doc: "#3b6fe0",
      sheet: "#12805c",
      slide: "#c2640a",
      image: "#8b5cf6",
      code: "#0e7490",
      web: "#dc2626",
      config: "#64748b",
      data: "#0891b2",
      media: "#c026d3",
      archive: "#92400e",
      binary: "#525252",
      other: "#94a3b8"
    };

    // Keys, not literals: this table is built at factory-evaluation time, before the
    // host translator is installed. categoryLabel() resolves through t() at render time.
    var CATEGORY_LABEL = {
      doc: "category.doc",
      sheet: "category.sheet",
      slide: "category.slide",
      image: "category.image",
      code: "category.code",
      web: "category.web",
      config: "category.config",
      data: "category.data",
      media: "category.media",
      archive: "category.archive",
      binary: "category.binary",
      other: "category.other"
    };

    function categoryColor(category) {
      return CATEGORY_COLOR[category] || CATEGORY_COLOR.other;
    }

    function categoryLabel(category) {
      var key = CATEGORY_LABEL[category] || "category.other";
      return t(key);
    }

    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }

    /**
     * Recent stamps stay short; anything from another year keeps its year.
     *
     * The current year is read per call, not captured at module evaluation. A panel left open
     * across New Year (or a long-lived window) kept the old year: every January stamp lost its
     * year and every December one gained a year it did not need.
     */
    function fmtTime(ms) {
      if (!ms || !isFinite(ms)) return "--";
      var date = new Date(ms);
      if (isNaN(date.getTime())) return "--";
      var stamp = pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
      return date.getFullYear() === new Date().getFullYear() ? stamp : date.getFullYear() + "-" + stamp;
    }

    /** "76.8 KB" / "1.2 MB" for the preview header; bare bytes below 1 KB. */
    function fmtBytes(bytes) {
      if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) {
        var kb = bytes / 1024;
        return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + " KB";
      }
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    /** Short label for how the preview bytes were decoded; null when it is plain UTF-8. */
    function encodingLabel(encoding) {
      if (encoding === "utf-8+gb18030") return t("encoding.gb18030Mixed");
      if (encoding === "utf-16le") return "UTF-16LE";
      if (encoding === "utf-16be") return "UTF-16BE";
      return null;
    }

    /**
     * DSH's workspace/navigation service, captured in apply() when the build has one.
     * `openSession(sessionId)` is exactly "select that session and show its conversation",
     * which is what jumping from a ledger card uses; without it the menu simply omits the
     * entry instead of failing.
     */
    var workspaceNav = null;

    /** Whether this build can switch the conversation from a ledger card. */
    function canJumpToSession() {
      return workspaceNav !== null && typeof workspaceNav.openSession === "function";
    }

    /**
     * Switch the GUI to a session.
     * @returns true when the navigation was handed off.
     */
    function jumpToSession(sessionId) {
      if (!canJumpToSession()) return false;
      if (typeof sessionId !== "string" || sessionId === "") return false;
      try {
        workspaceNav.openSession(sessionId);
        return true;
      } catch (error) {
        report("session-jump-error", (error && error.message) || error);
        return false;
      }
    }

    /**
     * DSH's own right-sidebar service, captured in apply(). `openResource` opens the
     * host's document-preview tab by resource address, and that tab already renders
     * text / markdown / html / image / pdf / office / excel / code — which is why this
     * plugin ships no image or markdown rendering of its own.
     */
    var hostSidebar = null;

    /**
     * `dsh-resource://file/session/<id>/<path>`, spelled exactly like DSH's own
     * address grammar: backslashes normalize to `/`, every segment is
     * component-encoded, and `:` stays literal so a Windows drive letter survives.
     */
    function hostFileAddress(sessionId, path) {
      var encodeSegment = function (segment) {
        return encodeURIComponent(segment).replace(/%3A/gi, ":");
      };
      var normalized = String(path).replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
      return "dsh-resource://file/session/" + encodeSegment(String(sessionId)) + "/" +
        normalized.split("/").map(encodeSegment).join("/");
    }

    /** Whether this DSH build can open a file in its own document preview. */
    function hostPreviewReady() {
      return hostSidebar !== null && typeof hostSidebar.openResource === "function";
    }

    /**
     * Open a file in the host's document preview.
     * @param file - the ledger row (its `path` is the payload).
     * @param sessionId - the session whose sidebar is on screen: the address is scoped
     *   to it so the tab lands where the reader is looking, even for a row that came
     *   from another session in the "all sessions" view. Absolute paths resolve the
     *   same way against any session's root.
     * @returns true when the host took it; false leaves the caller on the in-panel modal.
     */
    function hostPreviewOpen(file, sessionId) {
      if (file === null || file === undefined || file.path === undefined) return false;
      if (!hostPreviewReady()) return false;
      try {
        hostSidebar.openResource(hostFileAddress(sessionId || file.sessionId, file.path));
        return true;
      } catch (error) {
        report("host-preview-error", (error && error.message) || error);
        return false;
      }
    }

    /**
     * Wrap every search-term match so a multi-word query explains itself. Ranges are
     * merged before rendering, so overlapping terms (`ord` + `order`) mark one span
     * instead of nesting a <mark> inside another.
     */
    function highlight(text, query) {
      var value = String(text === null || text === undefined ? "" : text);
      var terms = termsOf(query);
      if (terms.length === 0) return value;
      var lower = value.toLowerCase();
      var ranges = [];
      for (var t = 0; t < terms.length; t += 1) {
        var term = terms[t];
        var at = lower.indexOf(term);
        while (at !== -1) {
          ranges.push([at, at + term.length]);
          at = lower.indexOf(term, at + term.length);
        }
      }
      if (ranges.length === 0) return value;
      ranges.sort(function (left, right) { return left[0] - right[0]; });
      var merged = [];
      for (var r = 0; r < ranges.length; r += 1) {
        var last = merged[merged.length - 1];
        if (last !== undefined && ranges[r][0] <= last[1]) {
          last[1] = Math.max(last[1], ranges[r][1]);
        } else {
          merged.push(ranges[r]);
        }
      }
      var parts = [];
      var cursor = 0;
      for (var m = 0; m < merged.length; m += 1) {
        if (merged[m][0] > cursor) parts.push(value.slice(cursor, merged[m][0]));
        parts.push(react.createElement("mark", { key: "h" + parts.length, style: S.mark }, value.slice(merged[m][0], merged[m][1])));
        cursor = merged[m][1];
      }
      if (cursor < value.length) parts.push(value.slice(cursor));
      return parts;
    }

    function shortPath(dir, max) {
      if (!dir) return "";
      if (dir.length <= max) return dir;
      return "…" + dir.slice(dir.length - max + 1);
    }

    /**
     * Style system: one shared shape `S`, generated per theme.
     *
     * The panel used to hand-write one `var S = { ... }`; every component reads `S.xxx`,
     * so the lookup surface (58 keys, ~330 references) stays unchanged and the whole
     * visual language swaps when the theme changes. `setStyleTheme(id)` rebuilds `S` and
     * notifies subscribers; components read `S` through the `useStyles()` hook so a theme
     * switch re-renders without reloading the panel.
     *
     * Themes:
     *   - "compact"  the original look (kept as the safe default and the fallback)
     *   - "airy"     more whitespace, fewer hairlines, weight instead of borders (Notion/Linear)
     *   - "table"    grid rows, zebra stripes, tabular numbers (data-dense, VS Code-ish)
     *   - "card"     floating cards with soft shadows and accent bars (Apple/Things-ish)
     *
     * All colors prefer the host's theme tokens (`--dsw-alias-*`) and fall back to neutral
     * grey, so every theme still reads in light and dark mode.
     */

    /**
     * Colours, self-contained.
     *
     * The host token route was measured and rejected: in this build the DSH theme declares
     * `--dsw-alias-brand-primary: #0f1115` (ink, not an accent) and `--dsw-alias-bg-layer-1`
     * and `-layer-2` are **both #fff**. Every distinction this panel draws — an accent rail, a
     * tinted backdrop behind white cards, a warn tint — collapsed into one flat white with a
     * black rail. The tokens are also only defined for the shell's own subtree, so half of them
     * resolved and half fell back to literals.
     *
     * So the palette is defined here instead: one light and one dark set, chosen by
     * prefers-color-scheme. That is a real trade — the panel no longer follows a custom host
     * theme — but it is honest, and it is the only way four looks can actually differ.
     */
    /**
     * The colour scheme, read from the host's own signal.
     *
     * `prefers-color-scheme` is the OS setting, and the panel used it — so choosing Dark inside
     * DSH (with a light OS) kept the panel white forever. Measured on a live window, DSH marks
     * the scheme with BOTH of these:
     *
     *   <html data-ds-theme-source="dark">
     *   <body data-ds-dark-theme>
     *
     * Either one is authoritative; the attribute is present only in dark mode, which makes
     * "attribute present" the whole test. The media query stays as the last resort for the
     * harness and the static report, which have no host.
     */
    function readDarkScheme() {
      try {
        if (typeof document !== "undefined") {
          var html = document.documentElement;
          var body = document.body;
          if (html !== null && html.getAttribute("data-ds-theme-source") === "dark") return true;
          if (html !== null && html.getAttribute("data-ds-theme-source") === "light") return false;
          if (body !== null && body.hasAttribute("data-ds-dark-theme")) return true;
          // `color-scheme` follows the host's own computed value in both schemes.
          if (html !== null) {
            var scheme = getComputedStyle(html).colorScheme;
            if (scheme === "dark") return true;
            if (scheme === "light") return false;
          }
        }
        if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
          return window.matchMedia("(prefers-color-scheme: dark)").matches === true;
        }
      } catch (error) {
        /* an unreadable document only costs the dark palette */
      }
      return false;
    }

    /**
     * The host's real colours, taken from the custom properties DSH defines on <body>.
     *
     * These are the values the rest of the UI uses, including a user's own theme, so reading
     * them is what "follow the DSH theme" actually means. Each one keeps a literal fallback for
     * the harness, where no host defines them — and those fallbacks are the only reason the
     * light/dark tables below still exist.
     */
    var HOST = {
      text: "var(--dsw-alias-label-primary, #1c1f23)",
      textDim: "var(--dsw-alias-label-secondary, #5c626b)",
      textFaint: "var(--dsw-alias-label-secondary, #8a919b)",
      bg: "var(--dsw-alias-bg-layer-1, #ffffff)",
      bgSoft: "var(--dsw-alias-bg-layer-2, #f4f5f7)",
      bgBase: "var(--dsw-alias-bg-base, #ffffff)",
      bgOverlay: "var(--dsw-alias-bg-overlay, #ffffff)",
      border: "var(--dsw-alias-border-l1, #dfe3e8)",
      borderStrong: "var(--dsw-alias-border-l2, #c7ccd4)",
      accent: "var(--dsw-alias-brand-primary, #3b6fe0)",
      danger: "var(--dsw-alias-state-error-primary, #c0392b)",
      success: "var(--dsw-alias-state-success-primary, #12805c)",
      warn: "var(--dsw-alias-state-warn-primary, #a86512)"
    };

    /** Re-read on every rebuild: the host flips a DOM attribute, not a media query. */
    var prefersDark = readDarkScheme();

    function schemeIsDark() {
      prefersDark = readDarkScheme();
      return prefersDark;
    }

    /**
     * Fallback literals, used only where no host token exists. `DARK` exists so the harness and
     * the static report can be previewed in a dark scheme; the host path never needs it.
     */
    var LIGHT = {
      text: "#1c1f23", textDim: "#5c626b", textFaint: "#8a919b",
      bg: "#ffffff", bgSoft: "#f4f5f7", bgBase: "#ffffff", bgOverlay: "#ffffff",
      border: "#dfe3e8", borderStrong: "#c7ccd4",
      accent: "#3b6fe0", danger: "#c0392b", success: "#12805c", warn: "#a86512"
    };

    var DARK = {
      text: "#e6e8ec", textDim: "#a3a9b3", textFaint: "#767d88",
      bg: "#1e2126", bgSoft: "#171a1e", bgBase: "#131518", bgOverlay: "#262a30",
      border: "#343941", borderStrong: "#444b55",
      accent: "#6b93ff", danger: "#ff6b6b", success: "#4ec9a0", warn: "#e0a030"
    };

    /** Theme tokens first (which is what follows DSH); literals are only a fallback. */
    var TOKEN = HOST;

    /**
     * The rail and the selected state.
     *
     * Deliberately NOT the host accent: DSH's default theme declares
     * `--dsw-alias-brand-primary: #0f1115` (ink), so a rail drawn from it is a black bar on a
     * white card — which is what the first attempt produced. A fixed brand blue is legible on
     * both surfaces; a host theme with a real accent still drives everything else.
     */
    function accentFor(dark) {
      return dark ? "#6b93ff" : "#3b6fe0";
    }

    var ACCENT = accentFor(prefersDark);

    /**
     * The palette: follow the host where it is trustworthy, derive where it is not.
     *
     * Measured in the live window (light scheme), DSH declares
     *   --dsw-alias-brand-primary: #0f1115   (ink, not an accent)
     *   --dsw-alias-bg-layer-1:    #fff
     *   --dsw-alias-bg-layer-2:    #fff      (identical to layer-1)
     * so a "faithful" palette gives white cards on a white backdrop with a black rail: the card
     * theme becomes invisible, which is exactly what the screenshot showed.
     *
     * The split that works:
     *   - text, borders, danger/success/warn  -> host tokens (a custom theme's typography and
     *     state colours are worth honouring, and they read correctly in both schemes);
     *   - the backdrop and the accent -> derived locally, because the host gives no usable
     *     second surface level and no usable accent.
     *
     * The backdrop is a tint of the surface actually behind the panel: light mode darkens it a
     * little, dark mode lightens it, so white (or near-black) cards always have separation.
     */
    function palette() {
      var dark = schemeIsDark();
      // A backdrop derived from the surface: one step away from it, in the direction that
      // creates contrast for the cards drawn on top.
      var backdrop = dark
        ? "color-mix(in oklab, " + TOKEN.bg + " 72%, #000)"
        : "color-mix(in oklab, " + TOKEN.bg + " 94%, #000)";
      // The host's accent is ink in the default theme, so it cannot carry an accent rail.
      // A fixed brand blue stays legible on white and on near-black, and the fallback chain
      // still lets a theme with a real accent win.
      var accent = ACCENT;
      return {
        text: TOKEN.text,
        textDim: TOKEN.textDim,
        textFaint: TOKEN.textFaint,
        bg: TOKEN.bg,
        // The second surface level: derived, since the host's own is identical to the first.
        bgSoft: backdrop,
        bgBase: TOKEN.bgBase,
        bgOverlay: TOKEN.bgOverlay,
        border: TOKEN.border,
        borderStrong: TOKEN.borderStrong,
        borderSoft: "color-mix(in oklab, " + TOKEN.border + " 55%, transparent)",
        accent: accent,
        accentSoft: "color-mix(in oklab, " + accent + " 14%, transparent)",
        accentBorder: "color-mix(in oklab, " + accent + " 72%, transparent)",
        danger: TOKEN.danger,
        dangerSoft: "color-mix(in oklab, " + TOKEN.danger + " 16%, transparent)",
        success: TOKEN.success,
        warn: TOKEN.warn,
        warnSoft: "color-mix(in oklab, " + TOKEN.warn + " 14%, transparent)",
        mark: "color-mix(in oklab, #facc15 45%, transparent)",
        radius: { sm: "4px", md: "6px", lg: "8px", xl: "10px", xxl: "14px" },
        rowHover: "color-mix(in oklab, " + accent + " 8%, transparent)",
        hairline: "color-mix(in oklab, " + TOKEN.border + " 40%, transparent)",
        warnBorder: "color-mix(in oklab, " + TOKEN.warn + " 30%, transparent)",
        scrim: "rgba(0,0,0,0.55)",
        shadowMenu: dark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.14)",
        shadowToast: "0 4px 14px rgba(0,0,0,0.22)",
        // Deeper in dark mode: a 6% black shadow on a near-black backdrop reads as nothing.
        shadowCard: dark
          ? "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.28)"
          : "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
        onAccent: "#ffffff"
      };
    }

    /**
     * Four presets, each built from one reference system rather than from taste.
     *
     * The references were read, not remembered:
     *  - shadcn/ui `globals.css`: one `--radius` expanded into a five-step scale, and every
     *    translucent value mixed in `oklab` (perceptually even, so a 6% wash looks like 6%
     *    on both a white and a near-black surface). Both are adopted below.
     *  - VS Code `explorerviewlet.css`: dense rows are a fixed 22px with `line-height` equal
     *    to the row height, `flex-wrap: nowrap`, `min-width: 0` and ellipsis on the label.
     *    That is the whole trick behind a list that stays legible at 380px wide.
     *
     * Each theme therefore has a different *structure*, not a different tint:
     *   compact   VS Code density — 22px rows, hairlines, no decoration
     *   airy      generous rhythm — no hairlines, bigger type, weight carries the hierarchy
     *   table     a real grid — monospace, zebra stripes, right-aligned tabular numbers
     *   card      floating surfaces — accent rail, shadow, satisfying gutters
     */

    /** VS Code's row metric, in one place: every dense theme uses it. */
    var ROW_H = 22;

    /**
     * "compact": the densest of the four. Modelled on VS Code's explorer — fixed 22px rows,
     * hairline separators, no radius except where a control needs one, and the label doing all
     * the work through weight instead of colour.
     */
    function compactStyles() {
      var c = palette();
      return {
        root: { display: "flex", flexDirection: "column", height: "100%", minHeight: "320px", fontSize: "12px", color: c.text, background: c.bg, overflow: "hidden", position: "relative" },
        bar: { display: "flex", flexDirection: "column", gap: "4px", padding: "6px 8px", borderBottom: "1px solid " + c.borderSoft },
        barRow: { display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", minWidth: 0 },
        buttonBase: { minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        title: { fontWeight: 600, fontSize: "12px", marginRight: "2px" },
        input: { flex: "1 1 120px", minWidth: "80px", height: "22px", padding: "0 7px", borderRadius: c.radius.sm, border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px" },
        button: { height: "22px", padding: "0 8px", borderRadius: c.radius.sm, border: "1px solid transparent", background: "transparent", color: c.textDim, fontSize: "12px", cursor: "pointer", minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        buttonOn: { height: "22px", padding: "0 8px", borderRadius: c.radius.sm, border: "1px solid transparent", background: c.accentSoft, color: c.accent, fontWeight: 600, fontSize: "12px", cursor: "pointer", minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        summary: { padding: "4px 8px", color: c.textDim, fontSize: "11px", borderBottom: "1px solid " + c.borderSoft },
        notice: { padding: "4px 8px", fontSize: "11px", color: c.warn, background: c.warnSoft, cursor: "pointer" },
        list: { flex: 1, overflowY: "auto", padding: "2px 4px 12px" },
        card: { border: "1px solid " + c.borderSoft, borderRadius: c.radius.sm, marginBottom: "6px", overflow: "hidden", background: c.bg },
        cardHead: { display: "flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 8px", cursor: "pointer", background: c.bgSoft },
        cardTitle: { fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        cardMeta: { color: c.textFaint, fontSize: "11px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
        sectionHead: { display: "flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 8px", color: c.textDim, fontSize: "11px", fontWeight: 600, userSelect: "none" },
        sectionTitle: { cursor: "pointer", flex: 1, background: "transparent", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        sortChip: { display: "inline-flex", alignItems: "center", gap: "3px", height: "18px", padding: "0 7px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: "transparent", cursor: "pointer", fontWeight: 400, whiteSpace: "nowrap", color: c.textDim, fontSize: "11px", font: "inherit", transition: "background 110ms ease, color 110ms ease", flex: "0 0 auto" },
        // A fixed row: height plus matching line-height is what keeps a dense list from
        // wobbling when one cell wraps (the VS Code trick).
        row: { display: "flex", alignItems: "center", gap: "6px", height: ROW_H + "px", lineHeight: ROW_H + "px", padding: "0 7px", cursor: "pointer", borderRadius: c.radius.sm, flexWrap: "nowrap", minWidth: 0 },
        rowAlt: { background: "transparent" },
        rowMissing: { opacity: 0.5 },
        mark: { background: c.mark, color: "inherit", borderRadius: "2px", padding: "0 1px" },
        tagMissing: { padding: "0 4px", borderRadius: "3px", background: c.dangerSoft, color: c.danger, whiteSpace: "nowrap", flex: "0 0 auto", fontSize: "10px", lineHeight: "14px" },
        filterBar: { display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderBottom: "1px solid " + c.borderSoft, flexWrap: "wrap" },
        filterLabel: { color: c.textFaint, fontSize: "11px", marginRight: "1px" },
        filterChip: { display: "inline-flex", alignItems: "center", gap: "4px", height: "18px", padding: "0 8px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: "transparent", color: c.textDim, fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 110ms ease, color 110ms ease" },
        filterChipOn: { display: "inline-flex", alignItems: "center", gap: "4px", height: "18px", padding: "0 8px", borderRadius: "999px", border: "1px solid " + c.accentBorder, background: c.accentSoft, color: c.accent, fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 110ms ease, color 110ms ease" },
        chipCount: { color: c.textFaint, fontSize: "10px", fontVariantNumeric: "tabular-nums" },
        chipCountOn: { color: c.accent, fontSize: "10px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
        filterDivider: { width: "1px", height: "12px", background: c.borderSoft, flex: "0 0 auto", margin: "0 1px" },
        filterAction: { display: "inline-flex", alignItems: "center", gap: "4px", height: "18px", padding: "0 6px", border: "none", borderRadius: c.radius.sm, background: "transparent", color: c.textFaint, fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 110ms ease, color 110ms ease" },
        filterActionGlyph: { fontSize: "10px", opacity: 0.7 },
        moreRow: { display: "flex", alignItems: "center", justifyContent: "center", height: ROW_H + "px", cursor: "pointer", color: c.accent, fontSize: "11px" },
        dot: { width: "7px", height: "7px", borderRadius: "2px", flex: "0 0 auto" },
        // Present in every theme (the parity check compares key sets); only "card" gives it a
        // visible value, the rest leave it null so the head renders no rail.
        cardRail: null,
        // Only the grid preset spans an expanded card; null means "place it normally".
        cardOpen: null,
        // Gutter parts (the timeline preset was removed; the row still guards on these, so
        // they stay as nulls rather than dragging the drawing code out of the row).
        rowDot: null,
        rowSpine: null,
        fileBadge: { display: "inline-block", flex: "0 0 auto", borderRadius: "3px", color: c.onAccent, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.02em", overflow: "hidden" },
        // Three tiers, and only three: name is the anchor, path is context, counters are metadata.
        name: { fontWeight: 500, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "46%", flex: "0 1 auto", minWidth: 0 },
        dir: { color: c.textFaint, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 0", minWidth: 0 },
        io: { color: c.textFaint, whiteSpace: "nowrap", flex: "0 0 auto", fontSize: "10px", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "32px" },
        times: { color: c.textFaint, whiteSpace: "nowrap", flex: "0 0 auto", fontVariantNumeric: "tabular-nums", fontSize: "10px", textAlign: "right", minWidth: "70px" },
        tag: { padding: "0 5px", borderRadius: "3px", background: c.accentSoft, color: c.accent, whiteSpace: "nowrap", maxWidth: "88px", overflow: "hidden", textOverflow: "ellipsis", flex: "0 0 auto", fontSize: "10px" },
        empty: { padding: "24px 12px", textAlign: "center", color: c.textFaint, fontSize: "12px" },
        // The "entered session" bar, shown by the grid preset above the single card it drilled
        // into. A right-hand drawer was tried first and rejected: it covers the board it is meant
        // to complement. Replacing the board needs no overlay, no empty gap and no covering.
        backBar: {
          display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto",
          height: "32px", padding: "0 10px", margin: "6px 10px 0",
          borderRadius: c.radius.lg, background: c.bg
        },
        backButton: {
          display: "inline-flex", alignItems: "center", gap: "4px",
          height: "22px", padding: "0 8px", border: "none", cursor: "pointer",
          borderRadius: c.radius.sm, background: "transparent", color: c.accent,
          fontSize: "12px", fontWeight: 600
        },
        backLabel: {
          flex: "1 1 auto", minWidth: 0, color: c.textFaint, fontSize: "11px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right"
        },
        modal: { position: "fixed", inset: 0, background: c.scrim, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "24px" },
        modalBox: { background: c.bg, color: "inherit", borderRadius: c.radius.lg, width: "min(900px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "visible", border: "1px solid " + c.border, boxShadow: c.shadowMenu },
        modalHead: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", minWidth: 0, flex: "0 0 auto", borderBottom: "1px solid " + c.borderSoft },
        pre: { margin: 0, padding: "10px 12px", overflow: "auto", fontSize: "12px", lineHeight: 1.55, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: "1 1 auto", minHeight: 0 },
        modalFoot: { padding: "5px 12px", borderTop: "1px solid " + c.borderSoft, fontSize: "11px", lineHeight: "16px", color: c.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalMeta: { padding: "4px 12px", fontSize: "11px", lineHeight: "16px", color: c.textDim, borderBottom: "1px solid " + c.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalWarn: { padding: "4px 12px", fontSize: "11px", lineHeight: "16px", color: c.warn, background: c.warnSoft, borderBottom: "1px solid " + c.warnBorder, flex: "0 0 auto" },
        menu: { position: "absolute", zIndex: 80, padding: "3px", borderRadius: c.radius.md, background: c.bg, border: "1px solid " + c.border, boxShadow: c.shadowMenu },
        menuItem: { display: "flex", alignItems: "center", gap: "8px", height: "26px", padding: "0 8px", borderRadius: c.radius.sm, cursor: "pointer", whiteSpace: "nowrap", fontSize: "12px" },
        menuLabel: { padding: "4px 8px 2px", color: c.textFaint, fontSize: "11px" },
        menuSep: { height: "1px", margin: "3px 2px", background: c.borderSoft },
        menuPath: { padding: "2px 8px 4px", color: c.textFaint, fontSize: "11px", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        appIcon: { position: "relative", width: "16px", height: "16px", flex: "0 0 auto", display: "inline-block" },
        headActions: { display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" },
        split: { position: "relative", display: "flex", alignItems: "stretch" },
        splitMain: { display: "flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: c.radius.sm + " 0 0 " + c.radius.sm, border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
        splitArrow: { height: "24px", padding: "0 5px", borderRadius: "0 " + c.radius.sm + " " + c.radius.sm + " 0", border: "1px solid " + c.border, borderLeft: "none", background: "transparent", color: "inherit", fontSize: "10px", cursor: "pointer" },
        dropdown: { position: "absolute", right: 0, top: "calc(100% + 4px)", width: "230px", maxHeight: "280px", overflowY: "auto", padding: "3px", borderRadius: c.radius.md, background: c.bg, border: "1px solid " + c.border, boxShadow: c.shadowMenu, zIndex: 85 },
        toast: { position: "absolute", left: "10px", right: "10px", bottom: "10px", padding: "7px 10px", borderRadius: c.radius.md, color: c.onAccent, fontSize: "12px", zIndex: 70, wordBreak: "break-word", boxShadow: c.shadowToast },
        toastOk: { background: c.success, color: c.onAccent },
        toastError: { background: c.danger, color: c.onAccent },
        focusRing: "color-mix(in oklab, " + TOKEN.accent + " 55%, transparent)",
        hoverWash: "color-mix(in oklab, " + TOKEN.textDim + " 12%, transparent)",
        ghostLabel: TOKEN.textDim,
        menuHover: c.rowHover,
        checkMark: TOKEN.accent
      };
    }

    /**
     * "airy": rhythm instead of rules. No hairlines anywhere a row needs one — the eye groups
     * rows by whitespace. Type grows a notch and the label gains weight, because with the
     * separators gone weight is the only thing left to hang hierarchy on.
     */
    /**
     * "grid": a two-column board.
     *
     * The only preset that changes the flow rather than the skin: cards tile side by side and
     * each one is a compact tile with its own header chip, so a wide panel shows twice as many
     * sessions before scrolling. Below ~420px the second column would be too narrow, so the
     * panel falls back to one column through the same inline style (see 100-sections).
     */
    function gridStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "12px", background: c.bgSoft }),
        bar: Object.assign({}, base.bar, { gap: "6px", padding: "10px 12px", borderBottom: "none", background: c.bg }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { height: "26px", padding: "0 10px", borderRadius: c.radius.lg, background: c.bgSoft, border: "1px solid transparent" }),
        button: Object.assign({}, base.button, { height: "26px", padding: "0 10px", borderRadius: c.radius.lg, background: c.bgSoft }),
        buttonOn: Object.assign({}, base.buttonOn, { height: "26px", padding: "0 10px", borderRadius: c.radius.lg }),
        summary: Object.assign({}, base.summary, { padding: "6px 12px", borderBottom: "none" }),
        notice: Object.assign({}, base.notice, { padding: "7px 12px", borderRadius: c.radius.lg, margin: "0 8px 6px" }),
        // The board: as many columns as the panel can honour, and never a tile too narrow to read.
        //
        // Floor is 230px, measured: a 520px sidebar minus 20px padding and a 10px gap leaves
        // 490px, which fits two 240px tiles. `auto-fit` (not auto-fill) collapses the empty tracks,
        // so a lone card — the merged view — stretches across the panel instead of sitting in one
        // 230px strip with the rest of the row blank.
        list: Object.assign({}, base.list, {
          padding: "10px 10px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          // `dense` lets a later short card backfill the hole left beside a tall, expanded card.
          // Without it the board leaves a column-sized gap exactly as tall as the expanded card
          // and pushes everything after it below that gap.
          gridAutoFlow: "row dense",
          gap: "10px", alignContent: "start"
        }),
        card: Object.assign({}, base.card, {
          border: "1px solid " + c.borderSoft, borderRadius: c.radius.lg,
          background: c.bg, marginBottom: "0", overflow: "hidden",
          boxShadow: c.shadowCard, alignSelf: "start"
        }),
        /**
         * An expanded card keeps its column; the board flows around it.
         *
         * Making it span the full row was tried first and was wrong: every card on the board is
         * the same width by design, so a click that blows one card up to 700px reads as the
         * layout breaking rather than as that card opening. `grid-auto-flow: row dense` on the
         * list is what removes the tall empty gap this used to leave — later cards backfill it.
         * `alignSelf: start` (already on `card`) keeps a short card from stretching to its row.
         */
        cardOpen: null,
        cardHead: Object.assign({}, base.cardHead, {
          height: "32px", padding: "0 10px", background: c.bgSoft,
          borderBottom: "1px solid " + c.borderSoft, gap: "6px"
        }),
        cardTitle: Object.assign({}, base.cardTitle, { fontSize: "12px", fontWeight: 600 }),
        cardMeta: Object.assign({}, base.cardMeta, { fontSize: "10px" }),
        sectionHead: Object.assign({}, base.sectionHead, {
          height: "24px", padding: "6px 10px 2px", fontSize: "10px", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em", color: c.textFaint
        }),
        /**
         * One line per file, laid out with flex — not a numbered grid.
         *
         * The grid version assigned each cell an explicit column (glyph 1, tag 2, name 3,
         * deleted 4, counters 5, time 6). That is only correct while every cell exists. The
         * merged view has no session tag, so column 2 was empty and the name — still forced into
         * column 3 — received the 1fr: measured 467px of a 679px row, with the counters and the
         * time squeezed into the remaining 136px. A flex row has no such failure mode: absent
         * cells simply do not occupy space, and `flex: 1` on the name takes exactly what is left.
         */
        row: Object.assign({}, base.row, {
          display: "flex", alignItems: "center", flexWrap: "nowrap",
          gap: "6px", height: "30px", minHeight: "0", lineHeight: "30px",
          padding: "0 10px", borderRadius: 0,
          borderTop: "1px solid color-mix(in oklab, " + c.borderSoft + " 55%, transparent)"
        }),
        // The name is the only flexible cell: it takes the leftover width and ellipsises.
        name: Object.assign({}, base.name, {
          flex: "1 1 auto", maxWidth: "none", minWidth: "40px",
          fontSize: "12px", fontWeight: 600
        }),
        // The path column is dropped in this theme; `display: none` also keeps it out of the flow.
        dir: Object.assign({}, base.dir, { display: "none" }),
        // Session badge: a fixed-width pill so long titles cannot crowd out the name.
        tag: Object.assign({}, base.tag, {
          flex: "0 0 auto", maxWidth: "96px", fontSize: "10px", padding: "0 5px"
        }),
        tagMissing: Object.assign({}, base.tagMissing, { flex: "0 0 auto" }),
        io: Object.assign({}, base.io, {
          flex: "0 0 auto", fontSize: "10px", minWidth: "auto", textAlign: "right"
        }),
        times: Object.assign({}, base.times, {
          flex: "0 0 auto", fontSize: "10px", minWidth: "auto", textAlign: "right"
        }),
        filterBar: Object.assign({}, base.filterBar, { gap: "6px", padding: "6px 12px", borderBottom: "none" }),
        filterChip: Object.assign({}, base.filterChip, { height: "20px", padding: "0 9px", background: c.bg, border: "1px solid " + c.borderSoft }),
        filterChipOn: Object.assign({}, base.filterChipOn, { height: "20px", padding: "0 9px" }),
        moreRow: Object.assign({}, base.moreRow, { height: "28px", fontSize: "11px" }),
        empty: Object.assign({}, base.empty, { padding: "40px 16px", gridColumn: "1 / -1" })
      });
    }

    /**
     * "card": surfaces that float.
     *
     * A tinted backdrop with white cards on it and a 3px accent rail down each card's left edge.
     * The rail lives on the card's own border box, not inside the head: two earlier attempts
     * failed for the same geometric reason — the card clips at a 14px radius, and a 3px strip
     * drawn inside that corner is removed almost entirely (a border was clipped to a sliver, an
     * inset shadow was clipped the same way, and a 3px absolute strip inside the head was
     * clipped too). A left border on the card paints in the unclipped border box, so the radius
     * is applied to the right side only and the left edge stays square — the shape a rail needs.
     */
    function cardStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "13px", background: c.bgSoft }),
        bar: Object.assign({}, base.bar, { gap: "6px", padding: "10px 12px", borderBottom: "none", background: c.bg }),
        barRow: Object.assign({}, base.barRow, { gap: "6px" }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { height: "26px", padding: "0 10px", borderRadius: c.radius.xl, background: c.bgSoft, border: "1px solid transparent" }),
        button: Object.assign({}, base.button, { height: "26px", padding: "0 10px", borderRadius: c.radius.xl, background: c.bgSoft }),
        buttonOn: Object.assign({}, base.buttonOn, { height: "26px", padding: "0 10px", borderRadius: c.radius.xl }),
        summary: Object.assign({}, base.summary, { padding: "6px 12px", borderBottom: "none" }),
        notice: Object.assign({}, base.notice, { padding: "7px 12px", borderRadius: c.radius.lg, margin: "0 8px 6px" }),
        list: Object.assign({}, base.list, { padding: "10px 10px 20px" }),
        // All four corners are set individually and the inherited shorthand is dropped, because
        // React warns (and skips the update) when a rerender mixes `borderRadius` with
        // `borderTopRightRadius` and friends: the shorthand would win the cascade inconsistently
        // and the card could keep the previous theme's radius after a switch.
        card: (function () {
          var style = Object.assign({}, base.card, {
            border: "none", borderLeft: "3px solid " + c.accent,
            marginBottom: "12px", boxShadow: c.shadowCard, background: c.bg, overflow: "hidden"
          });
          delete style.borderRadius;
          style.borderTopLeftRadius = "0";
          style.borderBottomLeftRadius = "0";
          style.borderTopRightRadius = c.radius.xxl;
          style.borderBottomRightRadius = c.radius.xxl;
          return style;
        })(),
        cardHead: Object.assign({}, base.cardHead, { height: "36px", padding: "0 12px", background: "transparent" }),
        cardTitle: Object.assign({}, base.cardTitle, { fontSize: "13px" }),
        sectionHead: Object.assign({}, base.sectionHead, { height: "30px", padding: "0 12px" }),
        row: Object.assign({}, base.row, { height: "28px", lineHeight: "28px", padding: "0 12px 0 21px", borderRadius: 0 }),
        filterBar: Object.assign({}, base.filterBar, { gap: "6px", padding: "6px 12px", borderBottom: "none" }),
        filterChip: Object.assign({}, base.filterChip, { height: "22px", padding: "0 10px", background: c.bg }),
        filterChipOn: Object.assign({}, base.filterChipOn, { height: "22px", padding: "0 10px" }),
        name: Object.assign({}, base.name, { fontWeight: 600 }),
        moreRow: Object.assign({}, base.moreRow, { height: "30px" }),
        empty: Object.assign({}, base.empty, { padding: "40px 16px" })
      });
    }

    var STYLE_THEMES = {
      compact: compactStyles,
      grid: gridStyles,
      card: cardStyles
    };

    /** Order shown in the picker; the first entry is the fallback and the default. */
    var THEME_ORDER = ["card", "compact", "grid"];

    var currentTheme = "card";
    var S = cardStyles();
    var styleListeners = new Set();

    function styleTheme() {
      return currentTheme;
    }

    /**
     * Rebuild the active table in place after the host switched light/dark.
     *
     * The theme id did not change — only the scheme did — so `setStyleTheme` would early-return.
     * The palette itself is live CSS (`var(--dsw-alias-…)`) so colours already follow; what this
     * refreshes is everything derived from `readDarkScheme()` (there is nothing scheme-specific
     * left in the tables, but rebuilding is what tells subscribers to repaint).
     */
    function refreshStyles() {
      if (S === null) return;
      prefersDark = readDarkScheme();
      ACCENT = accentFor(prefersDark);
      S = STYLE_THEMES[currentTheme]();
      styleListeners.forEach(function (fn) {
        try { fn(S); } catch (error) { /* a subscriber must not break a theme switch */ }
      });
    }

    function setStyleTheme(id) {
      var next = Object.prototype.hasOwnProperty.call(STYLE_THEMES, id) ? id : "card";
      if (next === currentTheme && S !== null) return;
      currentTheme = next;
      S = STYLE_THEMES[next]();
      // Handlers write hover/focus to element.style, which React never reconciles: without
      // this, a control the pointer had touched keeps the previous theme's fill.
      if (typeof clearHoverArtifacts === "function") clearHoverArtifacts();
      styleListeners.forEach(function (fn) {
        try { fn(S); } catch (error) { /* a subscriber must not break a theme switch */ }
      });
    }

    function useStyles() {
      var state = react.useState(S);
      var set = state[1];
      react.useEffect(function () {
        var onStyle = function (styles) { set(styles); };
        styleListeners.add(onStyle);
        return function () { styleListeners.delete(onStyle); };
      }, []);
      return S;
    }
    /** One sort axis: key plus direction. */
    function defaultDir(key) {
      return key === "type" || key === "path" || key === "exists" ? "asc" : "desc";
    }

    /**
     * The three section-level decisions, isolated so they can be tested without React.
     *
     * `rowsOf` used to inline all three inside a hook-heavy component, which put the roving
     * index arithmetic — the part that actually broke twice — out of reach of any test.
     */

    /** Section prefixes used by SessionCard: used / created / created-split / modified-split. */
    var SECTION_PREFIXES = ["u", "c", "cs", "ms"];

    /**
     * Which sort spec drives a section. The split views (`cs` / `ms`) share the created
     * sort because they are the two halves of the same "Created / Modified" column.
     */
    function sortSpecOf(prefix, usedSort, createdSort, modifiedSort) {
      if (prefix === "u") return usedSort;
      if (prefix === "ms") return modifiedSort;
      return createdSort;
    }

    /** Which timestamp a section's rows show (see rowTime). */
    function rowModeOf(prefix) {
      if (prefix === "u") return "used";
      if (prefix === "ms") return "modified";
      return "created";
    }

    /**
     * Whether a section's rows take part in the card's roving tab order.
     *
     * Both conditions matter and both have caused bugs: a collapsed section builds no DOM,
     * and the merged view computes the split arrays without rendering them. Counting either
     * kind would offset every index past the last focusable row.
     */
    function rowsReachable(open, rendered) {
      return open !== false && rendered !== false;
    }

    /** Rows a section shows: its own page limit, or the default. */
    function rowLimitOf(prefix, limits, defaultLimit) {
      var value = limits === null || limits === undefined ? 0 : Number(limits[prefix]);
      return value > 0 ? value : defaultLimit;
    }

    /**
     * The next active index for ArrowUp/ArrowDown inside one card.
     * Clamped, not wrapped: stepping past the end should stay put rather than jump to the
     * other end, which is what a list of rows means.
     */
    function clampRowIndex(from, delta, total) {
      if (total <= 0) return 0;
      return Math.min(total - 1, Math.max(0, from + delta));
    }

    /**
     * Extensions inside one family, counted from the live data.
     *
     * This is the second filter level, and it is deliberately derived rather than declared: a
     * language table would be biased toward whatever the current project uses (one real ledger
     * was 44% `.java`, so a fixed "Code" chip filtered nothing), while a derived census is
     * correct for every project and needs no maintenance when a new extension appears.
     *
     * @param files  the files to census
     * @param family the family to restrict to, or null for every family
     * @returns `[{ ext, count }]`, most frequent first; `ext` is "" for extension-less files
     */
    function extensionCensus(files, family) {
      var counts = {};
      (files || []).forEach(function (file) {
        if (family !== null && family !== undefined && String(file.category || "other") !== family) return;
        var ext = extOf(file.name || file.path || "");
        counts[ext] = (counts[ext] || 0) + 1;
      });
      return Object.keys(counts).map(function (ext) {
        return { ext: ext, count: counts[ext] };
      }).sort(function (left, right) {
        // Most frequent first; ties alphabetical so the order is stable between renders.
        return right.count - left.count || left.ext.localeCompare(right.ext);
      });
    }

    /**
     * How many extension chips to show before folding the rest into a counter.
     * Kept small because this is a second row under an already busy first one.
     */
    var EXT_CHIP_MAX = 8;

    /** Split a census into the chips to show and the remainder's totals. */
    function extensionChips(census, max) {
      var limit = max > 0 ? max : EXT_CHIP_MAX;
      var list = census || [];
      if (list.length <= limit + 1) return { shown: list, hidden: 0, hiddenFiles: 0 };
      var shown = list.slice(0, limit);
      var rest = list.slice(limit);
      return {
        shown: shown,
        hidden: rest.length,
        hiddenFiles: rest.reduce(function (total, entry) { return total + entry.count; }, 0)
      };
    }

    /**
     * A row that counts as "activity": the engine records a file the moment it sees a read
     * or a write, but a file can also arrive with only a timestamp and no counters. A card
     * with none of these must not claim a slot in the merged view.
     */
    function isActiveRow(file) {
      if (file === null || file === undefined) return false;
      return (file.reads || 0) > 0 || Boolean(file.firstUsedAt) || Boolean(file.createdAt) || (file.writes || 0) > 0;
    }

    /** Whether any file of a session survives the active filters and counts as activity. */
    function hasActiveRow(files, passes) {
      var list = files || [];
      for (var i = 0; i < list.length; i += 1) {
        if (typeof passes === "function" && !passes(list[i])) continue;
        if (isActiveRow(list[i])) return true;
      }
      return false;
    }

    /**
     * The page size after "show more": one more page, seeded from the default when the
     * section has never been widened. Kept pure so the arithmetic is not buried in a setState.
     */
    function nextRowLimit(current, page) {
      var step = page > 0 ? page : 100;
      var base = Number(current) > 0 ? Number(current) : step;
      return base + step;
    }

    function sortFiles(files, spec) {
      var key = spec.key;
      var dir = spec.dir === "asc" ? 1 : -1;
      var list = files.slice();
      list.sort(function (left, right) {
        var a;
        var b;
        if (key === "type") { a = String(left.category); b = String(right.category); }
        else if (key === "path") { a = String(left.rel || left.path); b = String(right.rel || right.path); }
        else if (key === "exists") { a = left.exists === false ? 1 : 0; b = right.exists === false ? 1 : 0; }
        else if (key === "reads") { a = left.reads || 0; b = right.reads || 0; }
        else if (key === "writes") { a = left.writes || 0; b = right.writes || 0; }
        else if (key === "createdAt") { a = left.createdAt || 0; b = right.createdAt || 0; }
        else if (key === "updatedAt") { a = left.updatedAt || 0; b = right.updatedAt || 0; }
        else if (key === "firstUsed") { a = left.firstUsedAt || 0; b = right.firstUsedAt || 0; }
        else { a = left.lastUsedAt || 0; b = right.lastUsedAt || 0; }
        if (a === b) return String(left.name).localeCompare(String(right.name));
        if (typeof a === "string") return a.localeCompare(b) * (dir < 0 ? -1 : 1);
        return (a < b ? -1 : 1) * (dir < 0 ? -1 : 1);
      });
      return list;
    }

    /** Lowercased search terms; a space separates independent terms (all of them must match). */
    function termsOf(query) {
      var text = String(query === null || query === undefined ? "" : query).trim().toLowerCase();
      if (text === "") return [];
      return text.split(/\s+/).filter(function (term) { return term !== ""; });
    }

    function matches(file, query) {
      var terms = termsOf(query);
      if (terms.length === 0) return true;
      // `sessionId` is part of the haystack because it is the one identifier a reader can copy
      // from the session menu or from a log, and searching it previously matched nothing.
      var haystack = (
        String(file.name) + " " + String(file.rel) + " " + String(file.path) + " " +
        String(file.category) + " " + String(file.sessionTitle || "") + " " +
        String(file.sessionId || "") + " " +
        // A pasted id may carry the `session-` prefix or not, so both spellings match.
        String(file.sessionId || "").replace(/^session-/, "")
      ).toLowerCase();
      for (var index = 0; index < terms.length; index += 1) {
        if (haystack.indexOf(terms[index]) === -1) return false;
      }
      return true;
    }

    /**
     * Timestamp helpers for merging: null/undefined stay null instead of becoming Infinity.
     *
     * `Math.min(a || Infinity, b || Infinity)` looks defensive but produces Infinity when both
     * sides are missing, and Infinity is truthy — so it silently turned "never read" into
     * "was read". These two keep a missing stamp missing.
     */
    function minStamp(left, right) {
      var a = typeof left === "number" && isFinite(left) ? left : null;
      var b = typeof right === "number" && isFinite(right) ? right : null;
      if (a === null) return b;
      if (b === null) return a;
      return a < b ? a : b;
    }

    function maxStamp(left, right) {
      var a = typeof left === "number" && isFinite(left) ? left : null;
      var b = typeof right === "number" && isFinite(right) ? right : null;
      if (a === null) return b;
      if (b === null) return a;
      return a > b ? a : b;
    }

    function mergeSessions(sessions) {
      var byPath = new Map();
      sessions.forEach(function (session) {
        (session.files || []).forEach(function (file) {
          var existing = byPath.get(file.path);
          if (existing === undefined) {
            byPath.set(file.path, Object.assign({}, file, { sessionTitle: session.title || session.sessionId, sessionId: session.sessionId }));
            return;
          }
          existing.reads = (existing.reads || 0) + (file.reads || 0);
          existing.writes = (existing.writes || 0) + (file.writes || 0);
          // A missing timestamp must stay missing. `|| Infinity` used to win the Math.min and
          // leave Infinity on the row: `fmtTime` then printed "NaN-NaN-NaN NaN:NaN", the sort
          // key became Infinity, and — because Infinity is truthy — a write-only file landed
          // in the "Used" section with reads 0 (25 such rows on this machine's data).
          existing.firstUsedAt = minStamp(existing.firstUsedAt, file.firstUsedAt);
          existing.lastUsedAt = maxStamp(existing.lastUsedAt, file.lastUsedAt);
          existing.createdAt = minStamp(existing.createdAt, file.createdAt);
          existing.updatedAt = maxStamp(existing.updatedAt, file.updatedAt);
        });
      });
      return Array.from(byPath.values());
    }

    var APP_BADGE = ["#f5a623", "#0f9ce8", "#fe315d", "#1f9d55", "#a855f7", "#ef4444"];

    /** The executable's real icon, served and cached by the host. */
    function iconUrl(exe) {
      return BASE + "/icon?path=" + encodeURIComponent(String(exe));
    }

    /**
     * The platform's association icon for an extension (tier B of FileGlyph).
     * A 404 is the normal answer for an extension Windows does not know, and the client then
     * draws its own badge instead.
     */
    function fileIconUrl(ext) {
      return BASE + "/fileicon?ext=" + encodeURIComponent(String(ext || "").toLowerCase());
    }

    /** The extension of a path, lowercased, without the dot. "" when there is none. */
    function extOf(path) {
      var name = String(path || "");
      var slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
      var base = slash >= 0 ? name.slice(slash + 1) : name;
      var dot = base.lastIndexOf(".");
      if (dot <= 0 || dot === base.length - 1) return "";
      return base.slice(dot + 1).toLowerCase();
    }

    /**
     * The program's own icon with a colour-coded initial as the fallback: an
     * executable whose icon cannot be extracted still gets a distinguishable mark.
     */
    function AppIcon(props) {
      var label = String(props.label || "?");
      var sum = 0;
      for (var i = 0; i < label.length; i++) sum = (sum + label.charCodeAt(i)) % APP_BADGE.length;
      var badge = react.createElement("span", {
        style: {
          position: "absolute", inset: 0, borderRadius: "3px", background: APP_BADGE[sum], color: "#fff",
          fontSize: "10px", lineHeight: "16px", textAlign: "center", fontWeight: 600,
          display: props.exe ? "none" : "block"
        }
      }, label.slice(0, 1));
      if (!props.exe) return react.createElement("span", { style: S.appIcon }, badge);
      var image = react.createElement("img", {
        src: iconUrl(props.exe),
        alt: "",
        width: 16,
        height: 16,
        style: { position: "relative", width: "16px", height: "16px", objectFit: "contain", display: "block" },
        onError: function (event) {
          event.currentTarget.style.display = "none";
          var previous = event.currentTarget.previousSibling;
          if (previous !== null) previous.style.display = "block";
        }
      });
      return react.createElement("span", { style: S.appIcon }, badge, image);
    }

    /**
     * Stable dispatchers for memoised children: the real handlers are recreated on every
     * render (they close over current state), so the child gets one permanent wrapper that
     * always calls the newest handler through a ref.
     */
    function useHandlers(handlers) {
      var ref = react.useRef(handlers);
      ref.current = handlers;
      return react.useMemo(function () {
        return {
          open: function (file) { ref.current.open(file); },
          quick: function (file) { ref.current.quick(file); },
          menu: function (event, file) { ref.current.menu(event, file); },
          sortMenu: function (event, target) { ref.current.sortMenu(event, target); },
          sessionMenu: function (event, session) { ref.current.sessionMenu(event, session); }
        };
      }, []);
    }

    /**
     * The search box owns its draft text and debounces the query. Keeping the draft here
     * means a keystroke re-renders one input instead of every card and row on screen.
     */
    function SearchBox(props) {
      var h = react.createElement;
      var draftState = react.useState("");
      var draft = draftState[0];
      var setDraft = draftState[1];
      var timer = react.useRef(null);
      react.useEffect(function () {
        return function () { if (timer.current !== null) clearTimeout(timer.current); };
      }, []);
      return h("input", {
        ref: props.inputRef,
        style: S.input,
        placeholder: t("search.placeholder"),
        "aria-label": t("search.aria"),
        value: draft,
        onChange: function (event) {
          var value = event.target.value;
          setDraft(value);
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(function () { props.onQuery(value.toLowerCase().trim()); }, 150);
        }
      });
    }

    /**
     * Rows are the bulk of the DOM (a wide "all sessions" view is ~900 of them), so they
     * are memoised: a row only re-renders when its own file object changes. The two
     * callbacks are stable wrappers (see useHandlers) so they never invalidate the memo.
     */
    /**
     * The per-file glyph, with a three-tier fallback (A > B > C).
     *
     * A — DSH's own `FileTypeIcon` from `@deepseek-ai/dsh-client-ui-primitives`
     *     (`{ path | kind, size, className }`). Probed exactly like 20-assets.js probes its tab
     *     artwork: a try/catch around `require`, because the plugin's `require` only resolves
     *     `react` and this package is inlined into the DSH bundles at build time rather than
     *     registered as a client module. In DSH 0.2.2-rc.1 the probe therefore misses, but it
     *     costs nothing, needs no reload to start working, and would pick the host icon up
     *     automatically if a build ever registers it.
     * B — the real Windows association icon, extracted per extension by the host half
     *     (`/fileicon?ext=md`). `app.getFileIcon` is not reachable from the plugin process, so
     *     the host drives shell32's SHGetFileInfo instead. This is the tier that actually
     *     renders today: IntelliJ's Java icon, the JSON braces, Markdown's M, the image glyph.
     * C — a drawn badge: the extension's first characters on a per-type tint. It always works,
     *     sits underneath the tier-B image (so it doubles as the loading placeholder), and is
     *     what a 404 from tier B falls back to.
     *
     * The module probe is memoised: once tier A is known to be missing, nothing pays again.
     */
    var primitivesModule;
    var primitivesProbed = false;
    function dshPrimitives() {
      if (primitivesProbed === true) return primitivesModule;
      primitivesProbed = true;
      primitivesModule = null;
      var failure = "";
      try {
        var loaded = require("@deepseek-ai/dsh-client-ui-primitives");
        // Accept the icon under any name the package might use: the bundle's own call sites read
        // `FileTypeIcon`, but a future build could rename it and the others cost one OR each.
        var icon = loaded ? (loaded.FileTypeIcon || loaded.FileIcon || loaded.FileGlyph) : null;
        if (typeof icon === "function") primitivesModule = { FileTypeIcon: icon };
        else failure = loaded ? "no icon export" : "empty module";
      } catch (error) {
        failure = String((error && error.message) || error).slice(0, 200);
      }
      // One line per page load, so a real session can be diagnosed from the host log alone.
      report("primitives", failure === "" ? "tier-A: ok" : "tier-A: miss (" + failure + ")");
      return primitivesModule;
    }

    /** Tier C: the drawn badge. Two letters for long extensions so "yaml" reads as "ya". */
    function fileBadgeText(ext) {
      var value = String(ext || "").toLowerCase();
      if (value === "") return "";
      if (value.length <= 3) return value;
      return value.slice(0, 2);
    }

    function FileGlyph(props) {
      useStyles();
      var ext = String(props.ext || "").toLowerCase();
      var size = props.size || 16;
      var primitives = dshPrimitives();
      // Every hook runs before the tier branch. Returning early on tier A while useState sat
      // further down would change the hook count between renders, which React rejects.
      var state = react.useState(ext === "" ? "fallback" : "image");
      var mode = state[0];
      var setMode = state[1];
      // Tier A: the host's own icon. Nothing else is evaluated or fetched for it.
      if (primitives !== null) {
        return react.createElement(primitives.FileTypeIcon, {
          path: props.path || props.name || "",
          size: size
        });
      }
      // Tier B renders the host-extracted image; on error it hides itself and reveals tier C.
      if (mode === "fallback") {
        return react.createElement("span", {
          style: Object.assign({}, S.fileBadge, { background: categoryColor(props.category), width: size + "px", height: size + "px", fontSize: Math.max(8, Math.round(size * 0.56)) + "px", lineHeight: size + "px" }),
          "aria-hidden": "true"
        }, fileBadgeText(ext).toUpperCase());
      }
      return react.createElement("span", { style: { position: "relative", width: size + "px", height: size + "px", flex: "0 0 auto", display: "inline-block" } },
        react.createElement("span", {
          style: Object.assign({}, S.fileBadge, {
            position: "absolute", inset: 0, background: categoryColor(props.category),
            width: size + "px", height: size + "px", fontSize: Math.max(8, Math.round(size * 0.56)) + "px", lineHeight: size + "px"
          }),
          "aria-hidden": "true"
        }, fileBadgeText(ext).toUpperCase()),
        react.createElement("img", {
          src: fileIconUrl(ext),
          alt: "",
          width: size,
          height: size,
          loading: "lazy",
          decoding: "async",
          style: { position: "relative", width: size + "px", height: size + "px", objectFit: "contain", display: "block" },
          onError: function () { setMode("fallback"); }
        })
      );
    }

    var FileRow = react.memo(function FileRow(props) {
      // Theme-aware: the row is memoised, so without this hook a theme switch would
      // leave it frozen on the previous style table.
      useStyles();
      var file = props.file;
      var open = function () { props.onOpen(file); };
      var missing = file.exists === false;
      // Zebra striping for the "table" theme: an odd row gets the faint fill. It is applied
      // through the style table so every theme inherits the same mechanism (only "table"
      // defines a visible value; the rest map it to transparent).
      var rowStyle = props.parity === 1 ? Object.assign({}, S.row, S.rowAlt) : S.row;
      return react.createElement("div", {
        style: missing ? Object.assign({}, rowStyle, S.rowMissing) : rowStyle,
        // Roving tabindex: the card keeps ONE tabbable row (see SessionCard), so Tab enters
        // the list once instead of stopping on all ~900 rows of an expanded panel.
        tabIndex: props.active === true ? 0 : -1,
        // Rows of a collapsed section are not part of the roving order (index -1): without the
        // attribute they cannot be mistaken for a DOM position by focusRow().
        "data-row-index": props.index >= 0 ? props.index : undefined,
        role: "button",
        "aria-label": file.name + (missing ? t("row.missingSuffix") : "") + t("row.ariaSuffix"),
        onFocus: function () {
          if (typeof props.onFocusIndex === "function") props.onFocusIndex(props.index);
        },
        onClick: open,
        onKeyDown: function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            // Shift+Enter is the quick look: the modal is the fallback, not the default.
            if (event.shiftKey && typeof props.onQuick === "function") { props.onQuick(file); return; }
            open();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (typeof props.onMove === "function") props.onMove(props.index, event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            if (typeof props.onEdge === "function") props.onEdge(event.key === "Home" ? "first" : "last");
          } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            var rect = event.currentTarget.getBoundingClientRect();
            props.onMenu({ clientX: rect.left + 24, clientY: rect.top + 8, currentTarget: event.currentTarget, preventDefault: function () {}, stopPropagation: function () {} }, file);
          }
        },
        onContextMenu: function (event) {
          event.preventDefault();
          event.stopPropagation();
          props.onMenu(event, file);
        },
        title: file.path + (missing ? t("row.missingSuffix") : "")
      },
        // The timeline gutter, painted in order: spine first (so it sits behind), then the dot,
        // then the glyph. Other themes leave both styles null and pay one truthiness check.
        S.rowSpine ? react.createElement("span", { key: "spine", style: S.rowSpine, "aria-hidden": "true" }) : null,
        S.rowDot ? react.createElement("span", {
          key: "dot",
          style: Object.assign({}, S.rowDot, { background: categoryColor(file.category) }),
          "aria-hidden": "true"
        }) : null,
        react.createElement(FileGlyph, { ext: extOf(file.name || file.path), path: file.path, name: file.name, category: file.category, size: 16 }),
        react.createElement("span", { style: S.name }, highlight(file.name, props.query)),
        missing ? react.createElement("span", { style: S.tagMissing }, t("row.missingTag")) : null,
        file.sessionTitle ? react.createElement("span", { style: S.tag, title: file.sessionId }, file.sessionTitle) : null,
        react.createElement("span", { style: S.dir }, highlight(shortPath(file.rel, 34), props.query)),
        // Size rides in the same cell as the counters instead of taking a column of its own:
        // at 380px the row is already at its width budget, and "R2/W1 \u00b7 4.2 KB" is one fact
        // about the file's footprint rather than two unrelated ones.
        react.createElement("span", { style: S.io }, t("row.read") + (file.reads || 0) + t("row.writeSlash") + (file.writes || 0) + rowSize(file)),
        react.createElement("span", { style: S.times }, rowTime(file, props.mode))
      );
    }, function (prev, next) {
      return prev.file === next.file && prev.query === next.query
        && prev.active === next.active && prev.index === next.index
        && prev.mode === next.mode && prev.parity === next.parity;
    });

    /**
     * One time per row, not two.
     *
     * A row used to print "created 11-06 16:00 · updated 11-06 16:30" no matter which
     * section it sat in. The two stamps are usually minutes apart — and in the "Used"
     * section neither is what the reader is scanning for. The section already tells you
     * which dimension matters, so the row echoes it: last-used in Used, updated in
     * Modified, created in Created. That halves the widest cell and removes the wrap
     * that pushed rows to two lines.
     */
    function rowTime(file, mode) {
      if (mode === "created") {
        return file.createdAt ? t("row.onlyCreated", { time: fmtTime(file.createdAt) }) : "";
      }
      if (mode === "modified") {
        return file.updatedAt ? t("row.onlyUpdated", { time: fmtTime(file.updatedAt) }) : "";
      }
      return t("row.onlyUsed", { time: fmtTime(file.lastUsedAt || file.updatedAt) });
    }

    /**
     * The size suffix for a row, or "" when there is nothing honest to show.
     *
     * A deleted file has no size on disk, and printing the last known one would invite the
     * reader to trust a number about a file that no longer exists. The separator is the same
     * middot the time cells use, so the two metadata cells read as one family.
     */
    function rowSize(file, enabled) {
      if (enabled === false) return "";
      var bytes = file.bytes;
      if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "";
      var text = fmtBytes(bytes);
      return text === "" ? "" : t("ui.sep") + text;
    }

    /**
     * Keyboard focus ring and ghost-action hover.
     *
     * These are imperative because inline styles have no `:focus-visible` / `:hover`, so the
     * handler writes the property directly. Two consequences had to be handled:
     *
     * 1. the colors must come from the active style table, not from a literal — a hardcoded
     *    `rgba(118,118,126,0.98)` on hoverOff painted dark grey text on a dark theme, so the
     *    label vanished as soon as the pointer left it;
     * 2. whatever a handler writes outlives a theme switch, because React only reconciles
     *    props it knows about. `collectNode` remembers those nodes and `clearHoverArtifacts`
     *    drops the overrides when the theme changes.
     */
    var HOVER_NODES = new Set();
    function track(node) {
      if (node !== null && node !== undefined) HOVER_NODES.add(node);
      return node;
    }
    function ringOn(event) {
      var node = track(event.currentTarget);
      node.style.boxShadow = "0 0 0 2px " + (S.focusRing || "rgba(79,124,247,0.55)");
    }
    function ringOff(event) {
      event.currentTarget.style.boxShadow = "";
    }
    /**
     * Hover for the ghost actions only: the chip pills carry their own tint, and a
     * hover wash on top of it would read as a second, unrelated state.
     */
    function hoverOn(event) {
      var node = track(event.currentTarget);
      node.style.background = S.hoverWash || "rgba(128,128,128,0.14)";
      node.style.color = "inherit";
    }
    function hoverOff(event) {
      var node = event.currentTarget;
      node.style.background = "transparent";
      // Restore the label to the theme's own dim color instead of a literal grey.
      node.style.color = S.ghostLabel || "inherit";
    }
    /** Drop every imperatively written override so a new theme starts clean. */
    function clearHoverArtifacts() {
      HOVER_NODES.forEach(function (node) {
        try {
          node.style.boxShadow = "";
          node.style.background = "";
          node.style.color = "";
        } catch (error) {
          /* a detached node is already gone */
        }
      });
      HOVER_NODES.clear();
    }
    /** Enter/Space activate anything that only looks like a button. */
    function onActivate(handler) {
      return function (event) {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          event.stopPropagation();
          handler(event);
        }
      };
    }

    function Section(props) {
      var h = react.createElement;
      return h("div", null,
        h("div", { style: S.sectionHead },
          h("button", {
            type: "button",
            style: S.sectionTitle,
            "aria-expanded": props.open === true,
            title: props.open ? t("section.collapse") : t("section.expand"),
            onFocus: ringOn,
            onBlur: ringOff,
            onClick: props.onToggle
          }, (props.open ? "▾ " : "▸ ") + t("section.titleWithCount", { title: props.title, count: props.count })),
          props.extra ? props.extra : null,
          h("button", {
            type: "button",
            style: S.sortChip,
            title: t("section.sortTitle"),
            "aria-label": t("section.sortPrefix") + props.sortLabel,
            "aria-haspopup": "menu",
            onFocus: ringOn,
            onBlur: ringOff,
            onClick: function (event) {
              event.stopPropagation();
              props.onSort(event);
            }
          }, props.sortLabel + (props.dir === "asc" ? " ↑" : " ↓"))
        ),
        props.open ? props.rows : null
      );
    }

    /** How many rows one section shows before it offers "显示更多". */
    var ROW_PAGE = 100;

    /**
     * One session. Memoised on purpose: typing in the search box or opening another card
     * must not re-render every row of every card. All callbacks are stable dispatchers.
     */
    var SessionCard = react.memo(function SessionCard(props) {
      var h = react.createElement;
      // Subscribe to the style theme so a memoised card re-renders when S is swapped.
      // The hook also returns the current S; the component reads it through the local
      // binding below instead of the module global, so the memo gate cannot freeze an
      // old theme in place.
      useStyles();
      var session = props.session;
      var files = session.files || [];
      // Every hook runs before the early return: a card that starts out empty and later
      // matches must not change the hook order.
      var limitState = react.useState({});
      var limits = limitState[0];
      var setLimits = limitState[1];
      // Roving tabindex for the rows of THIS card: exactly one row is Tab-reachable, and
      // ArrowUp/Down/Home/End move between rows. Without it, an expanded "all sessions" view
      // puts ~900 tab stops between the search box and the next control.
      var cardRef = react.useRef(null);
      var rowState = react.useState(null);
      var activeRow = rowState[0];
      var setActiveRow = rowState[1];
      var rowCursor = 0;
      var rowCountRef = react.useRef(0);
      var focusRow = function (index) {
        var box = cardRef.current;
        if (box === null || box === undefined) return;
        var nodes = box.querySelectorAll("[data-row-index]");
        for (var i = 0; i < nodes.length; i += 1) {
          if (String(i) === String(index)) {
            setActiveRow(index);
            nodes[i].focus();
            return;
          }
        }
      };
      var moveRow = function (from, delta) {
        var box = cardRef.current;
        if (box === null || box === undefined) return;
        var total = box.querySelectorAll("[data-row-index]").length;
        var next = clampRowIndex(from, delta, total);
        if (next !== from) focusRow(next);
      };
      var edgeRow = function (which) {
        var box = cardRef.current;
        if (box === null || box === undefined) return;
        var total = box.querySelectorAll("[data-row-index]").length;
        focusRow(which === "first" ? 0 : Math.max(0, total - 1));
      };
      // A filter that shrinks the list can leave the active index past the end; put it back
      // to the first row after the render that shrank it.
      react.useEffect(function () {
        var box = cardRef.current;
        if (box === null || box === undefined || activeRow === null) return;
        var total = box.querySelectorAll("[data-row-index]").length;
        if (activeRow >= total) setActiveRow(null);
      });
      var isCreated = function (file) {
        if (file.created === "confirmed" || file.created === "inferred") return true;
        if (file.created === null) return false;
        return Boolean(file.createdAt) && (file.reads || 0) === 0;
      };
      var matchesQuery = function (file) {
        if (props.deletedOnly === true && file.exists !== false) return false;
        if (props.typeSet !== null && props.typeSet !== undefined && props.typeSet[String(file.category || "other")] !== true) return false;
        return matches(file, props.query);
      };
      // "Used" means a read happened. `|| file.firstUsedAt` looked equivalent and was not:
      // a merged row whose stamp had gone bad (Infinity) put a write-only file into this list.
      var usedAll = files.filter(function (file) { return (file.reads || 0) > 0; });
      // Merged view: everything written, created or not. Split view: the engine's
      // own distinction — files this session created vs files it only modified.
      var createdAll = files.filter(function (file) { return Boolean(file.createdAt) || (file.writes || 0) > 0; });
      var createdOnly = files.filter(isCreated);
      var modifiedOnly = files.filter(function (file) { return (file.writes || 0) > 0 && !isCreated(file); });

      // Filtering is cheap and the head needs the counts; sorting and building hundreds
      // of row elements is not, so that only happens for a card that is actually open.
      var used = usedAll.filter(matchesQuery);
      var created = createdAll.filter(matchesQuery);
      var createdSplit = createdOnly.filter(matchesQuery);
      var modifiedSplit = modifiedOnly.filter(matchesQuery);
      if (used.length === 0 && created.length === 0) return null;
      var split = props.splitWrites === true;
      var showBody = props.open === true && props.near !== false;

      // Sections show ROW_PAGE rows at a time; the rest are one click away instead of
      // being dropped silently (the old code cut every section at 400 with no hint).
      var showMore = function (prefix) {
        setLimits(function (previous) {
          var next = Object.assign({}, previous);
          next[prefix] = nextRowLimit(previous[prefix], ROW_PAGE);
          return next;
        });
      };

      var rowsOf = function (prefix, list, open, rendered) {
        // The three decisions live in 80-core so they are testable without React: whether a
        // section joins the roving order, which sort drives it, and which timestamp its rows
        // show. Both reachability conditions have caused real bugs (collapsed sections build
        // no DOM; the merged view computes split arrays without rendering them).
        var reachable = rowsReachable(open, rendered);
        var sort = sortSpecOf(prefix, props.usedSort, props.createdSort, props.modifiedSort);
        var mode = rowModeOf(prefix);
        var sorted = sortFiles(list, sort);
        var limit = rowLimitOf(prefix, limits, ROW_PAGE);
        var rows = sorted.slice(0, limit).map(function (file, ordinal) {
          var index = reachable === true ? rowCursor : -1;
          if (reachable === true) rowCursor += 1;
          return react.createElement(FileRow, {
            key: prefix + ":" + file.path,
            file: file,
            index: index,
            mode: mode,
            // Alternate-row tint for the "table" theme; the row is memoised, so this has to
            // be a prop rather than a CSS class (there is no stylesheet to hang one on).
            parity: ordinal % 2,
            active: reachable === true && index === (activeRow === null ? 0 : activeRow),
            query: props.query,
            onOpen: props.onOpen,
            onQuick: props.onQuick,
            onMenu: props.onMenu,
            onFocusIndex: setActiveRow,
            onMove: moveRow,
            onEdge: edgeRow
          });
        });
        if (sorted.length > limit) {
          rows.push(h("div", {
            key: prefix + ":more",
            style: S.moreRow,
            role: "button",
            tabIndex: 0,
            onFocus: ringOn,
            onBlur: ringOff,
            onClick: function (event) { event.stopPropagation(); showMore(prefix); },
            onKeyDown: onActivate(function () { showMore(prefix); })
          }, t("section.morePrefix") + (sorted.length - limit) + t("section.moreSuffix")));
        }
        return rows;
      };
      var usedRows = showBody ? rowsOf("u", used, props.usedOpen, true) : null;
      var createdRows = showBody ? rowsOf("c", created, props.createdOpen, split === false) : null;
      var createdSplitRows = showBody ? rowsOf("cs", createdSplit, props.createdOpen, split === true) : null;
      var modifiedSplitRows = showBody ? rowsOf("ms", modifiedSplit, props.modifiedOpen, split === true) : null;

      var splitChip = h("button", {
        type: "button",
        style: S.sortChip,
        title: split ? t("section.mergeTitle") : t("section.splitTitle"),
        "aria-pressed": split === true,
        onFocus: ringOn,
        onBlur: ringOff,
        onClick: function (event) { event.stopPropagation(); props.onToggleSplit(); }
      }, split ? t("section.merge") : t("section.split"));

      rowCountRef.current = rowCursor;
      return react.createElement("div", {
        ref: cardRef,
        // An open card spans the grid row so an expanded board does not leave a tall gap beside
        // it (see the cardOpen style). Only the grid theme defines it; elsewhere it stays null.
        style: props.open === true && S.cardOpen !== null && S.cardOpen !== undefined
          ? Object.assign({}, S.card, S.cardOpen)
          : S.card,
        "data-card": props.sessionId,
        // Focus (keyboard or click) mounts the card, so Tab never lands on a blank body.
        onFocusCapture: function () { props.onMount(); }
      },
        react.createElement("div", {
          style: S.cardHead,
          role: "button",
          tabIndex: 0,
          "aria-expanded": props.open === true,
          "aria-label": (session.title || session.sessionId) + t("section.cardAria"),
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () { props.onToggleCard(props.sessionId); },
          onKeyDown: onActivate(function () { props.onToggleCard(props.sessionId); }),
          onContextMenu: function (event) {
            // Right-click on the header is the session menu; the rows keep their own.
            event.preventDefault();
            event.stopPropagation();
            if (typeof props.onSessionMenu === "function") props.onSessionMenu(event, session);
          }
        },
          // The accent rail is a real element, not a border or an inset shadow: both of those
          // were clipped by the card's 14px radius plus overflow:hidden and never appeared.
          S.cardRail ? react.createElement("span", { style: S.cardRail, "aria-hidden": "true" }) : null,
          react.createElement("span", { style: S.cardTitle, title: session.title }, (props.open ? "▾ " : "▸ ") + (session.title || session.sessionId)),
          react.createElement("span", { style: S.cardMeta },
            split
              ? t("section.usedShort") + used.length + t("section.createdShort") + createdSplit.length + t("section.modifiedShort") + modifiedSplit.length
              : t("section.usedShort") + used.length + t("section.createdShort") + created.length
          )
        ),
        showBody ? react.createElement("div", null,
          used.length > 0 ? react.createElement(Section, {
            title: t("section.used"), count: used.length, open: props.usedOpen, rows: usedRows,
            sortLabel: props.usedLabel, dir: props.usedSort.dir,
            onToggle: function () { props.onToggleSection(props.sessionId + ":used"); },
            onSort: function (event) { props.onSortMenu(event, "used"); }
          }) : null,
          split
            ? [
              createdSplit.length > 0 ? react.createElement(Section, {
                key: "created", title: t("section.created"), count: createdSplit.length, open: props.createdOpen, rows: createdSplitRows,
                sortLabel: props.createdLabel, dir: props.createdSort.dir,
                onToggle: function () { props.onToggleSection(props.sessionId + ":created"); },
                onSort: function (event) { props.onSortMenu(event, "created"); },
                extra: splitChip
              }) : null,
              modifiedSplit.length > 0 ? react.createElement(Section, {
                key: "modified", title: t("section.modifiedOnly"), count: modifiedSplit.length, open: props.modifiedOpen, rows: modifiedSplitRows,
                sortLabel: props.modifiedLabel, dir: props.modifiedSort.dir,
                onToggle: function () { props.onToggleSection(props.sessionId + ":modified"); },
                onSort: function (event) { props.onSortMenu(event, "modified"); }
              }) : null
            ]
            : (created.length > 0 ? react.createElement(Section, {
              title: t("section.createdModified"), count: created.length, open: props.createdOpen, rows: createdRows,
              sortLabel: props.createdLabel, dir: props.createdSort.dir,
              onToggle: function () { props.onToggleSection(props.sessionId + ":created"); },
              onSort: function (event) { props.onSortMenu(event, "created"); },
              extra: splitChip
            }) : null)
        ) : null
      );
    }, function (prev, next) {
      return prev.session === next.session
        && prev.sessionId === next.sessionId
        && prev.query === next.query
        && prev.typeSet === next.typeSet
        && prev.deletedOnly === next.deletedOnly
        && prev.near === next.near
        && prev.open === next.open
        && prev.usedOpen === next.usedOpen
        && prev.createdOpen === next.createdOpen
        && prev.modifiedOpen === next.modifiedOpen
        && prev.splitWrites === next.splitWrites
        && prev.usedSort === next.usedSort
        && prev.createdSort === next.createdSort
        && prev.modifiedSort === next.modifiedSort
        && prev.usedLabel === next.usedLabel
        && prev.createdLabel === next.createdLabel
        && prev.modifiedLabel === next.modifiedLabel;
    });

    /** One popup for both the row context menu and the sort picker. */
    function Menu(props) {
      var h = react.createElement;
      var boxRef = react.useRef(null);
      var open = props.menu !== null;
      // Hooks must run every render, so the effect guards on `open` instead of the
      // component returning early. Focus moves into the popup and back to the trigger.
      react.useEffect(function () {
        if (open !== true) return undefined;
        var trigger = props.menu && props.menu.returnFocus ? props.menu.returnFocus : null;
        var box = boxRef.current;
        if (box !== null) {
          var first = box.querySelector("[data-menu-item='1']");
          (first !== null ? first : box).focus();
        }
        return function () {
          if (trigger !== null && typeof trigger.focus === "function") {
            try { trigger.focus(); } catch (error) { /* the row may be gone after a refresh */ }
          }
        };
      }, [open]);
      var menu = props.menu;
      if (menu === null) return null;
      var bounds = menu.bounds || { w: 420, h: 640 };
      var width = 224;
      var top = Math.min(menu.y, Math.max(4, bounds.h - 240));
      var maxHeight = Math.max(120, bounds.h - top - 8);
      var item = function (entry, index) {
        if (entry.sep === true) return h("div", { key: "sep" + index, style: S.menuSep });
        if (entry.labelOnly === true) return h("div", { key: "lbl" + index, style: S.menuLabel }, entry.label);
        return h("div", {
          key: "item" + index,
          style: S.menuItem,
          role: "menuitem",
          tabIndex: -1,
          "data-menu-item": "1",
          onMouseEnter: function (event) { event.currentTarget.style.background = S.menuHover; },
          onMouseLeave: function (event) { event.currentTarget.style.background = "transparent"; },
          onClick: function (event) {
            event.stopPropagation();
            props.onPick(entry.action);
          }
        },
          entry.iconLabel ? h(AppIcon, { label: entry.iconLabel, exe: entry.iconExe }) : null,
          h("span", { style: { flex: 1 } }, entry.label),
          entry.current === true ? h("span", { style: { color: S.checkMark } }, "✓") : null
        );
      };
      return h("div", {
        ref: boxRef,
        style: Object.assign({}, S.menu, { left: Math.min(menu.x, Math.max(4, bounds.w - width - 4)) + "px", top: top + "px", maxHeight: maxHeight + "px", overflowY: "auto", width: width + "px" }),
        role: "menu",
        tabIndex: -1,
        "aria-label": menu.title || t("sort.menu"),
        onClick: function (event) { event.stopPropagation(); },
        onKeyDown: function (event) {
          var node = event.currentTarget;
          var items = [].slice.call(node.querySelectorAll("[data-menu-item='1']"));
          if (items.length === 0) return;
          var index = items.indexOf(document.activeElement);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            var delta = event.key === "ArrowDown" ? 1 : -1;
            var next = index < 0
              ? (delta === 1 ? 0 : items.length - 1)
              : (index + delta + items.length) % items.length;
            items[next].focus();
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            (event.key === "Home" ? items[0] : items[items.length - 1]).focus();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (typeof props.onClose === "function") props.onClose();
          } else if (event.key === "Tab") {
            event.preventDefault();
          }
        }
      },
        menu.title ? h("div", { style: S.menuPath, title: menu.fullPath || menu.title }, menu.title) : null,
        (menu.items || []).map(item)
      );
    }

    var USED_KEYS = [
      { key: "lastUsed", label: "sort.lastUsed" },
      { key: "firstUsed", label: "sort.firstUsed" },
      { key: "reads", label: "sort.reads" },
      { key: "exists", label: "sort.exists" },
      { key: "type", label: "sort.type" },
      { key: "path", label: "sort.path" }
    ];
    var CREATED_KEYS = [
      { key: "createdAt", label: "sort.createdAt" },
      { key: "updatedAt", label: "sort.updatedAt" },
      { key: "writes", label: "sort.writes" },
      { key: "exists", label: "sort.exists" },
      { key: "type", label: "sort.type" },
      { key: "path", label: "sort.path" }
    ];
    var MODIFIED_KEYS = [
      { key: "updatedAt", label: "sort.updatedAt" },
      { key: "createdAt", label: "sort.createdAt" },
      { key: "writes", label: "sort.writes" },
      { key: "exists", label: "sort.exists" },
      { key: "type", label: "sort.type" },
      { key: "path", label: "sort.path" }
    ];

    /** The panel's own box: popups are absolute inside it, so a clipping sidebar cannot cut them. */
    function panelRect(node) {
      try {
        var root = node && node.closest ? node.closest("[data-doc-ledger-root]") : null;
        if (root !== null) return root.getBoundingClientRect();
      } catch (error) {
        /* fall through to the default box */
      }
      return { left: 0, top: 0, width: 420, height: 640 };
    }

    function labelOf(keys, spec) {
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].key === spec.key) return t(keys[i].label);
      }
      return spec.key;
    }

    function Frame(props) {
      try {
        return FrameInner(props);
      } catch (error) {
        report("frame-error", (error && error.stack) || error);
        return react.createElement("div", { style: { padding: "12px", fontSize: "12px", color: "#b91c1c" } }, t("frame.errorPrefix") + ((error && error.message) || String(error)));
      }
    }

    /** Small, failure-tolerant preference store: sorting and view switches survive a reload. */
    var PREF_PREFIX = "dsh.docLedger.v1.";
    function loadPref(key, fallback) {
      try {
        var raw = window.localStorage.getItem(PREF_PREFIX + key);
        if (raw === null) return fallback;
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (error) {
        return fallback;
      }
    }
    function savePref(key, value) {
      try {
        window.localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value));
      } catch (error) {
        /* private mode or a full quota: preferences are optional */
      }
    }

    function FrameInner(props) {
      var h = react.createElement;
      // Subscribe to the style theme: setStyleTheme swaps S, and this hook re-renders
      // every mounted component that reads S. The hook also pins the current S on each
      // render so a theme switch does not need a reload.
      useStyles();
      var sessionId = readSessionId(props);
      report("session", String(sessionId));

      var scopeState = react.useState("current");
      var scope = scopeState[0];
      var setScope = scopeState[1];

      var queryState = react.useState("");
      var query = queryState[0];
      var setQuery = queryState[1];
      var searchRef = react.useRef(null);
      var exportRef = react.useRef({ sessions: [], scope: "current", query: "" });

      var usedSortState = react.useState(function () { return loadPref("usedSort", { key: "lastUsed", dir: "desc" }); });
      var usedSort = usedSortState[0];
      var setUsedSort = usedSortState[1];

      var createdSortState = react.useState(function () { return loadPref("createdSort", { key: "createdAt", dir: "desc" }); });
      var createdSort = createdSortState[0];
      var setCreatedSort = createdSortState[1];

      var modifiedSortState = react.useState(function () { return loadPref("modifiedSort", { key: "updatedAt", dir: "desc" }); });
      var modifiedSort = modifiedSortState[0];
      var setModifiedSort = modifiedSortState[1];

      var splitWritesState = react.useState(function () { return loadPref("splitWrites", false) === true; });
      var splitWrites = splitWritesState[0];
      var setSplitWrites = splitWritesState[1];

      var separateState = react.useState(function () { return loadPref("separate", true) !== false; });
      var separate = separateState[0];
      var setSeparate = separateState[1];

      var autoState = react.useState(function () { return loadPref("autoRefresh", true) !== false; });
      var autoRefresh = autoState[0];
      var setAutoRefresh = autoState[1];
      var autoRef = react.useRef(autoRefresh);
      autoRef.current = autoRefresh;

      // The quick-look dialog is `min(900px, 100%)` wide: in a narrow window the head's
      // buttons squeeze the file name down to a few characters, so below ~640 px the split
      // button drops its label and keeps only the program icon (its title stays).
      var narrowState = react.useState(function () {
        return typeof window !== "undefined" && window.innerWidth < 640;
      });
      var narrow = narrowState[0];
      var setNarrow = narrowState[1];
      react.useEffect(function () {
        if (typeof window === "undefined") return undefined;
        var onResize = function () { setNarrow(window.innerWidth < 640); };
        window.addEventListener("resize", onResize);
        return function () { window.removeEventListener("resize", onResize); };
      }, []);

      // Visual theme: compact (original) / airy / table / card. Persisted like the
      // other preferences; setStyleTheme rebuilds S and re-renders via useStyles().
      /** Stamped by tools/build-client.mjs as an ISO minute so a stale bundle is obvious. */
    var BUILD_TAG = "2026-11-13 16:18";

    var themeState = react.useState(function () { return loadPref("styleTheme", "card"); });
      var theme = themeState[0];
      // Read through a ref inside memoised callbacks: recreating them on every theme change would
      // invalidate every memoised card.
      var styleThemeRef = react.useRef(theme);
      styleThemeRef.current = theme;
      var setTheme = themeState[1];
      react.useEffect(function () {
        setStyleTheme(theme);
      }, [theme]);

      // Active type chips: an empty object means "no type filter".
      var typeSelState = react.useState(function () {
        var saved = loadPref("typeFilter", []);
        var map = {};
        if (Array.isArray(saved)) saved.forEach(function (key) { if (typeof key === "string" && key !== "") map[key] = true; });
        return map;
      });
      var typeSelection = typeSelState[0];
      var setTypeSelection = typeSelState[1];
      // Second filter level: one extension inside the selected family, or "" for all of them.
      // Kept separate from `typeSelection` so clearing the family clears the extension too,
      // and so the extension can be "all" without inventing a sentinel in the family map.
      var extState = react.useState(function () { return String(loadPref("extFilter", "")); });
      var extFilter = extState[0];
      var setExtFilter = extState[1];

      var typeKeys = Object.keys(typeSelection).filter(function (key) { return typeSelection[key] === true; }).sort();
      var typeKey = typeKeys.join(",");
      // One stable object per selection, so memoised cards are not invalidated by a re-render.
      var typeSet = react.useMemo(function () {
        if (typeKey === "") return null;
        var set = {};
        typeKeys.forEach(function (key) { set[key] = true; });
        return set;
      }, [typeKey]);

      // Which cards may build their rows: only those near the scroll position (plus
      // anything already built). Forty-three expanded cards would otherwise commit
      // ~8 000 nodes in one go, and none of them is on screen.
      var listRef = react.useRef(null);
      var mountedRef = react.useRef(new Set());
      var scrollRafRef = react.useRef(null);
      var mountTickState = react.useState(0);
      var setMountTick = mountTickState[1];
      /** The in-flight "expand every card" job, so a second click can cancel it. */
      var expandJobRef = react.useRef(null);
      /** True while a chunked expansion runs, so the button can offer "全部折叠" again. */
      var bulkState = react.useState(false);
      var bulkBusy = bulkState[0];
      var setBulkBusy = bulkState[1];

      // "只看已删除" is a transient drill-down, not a remembered preference.
      var deletedState = react.useState(false);
      var deletedOnly = deletedState[0];
      var setDeletedOnly = deletedState[1];

      // "Load earlier" asks the host for more sessions than the default page size.
      var limitState = react.useState(function () { return Number(loadPref("sessionLimit", 0)) || 0; });
      var sessionLimit = limitState[0];
      var setSessionLimit = limitState[1];

      /**
       * The session the grid preset has "entered", or null while it shows the board.
       *
       * In the grid preset a session is not expanded in place: the board is replaced by that one
       * session's full-width card. Expanding in place cannot work in a board — one tall card
       * leaves a hole its neighbours cannot backfill and shoves everything after it — and a
       * right-hand drawer was rejected because it covers the board it is meant to complement.
       */
      var enteredState = react.useState(null);
      var entered = enteredState[0];
      var setEntered = enteredState[1];

      var cardOpenState = react.useState({});
      var cardOpen = cardOpenState[0];
      var setCardOpen = cardOpenState[1];

      var sectionOpenState = react.useState({});
      var sectionOpen = sectionOpenState[0];
      var setSectionOpen = sectionOpenState[1];

      var dataState = react.useState({ status: "loading" });
      var data = dataState[0];
      var setData = dataState[1];

      var previewState = react.useState(null);
      var preview = previewState[0];
      var setPreview = previewState[1];
      var previewRef = react.useRef(null);
      previewRef.current = preview;
      /** Monotonic id of the newest preview request; older responses are dropped. */
      var previewToken = react.useRef(0);
      var preRef = react.useRef(null);
      var modalRef = react.useRef(null);
      // Focus moves into the dialog when it opens and back to the row that opened it.
      var modalOpen = preview !== null;
      react.useEffect(function () {
        if (modalOpen !== true) return undefined;
        var previous = document.activeElement;
        var box = modalRef.current;
        if (box !== null) box.focus();
        return function () {
          if (previous !== null && typeof previous.focus === "function") {
            try { previous.focus(); } catch (error) { /* the row may be gone after a refresh */ }
          }
        };
      }, [modalOpen]);
      var previewWasOpen = react.useRef(false);

      var previewAppsState = react.useState([]);
      var previewApps = previewAppsState[0];
      var setPreviewApps = previewAppsState[1];

      var previewMenuState = react.useState(false);
      var previewMenu = previewMenuState[0];
      var setPreviewMenu = previewMenuState[1];

      var menuState = react.useState(null);
      var menu = menuState[0];
      var setMenu = menuState[1];

      var toastState = react.useState(null);
      var toast = toastState[0];
      var setToast = toastState[1];

      // Persist the view switches; they are cheap to store and annoying to lose.
      react.useEffect(function () { savePref("usedSort", usedSort); }, [usedSort.key, usedSort.dir]);
      react.useEffect(function () { savePref("createdSort", createdSort); }, [createdSort.key, createdSort.dir]);
      react.useEffect(function () { savePref("modifiedSort", modifiedSort); }, [modifiedSort.key, modifiedSort.dir]);
      react.useEffect(function () { savePref("splitWrites", splitWrites); }, [splitWrites]);
      react.useEffect(function () { savePref("separate", separate); }, [separate]);
      react.useEffect(function () { savePref("autoRefresh", autoRefresh); }, [autoRefresh]);

      // A chunked expand-all must not keep setting state on an unmounted panel.
      react.useEffect(function () {
        return function () { stopExpandJob(); };
      }, []);

      /** Toasts carry a mood: 'ok' for "copied / refreshed", 'error' for failures. */
      var notify = function (text, kind) {
        setToast({ text: String(text), kind: kind === "error" ? "error" : "ok" });
      };

      var fallbackCopy = function (text, note) {
        try {
          var area = document.createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          document.body.removeChild(area);
          notify(note + t("toast.copiedChars", { n: text.length }));
        } catch (error) {
          notify(t("toast.copyFailed") + String(error), "error");
        }
      };

      var copyText = function (text, note) {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(function () {
              notify(note + t("toast.copiedChars", { n: text.length }));
            }, function () {
              fallbackCopy(text, note);
            });
            return;
          }
        } catch (error) {
          /* fall through to the textarea path */
        }
        fallbackCopy(text, note);
      };

      var csvCell = function (value) {
        var text = String(value === null || value === undefined ? "" : value);
        return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };

      var buildExport = function (format) {
        var data = exportRef.current || { rows: [] };
        var rows = data.rows || [];
        if (format === "paths") return rows.map(function (row) { return row.file.path; }).join("\n");
        if (format === "summary") {
          var used = rows.filter(function (row) { return (row.file.reads || 0) > 0; }).length;
          var createdRows = rows.filter(function (row) { return row.file.created === "confirmed" || row.file.created === "inferred"; }).length;
          return t("export.titlePrefix") + (data.scope === "all" ? t("export.scopeAll") : t("export.scopeCurrent")) +
            (data.query ? t("export.query", { q: data.query }) : "") +
            t("export.lines", { lines: rows.length, used: used, created: createdRows });
        }
        var header = format === "csv"
          ? [t("export.colSession"), t("export.colFile"), t("export.colRel"), t("export.colAbs"), t("export.colRead"), t("export.colWrite"), t("export.colCreated"), t("export.colUpdated")]
          : [t("export.colSession"), t("export.colFile"), t("export.colRel"), t("export.colRead"), t("export.colWrite"), t("export.colCreatedShort"), t("export.colModified")];
        if (format === "csv") {
          return [header.map(csvCell).join(",")].concat(rows.map(function (row) {
            return [row.sessionTitle, row.file.name, row.file.rel, row.file.path, row.file.reads || 0, row.file.writes || 0, fmtTime(row.file.createdAt), fmtTime(row.file.updatedAt)].map(csvCell).join(",");
          })).join("\n");
        }
        var lines = ["| " + header.join(" | ") + " |", "|" + header.map(function () { return " --- "; }).join("|") + "|"];
        rows.forEach(function (row) {
          lines.push("| " + [
            row.sessionTitle.replace(/\|/g, "\\|"),
            row.file.name.replace(/\|/g, "\\|"),
            String(row.file.rel || "").replace(/\|/g, "\\|"),
            row.file.reads || 0,
            row.file.writes || 0,
            fmtTime(row.file.createdAt),
            fmtTime(row.file.updatedAt)
          ].join(" | ") + " |");
        });
        return lines.join("\n");
      };

      /**
       * Theme picker: a dropdown, not a cycling button.
       *
       * Cycling was a dead end — the reader had to click up to four times to reach the look
       * they wanted, and with four themes the label alone never told them what was on offer.
       * The list shows every theme with a check next to the active one.
       */
      var openThemeMenu = function (event) {
        if (menu !== null && menu !== undefined && menu.kind === "theme") { setMenu(null); return; }
        var rect = event.currentTarget.getBoundingClientRect();
        var panel = panelRect(event.currentTarget);
        setMenu({
          kind: "theme",
          x: rect.left - panel.left,
          y: rect.bottom - panel.top + 4,
          bounds: { w: panel.width, h: panel.height },
          title: t("theme.pick"),
          returnFocus: event.currentTarget,
          items: THEME_ORDER.map(function (id) {
            return {
              label: t("theme." + id),
              current: theme === id,
              action: { kind: "setTheme", theme: id }
            };
          })
        });
      };

      var openExportMenu = function (event) {
        if (menu !== null && menu !== undefined && menu.kind === "export") { setMenu(null); return; }
        var rect = event.currentTarget.getBoundingClientRect();
        var panel = panelRect(event.currentTarget);
        var count = (exportRef.current && exportRef.current.rows ? exportRef.current.rows.length : 0);
        setMenu({
          kind: "export",
          x: rect.left - panel.left,
          y: rect.bottom - panel.top + 4,
          bounds: { w: panel.width, h: panel.height },
          title: t("export.currentListWithCount", { n: count }),
          items: [
            { label: t("export.markdown"), action: { kind: "copyText", format: "md" } },
            { label: t("export.csv"), action: { kind: "copyText", format: "csv" } },
            { label: t("export.paths"), action: { kind: "copyText", format: "paths" } },
            { sep: true },
            { label: t("export.summary"), action: { kind: "copyText", format: "summary" } }
          ]
        });
      };

      /**
       * Loads (or reloads) the body of one file. `token` guards against the older
       * response of a previous file landing in the dialog that is open now, which is
       * what a fast A-then-B double click used to do.
       */
      var loadPreviewBody = function (file, token) {
        getJson("/api/file?path=" + encodeURIComponent(file.path), { cache: "default" }).then(function (payload) {
          if (previewToken.current !== token) return;
          setPreview({
            file: file,
            path: file.path,
            name: file.name,
            status: "ok",
            text: payload.text,
            truncated: payload.truncated === true,
            bytes: payload.bytes,
            shown: payload.shown,
            lines: payload.lines,
            encoding: payload.encoding,
            replacements: payload.replacements,
            binary: payload.binary === true,
            loadedAt: Date.now()
          });
        }).catch(function (error) {
          if (previewToken.current !== token) return;
          setPreview({ file: file, path: file.path, name: file.name, status: "error", text: String((error && error.message) || error) });
        });
      };

      /**
       * Default activation: hand the file to the host's document preview, which
       * renders markdown, images, PDFs, Office files and highlighted code. The
       * in-panel modal is the fallback — an older build without `openResource`, or a
       * file that no longer exists (only the modal can explain that).
       */
      var openDefault = function (file) {
        if (file !== null && file !== undefined && file.exists !== false && hostPreviewOpen(file, sessionId)) return;
        openPreview(file);
      };

      var openPreview = function (file) {
        var token = previewToken.current + 1;
        previewToken.current = token;
        setPreview({ file: file, path: file.path, name: file.name, status: "loading" });
        setPreviewMenu(false);
        setPreviewApps([]);
        // The host caches this per extension for 10 minutes, so the split button keeps
        // its program name and icon without a registry walk on every preview.
        getJson("/api/openwith?path=" + encodeURIComponent(file.path)).then(function (payload) {
          if (previewToken.current !== token) return;
          setPreviewApps(payload.apps || []);
        }).catch(function () {
          if (previewToken.current !== token) return;
          setPreviewApps([]);
        });
        loadPreviewBody(file, token);
      };

      /** Re-reads the dialog's file; the host answers 304 when nothing changed. */
      var refreshPreview = function () {
        if (preview === null || preview.file === null || preview.file === undefined) return;
        var box = preRef.current;
        var scrollTop = box === null ? 0 : box.scrollTop;
        var token = previewToken.current + 1;
        previewToken.current = token;
        loadPreviewBody(preview.file, token);
        // Restore the reading position once the new body is committed.
        if (scrollTop > 0) {
          setTimeout(function () {
            var node = preRef.current;
            if (node !== null) node.scrollTop = scrollTop;
          }, 60);
        }
      };

      var act = function (action) {
        setMenu(null);
        if (action === null || action === undefined) return;
        var file = action.file;
        if (action.kind === "sort") {
          var target = action.target === "modified" ? setModifiedSort : (action.target === "created" ? setCreatedSort : setUsedSort);
          var current = action.target === "modified" ? modifiedSort : (action.target === "created" ? createdSort : usedSort);
          target({ key: action.key, dir: current.key === action.key ? (current.dir === "desc" ? "asc" : "desc") : defaultDir(action.key) });
          return;
        }
        if (action.kind === "setTheme") {
          if (typeof action.theme === "string" && action.theme !== "") {
            setTheme(action.theme);
            savePref("styleTheme", action.theme);
          }
          return;
        }
        if (action.kind === "copyText") {
          var text = buildExport(action.format);
          copyText(text, action.format === "md" ? t("toast.copiedMd") : action.format === "csv" ? t("toast.copiedCsv") : action.format === "paths" ? t("toast.copiedPaths") : t("toast.copiedSummary"));
          return;
        }
        if (action.kind === "copySessionName") {
          copyText(String((action.session && action.session.title) || ""), t("toast.copiedSessionName"));
          return;
        }
        if (action.kind === "copySessionId") {
          copyText(String((action.session && action.session.sessionId) || ""), t("toast.copiedSessionId"));
          return;
        }
        if (action.kind === "jumpSession") {
          if (jumpToSession(action.session && action.session.sessionId)) {
            notify(t("toast.switchedTo", { name: (action.session && action.session.title) || t("toast.thisSession") }));
          } else {
            notify(t("toast.jumpUnsupported"), "error");
          }
          return;
        }
        if (action.kind === "preview") { openDefault(file); return; }
        if (action.kind === "quick") { openPreview(file); return; }
        if (action.kind === "copy") { copyText(file.path, t("toast.copiedPath")); return; }
        var mode = action.kind === "reveal" ? "reveal" : (action.kind === "choose" ? "choose" : "open");
        var suffix = action.app ? "&app=" + encodeURIComponent(action.app) : "";
        postJson("/api/open?mode=" + mode + "&path=" + encodeURIComponent(file.path) + suffix).then(function () {
          notify(mode === "reveal" ? t("toast.located") : (mode === "choose" ? t("toast.openWith") : t("toast.opened")));
        }).catch(function (error) {
          notify(String((error && error.message) || error), "error");
        });
      };

      var sortKeysOf = function (target) {
        if (target === "modified") return MODIFIED_KEYS;
        return target === "created" ? CREATED_KEYS : USED_KEYS;
      };
      var sortValueOf = function (target) {
        if (target === "modified") return modifiedSort;
        return target === "created" ? createdSort : usedSort;
      };
      var sortTitleOf = function (target) {
        if (target === "modified") return t("sort.modified");
        return target === "created" ? t("sort.createdModified") : t("sort.used");
      };

      var openSortMenu = function (event, target) {
        // Second click on the same sort chip closes the menu instead of re-opening it.
        if (menu !== null && menu !== undefined && menu.kind === "sort" && menu.target === target) {
          setMenu(null);
          return;
        }
        var rect = event.currentTarget.getBoundingClientRect();
        var panel = panelRect(event.currentTarget);
        var keys = sortKeysOf(target);
        var current = sortValueOf(target);
        setMenu({
          kind: "sort",
          target: target,
          x: rect.left - panel.left,
          y: rect.bottom - panel.top + 4,
          bounds: { w: panel.width, h: panel.height },
          returnFocus: event.currentTarget,
          title: sortTitleOf(target) + t("sort.directionHint"),
          items: keys.map(function (key) {
            return {
              label: key.label,
              current: current.key === key.key,
              action: { kind: "sort", target: target, key: key.key }
            };
          })
        });
      };

      var buildFileItems = function (file, list) {
        // A deleted file has no bytes for the host preview to read, so it keeps the
        // modal (which explains why) and the menu does not offer a dead action.
        var canHost = hostPreviewReady() && file !== null && file !== undefined && file.exists !== false;
        var items = [];
        if (canHost) items.push({ label: t("menu.previewInSidebar"), action: { kind: "preview", file: file } });
        items.push({ label: canHost ? t("menu.quick") : t("menu.preview"), action: { kind: "quick", file: file } });
        items.push({ sep: true });
        items.push({ label: t("menu.openWith"), labelOnly: true });
        if (list.length === 0) {
          items.push({ label: t("menu.noApps"), labelOnly: true });
        }
        list.forEach(function (app) {
          items.push({
            label: app.label + (app.isDefault ? t("menu.default") : ""),
            iconLabel: app.label,
            iconExe: app.exe,
            action: { kind: "open", file: file, app: app.exe }
          });
        });
        items.push({ sep: true });
        items.push({ label: t("menu.chooseOther"), action: { kind: "choose", file: file } });
        items.push({ label: t("menu.reveal"), action: { kind: "reveal", file: file } });
        items.push({ label: t("menu.copyFullPath"), action: { kind: "copy", file: file } });
        return items;
      };

      var openFileMenu = function (event, file) {
        var panel = panelRect(event.currentTarget);
        var bounds = { w: panel.width, h: panel.height };
        setMenu({
          x: event.clientX - panel.left,
          y: event.clientY - panel.top,
          bounds: bounds,
          title: file.name,
          fullPath: file.path,
          returnFocus: event.currentTarget,
          items: buildFileItems(file, [])
        });
        getJson("/api/openwith?path=" + encodeURIComponent(file.path)).then(function (payload) {
          setMenu(function (previous) {
            if (previous === null || previous === undefined || previous.fullPath !== file.path) return previous;
            return Object.assign({}, previous, { items: buildFileItems(file, payload.apps || []) });
          });
        }).catch(function (error) {
          report("openwith-error", String((error && error.message) || error));
        });
      };

      /**
       * Card-head menu for the all-sessions view: copying a session's name is the common
       * way to tell two look-alike cards apart, and the jump entry appears only when this
       * DSH build exposes `uiWorkspace.openSession`.
       */
      var sessionById = function (id) {
        if (typeof id !== "string" || id === "") return null;
        for (var index = 0; index < sessions.length; index += 1) {
          if (sessions[index].sessionId === id) return sessions[index];
        }
        return null;
      };
      var childSessionsOf = function (id) {
        var out = [];
        for (var index = 0; index < sessions.length; index += 1) {
          var candidate = sessions[index];
          if (candidate.sessionId !== id && candidate.parentSessionId === id) out.push(candidate);
        }
        return out;
      };

      var buildSessionItems = function (session) {
        var items = [
          { label: t("menu.copySessionName"), action: { kind: "copySessionName", session: session } },
          { label: t("menu.copySessionId"), action: { kind: "copySessionId", session: session } }
        ];
        if (canJumpToSession()) {
          items.push({ sep: true });
          items.push({ label: t("menu.jumpToSession"), action: { kind: "jumpSession", session: session } });
          // Subagent lineage: the parent id rides on the session payload, the children are
          // whatever else is loaded and names this session as its parent.
          var parent = sessionById(session.parentSessionId);
          if (typeof session.parentSessionId === "string" && session.parentSessionId !== "") {
            items.push({
              label: parent !== null ? t("menu.jumpToParentWith") + (parent.title || parent.sessionId) : t("menu.jumpToParent"),
              action: { kind: "jumpSession", session: parent !== null ? parent : { sessionId: session.parentSessionId, title: session.parentSessionId } }
            });
          }
          childSessionsOf(session.sessionId).slice(0, 5).forEach(function (child) {
            items.push({
              label: t("menu.jumpToChildWith") + (child.title || child.sessionId),
              action: { kind: "jumpSession", session: child }
            });
          });
        }
        return items;
      };

      var openSessionMenu = function (event, session) {
        var panel = panelRect(event.currentTarget);
        setMenu({
          x: event.clientX - panel.left,
          y: event.clientY - panel.top,
          bounds: { w: panel.width, h: panel.height },
          title: session.title || session.sessionId,
          sessionId: session.sessionId,
          returnFocus: event.currentTarget,
          items: buildSessionItems(session)
        });
      };

      // The "全部会话" payload is heavy, so it is fetched only when the view needs it.
      var allDataState = react.useState({ status: "idle", payload: null });
      var allData = allDataState[0];
      var setAllData = allDataState[1];
      var scopeRef = react.useRef(scope);
      scopeRef.current = scope;

      // Last revision per view: a poll that brings the same revision must not re-render
      // the list.
      var revRef = react.useRef({});
      var offlineState = react.useState(null);
      var offline = offlineState[0];
      var setOffline = offlineState[1];

      /**
       * options.silent: keep the current payload on screen while the new one arrives.
       * Polling must always be silent — a spinner every 8 s would unmount the list
       * (and the preview modal) and throw away the scroll position.
       */
      var fetchScope = function (target, alive, options) {
        var opts = options || {};
        var query = target === "current" && sessionId
          ? "?scope=current&session=" + encodeURIComponent(sessionId)
          : "?scope=all";
        var limit = opts.limit !== undefined ? opts.limit : sessionLimit;
        if (target === "all" && limit > 0) query += "&limit=" + encodeURIComponent(limit);
        if (opts.force === true) query += "&force=1";
        var setter = target === "all" ? setAllData : setData;
        if (opts.silent !== true) {
          setter(function (previous) { return { status: "loading", payload: previous ? previous.payload : null }; });
        }
        getJson("/api/all" + query).then(function (payload) {
          if (!alive()) return;
          setOffline(null);
          var unchanged = payload.rev !== undefined && payload.rev === revRef.current[target];
          if (unchanged === true && opts.silent === true) {
            // Nothing changed: keep the existing element tree untouched.
            report("data", "unchanged " + target);
            return;
          }
          revRef.current[target] = payload.rev;
          setter({ status: "ok", payload: payload });
          report("data", target + " ok sessions=" + (payload.sessions || []).length + " partial=" + (payload.partial === true) + " rev=" + payload.rev);
        }).catch(function (error) {
          if (!alive()) return;
          // A failed background refresh keeps the last good payload; the summary line says
          // so instead of silently showing stale data.
          if (opts.silent === true) {
            setOffline((error && error.message) || String(error));
            report("data-error", "silent: " + ((error && error.stack) || error));
            return;
          }
          setter({ status: "error", message: (error && error.message) || String(error) });
          report("data-error", (error && error.stack) || error);
        });
      };

      react.useEffect(function () {
        var live = true;
        var alive = function () { return live; };
        setAllData({ status: "idle", payload: null });
        fetchScope("current", alive, {});
        // Poll the cheap scope only, never while hidden, never while a preview is open,
        // and not at all when the user turned auto-refresh off.
        var timer = setInterval(function () {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
          if (scopeRef.current !== "current") return;
          if (previewRef.current !== null) return;
          if (autoRef.current !== true) return;
          fetchScope("current", alive, { silent: true });
        }, 8000);
        return function () { live = false; clearInterval(timer); };
      }, [sessionId]);

      react.useEffect(function () {
        if (scope !== "all" || allData.status !== "idle") return;
        fetchScope("all", function () { return true; }, {});
      }, [scope, allData.status]);

      // Closing the preview catches up on whatever was skipped while it was open.
      react.useEffect(function () {
        if (preview !== null) { previewWasOpen.current = true; return; }
        if (previewWasOpen.current !== true) return;
        previewWasOpen.current = false;
        fetchScope(scopeRef.current, function () { return true; }, { silent: true });
      }, [preview]);

      react.useEffect(function () {
        if (toast === null) return undefined;
        var timer = setTimeout(function () { setToast(null); }, 4000);
        return function () { clearTimeout(timer); };
      }, [toast]);

      // Keyboard: Esc unwinds (dropdown -> menu -> preview), Ctrl/Cmd+K focuses search.
      react.useEffect(function () {
        var onKey = function (event) {
          var mod = event.ctrlKey || event.metaKey;
          if (mod && (event.key === "k" || event.key === "K")) {
            event.preventDefault();
            if (searchRef.current !== null && searchRef.current !== undefined) searchRef.current.focus();
            return;
          }
          if (event.key !== "Escape") return;
          if (previewMenu === true) { setPreviewMenu(false); return; }
          if (menu !== null && menu !== undefined) { setMenu(null); return; }
          if (preview !== null) { setPreview(null); return; }
        };
        window.addEventListener("keydown", onKey);
        return function () { window.removeEventListener("keydown", onKey); };
      }, [menu, preview, previewMenu]);

      // Two rows, so a narrow sidebar cannot push the last buttons off-screen.
      // A single wrapped flex row put "Theme" past the right edge at 380px: it stayed
      // clickable in the DOM but half of it was outside the viewport, which is exactly
      // why only some of the four themes seemed reachable.
      var header = h("div", { style: S.bar },
        h("div", { style: S.barRow },
          h("span", { style: S.title }, t("toolbar.title")),
          h("button", { style: scope === "current" ? S.buttonOn : S.button, onClick: function () { setScope("current"); } }, t("export.scopeCurrent")),
          h("button", { style: scope === "all" ? S.buttonOn : S.button, onClick: function () { setScope("all"); } }, t("export.scopeAll"))
        ),
        h("div", { style: S.barRow },
          h(SearchBox, { inputRef: searchRef, onQuery: setQuery })
        ),
        h("div", { style: S.barRow },
          h("button", { style: separate ? S.buttonOn : S.button, onClick: function () { setSeparate(!separate); } }, t("toolbar.separate")),
          h("button", {
            style: autoRefresh ? S.buttonOn : S.button,
            title: autoRefresh ? t("toolbar.autoDesc") : t("toolbar.pausedDesc"),
            onClick: function () { setAutoRefresh(!autoRefresh); }
          }, autoRefresh ? t("toolbar.auto") : t("toolbar.paused")),
          h("button", {
            style: menu !== null && menu.kind === "export" ? S.buttonOn : S.button,
            title: t("toolbar.export"),
            onClick: function (event) { event.stopPropagation(); openExportMenu(event); }
          }, t("toolbar.exportShort")),
          h("button", {
            style: S.button,
            onClick: function () {
              fetchScope(scope === "all" ? "all" : "current", function () { return true; }, { force: true, silent: true });
              notify(t("toast.refreshed"));
            }
          }, t("toolbar.refresh")),
          h("button", {
            style: menu !== null && menu.kind === "theme" ? S.buttonOn : S.button,
            title: t("theme.title") + t("theme." + theme),
            "aria-haspopup": "menu",
            "aria-expanded": menu !== null && menu.kind === "theme",
            onClick: function (event) { event.stopPropagation(); openThemeMenu(event); }
          }, t("theme.next") + ": " + t("theme." + theme) + " ▾"),
          // A build tag on the toolbar. Without it there is no way to tell a stale bundle from a
          // broken layout: the DSH window keeps its client bundle until the process restarts, so
          // "I fixed it" and "you are looking at the old code" look identical from both sides.
          h("span", {
            style: { marginLeft: "auto", fontSize: "10px", opacity: 0.45, letterSpacing: "0.02em" },
            title: "doc-ledger build"
          }, BUILD_TAG)
        )
      );

      /**
       * The preview lives outside the data-view branch: a refresh (or a load error)
       * must never unmount the modal, otherwise the reader loses its scroll position.
       */
      var renderModal = function () {
        if (preview === null) return null;
        var defaultApp = null;
        for (var appIndex = 0; appIndex < previewApps.length; appIndex++) {
          if (previewApps[appIndex].isDefault) { defaultApp = previewApps[appIndex]; break; }
        }
        var defaultLabel = defaultApp !== null ? defaultApp.label : t("preview.defaultApp");

        // One line of context above the body. File facts come first: in a narrow window
        // the row ellipsizes, and "how big / how decoded" matters more than the counters.
        var metaBits = [];
        if (typeof preview.bytes === "number") metaBits.push(fmtBytes(preview.bytes));
        if (preview.lines > 0) metaBits.push(t("preview.lines", { n: preview.lines }));
        var decodedAs = encodingLabel(preview.encoding);
        if (decodedAs !== null) metaBits.push(decodedAs);
        var known = preview.file || null;
        if (known !== null) {
          if (known.createdAt) metaBits.push(t("preview.createdAt") + fmtTime(known.createdAt));
          if (known.updatedAt) metaBits.push(t("preview.updatedAt") + fmtTime(known.updatedAt));
          var reads = known.reads || 0;
          var writes = known.writes || 0;
          if (reads > 0 || writes > 0) metaBits.push(t("preview.readWrite", { reads: reads, writes: writes }));
        }
        var previewMeta = metaBits.length === 0 ? null : h("div", { style: S.modalMeta }, metaBits.join(t("ui.sep")));

        // Truncation and undecodable bytes are shown as a notice row instead of being
        // appended to the body, where they were easy to miss and got copied along.
        var notices = [];
        if (preview.truncated === true) {
          notices.push(t("preview.truncated", { shown: fmtBytes(preview.shown), total: fmtBytes(preview.bytes) }));
        }
        if (preview.replacements > 0) notices.push(t("preview.undecodable", { n: preview.replacements }));
        var previewNotice = notices.length === 0 ? null : h("div", { style: S.modalWarn }, notices.join(t("ui.sep")));

        return h("div", { style: S.modal, onClick: function () { setPreview(null); } },
          h("div", {
            ref: modalRef,
            style: S.modalBox,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": t("preview.aria") + preview.name,
            tabIndex: -1,
            onClick: function (event) { event.stopPropagation(); },
            onKeyDown: function (event) {
              if (event.key !== "Tab") return;
              // Keep Tab inside the dialog: a preview must not move focus behind the overlay.
              var node = event.currentTarget;
              var focusable = [].slice.call(node.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
              if (focusable.length === 0) { event.preventDefault(); node.focus(); return; }
              var first = focusable[0];
              var last = focusable[focusable.length - 1];
              if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }
          },
            h("div", { style: S.modalHead },
              h("span", { style: S.cardTitle, title: preview.path }, preview.name),
              h("div", { style: S.headActions },
                h("div", { style: S.split },
                  h("button", {
                    style: S.splitMain,
                    title: t("preview.openWith", { app: defaultLabel }),
                    "aria-label": t("preview.openWith", { app: defaultLabel }),
                    onClick: function () { act({ kind: "open", file: preview, app: "" }); }
                  },
                    defaultApp !== null ? h(AppIcon, { label: defaultApp.label, exe: defaultApp.exe }) : null,
                    narrow === true ? null : h("span", null, t("preview.openWith", { app: defaultLabel }))
                  ),
                  h("button", {
                    style: S.splitArrow,
                    title: t("preview.chooseOther"),
                    onClick: function (event) { event.stopPropagation(); setPreviewMenu(!previewMenu); }
                  }, "▾"),
                  previewMenu === true ? h("div", { style: S.dropdown },
                    previewApps.length === 0 ? h("div", { style: S.menuLabel }, t("menu.noApps")) : null,
                    previewApps.map(function (app) {
                      return h("div", {
                        key: app.exe,
                        style: S.menuItem,
                        title: app.exe,
                        role: "menuitem",
                        tabIndex: 0,
                        onFocus: ringOn,
                        onBlur: ringOff,
                        onKeyDown: onActivate(function () { setPreviewMenu(false); act({ kind: "open", file: preview, app: app.exe }); }),
                        onClick: function () { setPreviewMenu(false); act({ kind: "open", file: preview, app: app.exe }); }
                      },
                        h(AppIcon, { label: app.label, exe: app.exe }),
                        h("span", { style: { flex: 1 } }, app.label + (app.isDefault ? t("menu.default") : ""))
                      );
                    }),
                    h("div", { style: S.menuSep }),
                    h("div", {
                      style: S.menuItem,
                      role: "menuitem",
                      tabIndex: 0,
                      onFocus: ringOn,
                      onBlur: ringOff,
                      onKeyDown: onActivate(function () { setPreviewMenu(false); act({ kind: "choose", file: preview }); }),
                      onClick: function () { setPreviewMenu(false); act({ kind: "choose", file: preview }); }
                    }, t("menu.chooseOther")),
                    h("div", {
                      style: S.menuItem,
                      role: "menuitem",
                      tabIndex: 0,
                      onFocus: ringOn,
                      onBlur: ringOff,
                      onKeyDown: onActivate(function () { setPreviewMenu(false); act({ kind: "reveal", file: preview }); }),
                      onClick: function () { setPreviewMenu(false); act({ kind: "reveal", file: preview }); }
                    }, t("menu.reveal"))
                  ) : null
                ),
                // Escape hatch from the modal into the host's full preview (images,
                // PDFs, Office, rendered markdown) — never offered for a deleted file.
                hostPreviewReady() && preview.file !== null && preview.file !== undefined && preview.file.exists !== false ? h("button", {
                  style: S.button,
                  title: t("preview.sidebarTitle"),
                  onClick: function () {
                    if (hostPreviewOpen(preview.file, sessionId)) setPreview(null);
                  }
                }, t("preview.sidebar")) : null,
                h("button", {
                  style: S.button,
                  title: t("preview.reloadTitle"),
                  onClick: refreshPreview
                }, t("toolbar.refresh")),
                h("button", {
                  style: S.button,
                  title: preview.truncated === true ? t("preview.copyTruncated") : t("preview.copyContent"),
                  onClick: function () { copyText(preview.text || "", t("toast.copiedContent")); }
                }, t("preview.copy")),
                h("button", { style: S.button, onClick: function () { setPreview(null); } }, t("preview.close"))
              )
            ),
            previewMeta,
            previewNotice,
            h("pre", { ref: preRef, style: S.pre, tabIndex: 0 },
              preview.status === "loading" ? t("preview.loading") : (preview.text || "")),
            h("div", {
              style: Object.assign({}, S.modalFoot, { cursor: "pointer" }),
              title: preview.path + t("preview.copyPathHint"),
              onClick: function () { copyText(preview.path, t("toast.copiedPath")); }
            }, preview.path + t("preview.esc"))
          )
        );
      };

      var activeState = scope === "all" ? allData : data;
      // Every branch renders the same child list (header, summary, list, menu, modal, toast)
      // so React keeps nodes mounted; the modal must never be re-created by a reload.
      var ready = activeState.status === "ok";
      var payload = ready ? (activeState.payload || {}) : {};
      var sessions = ready ? (payload.sessions || []) : [];
      var missingCurrent = false;
      if (ready && scope === "current") {
        if (payload.currentSessionId) {
          var active = sessions.filter(function (session) { return session.sessionId === payload.currentSessionId; });
          missingCurrent = active.length === 0;
          sessions = active;
        } else {
          sessions = sessions.slice(0, 1);
        }
      }

      var summary = { sessions: sessions.length, used: 0, created: 0, reads: 0, writes: 0 };
      var byCategory = {};
      /** The one filter predicate: search + type chips + "only deleted" all narrow this. */
      var passesFilters = function (file) {
        if (deletedOnly === true && file.exists !== false) return false;
        if (typeSet !== null && typeSet[String(file.category || "other")] !== true) return false;
        if (extFilter !== "" && extOf(file.name || file.path || "") !== extFilter) return false;
        return matches(file, query);
      };
      var filterActive = query !== "" || typeSet !== null || deletedOnly === true || extFilter !== "";
      var visible = { files: 0, sessions: 0, deleted: 0 };
      sessions.forEach(function (session) {
        var counts = session.counts || {};
        summary.used += counts.used || 0;
        summary.created += counts.created || 0;
        summary.reads += counts.reads || 0;
        summary.writes += counts.writes || 0;
        var matched = 0;
        (session.files || []).forEach(function (file) {
          var key = String(file.category || "other");
          byCategory[key] = (byCategory[key] || 0) + 1;
          if (file.exists === false) visible.deleted += 1;
          if (filterActive && passesFilters(file)) matched += 1;
        });
        visible.files += matched;
        if (matched > 0) visible.sessions += 1;
      });
      if (!filterActive) {
        visible.sessions = sessions.length;
        visible.files = Object.keys(byCategory).reduce(function (total, key) { return total + byCategory[key]; }, 0);
      }

      var categoryChips = Object.keys(byCategory).map(function (key) {
        return { key: key, count: byCategory[key] };
      }).sort(function (left, right) {
        return right.count - left.count || left.key.localeCompare(right.key);
      });

      var summaryLine = ready ? h("div", { style: S.summary },
        t("summary.line", { sessions: summary.sessions || 0, used: summary.used || 0, created: summary.created || 0, reads: summary.reads || 0, writes: summary.writes || 0 }) +
        (filterActive ? t("summary.filteredLine", { files: t("summary.countFiles", { n: visible.files }), sessions: t("summary.countSessions", { n: visible.sessions }) }) : "") +
        (payload.truncated === true ? t("summary.onlyRecentLine", { shown: payload.maxSessions, total: payload.totalSessions }) : ""),
        payload.truncated === true && scope === "all" ? h("button", {
          type: "button",
          style: Object.assign({}, S.button, { marginLeft: "8px", padding: "1px 8px", fontSize: "11px" }),
          onClick: function () { loadEarlier(payload.maxSessions || 40); }
        }, t("summary.loadEarlier")) : null
      ) : null;

      // What the export actions copy: the rows currently visible after scope + search.
      var exportRows = [];
      sessions.forEach(function (session) {
        (session.files || []).forEach(function (file) {
          if (!passesFilters(file)) return;
          if (!((file.reads || 0) > 0 || file.firstUsedAt || file.createdAt || (file.writes || 0) > 0)) return;
          exportRows.push({ sessionTitle: session.title || session.sessionId, file: file });
        });
      });
      // Keep the last good export content while a new payload is loading.
      if (ready) exportRef.current = { rows: exportRows, scope: scope, query: query };
      // Stable dispatchers: memoised cards must not see a new callback on every render.
      var rowHandlers = useHandlers({ open: openDefault, quick: openPreview, menu: openFileMenu, sortMenu: openSortMenu, sessionMenu: openSessionMenu });
      var toggleCard = react.useCallback(function (id) {
        // In the grid preset a click enters the session: the board is replaced by that session's
        // card. Only "all sessions" is affected; "current session" already is a single card and
        // keeps the ordinary expansion below.
        if (styleThemeRef.current === "grid" && scopeRef.current !== "current") {
          setEntered(function (previous) { return previous === id ? null : id; });
          return;
        }
        // Clicking a card always mounts it, even when it is far below the fold.
        var list = listRef.current;
        if (list !== null && list !== undefined) {
          for (var index = 0; index < list.children.length; index += 1) {
            if (list.children[index].getAttribute("data-card") === id) { mountCard(index); break; }
          }
        }
        setCardOpen(function (previous) {
          var next = Object.assign({}, previous);
          var current = previous[id] !== undefined ? previous[id] : (scopeRef.current === "current");
          next[id] = !current;
          return next;
        });
      }, []);

      var toggleSection = react.useCallback(function (key) {
        setSectionOpen(function (previous) {
          var next = Object.assign({}, previous);
          next[key] = previous[key] === false ? true : false;
          return next;
        });
      }, []);

      var toggleSplit = react.useCallback(function () {
        setSplitWrites(function (previous) { return previous !== true; });
      }, []);

      var toggleType = function (key) {
        var next = Object.assign({}, typeSelection);
        if (next[key] === true) delete next[key]; else next[key] = true;
        setTypeSelection(next);
        savePref("typeFilter", Object.keys(next).filter(function (name) { return next[name] === true; }));
      };

      /** Widen the all-sessions page and refetch it, keeping the current scroll target. */
      var loadEarlier = function (currentMax) {
        var next = Math.min(300, Math.max(currentMax + 40, 40));
        setSessionLimit(next);
        savePref("sessionLimit", next);
        revRef.current.all = undefined;
        fetchScope("all", function () { return true; }, { limit: next, force: true, silent: true });
      };

      /**
       * Mount the cards that are within one screen of the viewport, and never unmount:
       * a body that disappears would change the list height under the pointer.
       */
      var mountNear = function () {
        var list = listRef.current;
        if (list === null || list === undefined) return;
        var mounted = mountedRef.current;
        var before = mounted.size;
        var base = list.getBoundingClientRect().top - list.scrollTop;
        // At most a few new cards per pass: mounting one changes every offset below it, so
        // filling the whole window at once would be the eager render again.
        var budget = 6;
        for (var index = 0; index < list.children.length; index += 1) {
          var child = list.children[index];
          var top = child.getBoundingClientRect().top - base;
          var bottom = top + (child.offsetHeight || 0);
          if (mounted.has(index) === true) continue;
          if (bottom < list.scrollTop - 600 || top > list.scrollTop + list.clientHeight + 1000) continue;
          // Whatever is actually on screen always mounts; the budget only limits prefetch.
          var visible = bottom >= list.scrollTop && top <= list.scrollTop + list.clientHeight;
          if (visible !== true) {
            if (budget <= 0) break;
            budget -= 1;
          }
          mounted.add(index);
        }
        if (mounted.size !== before) setMountTick(function (tick) { return tick + 1; });
        return mounted.size !== before;
      };
      /**
       * Mounting a card moves everything below it, so a jump (scrollbar, End, click) needs a
       * few passes to fill the viewport. Bounded: each pass mounts at most a few cards.
       */
      var settleMount = function () {
        var passes = 0;
        var step = function () {
          var grew = mountNear();
          passes += 1;
          if (grew === true && passes < 4) requestAnimationFrame(step);
        };
        step();
      };
      var onListScroll = function () {
        if (scrollRafRef.current !== null) return;
        scrollRafRef.current = requestAnimationFrame(function () {
          scrollRafRef.current = null;
          settleMount();
        });
      };
      // Re-measure when the list itself changes (data, filter, a card or all cards toggled).
      // Deliberately not on every render: a sync cascade would mount the whole list again.
      react.useEffect(function () { settleMount(); }, [ready, scope, separate, query, typeSet, deletedOnly, cardOpen, splitWrites, sessions.length]);
      var mountCard = function (index) {
        if (index === undefined || index === null) return;
        if (mountedRef.current.has(index)) return;
        mountedRef.current.add(index);
        setMountTick(function (tick) { return tick + 1; });
      };

      var everyOpen = sessions.length > 0 && sessions.every(function (session) { return cardOpen[session.sessionId] === true; });

      /** Stop an in-flight expand-all job without touching React state (safe on unmount). */
      var stopExpandJob = function () {
        var job = expandJobRef.current;
        if (job === null) return false;
        job.cancelled = true;
        if (job.timer !== 0) clearTimeout(job.timer);
        expandJobRef.current = null;
        return true;
      };
      /** Stop the job and put the bulk button back to its idle label. */
      var cancelExpandJob = function () {
        if (stopExpandJob() === true) setBulkBusy(false);
      };

      /**
       * Expand every card, but a few per task.
       *
       * Collapsing is cheap (rows disappear), so it stays one synchronous update. Expanding
       * is the expensive direction: forty already-mounted cards rebuild ~3 700 nodes, and
       * committing that in a single task blocks the main thread for ~85 ms — measured as two
       * long tasks of 85 ms each, 98 ms to the next painted frame. A chunked pass turns the
       * same work into a handful of short tasks, and the first chunk shows up right away.
       *
       * The scheduler is a 0 ms timer, not requestAnimationFrame: frames are throttled to
       * ~1 Hz when the window is not being composited, which would stretch the pass to
       * seconds, while a timer keeps the chunk loop close to its per-task cost.
       */
      var toggleAllCards = function () {
        var expand = everyOpen !== true && bulkBusy !== true;
        cancelExpandJob();
        if (!expand) {
          var collapsed = Object.assign({}, cardOpen);
          sessions.forEach(function (session) { collapsed[session.sessionId] = false; });
          setCardOpen(collapsed);
          // A collapsed card builds no rows, so forgetting which cards were mounted is
          // invisible — and it stops the next "expand all" from rebuilding every row that
          // was mounted while the cards were still 42 px tall (the prefetch band is sized
          // for collapsed heights, so that was most of the list).
          mountedRef.current.clear();
          setMountTick(function (tick) { return tick + 1; });
          return;
        }
        var pending = [];
        sessions.forEach(function (session) {
          if (cardOpen[session.sessionId] !== true) pending.push(session.sessionId);
        });
        if (pending.length === 0) return;
        var job = { ids: pending, cancelled: false, timer: 0 };
        expandJobRef.current = job;
        setBulkBusy(true);
        var step = function () {
          if (job.cancelled === true || expandJobRef.current !== job) return;
          var batch = job.ids.splice(0, 8);
          if (batch.length === 0) {
            expandJobRef.current = null;
            setBulkBusy(false);
            return;
          }
          setCardOpen(function (previous) {
            var next = Object.assign({}, previous);
            batch.forEach(function (id) { next[id] = true; });
            return next;
          });
          if (job.ids.length > 0) job.timer = setTimeout(step, 0);
          else {
            expandJobRef.current = null;
            setBulkBusy(false);
          }
        };
        step();
      };

      var sectionsOf = function (id) {
        return {
          usedOpen: sectionOpen[id + ":used"] !== false,
          createdOpen: sectionOpen[id + ":created"] !== false,
          modifiedOpen: sectionOpen[id + ":modified"] !== false
        };
      };

      var cardProps = function (session, index) {
        var override = cardOpen[session.sessionId];
        var sections = sectionsOf(session.sessionId);
        return {
          index: index,
          near: index === undefined || mountedRef.current.has(index) === true,
          onMount: function () { mountCard(index); },
          key: session.sessionId,
          sessionId: session.sessionId,
          session: session,
          query: query,
          typeSet: typeSet,
          deletedOnly: deletedOnly,
          usedSort: usedSort,
          createdSort: createdSort,
          modifiedSort: modifiedSort,
          splitWrites: splitWrites,
          usedLabel: labelOf(USED_KEYS, usedSort),
          createdLabel: labelOf(CREATED_KEYS, createdSort),
          modifiedLabel: labelOf(MODIFIED_KEYS, modifiedSort),
          open: override !== undefined ? override : (scope === "current"),
          usedOpen: sections.usedOpen,
          createdOpen: sections.createdOpen,
          modifiedOpen: sections.modifiedOpen,
          onToggleCard: toggleCard,
          onToggleSection: toggleSection,
          onToggleSplit: toggleSplit,
          onSortMenu: rowHandlers.sortMenu,
          onOpen: rowHandlers.open,
          onQuick: rowHandlers.quick,
          onMenu: rowHandlers.menu,
          onSessionMenu: rowHandlers.sessionMenu
        };
      };

      // A collapsed/empty card must not swallow the "no match" message: decide here
      // which sessions still have a row before creating any element.
      // The "counts as activity" rule lives in 80-core so it can be tested directly.
      var hasVisibleRow = function (files) {
        return hasActiveRow(files, passesFilters);
      };

      var cards = [];
      // Grid preset, "all sessions", a session entered: exactly one full-width card, always open,
      // with a back affordance above it. The board is not rendered at all, so nothing is covered
      // and nothing shifts.
      var enteredSession = null;
      if (entered !== null && theme === "grid" && separate) {
        for (var ei = 0; ei < sessions.length; ei += 1) {
          if (sessions[ei].sessionId === entered) { enteredSession = sessions[ei]; break; }
        }
      }
      if (enteredSession !== null) {
        var enteredProps = cardProps(enteredSession, 0);
        enteredProps.open = true;
        enteredProps.near = true;
        // Its head toggles back out, so clicking the card header is the same affordance as the bar.
        enteredProps.onToggleCard = function () { setEntered(null); };
        enteredProps.entered = true;
        cards = [h(SessionCard, enteredProps)];
      } else if (separate) {
        cards = sessions
          .filter(function (session) { return hasVisibleRow(session.files); })
          .map(function (session, index) { return h(SessionCard, cardProps(session, index)); });
      } else if (sessions.length > 0) {
        var merged = mergeSessions(sessions);
        var flatProps = cardProps({ sessionId: "__flat__", title: t("empty.mergeAll"), files: merged });
        flatProps.usedSort = usedSort;
        flatProps.createdSort = createdSort;
        flatProps.open = cardOpen.__flat__ !== false;
        flatProps.onToggleCard = function () {
          // The merged card keeps the ordinary toggle in every preset: there is no session to
          // enter, and the merged view is already a single full-width card.
          setCardOpen(function (previous) {
            var next = Object.assign({}, previous);
            next.__flat__ = previous.__flat__ === false ? true : false;
            return next;
          });
        };
        cards = hasVisibleRow(merged) ? [h(SessionCard, flatProps)] : [];
      }

      var emptyText = missingCurrent ? t("empty.noCurrent") : (query === "" ? t("empty.noDocs") : t("empty.noMatch", { terms: query.trim().split(/\s+/).join(" ") }));
      var placeholder = activeState.status === "error"
        ? t("empty.readFailed") + activeState.message
        : t("preview.loading");
      // The way back out of an entered session. Rendered above the list rather than floated, so it
      // can never cover a row.
      var backBar = enteredSession !== null ? h("div", { style: S.backBar },
        h("button", {
          type: "button",
          style: S.backButton,
          onClick: function () { setEntered(null); },
          onFocus: ringOn,
          onBlur: ringOff
        }, "\u2190 " + t("enter.back")),
        h("span", { style: S.backLabel }, t("enter.hint"))
      ) : null;

      var body = !ready
        ? h("div", { style: S.empty }, placeholder)
        : (cards.length > 0 ? cards : h("div", { style: S.empty }, emptyText));

      // One slot that is always present in the tree: offline and "served from cache" notes
      // must not shift the list to another child index (that would remount it).
      var notice = offline !== null
        ? h("div", {
          style: S.notice,
          role: "status",
          title: t("toast.backgroundFailed"),
          onClick: function () {
            setOffline(null);
            fetchScope(scopeRef.current, function () { return true; }, { force: true, silent: true });
          }
        }, t("toast.refreshFailed") + offline + t("toast.clickRetry"))
        : null;

      // Kept in the tree even when hidden: a new child index would remount the list.
      var showFilterBar = categoryChips.length >= 2 || (scope === "all" && separate);
      // The second level appears only when a single family is selected AND that family actually
      // has more than one extension in the current data. Otherwise it would be a row of one chip
      // repeating the family the reader just clicked.
      var selectedFamilies = typeSet === null ? [] : Object.keys(typeSet);
      var showExtRow = selectedFamilies.length === 1;
      var familyFiles = [];
      if (showExtRow) {
        var onlyFamily = selectedFamilies[0];
        sessions.forEach(function (session) {
          (session.files || []).forEach(function (file) {
            if (String(file.category || "other") === onlyFamily) familyFiles.push(file);
          });
        });
      }
      var census = showExtRow ? extensionCensus(familyFiles, null) : [];
      var extChipsPartition = showExtRow ? extensionChips(census, EXT_CHIP_MAX) : { shown: [], hidden: 0, hiddenFiles: 0 };
      var acceptExtFilter = showExtRow && extChipsPartition.shown.length >= 2;
      var extRow = acceptExtFilter ? h("div", { style: S.filterBar },
        h("span", { style: S.filterLabel }, t("filter.extLabel")),
        h("button", {
          type: "button",
          style: extFilter === "" ? S.filterChipOn : S.filterChip,
          "aria-pressed": extFilter === "",
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () { setExtFilter(""); savePref("extFilter", ""); }
        },
          h("span", null, t("filter.allExts")),
          h("span", { style: extFilter === "" ? S.chipCountOn : S.chipCount }, String(familyFiles.length))
        ),
        extChipsPartition.shown.map(function (entry) {
          var on = extFilter === entry.ext;
          var label = entry.ext === "" ? t("filter.noExt") : entry.ext;
          return h("button", {
            key: "ext:" + entry.ext,
            type: "button",
            style: on ? S.filterChipOn : S.filterChip,
            "aria-pressed": on,
            title: t("filter.onlyExt", { ext: label, count: entry.count }),
            onFocus: ringOn,
            onBlur: ringOff,
            onClick: function () {
              var next = on ? "" : entry.ext;
              setExtFilter(next);
              savePref("extFilter", next);
            }
          },
            h("span", null, label),
            h("span", { style: on ? S.chipCountOn : S.chipCount }, String(entry.count))
          );
        }),
        extChipsPartition.hidden > 0 ? h("span", { style: S.chipCount, title: t("filter.moreExts", { n: extChipsPartition.hidden }) },
          t("filter.moreExts", { n: extChipsPartition.hidden })) : null
      ) : null;

      var filterBar = h("div", { style: showFilterBar ? S.filterBar : Object.assign({}, S.filterBar, { display: "none" }) },
        h("span", { style: S.filterLabel }, t("sort.type")),
        categoryChips.map(function (chip) {
          var on = typeSet !== null && typeSet[chip.key] === true;
          return h("button", {
            key: chip.key,
            type: "button",
            style: on ? S.filterChipOn : S.filterChip,
            "aria-pressed": on,
            title: t("filter.only", { type: categoryLabel(chip.key), count: chip.count }),
            onFocus: ringOn,
            onBlur: ringOff,
            onClick: function () { toggleType(chip.key); }
          },
            h("span", null, categoryLabel(chip.key)),
            h("span", { style: on ? S.chipCountOn : S.chipCount }, String(chip.count))
          );
        }),
        h("button", {
          type: "button",
          style: deletedOnly === true ? S.filterChipOn : S.filterChip,
          "aria-pressed": deletedOnly === true,
          title: t("filter.missingTitle"),
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () { setDeletedOnly(function (previous) { return previous !== true; }); }
        },
          h("span", null, t("row.missingTag")),
          h("span", { style: deletedOnly === true ? S.chipCountOn : S.chipCount }, String(visible.deleted))
        ),
        // A reset is an action, not a filter: a hairline divider plus a ghost button.
        typeSet !== null || deletedOnly === true ? h("span", { style: S.filterDivider, "aria-hidden": "true" }) : null,
        typeSet !== null || deletedOnly === true ? h("button", {
          type: "button",
          style: S.filterAction,
          title: t("filter.clearTitle"),
          "aria-label": t("filter.clearAria"),
          onMouseEnter: hoverOn,
          onMouseLeave: hoverOff,
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () {
            setTypeSelection({});
            savePref("typeFilter", []);
            setExtFilter("");
            savePref("extFilter", "");
            setDeletedOnly(false);
          }
        }, h("span", { style: S.filterActionGlyph, "aria-hidden": "true" }, "✕"), t("filter.clear")) : null,
        scope === "all" && separate ? h("button", {
          type: "button",
          style: Object.assign({}, S.filterAction, { marginLeft: "auto" }),
          title: everyOpen === true || bulkBusy === true ? t("expand.collapseTitle") : t("expand.expandTitle"),
          "aria-busy": bulkBusy === true,
          onMouseEnter: hoverOn,
          onMouseLeave: hoverOff,
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: toggleAllCards
        }, everyOpen === true || bulkBusy === true ? t("expand.collapse") : t("expand.expand")) : null
      );

      return h("div", { "data-doc-ledger-root": "1", style: S.root, onClick: function () { if (menu !== null) setMenu(null); } },
        header,
        summaryLine,
        notice,
        filterBar,
        extRow,
        backBar,
        h("div", { ref: listRef, style: S.list, onScroll: onListScroll }, body),
        h(Menu, { menu: menu, onPick: act, onClose: function () { setMenu(null); } }),
        renderModal(),
        toast === null ? null : h("div", {
          style: Object.assign({}, S.toast, toast.kind === "error" ? S.toastError : S.toastOk),
          role: "status",
          "aria-live": "polite",
          title: t("toast.close"),
          onClick: function () { setToast(null); }
        }, (toast.kind === "error" ? "! " : "✓ ") + toast.text)
      );
    }

    function TabTitle() {
      try {
        return react.createElement("span", null, t("tab.title"));
      } catch (error) {
        return null;
      }
    }

    function apply(ctx) {
      report("apply", "enter");
      try {
        return applyInner(ctx);
      } catch (error) {
        report("apply-error", (error && error.stack) || error);
        throw error;
      }
    }

    /**
     * Turn on the client diagnostics channel when the plugin runs with `debug: true`.
     *
     * `report()` gates on `window.__DOC_LEDGER_DEBUG__`, but nothing in the bundle can read the
     * host config: the client is evaluated in the browser against a Loader entry it cannot see.
     * Before this, all seventeen report() call sites were dead and the host's client log only
     * ever held stale lines. The host now answers `/api/config`, and this is the one place that
     * sets the flag, early enough for the startup reports that follow.
     *
     * Fire-and-forget on purpose: diagnostics must not delay (or be able to block) mounting.
     */
    function enableDiagnostics() {
      if (typeof window === "undefined" || typeof fetch !== "function") return;
      try {
        fetch(BASE + "/api/config").then(function (response) {
          return response.ok ? response.json() : null;
        }).then(function (payload) {
          var data = payload && payload.data ? payload.data : null;
          // Resolves the queue either way: true flushes it, false discards it. Leaving the
          // flag undefined would keep buffering forever.
          reportEnable(data !== null && data.debug === true);
        }).catch(function () {
          /* a missing endpoint only costs the diagnostics channel */
          reportEnable(false);
        });
      } catch (error) {
        /* diagnostics must never break apply */
      }
    }

    function applyInner(ctx) {
      enableDiagnostics();
      // Install the host translator BEFORE any dictionary registration / render, so
      // evaluation-time constants (category labels, sort labels) and TabTitle all see it.
      setFallback({ zh: zh, en: en });
      setTranslator(ctx.locale.bind(NS), readActiveLocale(ctx));
      // Follow the host's appearance. DSH marks the scheme on <html>/<body> and emits
      // `theme/change`; the CSS variables the palette reads update by themselves, and this
      // listener repaints the panel so a derived value cannot lag behind.
      ctx.effect(function () {
        if (typeof ctx.on !== "function") return undefined;
        return ctx.on("theme/change", function () {
          try {
            report("theme-change", JSON.stringify({ dark: readDarkScheme() }));
            refreshStyles();
          } catch (error) {
            report("theme-change-error", String((error && error.message) || error));
          }
        });
      }, "doc-ledger: theme change");

      // A user can also flip the OS scheme while DSH follows `system`; that never emits
      // theme/change, so the media query is watched as well.
      ctx.effect(function () {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
        var query = window.matchMedia("(prefers-color-scheme: dark)");
        var onChange = function () {
          try { refreshStyles(); } catch (error) { /* repaint is best effort */ }
        };
        if (typeof query.addEventListener === "function") {
          query.addEventListener("change", onChange);
          return function () { query.removeEventListener("change", onChange); };
        }
        return undefined;
      }, "doc-ledger: os scheme change");

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "doc-ledger: dictionaries");

      // Follow language switches at runtime. Registering dictionaries does NOT emit
      // locale/change (boot does that once per package), so listening here only reacts to a
      // real switch; Intl.PluralRules is rebuilt for the new tag on the next t() call.
      ctx.effect(function () {
        if (typeof ctx.on !== "function") return undefined;
        return ctx.on("locale/change", function (snapshot) {
          try {
            var next = snapshot !== null && typeof snapshot === "object" ? snapshot.active : snapshot;
            setTranslator(ctx.locale.bind(NS), typeof next === "string" ? next : readActiveLocale(ctx));
          } catch (error) {
            report("locale-change-error", (error && error.message) || error);
          }
        });
      }, "doc-ledger: locale change");

      function registerTab() {
        var base = { id: TAB_ID, kind: KIND, title: function () { return t("tab.title"); } };
        var guide = {
          id: "ledger",
          order: 20,
          title: function () { return t("guide.title"); },
          description: function () { return t("guide.description"); }
        };
        if (tabIcon !== null) guide.icon = tabIcon;
        var attempts = [
          Object.assign({}, base, { guide: [guide] }),
          Object.assign({}, base, { guide: [guide], priority: "extension" }),
          Object.assign({}, base, { priority: "extension" }),
          base
        ];
        var lastError = null;
        for (var i = 0; i < attempts.length; i++) {
          try {
            return ctx.sidebarRightTabs.register(attempts[i]);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      }

      // `openResource` is the host's own "open this file in the document preview"
      // door; capturing the service here keeps the component free of service lookups
      // (and of the cordis guard that a bare `ctx.get` inside a render path can trip).
      try {
        hostSidebar = ctx.sidebarRight ?? null;
      } catch (error) {
        hostSidebar = null;
      }
      report("apply", "host-preview:" + (hostPreviewReady() ? "yes" : "no"));

      // Session jumping is optional: `uiWorkspace` is a host client service this plugin
      // may not have on older builds, and `ctx.inject` keeps the plugin mounted either way.
      ctx.inject(["uiWorkspace"], function (injected) {
        ctx.effect(function () {
          try {
            workspaceNav = injected.uiWorkspace ?? null;
          } catch (error) {
            workspaceNav = null;
          }
          report("apply", "session-nav:" + (canJumpToSession() ? "yes" : "no"));
          return function () { workspaceNav = null; };
        }, "doc-ledger: session nav");
      });

      ctx.effect(function () {
        report("apply", "before-tab");
        var dispose = registerTab();
        report("apply", "tab-ok");
        return dispose;
      }, "doc-ledger: tab type");

      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab", function () {
          return ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID, locale: NS }, Frame);
        });
      }, "doc-ledger: tab body");

      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab.title", function () {
          return ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_ID }, TabTitle);
        });
      }, "doc-ledger: tab title");

      ctx.inject(["shortcuts"], function (ctx) {
        ctx.effect(function () {
          try {
            return ctx.shortcuts.register({
              id: "doc-ledger.open",
              label: function () { return t("guide.title"); },
              aliases: ["documents", "doc ledger", "文档", "文档台账"],
              run: function () { ctx.sidebarRight.openTab(KIND); }
            });
          } catch (error) {
            return undefined;
          }
        }, "doc-ledger: shortcut");
      });
    }

    report("eval", "bundle-evaluated");
    exports.apply = apply;
    exports.inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];
    return module.exports;
  }
});
