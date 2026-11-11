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
        borderSoft: "color-mix(in oklab, " + TOKEN.border + " 55%, transparent)",
        accent: TOKEN.accent,
        accentSoft: "color-mix(in oklab, " + TOKEN.accent + " 14%, transparent)",
        accentBorder: "color-mix(in oklab, " + TOKEN.accent + " 72%, transparent)",
        danger: TOKEN.danger,
        dangerSoft: "color-mix(in oklab, " + TOKEN.danger + " 16%, transparent)",
        success: TOKEN.success,
        warn: TOKEN.warn,
        warnSoft: "color-mix(in oklab, " + TOKEN.warn + " 14%, transparent)",
        mark: "color-mix(in oklab, #facc15 45%, transparent)",
        // A 5-step radius scale (shadcn derives all of these from one --radius), so a theme
        // picks a step instead of inventing a number per box.
        radius: { sm: "4px", md: "6px", lg: "8px", xl: "10px", xxl: "14px" },
        // Selection/fill for dense rows: a muted wash, not a border.
        rowHover: "color-mix(in oklab, " + TOKEN.accent + " 8%, transparent)",
        // Structural shades: hairlines, scrims and shadows are also colour decisions, so
        // they belong in the palette instead of being literals the dark theme cannot see.
        hairline: "color-mix(in oklab, " + TOKEN.border + " 40%, transparent)",
        warnBorder: "color-mix(in oklab, " + TOKEN.warn + " 30%, transparent)",
        scrim: "rgba(0,0,0,0.55)",
        shadowMenu: "0 8px 24px rgba(0,0,0,0.28)",
        shadowToast: "0 4px 14px rgba(0,0,0,0.22)",
        shadowCard: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
        // Text drawn on a solid accent/success/error fill: fixed white in both schemes,
        // because the fill itself is the contrast anchor.
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
        fileBadge: { display: "inline-block", flex: "0 0 auto", borderRadius: "3px", color: c.onAccent, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.02em", overflow: "hidden" },
        // Three tiers, and only three: name is the anchor, path is context, counters are metadata.
        name: { fontWeight: 500, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "46%", flex: "0 1 auto", minWidth: 0 },
        dir: { color: c.textFaint, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 0", minWidth: 0 },
        io: { color: c.textFaint, whiteSpace: "nowrap", flex: "0 0 auto", fontSize: "10px", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "32px" },
        times: { color: c.textFaint, whiteSpace: "nowrap", flex: "0 0 auto", fontVariantNumeric: "tabular-nums", fontSize: "10px", textAlign: "right", minWidth: "70px" },
        tag: { padding: "0 5px", borderRadius: "3px", background: c.accentSoft, color: c.accent, whiteSpace: "nowrap", maxWidth: "88px", overflow: "hidden", textOverflow: "ellipsis", flex: "0 0 auto", fontSize: "10px" },
        empty: { padding: "24px 12px", textAlign: "center", color: c.textFaint, fontSize: "12px" },
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
    function airyStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "13px" }),
        bar: Object.assign({}, base.bar, { gap: "6px", padding: "10px 12px", borderBottom: "none" }),
        barRow: Object.assign({}, base.barRow, { gap: "6px" }),
        title: Object.assign({}, base.title, { fontWeight: 700, fontSize: "14px" }),
        input: Object.assign({}, base.input, { height: "26px", padding: "0 9px", borderRadius: c.radius.lg, border: "1px solid transparent", background: c.bgSoft }),
        button: Object.assign({}, base.button, { height: "26px", padding: "0 10px", borderRadius: c.radius.lg, background: "transparent" }),
        buttonOn: Object.assign({}, base.buttonOn, { height: "26px", padding: "0 10px", borderRadius: c.radius.lg }),
        summary: Object.assign({}, base.summary, { padding: "6px 12px", fontSize: "12px", borderBottom: "none" }),
        notice: Object.assign({}, base.notice, { padding: "7px 12px", borderRadius: c.radius.lg, margin: "0 8px 6px" }),
        list: Object.assign({}, base.list, { padding: "8px 10px 20px" }),
        card: Object.assign({}, base.card, { border: "none", borderRadius: c.radius.xxl, background: c.bgSoft, marginBottom: "12px" }),
        cardHead: Object.assign({}, base.cardHead, { height: "34px", padding: "0 12px", background: "transparent" }),
        cardTitle: Object.assign({}, base.cardTitle, { fontSize: "13px" }),
        sectionHead: Object.assign({}, base.sectionHead, { height: "30px", padding: "0 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: c.textFaint }),
        // Rows keep a fixed height so the list cannot shimmer, but the metric is airier.
        row: Object.assign({}, base.row, { height: "28px", lineHeight: "28px", padding: "0 12px", borderRadius: c.radius.lg }),
        filterBar: Object.assign({}, base.filterBar, { gap: "6px", padding: "6px 12px", borderBottom: "none" }),
        filterChip: Object.assign({}, base.filterChip, { height: "22px", padding: "0 10px", background: c.bgSoft, border: "1px solid transparent" }),
        filterChipOn: Object.assign({}, base.filterChipOn, { height: "22px", padding: "0 10px", border: "1px solid transparent" }),
        sortChip: Object.assign({}, base.sortChip, { height: "22px", padding: "0 9px", border: "1px solid transparent", background: c.bgSoft }),
        name: Object.assign({}, base.name, { fontWeight: 600, fontSize: "13px" }),
        dir: Object.assign({}, base.dir, { fontSize: "12px" }),
        io: Object.assign({}, base.io, { fontSize: "11px" }),
        times: Object.assign({}, base.times, { fontSize: "11px" }),
        moreRow: Object.assign({}, base.moreRow, { height: "30px", fontSize: "12px" }),
        empty: Object.assign({}, base.empty, { padding: "40px 16px", fontSize: "13px" })
      });
    }

    /**
     * "table": an actual grid. Zebra stripes replace separators, the name column is monospace
     * so paths line up, and every number is right-aligned with tabular figures — the same
     * decisions a data table makes, which is what a ledger is.
     */
    function tableStyles() {
      var c = palette();
      var base = compactStyles();
      return Object.assign({}, base, {
        root: Object.assign({}, base.root, { fontSize: "12px" }),
        bar: Object.assign({}, base.bar, { padding: "6px 8px", gap: "4px" }),
        list: Object.assign({}, base.list, { padding: "0 0 12px" }),
        card: Object.assign({}, base.card, { borderRadius: "0", border: "none", marginBottom: "10px", background: "transparent" }),
        cardHead: Object.assign({}, base.cardHead, {
          height: "26px", padding: "0 8px", borderRadius: 0, background: c.bgSoft,
          borderBottom: "1px solid " + c.border
        }),
        sectionHead: Object.assign({}, base.sectionHead, {
          height: "24px", padding: "0 8px", borderRadius: 0,
          fontFamily: "ui-monospace, Consolas, monospace", fontSize: "10px",
          textTransform: "uppercase", letterSpacing: "0.06em",
          borderBottom: "1px solid " + c.border
        }),
        row: Object.assign({}, base.row, { padding: "0 8px", gap: "8px", borderRadius: 0 }),
        rowAlt: { background: "color-mix(in oklab, " + c.textDim + " 6%, transparent)" },
        name: Object.assign({}, base.name, {
          maxWidth: "40%", fontWeight: 600, fontSize: "11px",
          fontFamily: "ui-monospace, Consolas, monospace"
        }),
        dir: Object.assign({}, base.dir, { fontSize: "10px" }),
        io: Object.assign({}, base.io, { fontSize: "10px", textAlign: "right", minWidth: "34px" }),
        times: Object.assign({}, base.times, { fontSize: "10px", textAlign: "right", minWidth: "72px" })
      });
    }

    /**
     * "card": surfaces that float. A tinted backdrop with white cards on it, a 3px accent rail
     * on each card head, and much larger radii — the combination that reads as a different
     * system rather than a recolour of the dense one.
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
        // The rail is what makes a card a card: 3px of accent down the head's left edge.
        card: Object.assign({}, base.card, {
          border: "none", borderRadius: c.radius.xxl, marginBottom: "12px",
          boxShadow: c.shadowCard, background: c.bg, overflow: "hidden"
        }),
        cardHead: Object.assign({}, base.cardHead, {
          height: "36px", padding: "0 12px", background: "transparent",
          borderLeft: "3px solid " + c.accent
        }),
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
