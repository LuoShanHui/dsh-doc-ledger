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
    var BUILD_TAG = "__DOC_LEDGER_BUILD__";

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
      // The entered card starts open and can be collapsed with its own header. Kept separate from
      // `cardOpen` so leaving and re-entering a session always starts expanded.
      var enteredOpenState = react.useState(true);
      var enteredOpen = enteredOpenState[0];
      var setEnteredOpen = enteredOpenState[1];

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
          setEnteredOpen(true);
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
        // Its own collapsed/expanded state, independent of the board's. Reading it through the
        // same `cardOpen` map would collide with the board entry for this session.
        enteredProps.open = enteredOpen;
        enteredProps.near = true;
        // The header collapses/expands this card only. Leaving the session has exactly one
        // affordance — the back bar above — so a click on the title never throws the reader out
        // of the session they just entered.
        enteredProps.onToggleCard = function () {
          setEnteredOpen(function (previous) { return previous !== true; });
        };
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
          // The merged card has nothing to enter, and toggling it in the grid preset is a trap:
          // its header looks like every other card's, so a reader clicks it and the whole list
          // collapses to a 35px strip. In the grid preset the merged card's header is inert;
          // the board's other presets keep the collapse.
          if (styleThemeRef.current === "grid") return;
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

