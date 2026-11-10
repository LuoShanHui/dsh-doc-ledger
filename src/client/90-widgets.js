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
        placeholder: "搜索文件 / 路径 / 类型 / 会话，空格分隔多个词  (Ctrl+K)",
        "aria-label": "搜索文档路径、类型或会话",
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
    var FileRow = react.memo(function FileRow(props) {
      var file = props.file;
      var open = function () { props.onOpen(file); };
      var missing = file.exists === false;
      return react.createElement("div", {
        style: missing ? Object.assign({}, S.row, S.rowMissing) : S.row,
        // Roving tabindex: the card keeps ONE tabbable row (see SessionCard), so Tab enters
        // the list once instead of stopping on all ~900 rows of an expanded panel.
        tabIndex: props.active === true ? 0 : -1,
        // Rows of a collapsed section are not part of the roving order (index -1): without the
        // attribute they cannot be mistaken for a DOM position by focusRow().
        "data-row-index": props.index >= 0 ? props.index : undefined,
        role: "button",
        "aria-label": file.name + (missing ? "（文件已不存在）" : "") + "，回车打开预览，Shift+回车快速查看，Shift+F10 打开菜单",
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
        title: file.path + (missing ? "（文件已不存在）" : "")
      },
        react.createElement("span", { style: Object.assign({}, S.dot, { background: categoryColor(file.category) }) }),
        react.createElement("span", { style: S.name }, highlight(file.name, props.query)),
        missing ? react.createElement("span", { style: S.tagMissing }, "已删除") : null,
        file.sessionTitle ? react.createElement("span", { style: S.tag, title: file.sessionId }, file.sessionTitle) : null,
        react.createElement("span", { style: S.dir }, highlight(shortPath(file.rel, 34), props.query)),
        react.createElement("span", { style: S.io }, "读" + (file.reads || 0) + "/写" + (file.writes || 0)),
        react.createElement("span", { style: S.times }, "建 " + fmtTime(file.createdAt) + " · 改 " + fmtTime(file.updatedAt))
      );
    }, function (prev, next) {
      return prev.file === next.file && prev.query === next.query
        && prev.active === next.active && prev.index === next.index;
    });

    /** A visible keyboard focus ring, since inline styles cannot use :focus-visible. */
    function ringOn(event) {
      event.currentTarget.style.boxShadow = "0 0 0 2px rgba(79,124,247,0.55)";
    }
    function ringOff(event) {
      event.currentTarget.style.boxShadow = "";
    }
    /**
     * Hover for the ghost actions only: the chip pills carry their own tint, and a
     * hover wash on top of it would read as a second, unrelated state.
     */
    function hoverOn(event) {
      event.currentTarget.style.background = "rgba(128,128,128,0.14)";
      event.currentTarget.style.color = "inherit";
    }
    function hoverOff(event) {
      event.currentTarget.style.background = "transparent";
      event.currentTarget.style.color = "rgba(118,118,126,0.98)";
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

