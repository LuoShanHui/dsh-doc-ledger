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
      // The same predicate the frame uses, so the rows and the counts can never disagree.
      var matchesQuery = function (file) {
        return rowPasses(file, {
          deletedOnly: props.deletedOnly,
          typeSet: props.typeSet,
          extFilter: props.extFilter,
          query: props.query
        });
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
        style: S.card,
        "data-card": props.sessionId,
        // Focus (keyboard or click) mounts the card, so Tab never lands on a blank body.
        onFocusCapture: function () { props.onMount(); }
      },
        react.createElement("div", (function () {
          // The head is a control only when clicking it does something. The grid preset keeps the
          // merged card's head deliberately inert, and an inert head must not advertise itself as a
          // button: it measured role=button, tabIndex=0, aria-expanded=true, with a click that had
          // no effect — a focusable control that lies about what it does. Right-click still opens
          // the session menu in both cases.
          var head = {
            style: S.cardHead,
            onContextMenu: function (event) {
              // Right-click on the header is the session menu; the rows keep their own.
              event.preventDefault();
              event.stopPropagation();
              if (typeof props.onSessionMenu === "function") props.onSessionMenu(event, session);
            }
          };
          if (props.headInert !== true) {
            head.role = "button";
            head.tabIndex = 0;
            head["aria-expanded"] = props.open === true;
            head["aria-label"] = (session.title || session.sessionId) + t("section.cardAria");
            head.onFocus = ringOn;
            head.onBlur = ringOff;
            head.onClick = function () { props.onToggleCard(props.sessionId); };
            head.onKeyDown = onActivate(function () { props.onToggleCard(props.sessionId); });
          }
          return head;
        })(),
          // The accent rail is a real element, not a border or an inset shadow: both of those
          // were clipped by the card's 14px radius plus overflow:hidden and never appeared.
          S.cardRail ? react.createElement("span", { style: S.cardRail, "aria-hidden": "true" }) : null,
          react.createElement("span", { style: S.cardTitle, title: session.title },
            (props.headInert === true ? "" : (props.open ? "▾ " : "▸ ")) + (session.title || session.sessionId)),
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
      // Every prop that changes what this card *does* has to be compared, not only the ones that
      // change what it looks like. `entered` and `headInert` were missing, and so was
      // `onToggleCard` — which is the prop that decides whether a click enters the session or
      // collapses the card. React reuses the element by `key`, so leaving the board after entering
      // a session reused that session's element with its entered-mode handler still attached: the
      // comparator saw "no change", skipped the update, and the card could never be entered again.
      // `index` is compared because `onMount` closes over it (comparing the closure itself would
      // defeat memoisation for every card).
      return prev.session === next.session
        && prev.sessionId === next.sessionId
        && prev.index === next.index
        && prev.entered === next.entered
        && prev.headInert === next.headInert
        && prev.onToggleCard === next.onToggleCard
        && prev.extFilter === next.extFilter
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

    /**
     * The type picker: a two-level tree in one popup.
     *
     * Why a popup rather than rows of chips: on a real ledger one extension dominates (`.java` was
     * 46% of 2262 files and 81% of its family), so an always-visible second row spent its width on
     * one-to-three-file chips, and five of nine families had exactly one extension — a second level
     * with nothing to choose. A tree shows the hierarchy once, expands only where there is a choice,
     * and costs no height in the toolbar.
     *
     * It is a controlled multi-select: rows stay open while ticking, because narrowing by type is
     * usually several clicks in a row, and closing after each one would force a re-open every time.
     */
    function TypePanel(props) {
      var h = react.createElement;
      useStyles();
      var boxRef = react.useRef(null);
      var open = props.panel !== null && props.panel !== undefined;
      // Expanded families are owned by the frame, so closing and reopening the panel does not
      // collapse what the reader had opened.
      var expanded = props.panel && props.panel.expanded ? props.panel.expanded : {};
      var toggleFamily = function (key) {
        if (props.panel && typeof props.panel.onToggleFamily === "function") {
          props.panel.onToggleFamily(key);
        }
      };

      react.useEffect(function () {
        if (open !== true) return undefined;
        var box = boxRef.current;
        if (box !== null) {
          var first = box.querySelector("[data-type-row='1']");
          (first !== null ? first : box).focus();
        }
        var trigger = props.panel && props.panel.returnFocus ? props.panel.returnFocus : null;
        return function () {
          if (trigger !== null && typeof trigger.focus === "function") {
            try { trigger.focus(); } catch (error) { /* the trigger may be gone after a refresh */ }
          }
        };
      }, [open]);

      if (open !== true) return null;
      var panel = props.panel;
      var bounds = panel.bounds || { w: 420, h: 640 };
      var top = Math.min(panel.y, Math.max(4, bounds.h - 260));
      var maxHeight = Math.max(140, bounds.h - top - 8);
      var tree = panel.tree || [];

      var renderExt = function (family, entry) {
        var on = panel.ext === entry.ext;
        var label = entry.ext === "" ? t("filter.noExt") : entry.ext;
        return h("div", {
          key: "x:" + family + ":" + entry.ext,
          style: on ? S.typeExtRowOn : S.typeExtRow,
          role: "menuitemcheckbox",
          "aria-checked": on,
          tabIndex: -1,
          "data-type-row": "1",
          onMouseEnter: function (event) { if (on !== true) event.currentTarget.style.background = S.menuHover; },
          onMouseLeave: function (event) { if (on !== true) event.currentTarget.style.background = "transparent"; },
          onClick: function (event) {
            event.stopPropagation();
            // null clears the choice; "" is the no-extension bucket and must survive as itself,
            // otherwise this row could never be un-ticked (it re-selected its own key).
            props.onPickExt(on ? null : entry.ext, family);
          }
        },
          h("span", { style: S.typeTwisty }, on ? "\u2713" : ""),
          h("span", { style: { flex: "1", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
          h("span", { style: on ? S.typeCountOn : S.typeCount }, String(entry.count))
        );
      };

      var rows = [];
      tree.forEach(function (family) {
        var on = panel.families[family.key] === true;
        var isOpen = expanded[family.key] === true;
        // Only offer a second level where there is an actual choice to make.
        var nestable = (family.exts || []).length >= 2;
        rows.push(h("div", {
          key: "f:" + family.key,
          style: on ? S.typeRowOn : S.typeRow,
          role: "menuitemcheckbox",
          "aria-checked": on,
          tabIndex: -1,
          "data-type-row": "1",
          onMouseEnter: function (event) { if (on !== true) event.currentTarget.style.background = S.menuHover; },
          onMouseLeave: function (event) { if (on !== true) event.currentTarget.style.background = "transparent"; },
          onClick: function (event) {
            event.stopPropagation();
            // The twisty has its own hit area, so expanding never changes the selection.
            if (nestable && event.target === event.currentTarget.firstChild) {
              toggleFamily(family.key);
              return;
            }
            props.onPickFamily(family.key);
          }
        },
          h("span", {
            style: Object.assign({}, S.typeTwisty, { cursor: nestable ? "pointer" : "default" }),
            onClick: function (event) {
              if (!nestable) return;
              event.stopPropagation();
              toggleFamily(family.key);
            }
          }, nestable ? (isOpen ? "\u25be" : "\u25b8") : ""),
          // A tick, not only a tinted background: the extension rows use a tick, and relying on
          // colour alone made the family's state easy to misread.
          h("span", { style: S.typeTick }, on ? "\u2713" : ""),
          h("span", { style: { flex: "1", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, categoryLabel(family.key)),
          h("span", { style: on ? S.typeCountOn : S.typeCount }, String(family.count))
        ));
        if (nestable && isOpen) {
          (family.exts || []).forEach(function (entry) { rows.push(renderExt(family.key, entry)); });
        }
      });

      return h("div", {
        ref: boxRef,
        style: Object.assign({}, S.typePanel, { left: Math.max(4, Math.min(panel.x, bounds.w - 268)) + "px", top: top + "px", maxHeight: maxHeight + "px", overflowY: "auto" }),
        role: "menu",
        "aria-label": t("filter.typePick"),
        tabIndex: -1,
        onClick: function (event) { event.stopPropagation(); }
      },
        h("div", { style: S.typePanelHead },
          h("span", { style: { flex: 1 } }, t("filter.typePick")),
          (props.active === true ? h("button", {
            type: "button",
            style: S.filterAction,
            onClick: function (event) { event.stopPropagation(); props.onClear(); }
          }, t("filter.clear")) : null)
        ),
        rows.length === 0 ? h("div", { style: S.typeEmpty }, t("filter.noTypes")) : rows,
        // The chosen extension is pinned here so it stays visible even when its family is
        // collapsed — the row it lives under can be folded away, the choice cannot be hidden.
        panel.ext !== null && panel.ext !== undefined ? h("div", { style: S.typeFooter },
          h("span", { style: { flex: "1" } }, t("filter.chosenExt")),
          h("span", { style: S.typeFooterChip }, panel.ext === "" ? t("filter.noExt") : panel.ext),
          h("button", {
            type: "button",
            style: S.typeFooterClear,
            title: t("filter.clearExt"),
            "aria-label": t("filter.clearExt"),
            onClick: function (event) { event.stopPropagation(); props.onPickExt(null); }
          }, "\u2715")
        ) : null
      );
    }

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

