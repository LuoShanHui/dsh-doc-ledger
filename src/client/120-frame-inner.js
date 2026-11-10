    function FrameInner(props) {
      var h = react.createElement;
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

      // Active type chips: an empty object means "no type filter".
      var typeSelState = react.useState(function () {
        var saved = loadPref("typeFilter", []);
        var map = {};
        if (Array.isArray(saved)) saved.forEach(function (key) { if (typeof key === "string" && key !== "") map[key] = true; });
        return map;
      });
      var typeSelection = typeSelState[0];
      var setTypeSelection = typeSelState[1];
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
          notify(note + "（" + text.length + " 字符）");
        } catch (error) {
          notify("复制失败：" + String(error), "error");
        }
      };

      var copyText = function (text, note) {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(function () {
              notify(note + "（" + text.length + " 字符）");
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
          return "文档台账 · " + (data.scope === "all" ? "全部会话" : "当前会话") +
            (data.query ? " · 搜索「" + data.query + "」" : "") +
            "\n行数 " + rows.length + " · 使用过 " + used + " · 创建 " + createdRows;
        }
        var header = format === "csv"
          ? ["会话", "文件", "相对路径", "绝对路径", "读", "写", "创建时间", "修改时间"]
          : ["会话", "文件", "相对路径", "读", "写", "创建", "修改"];
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
          title: "导出当前清单（" + count + " 行）",
          items: [
            { label: "复制清单（Markdown 表格）", action: { kind: "copyText", format: "md" } },
            { label: "复制清单（CSV）", action: { kind: "copyText", format: "csv" } },
            { label: "复制全部路径", action: { kind: "copyText", format: "paths" } },
            { sep: true },
            { label: "复制摘要", action: { kind: "copyText", format: "summary" } }
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
        if (action.kind === "copyText") {
          var text = buildExport(action.format);
          copyText(text, "已复制" + (action.format === "md" ? " Markdown" : action.format === "csv" ? " CSV" : action.format === "paths" ? "路径" : "摘要"));
          return;
        }
        if (action.kind === "copySessionName") {
          copyText(String((action.session && action.session.title) || ""), "已复制会话名称");
          return;
        }
        if (action.kind === "copySessionId") {
          copyText(String((action.session && action.session.sessionId) || ""), "已复制会话 ID");
          return;
        }
        if (action.kind === "jumpSession") {
          if (jumpToSession(action.session && action.session.sessionId)) {
            notify("已切换到「" + ((action.session && action.session.title) || "该会话") + "」");
          } else {
            notify("这个环境不支持跳转会话", "error");
          }
          return;
        }
        if (action.kind === "preview") { openDefault(file); return; }
        if (action.kind === "quick") { openPreview(file); return; }
        if (action.kind === "copy") { copyText(file.path, "已复制路径"); return; }
        var mode = action.kind === "reveal" ? "reveal" : (action.kind === "choose" ? "choose" : "open");
        var suffix = action.app ? "&app=" + encodeURIComponent(action.app) : "";
        postJson("/api/open?mode=" + mode + "&path=" + encodeURIComponent(file.path) + suffix).then(function () {
          notify(mode === "reveal" ? "已在资源管理器中定位" : (mode === "choose" ? "已打开「打开方式」对话框" : "已交给系统打开"));
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
        if (target === "modified") return "修改排序";
        return target === "created" ? "创建 / 修改排序" : "使用过排序";
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
          title: sortTitleOf(target) + " · 点当前项切方向",
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
        if (canHost) items.push({ label: "在侧边栏预览", action: { kind: "preview", file: file } });
        items.push({ label: canHost ? "快速查看" : "预览", action: { kind: "quick", file: file } });
        items.push({ sep: true });
        items.push({ label: "打开方式", labelOnly: true });
        if (list.length === 0) {
          items.push({ label: "没有找到为这个类型注册的程序", labelOnly: true });
        }
        list.forEach(function (app) {
          items.push({
            label: app.label + (app.isDefault ? "（默认）" : ""),
            iconLabel: app.label,
            iconExe: app.exe,
            action: { kind: "open", file: file, app: app.exe }
          });
        });
        items.push({ sep: true });
        items.push({ label: "选择其他程序…", action: { kind: "choose", file: file } });
        items.push({ label: "在资源管理器中显示", action: { kind: "reveal", file: file } });
        items.push({ label: "复制完整路径", action: { kind: "copy", file: file } });
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
          { label: "复制会话名称", action: { kind: "copySessionName", session: session } },
          { label: "复制会话 ID", action: { kind: "copySessionId", session: session } }
        ];
        if (canJumpToSession()) {
          items.push({ sep: true });
          items.push({ label: "跳转到这个会话", action: { kind: "jumpSession", session: session } });
          // Subagent lineage: the parent id rides on the session payload, the children are
          // whatever else is loaded and names this session as its parent.
          var parent = sessionById(session.parentSessionId);
          if (typeof session.parentSessionId === "string" && session.parentSessionId !== "") {
            items.push({
              label: parent !== null ? "跳到父会话：" + (parent.title || parent.sessionId) : "跳到父会话",
              action: { kind: "jumpSession", session: parent !== null ? parent : { sessionId: session.parentSessionId, title: session.parentSessionId } }
            });
          }
          childSessionsOf(session.sessionId).slice(0, 5).forEach(function (child) {
            items.push({
              label: "跳到子会话：" + (child.title || child.sessionId),
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

      var header = h("div", { style: S.bar },
        h("span", { style: S.title }, "文档台账"),
        h("button", { style: scope === "current" ? S.buttonOn : S.button, onClick: function () { setScope("current"); } }, "当前会话"),
        h("button", { style: scope === "all" ? S.buttonOn : S.button, onClick: function () { setScope("all"); } }, "全部会话"),
        h(SearchBox, { inputRef: searchRef, onQuery: setQuery }),
        h("button", { style: separate ? S.buttonOn : S.button, onClick: function () { setSeparate(!separate); } }, "区分会话"),
        h("button", {
          style: autoRefresh ? S.buttonOn : S.button,
          title: autoRefresh ? "每 8 秒自动刷新（预览打开时暂停），点击暂停" : "已暂停自动刷新，点击恢复",
          onClick: function () { setAutoRefresh(!autoRefresh); }
        }, autoRefresh ? "自动刷新" : "已暂停"),
        h("button", {
          style: menu !== null && menu.kind === "export" ? S.buttonOn : S.button,
          title: "导出当前清单",
          onClick: function (event) { event.stopPropagation(); openExportMenu(event); }
        }, "导出"),
        h("button", {
          style: S.button,
          onClick: function () {
            fetchScope(scope === "all" ? "all" : "current", function () { return true; }, { force: true, silent: true });
            notify("已刷新");
          }
        }, "刷新")
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
        var defaultLabel = defaultApp !== null ? defaultApp.label : "默认程序";

        // One line of context above the body. File facts come first: in a narrow window
        // the row ellipsizes, and "how big / how decoded" matters more than the counters.
        var metaBits = [];
        if (typeof preview.bytes === "number") metaBits.push(fmtBytes(preview.bytes));
        if (preview.lines > 0) metaBits.push(preview.lines + " 行");
        var decodedAs = encodingLabel(preview.encoding);
        if (decodedAs !== null) metaBits.push(decodedAs);
        var known = preview.file || null;
        if (known !== null) {
          if (known.createdAt) metaBits.push("创建于 " + fmtTime(known.createdAt));
          if (known.updatedAt) metaBits.push("改于 " + fmtTime(known.updatedAt));
          var reads = known.reads || 0;
          var writes = known.writes || 0;
          if (reads > 0 || writes > 0) metaBits.push("读 " + reads + " 写 " + writes);
        }
        var previewMeta = metaBits.length === 0 ? null : h("div", { style: S.modalMeta }, metaBits.join("　·　"));

        // Truncation and undecodable bytes are shown as a notice row instead of being
        // appended to the body, where they were easy to miss and got copied along.
        var notices = [];
        if (preview.truncated === true) {
          notices.push("只显示前 " + fmtBytes(preview.shown) + "（共 " + fmtBytes(preview.bytes) + "），完整内容请用上面的按钮打开");
        }
        if (preview.replacements > 0) notices.push(preview.replacements + " 个字符无法解码");
        var previewNotice = notices.length === 0 ? null : h("div", { style: S.modalWarn }, notices.join("　·　"));

        return h("div", { style: S.modal, onClick: function () { setPreview(null); } },
          h("div", {
            ref: modalRef,
            style: S.modalBox,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "预览 " + preview.name,
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
                    title: "用 " + defaultLabel + " 打开",
                    "aria-label": "用 " + defaultLabel + " 打开",
                    onClick: function () { act({ kind: "open", file: preview, app: "" }); }
                  },
                    defaultApp !== null ? h(AppIcon, { label: defaultApp.label, exe: defaultApp.exe }) : null,
                    narrow === true ? null : h("span", null, "用 " + defaultLabel + " 打开")
                  ),
                  h("button", {
                    style: S.splitArrow,
                    title: "选择其他程序",
                    onClick: function (event) { event.stopPropagation(); setPreviewMenu(!previewMenu); }
                  }, "▾"),
                  previewMenu === true ? h("div", { style: S.dropdown },
                    previewApps.length === 0 ? h("div", { style: S.menuLabel }, "没有找到为这个类型注册的程序") : null,
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
                        h("span", { style: { flex: 1 } }, app.label + (app.isDefault ? "（默认）" : ""))
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
                    }, "选择其他程序…"),
                    h("div", {
                      style: S.menuItem,
                      role: "menuitem",
                      tabIndex: 0,
                      onFocus: ringOn,
                      onBlur: ringOff,
                      onKeyDown: onActivate(function () { setPreviewMenu(false); act({ kind: "reveal", file: preview }); }),
                      onClick: function () { setPreviewMenu(false); act({ kind: "reveal", file: preview }); }
                    }, "在资源管理器中显示")
                  ) : null
                ),
                // Escape hatch from the modal into the host's full preview (images,
                // PDFs, Office, rendered markdown) — never offered for a deleted file.
                hostPreviewReady() && preview.file !== null && preview.file !== undefined && preview.file.exists !== false ? h("button", {
                  style: S.button,
                  title: "在侧边栏的文档预览中打开（图片 / PDF / Office / Markdown 都由宿主渲染）",
                  onClick: function () {
                    if (hostPreviewOpen(preview.file, sessionId)) setPreview(null);
                  }
                }, "侧边栏") : null,
                h("button", {
                  style: S.button,
                  title: "重新读取这个文件（没变时宿主只回 304，不重传正文）",
                  onClick: refreshPreview
                }, "刷新"),
                h("button", {
                  style: S.button,
                  title: preview.truncated === true ? "复制可见内容（文件已截断）" : "复制文件内容",
                  onClick: function () { copyText(preview.text || "", "已复制内容"); }
                }, "复制"),
                h("button", { style: S.button, onClick: function () { setPreview(null); } }, "关闭")
              )
            ),
            previewMeta,
            previewNotice,
            h("pre", { ref: preRef, style: S.pre, tabIndex: 0 },
              preview.status === "loading" ? "加载中…" : (preview.text || "")),
            h("div", {
              style: Object.assign({}, S.modalFoot, { cursor: "pointer" }),
              title: preview.path + "（点击复制完整路径）",
              onClick: function () { copyText(preview.path, "已复制路径"); }
            }, preview.path + "　·　Esc 关闭")
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
        return matches(file, query);
      };
      var filterActive = query !== "" || typeSet !== null || deletedOnly === true;
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
        "会话 " + (summary.sessions || 0) + " · 使用 " + (summary.used || 0) + " · 创建 " + (summary.created || 0) + " · 读 " + (summary.reads || 0) + " 次 · 写 " + (summary.writes || 0) + " 次" +
        (filterActive ? "　·　筛选后 " + visible.files + " 个文件 / " + visible.sessions + " 个会话" : "") +
        (payload.truncated === true ? "　（仅最近 " + payload.maxSessions + " 个会话，共 " + payload.totalSessions + "）" : ""),
        payload.truncated === true && scope === "all" ? h("button", {
          type: "button",
          style: Object.assign({}, S.button, { marginLeft: "8px", padding: "1px 8px", fontSize: "11px" }),
          onClick: function () { loadEarlier(payload.maxSessions || 40); }
        }, "加载更早的会话") : null
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
      var hasVisibleRow = function (files) {
        return (files || []).some(function (file) {
          if (!passesFilters(file)) return false;
          return (file.reads || 0) > 0 || Boolean(file.firstUsedAt) || Boolean(file.createdAt) || (file.writes || 0) > 0;
        });
      };

      var cards = [];
      if (separate) {
        cards = sessions
          .filter(function (session) { return hasVisibleRow(session.files); })
          .map(function (session, index) { return h(SessionCard, cardProps(session, index)); });
      } else if (sessions.length > 0) {
        var merged = mergeSessions(sessions);
        var flatProps = cardProps({ sessionId: "__flat__", title: "全部合并（按路径去重）", files: merged });
        flatProps.usedSort = usedSort;
        flatProps.createdSort = createdSort;
        flatProps.open = cardOpen.__flat__ !== false;
        flatProps.onToggleCard = function () {
          setCardOpen(function (previous) {
            var next = Object.assign({}, previous);
            next.__flat__ = previous.__flat__ === false ? true : false;
            return next;
          });
        };
        cards = hasVisibleRow(merged) ? [h(SessionCard, flatProps)] : [];
      }

      var emptyText = missingCurrent ? "本会话还没有文档记录" : (query === "" ? "没有文档记录" : "没有同时匹配「" + query.trim().split(/\s+/).join("」「") + "」的文档");
      var placeholder = activeState.status === "error"
        ? "读取失败：" + activeState.message
        : "加载中…";
      var body = !ready
        ? h("div", { style: S.empty }, placeholder)
        : (cards.length > 0 ? cards : h("div", { style: S.empty }, emptyText));

      // One slot that is always present in the tree: offline and "served from cache" notes
      // must not shift the list to another child index (that would remount it).
      var notice = offline !== null
        ? h("div", {
          style: S.notice,
          role: "status",
          title: "后台刷新失败，显示的是上次成功的数据",
          onClick: function () {
            setOffline(null);
            fetchScope(scopeRef.current, function () { return true; }, { force: true, silent: true });
          }
        }, "刷新失败：" + offline + "　点击重试")
        : null;

      // Kept in the tree even when hidden: a new child index would remount the list.
      var showFilterBar = categoryChips.length >= 2 || (scope === "all" && separate);
      var filterBar = h("div", { style: showFilterBar ? S.filterBar : Object.assign({}, S.filterBar, { display: "none" }) },
        h("span", { style: S.filterLabel }, "类型"),
        categoryChips.map(function (chip) {
          var on = typeSet !== null && typeSet[chip.key] === true;
          return h("button", {
            key: chip.key,
            type: "button",
            style: on ? S.filterChipOn : S.filterChip,
            "aria-pressed": on,
            title: "只看 " + categoryLabel(chip.key) + "（" + chip.count + " 个文件）",
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
          title: "只看磁盘上已经不存在的文件",
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () { setDeletedOnly(function (previous) { return previous !== true; }); }
        },
          h("span", null, "已删除"),
          h("span", { style: deletedOnly === true ? S.chipCountOn : S.chipCount }, String(visible.deleted))
        ),
        // A reset is an action, not a filter: a hairline divider plus a ghost button.
        typeSet !== null || deletedOnly === true ? h("span", { style: S.filterDivider, "aria-hidden": "true" }) : null,
        typeSet !== null || deletedOnly === true ? h("button", {
          type: "button",
          style: S.filterAction,
          title: "清除类型与「已删除」筛选（搜索框里的词保留）",
          "aria-label": "清除筛选条件",
          onMouseEnter: hoverOn,
          onMouseLeave: hoverOff,
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: function () {
            setTypeSelection({});
            savePref("typeFilter", []);
            setDeletedOnly(false);
          }
        }, h("span", { style: S.filterActionGlyph, "aria-hidden": "true" }, "✕"), "清除筛选") : null,
        scope === "all" && separate ? h("button", {
          type: "button",
          style: Object.assign({}, S.filterAction, { marginLeft: "auto" }),
          title: everyOpen === true || bulkBusy === true ? "收起所有会话卡片" : "展开所有会话卡片",
          "aria-busy": bulkBusy === true,
          onMouseEnter: hoverOn,
          onMouseLeave: hoverOff,
          onFocus: ringOn,
          onBlur: ringOff,
          onClick: toggleAllCards
        }, everyOpen === true || bulkBusy === true ? "全部折叠" : "全部展开") : null
      );

      return h("div", { "data-doc-ledger-root": "1", style: S.root, onClick: function () { if (menu !== null) setMenu(null); } },
        header,
        summaryLine,
        notice,
        filterBar,
        h("div", { ref: listRef, style: S.list, onScroll: onListScroll }, body),
        h(Menu, { menu: menu, onPick: act, onClose: function () { setMenu(null); } }),
        renderModal(),
        toast === null ? null : h("div", {
          style: Object.assign({}, S.toast, toast.kind === "error" ? S.toastError : S.toastOk),
          role: "status",
          "aria-live": "polite",
          title: "点击关闭",
          onClick: function () { setToast(null); }
        }, (toast.kind === "error" ? "! " : "✓ ") + toast.text)
      );
    }

