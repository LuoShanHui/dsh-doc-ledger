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

