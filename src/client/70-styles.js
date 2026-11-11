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
     * Host theme tokens, spelled exactly as the Theme provider declares them (checked with
     * cordis_inspect_query → client/Theme/listTokens). These are the ONLY names that exist:
     * `--dsw-alias-accent`, `--dsw-alias-border` and `--dsw-alias-label-tertiary` are not
     * real tokens, so using them silently fell back to a light-mode literal and the panel
     * ignored dark mode entirely.
     *
     * Every token is declared light+dark by the host, so a single `var(...)` follows the
     * active theme. The literal fallback only matters outside the host (harness, static
     * report), where it provides a readable light scheme.
     */
    var TOKEN = {
      text: "var(--dsw-alias-label-primary, #1f2329)",
      textDim: "var(--dsw-alias-label-secondary, rgba(128,128,128,0.95))",
      // No tertiary label token exists; the secondary colour at reduced weight is the
      // closest honest equivalent.
      textFaint: "var(--dsw-alias-label-secondary, rgba(128,128,128,0.95))",
      bg: "var(--dsw-alias-bg-layer-1, #ffffff)",
      bgSoft: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.07))",
      bgBase: "var(--dsw-alias-bg-base, #ffffff)",
      bgOverlay: "var(--dsw-alias-bg-overlay, #ffffff)",
      border: "var(--dsw-alias-border-l1, rgba(128,128,128,0.28))",
      borderStrong: "var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
      accent: "var(--dsw-alias-brand-primary, #4f7cf7)",
      danger: "var(--dsw-alias-state-error-primary, #b91c1c)",
      success: "var(--dsw-alias-state-success-primary, #15805b)",
      warn: "var(--dsw-alias-state-warn-primary, #b06c10)",
      idle: "var(--dsw-alias-state-idle-primary, rgba(128,128,128,0.9))",
      sidebarFill: "var(--dsw-specific-sidebar-fill, rgba(128,128,128,0.04))"
    };

    var ACCENT = TOKEN.accent;

    function palette() {
      return {
        text: TOKEN.text,
        textDim: TOKEN.textDim,
        textFaint: TOKEN.textFaint,
        bg: TOKEN.bg,
        bgSoft: TOKEN.bgSoft,
        bgBase: TOKEN.bgBase,
        bgOverlay: TOKEN.bgOverlay,
        border: TOKEN.border,
        borderStrong: TOKEN.borderStrong,
        // A 16% hairline: the token itself is a solid colour, so the soft variant is built
        // from it rather than invented as an rgba literal that dark mode cannot follow.
        borderSoft: "color-mix(in srgb, " + TOKEN.border + " 55%, transparent)",
        accent: TOKEN.accent,
        accentSoft: "color-mix(in srgb, " + TOKEN.accent + " 14%, transparent)",
        accentBorder: "color-mix(in srgb, " + TOKEN.accent + " 72%, transparent)",
        danger: TOKEN.danger,
        dangerSoft: "color-mix(in srgb, " + TOKEN.danger + " 16%, transparent)",
        success: TOKEN.success,
        warn: TOKEN.warn,
        warnSoft: "color-mix(in srgb, " + TOKEN.warn + " 14%, transparent)",
        mark: "color-mix(in srgb, #facc15 45%, transparent)",
        // Structural shades: hairlines, scrims and shadows are also colour decisions, so
        // they belong in the palette instead of being literals the dark theme cannot see.
        hairline: "color-mix(in srgb, " + TOKEN.border + " 40%, transparent)",
        warnBorder: "color-mix(in srgb, " + TOKEN.warn + " 30%, transparent)",
        scrim: "rgba(0,0,0,0.55)",
        shadowMenu: "0 8px 24px rgba(0,0,0,0.28)",
        shadowToast: "0 4px 14px rgba(0,0,0,0.22)",
        shadowCard: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
        // Text drawn on a solid accent/success/error fill: fixed white in both schemes,
        // because the fill itself is the contrast anchor.
        onAccent: "#ffffff"
      };
    }

    function compactStyles() {
      var c = palette();
      return {
        root: { display: "flex", flexDirection: "column", height: "100%", minHeight: "320px", fontSize: "12px", color: c.text, background: c.bg, overflow: "hidden", position: "relative" },
        bar: { display: "flex", flexDirection: "column", gap: "6px", padding: "8px 10px", borderBottom: "1px solid " + c.borderSoft },
        // One row of the toolbar. It must be able to shrink (minWidth 0) and wrap, so the
        // last button never lands outside the panel: at 380px a single flat row pushed
        // "Theme" past the right edge and it was only half clickable.
        barRow: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minWidth: 0 },
        // Buttons may shrink and their labels stay on one line: without flexShrink a row
        // whose natural width exceeds the panel simply overflows to the right (measured:
        // "Theme" ended 6 px past a 380 px viewport, half outside the clickable area).
        buttonBase: { minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        title: { fontWeight: 600, fontSize: "13px", marginRight: "4px" },
        input: { flex: "1 1 120px", minWidth: "90px", padding: "4px 8px", borderRadius: "6px", border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px" },
        button: { padding: "3px 9px", borderRadius: "6px", border: "1px solid " + c.border, background: "transparent", color: c.text, fontSize: "12px", cursor: "pointer", minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        buttonOn: { padding: "3px 9px", borderRadius: "6px", border: "1px solid " + c.accentBorder, background: c.accentSoft, color: c.accent, fontWeight: 600, fontSize: "12px", cursor: "pointer", minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        summary: { padding: "6px 10px", color: c.textDim, borderBottom: "1px solid " + c.borderSoft },
        notice: { padding: "5px 10px", fontSize: "11px", color: c.warn, borderBottom: "1px solid " + c.borderSoft, cursor: "pointer" },
        list: { flex: 1, overflowY: "auto", padding: "6px 8px 16px" },
        card: { border: "1px solid " + c.borderSoft, borderRadius: "8px", marginBottom: "8px", overflow: "hidden", background: c.bg },
        cardHead: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", cursor: "pointer", background: c.bgSoft },
        cardTitle: { fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        cardMeta: { color: c.textDim, whiteSpace: "nowrap" },
        sectionHead: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 9px 3px", color: c.textDim, fontWeight: 600, userSelect: "none" },
        sectionTitle: { cursor: "pointer", flex: 1, background: "transparent", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", fontWeight: 600 },
        sortChip: { display: "inline-flex", alignItems: "baseline", gap: "3px", padding: "2px 8px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: c.bgSoft, cursor: "pointer", fontWeight: 400, whiteSpace: "nowrap", color: c.textDim, fontSize: "11px", lineHeight: "16px", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        row: { display: "flex", alignItems: "center", gap: "8px", padding: "3px 9px", cursor: "pointer", borderTop: "1px solid " + c.hairline, minWidth: 0, overflow: "hidden" },
        rowAlt: { background: "transparent" },
        rowMissing: { opacity: 0.55 },
        mark: { background: c.mark, color: "inherit", borderRadius: "2px", padding: "0 1px" },
        tagMissing: { padding: "0 5px", borderRadius: "4px", background: c.dangerSoft, color: c.danger, whiteSpace: "nowrap", flex: "0 0 auto" },
        filterBar: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderBottom: "1px solid " + c.borderSoft, flexWrap: "wrap" },
        filterLabel: { color: c.textDim, fontSize: "11px", marginRight: "1px" },
        filterChip: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid " + c.borderSoft, background: c.bgSoft, color: c.text, fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        filterChipOn: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid " + c.accentBorder, background: c.accentSoft, color: c.accent, fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
        chipCount: { color: c.textDim, fontSize: "10px", fontVariantNumeric: "tabular-nums" },
        chipCountOn: { color: c.accent, fontSize: "10px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
        filterDivider: { width: "1px", height: "12px", background: c.borderSoft, flex: "0 0 auto", margin: "0 1px" },
        filterAction: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", border: "none", borderRadius: "5px", background: "transparent", color: c.textDim, fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, color 120ms ease" },
        filterActionGlyph: { fontSize: "10px", lineHeight: "16px", opacity: 0.75 },
        moreRow: { padding: "5px 9px", cursor: "pointer", color: c.accent, borderTop: "1px solid " + c.hairline, textAlign: "center" },
        dot: { width: "7px", height: "7px", borderRadius: "2px", flex: "0 0 auto" },
        // Tier-C file badge: a small rounded square with the extension on a per-type tint.
        // It sits under the tier-B image, so it doubles as the loading placeholder.
        fileBadge: { display: "inline-block", flex: "0 0 auto", borderRadius: "3px", color: c.onAccent, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.02em", overflow: "hidden" },
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
        modal: { position: "fixed", inset: 0, background: c.scrim, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "24px" },
        modalBox: { background: c.bg, color: "inherit", borderRadius: "10px", width: "min(900px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "visible", border: "1px solid " + c.border },
        modalHead: { display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", minWidth: 0, flex: "0 0 auto", borderBottom: "1px solid " + c.borderSoft },
        pre: { margin: 0, padding: "10px 12px", overflow: "auto", fontSize: "12px", lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: "1 1 auto", minHeight: 0 },
        modalFoot: { padding: "6px 12px", borderTop: "1px solid " + c.borderSoft, fontSize: "11px", lineHeight: "16px", color: c.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalMeta: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: c.textDim, borderBottom: "1px solid " + c.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
        modalWarn: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: c.warn, background: c.warnSoft, borderBottom: "1px solid " + c.warnBorder, flex: "0 0 auto" },
        menu: { position: "absolute", zIndex: 80, padding: "4px", borderRadius: "8px", background: c.bg, border: "1px solid " + c.border, boxShadow: c.shadowMenu },
        menuItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" },
        menuLabel: { padding: "4px 10px 2px", color: c.textDim, fontSize: "11px" },
        menuSep: { height: "1px", margin: "4px 2px", background: c.borderSoft },
        menuPath: { padding: "4px 10px 6px", color: c.textDim, fontSize: "11px", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        appIcon: { position: "relative", width: "16px", height: "16px", flex: "0 0 auto", display: "inline-block" },
        headActions: { display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" },
        split: { position: "relative", display: "flex", alignItems: "stretch" },
        splitMain: { display: "flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "6px 0 0 6px", border: "1px solid " + c.border, background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
        splitArrow: { padding: "3px 6px", borderRadius: "0 6px 6px 0", border: "1px solid " + c.border, borderLeft: "none", background: "transparent", color: "inherit", fontSize: "10px", cursor: "pointer" },
        dropdown: { position: "absolute", right: 0, top: "calc(100% + 6px)", width: "230px", maxHeight: "280px", overflowY: "auto", padding: "4px", borderRadius: "8px", background: c.bg, border: "1px solid " + c.border, boxShadow: c.shadowMenu, zIndex: 85 },
        // Semantic colors for the imperative handlers (focus ring, ghost hover). They live
        // in the table so a theme can retune them, and so no handler ever holds a literal:
        // a hardcoded grey on hoverOff painted dark text on a dark theme.
        focusRing: "color-mix(in srgb, " + TOKEN.accent + " 55%, transparent)",
        hoverWash: "color-mix(in srgb, " + TOKEN.textDim + " 14%, transparent)",
        ghostLabel: TOKEN.textDim,
        menuHover: "color-mix(in srgb, " + TOKEN.textDim + " 16%, transparent)",
        checkMark: TOKEN.accent,
        toast: { position: "absolute", left: "12px", right: "12px", bottom: "12px", padding: "8px 10px", borderRadius: "8px", color: c.onAccent, fontSize: "12px", zIndex: 70, wordBreak: "break-word", boxShadow: c.shadowToast },
        toastOk: { background: c.success, color: c.onAccent },
        toastError: { background: c.danger, color: c.onAccent }
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
     * "table": real columns and zebra stripes — the data-dense reading of a ledger.
     * Rows alternate a faint background, the name column is monospace, every number is
     * right-aligned, and headings are uppercase. This is deliberately NOT "compact with
     * a different radius": the alternation and the monospace are what make it a table.
     */
    function tableStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "12px" }),
        bar: Object.assign({}, base.bar, { padding: "8px 10px", gap: "6px" }),
        list: Object.assign({}, base.list, { padding: "0 6px 16px" }),
        card: Object.assign({}, base.card, { borderRadius: "2px", border: "1px solid " + c.border, marginBottom: "6px" }),
        cardHead: Object.assign({}, base.cardHead, { padding: "5px 8px", borderRadius: 0 }),
        sectionHead: Object.assign({}, base.sectionHead, {
          padding: "5px 8px 2px", fontFamily: "ui-monospace, Consolas, monospace",
          fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em",
          borderBottom: "1px solid " + c.border
        }),
        row: Object.assign({}, base.row, { padding: "3px 8px", gap: "8px", borderRadius: 0 }),
        rowAlt: { background: "color-mix(in srgb, " + c.textDim + " 6%, transparent)" },
        name: Object.assign({}, base.name, {
          maxWidth: "38%", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "11px", fontWeight: 600
        }),
        dir: Object.assign({}, base.dir, { fontSize: "10px", color: c.textFaint }),
        io: Object.assign({}, base.io, { fontSize: "10px", color: c.textFaint, textAlign: "right", fontVariantNumeric: "tabular-nums" }),
        times: Object.assign({}, base.times, { fontSize: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums" })
      });
    }

    /**
     * "card": floating panels over a tinted backdrop, with the accent carried by the card
     * itself. Rows inside a card are indistinguishable from "airy" except that the card
     * floats and the list has gutters — so the card head gets an accent bar and a much
     * larger radius, which is what actually reads as a different system.
     */
    function cardStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "13px", background: c.bgSoft, gap: "2px" }),
        bar: Object.assign({}, base.bar, { padding: "12px 14px", gap: "8px", borderBottom: "none", background: c.bg }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { padding: "6px 10px", borderRadius: "10px", background: c.bgSoft, border: "1px solid transparent" }),
        button: Object.assign({}, base.button, { padding: "4px 10px", borderRadius: "10px", background: c.bgSoft, border: "1px solid transparent" }),
        buttonOn: Object.assign({}, base.buttonOn, { padding: "4px 10px", borderRadius: "10px" }),
        summary: Object.assign({}, base.summary, { padding: "8px 14px", borderBottom: "none" }),
        notice: Object.assign({}, base.notice, { padding: "7px 14px", borderBottom: "none" }),
        list: Object.assign({}, base.list, { padding: "12px 12px 20px" }),
        // The card floats: bigger radius plus a real shadow, and an accent rail on the head.
        card: Object.assign({}, base.card, {
          border: "none", borderRadius: "16px", marginBottom: "14px",
          boxShadow: c.shadowCard,
          background: c.bg, overflow: "visible"
        }),
        cardHead: Object.assign({}, base.cardHead, {
          padding: "10px 14px 10px 16px", background: "transparent",
          borderRadius: "16px 16px 0 0",
          borderLeft: "3px solid " + c.accent
        }),
        sectionHead: Object.assign({}, base.sectionHead, { padding: "10px 14px 4px" }),
        filterBar: Object.assign({}, base.filterBar, { padding: "8px 14px", borderBottom: "none", gap: "8px" }),
        filterChip: Object.assign({}, base.filterChip, { padding: "3px 10px", background: c.bg }),
        filterChipOn: Object.assign({}, base.filterChipOn, { padding: "3px 10px" }),
        row: Object.assign({}, base.row, { borderTop: "none", padding: "5px 14px" }),
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
