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

    var ACCENT = "var(--dsw-alias-accent, #4f7cf7)";

    function palette() {
      return {
        text: "var(--dsw-alias-label-primary, #1f2329)",
        textDim: "var(--dsw-alias-label-secondary, rgba(128,128,128,0.95))",
        textFaint: "var(--dsw-alias-label-tertiary, rgba(128,128,128,0.62))",
        bg: "var(--dsw-alias-bg-layer-1, #ffffff)",
        bgSoft: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.07))",
        border: "var(--dsw-alias-border, rgba(128,128,128,0.28))",
        borderSoft: "rgba(128,128,128,0.16)",
        accent: ACCENT,
        accentSoft: "rgba(79,124,247,0.14)",
        accentBorder: "rgba(79,124,247,0.72)",
        danger: "rgba(185,28,28,0.95)",
        dangerSoft: "rgba(185,28,28,0.16)",
        mark: "rgba(250,204,21,0.45)",
        warn: "rgba(176,108,16,0.98)",
        warnSoft: "rgba(240,180,60,0.14)"
      };
    }

    function compactStyles() {
      var c = palette();
      return {
        root: { display: "flex", flexDirection: "column", height: "100%", minHeight: "320px", fontSize: "12px", color: c.text, overflow: "hidden", position: "relative" },
        bar: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid " + c.borderSoft, flexWrap: "wrap" },
        title: { fontWeight: 600, fontSize: "13px", marginRight: "4px" },
        input: { flex: "1 1 120px", minWidth: "90px", padding: "4px 8px", borderRadius: "6px", border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px" },
        button: { padding: "3px 9px", borderRadius: "6px", border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer" },
        buttonOn: { padding: "3px 9px", borderRadius: "6px", border: "1px solid " + c.accentBorder, background: c.accentSoft, color: "inherit", fontSize: "12px", cursor: "pointer" },
        summary: { padding: "6px 10px", color: c.textDim, borderBottom: "1px solid " + c.borderSoft },
        notice: { padding: "5px 10px", fontSize: "11px", color: c.warn, borderBottom: "1px solid " + c.borderSoft, cursor: "pointer" },
        list: { flex: 1, overflowY: "auto", padding: "6px 8px 16px" },
        card: { border: "1px solid " + c.borderSoft, borderRadius: "8px", marginBottom: "8px", overflow: "hidden", background: c.bg },
        cardHead: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", cursor: "pointer", background: c.bgSoft },
        cardTitle: { fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        cardMeta: { color: c.textDim, whiteSpace: "nowrap" },
        sectionHead: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 9px 3px", color: c.textDim, fontWeight: 600, userSelect: "none" },
        sectionTitle: { cursor: "pointer", flex: 1, background: "transparent", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", fontWeight: 600 },
        sortChip: { display: "inline-flex", alignItems: "baseline", gap: "3px", padding: "2px 8px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: c.bgSoft, cursor: "pointer", fontWeight: 400, whiteSpace: "nowrap", color: "inherit", fontSize: "11px", lineHeight: "16px", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        row: { display: "flex", alignItems: "center", gap: "8px", padding: "3px 9px", cursor: "pointer", borderTop: "1px solid rgba(128,128,128,0.1)", minWidth: 0, overflow: "hidden" },
        rowMissing: { opacity: 0.55 },
        mark: { background: c.mark, color: "inherit", borderRadius: "2px", padding: "0 1px" },
        tagMissing: { padding: "0 5px", borderRadius: "4px", background: c.dangerSoft, color: c.danger, whiteSpace: "nowrap", flex: "0 0 auto" },
        filterBar: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderBottom: "1px solid " + c.borderSoft, flexWrap: "wrap" },
        filterLabel: { color: c.textDim, fontSize: "11px", marginRight: "1px" },
        filterChip: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: c.bgSoft, color: "inherit", fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        filterChipOn: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid " + c.accentBorder, background: c.accentSoft, color: "inherit", fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        chipCount: { color: c.textDim, fontSize: "10px", fontVariantNumeric: "tabular-nums" },
        chipCountOn: { color: c.accent, fontSize: "10px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
        filterDivider: { width: "1px", height: "12px", background: c.borderSoft, flex: "0 0 auto", margin: "0 1px" },
        filterAction: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", border: "none", borderRadius: "5px", background: "transparent", color: c.textDim, fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, color 120ms ease" },
        filterActionGlyph: { fontSize: "10px", lineHeight: "16px", opacity: 0.75 },
        moreRow: { padding: "5px 9px", cursor: "pointer", color: c.accent, borderTop: "1px solid rgba(128,128,128,0.1)", textAlign: "center" },
        dot: { width: "7px", height: "7px", borderRadius: "2px", flex: "0 0 auto" },
        // Three visual tiers, and only three: the file name is the anchor (100% + semibold),
        // the path is context (faint, 11px, allowed to shrink to nothing), the counters are
        // metadata (dim, tabular). Before this every cell was the same grey at the same size,
        // which read as a wall of text with no place for the eye to land.
        name: { fontWeight: 600, color: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "42%", flex: "0 1 auto" },
        // A fixed, right-aligned time column is what makes a list scannable: with the width
        // left to the text, every row's stamp started at a different x and the column read
        // as noise. 74px fits "MM-DD HH:MM" at 11px with tabular figures.
        dir: { color: c.textFaint, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 0", minWidth: 0 },
        io: { color: c.textFaint, whiteSpace: "nowrap", flex: "0 0 auto", fontSize: "11px", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "34px" },
        times: { color: c.textDim, whiteSpace: "nowrap", flex: "0 0 auto", fontVariantNumeric: "tabular-nums", fontSize: "11px", textAlign: "right", minWidth: "72px" },
        tag: { padding: "0 5px", borderRadius: "4px", background: c.accentSoft, color: c.accent, whiteSpace: "nowrap", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", flex: "0 0 auto" },
        empty: { padding: "24px 12px", textAlign: "center", color: c.textDim },
        modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "24px" },
        modalBox: { background: c.bg, color: "inherit", borderRadius: "10px", width: "min(900px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "visible", border: "1px solid " + c.border },
        modalHead: { display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", minWidth: 0, flex: "0 0 auto", borderBottom: "1px solid " + c.borderSoft },
        pre: { margin: 0, padding: "10px 12px", overflow: "auto", fontSize: "12px", lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: "1 1 auto", minHeight: 0 },
        modalFoot: { padding: "6px 12px", borderTop: "1px solid " + c.borderSoft, fontSize: "11px", lineHeight: "16px", color: c.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalMeta: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: c.textDim, borderBottom: "1px solid " + c.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalWarn: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: c.warn, background: c.warnSoft, borderBottom: "1px solid rgba(240,180,60,0.3)", flex: "0 0 auto" },
        menu: { position: "absolute", zIndex: 80, padding: "4px", borderRadius: "8px", background: c.bg, border: "1px solid " + c.border, boxShadow: "0 8px 24px rgba(0,0,0,0.28)" },
        menuItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" },
        menuLabel: { padding: "4px 10px 2px", color: c.textDim, fontSize: "11px" },
        menuSep: { height: "1px", margin: "4px 2px", background: c.borderSoft },
        menuPath: { padding: "4px 10px 6px", color: c.textDim, fontSize: "11px", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        appIcon: { position: "relative", width: "16px", height: "16px", flex: "0 0 auto", display: "inline-block" },
        headActions: { display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" },
        split: { position: "relative", display: "flex", alignItems: "stretch" },
        splitMain: { display: "flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "6px 0 0 6px", border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
        splitArrow: { padding: "3px 6px", borderRadius: "0 6px 6px 0", border: "1px solid " + c.border, borderLeft: "none", background: "transparent", color: "inherit", fontSize: "10px", cursor: "pointer" },
        dropdown: { position: "absolute", right: 0, top: "calc(100% + 6px)", width: "230px", maxHeight: "280px", overflowY: "auto", padding: "4px", borderRadius: "8px", background: c.bg, border: "1px solid " + c.border, boxShadow: "0 8px 24px rgba(0,0,0,0.28)", zIndex: 85 },
        toast: { position: "absolute", left: "12px", right: "12px", bottom: "12px", padding: "8px 10px", borderRadius: "8px", color: "#fff", fontSize: "12px", zIndex: 70, wordBreak: "break-word", boxShadow: "0 4px 14px rgba(0,0,0,0.22)" },
        toastOk: { background: "rgba(21,128,91,0.95)" },
        toastError: { background: "rgba(178,44,44,0.95)" }
      };
    }

    /**
     * "airy": fewer hairline borders, whitespace and weight do the work.
     */
    function airyStyles() {
      var c = palette();
      var base = compactStyles();
      var row = base.row;
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "13px", gap: "2px" }),
        bar: Object.assign({}, base.bar, { padding: "12px 14px", gap: "10px", borderBottom: "none" }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { padding: "6px 10px", borderRadius: "8px", background: c.bgSoft, border: "1px solid transparent" }),
        button: Object.assign({}, base.button, { padding: "4px 10px", borderRadius: "8px", border: "1px solid transparent", background: c.bgSoft }),
        buttonOn: Object.assign({}, base.buttonOn, { padding: "4px 10px", borderRadius: "8px", border: "1px solid transparent" }),
        summary: Object.assign({}, base.summary, { padding: "8px 14px", borderBottom: "none" }),
        notice: Object.assign({}, base.notice, { padding: "7px 14px", borderBottom: "none" }),
        list: Object.assign({}, base.list, { padding: "10px 12px 20px" }),
        card: Object.assign({}, base.card, { border: "none", borderRadius: "12px", background: c.bgSoft, marginBottom: "10px" }),
        cardHead: Object.assign({}, base.cardHead, { padding: "9px 12px", background: "transparent" }),
        sectionHead: Object.assign({}, base.sectionHead, { padding: "10px 12px 4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }),
        filterBar: Object.assign({}, base.filterBar, { padding: "8px 14px", borderBottom: "none", gap: "8px" }),
        filterChip: Object.assign({}, base.filterChip, { padding: "3px 10px" }),
        filterChipOn: Object.assign({}, base.filterChipOn, { padding: "3px 10px" }),
        row: Object.assign({}, row, { borderTop: "none", padding: "5px 12px", borderRadius: "8px", margin: "1px 0" }),
        name: Object.assign({}, base.name, { fontWeight: 600 }),
        dir: Object.assign({}, base.dir, { color: c.textFaint, fontSize: "11px" }),
        io: Object.assign({}, base.io, { color: c.textFaint }),
        empty: Object.assign({}, base.empty, { padding: "32px 12px" })
      });
    }

    /**
     * "table": grid rows with zebra stripes and right-aligned tabular numbers.
     */
    function tableStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "12px" }),
        bar: Object.assign({}, base.bar, { padding: "8px 10px", gap: "6px" }),
        list: Object.assign({}, base.list, { padding: "4px 6px 16px" }),
        card: Object.assign({}, base.card, { borderRadius: "6px", border: "1px solid " + c.borderSoft }),
        cardHead: Object.assign({}, base.cardHead, { padding: "6px 9px" }),
        sectionHead: Object.assign({}, base.sectionHead, { padding: "6px 9px 2px", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "11px" }),
        row: Object.assign({}, base.row, { padding: "4px 9px", gap: "10px" }),
        name: Object.assign({}, base.name, { maxWidth: "40%", fontSize: "11px", fontWeight: 600 }),
        dir: Object.assign({}, base.dir, { fontSize: "10px", color: c.textFaint }),
        io: Object.assign({}, base.io, { fontSize: "10px", color: c.textFaint, textAlign: "right", fontVariantNumeric: "tabular-nums" }),
        times: Object.assign({}, base.times, { fontSize: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums" })
      });
    }

    /**
     * "card": floating cards with soft shadows and a per-card accent bar.
     */
    function cardStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "13px", background: c.bgSoft }),
        bar: Object.assign({}, base.bar, { padding: "12px 14px", gap: "10px", borderBottom: "none" }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { padding: "6px 10px", borderRadius: "10px", background: c.bg, border: "1px solid " + c.borderSoft }),
        button: Object.assign({}, base.button, { padding: "4px 10px", borderRadius: "10px", background: c.bg, border: "1px solid " + c.borderSoft }),
        buttonOn: Object.assign({}, base.buttonOn, { padding: "4px 10px", borderRadius: "10px" }),
        summary: Object.assign({}, base.summary, { padding: "8px 14px", borderBottom: "none", background: "transparent" }),
        notice: Object.assign({}, base.notice, { padding: "7px 14px", borderBottom: "none" }),
        list: Object.assign({}, base.list, { padding: "12px 12px 20px" }),
        card: Object.assign({}, base.card, { border: "1px solid " + c.borderSoft, borderRadius: "14px", marginBottom: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)", background: c.bg }),
        cardHead: Object.assign({}, base.cardHead, { padding: "9px 12px", background: "transparent" }),
        sectionHead: Object.assign({}, base.sectionHead, { padding: "10px 12px 4px" }),
        filterBar: Object.assign({}, base.filterBar, { padding: "8px 14px", borderBottom: "none", gap: "8px" }),
        filterChip: Object.assign({}, base.filterChip, { padding: "3px 10px", background: c.bg }),
        filterChipOn: Object.assign({}, base.filterChipOn, { padding: "3px 10px" }),
        row: Object.assign({}, base.row, { borderTop: "none", padding: "5px 12px" }),
        name: Object.assign({}, base.name, { fontWeight: 600 }),
        empty: Object.assign({}, base.empty, { padding: "32px 12px" })
      });
    }

    var STYLE_THEMES = {
      compact: compactStyles,
      airy: airyStyles,
      table: tableStyles,
      card: cardStyles
    };

    var currentTheme = "compact";
    var S = compactStyles();
    var styleListeners = new Set();

    function styleTheme() {
      return currentTheme;
    }

    function setStyleTheme(id) {
      var next = Object.prototype.hasOwnProperty.call(STYLE_THEMES, id) ? id : "compact";
      if (next === currentTheme && S !== null) return;
      currentTheme = next;
      S = STYLE_THEMES[next]();
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
