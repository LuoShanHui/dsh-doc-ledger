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
        // The floor is 230px, measured rather than guessed: a 520px sidebar minus 20px of list
        // padding and a 10px gap leaves 490px, which fits two 240px tiles and therefore needs a
        // floor at or below 240. At 300px and 270px the grid silently collapsed to one column —
        // a list with extra steps — while 230px keeps two columns down to a ~490px panel and
        // still gives the name the tile's full width, because this theme drops the path column.
        // One card (the merged view) must span the whole row; several cards tile.
        //
        // `repeat(auto-fill, minmax(230px, 1fr))` gave every card exactly one 230px column, so the
        // merged view — which is a SINGLE card holding every session — filled one narrow strip on
        // the left and left the rest of the panel empty. `auto-fit` collapses the empty tracks, and
        // the single-card case is pinned to full width explicitly.
        list: Object.assign({}, base.list, {
          padding: "10px 10px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "10px", alignContent: "start"
        }),
        // No explicit `grid-column` here: with `auto-fit` a lone card already stretches across the
        // whole row (the empty tracks collapse), while several cards tile into columns. Forcing
        // `1 / -1` would stack every card full width and destroy the board.
        card: Object.assign({}, base.card, {
          border: "1px solid " + c.borderSoft, borderRadius: c.radius.lg,
          background: c.bg, marginBottom: "0", overflow: "hidden",
          boxShadow: c.shadowCard, alignSelf: "start"
        }),

        /**
         * An expanded card spans the whole row.
         *
         * With equal-height tiles the board reads as columns, but as soon as one card is expanded
         * it is many times taller than its neighbours: the grid keeps it in its own column, leaves
         * a tall empty gap beside it, and pushes the next card below that gap. In the reported
         * screenshot the third card had been pushed from y=201 to y=725. Spanning the row makes
         * the expanded card a full-width section with the remaining tiles continuing underneath,
         * which is what "expanding" is expected to look like.
         */
        cardOpen: { gridColumn: "1 / -1" },
        // A filled strip with the counts right-aligned: on a narrow tile the title and the meta
        // compete, so the meta is pinned to the right and never wraps.
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
        // A tile is ~245px, so the row is a two-line block:
        //   line 1  the file name (full width, ellipsised) plus the deleted marker
        //   line 2  the session this row came from, then reads/writes and the time
        // The session sits on its own line because in the merged view it is the only thing that
        // tells two identical-looking names apart, and it used to be a 10px chip squeezed
        // between the name and the counters with no room to read.
        // Two lines per row, laid out as a 3-column, 2-row grid:
        //
        //   [glyph] [name ....................] [deleted?]
        //           [session] [R/W · size] [time]
        //
        // A flex wrap could not express this: with the name at `flex: 1 1 100%` the glyph was
        // pushed onto a line of its own, so every row became three lines and a tile held six
        // files instead of ten. A grid keeps the glyph spanning both rows, which is what a list
        // with a leading icon wants.
        // Two lines, with the session chip as a leading badge on the FIRST line:
        //   row 1  glyph | [session] name ....... | deleted
        //   row 2  ....................... | R/W · size | time
        //
        // Three lines was tried and measured at 60px per row, which halves how many files a tile
        // can show — the opposite of what a board is for. Putting the chip inline before the name
        // keeps the affiliation visible while staying at 40px.
        // Two lines in a narrow tile, one line in a wide card.
        //
        // The merged view is a single full-width card, and there the two-line row wasted most of
        // its second line (only the counters and the time). At 420px and up the row collapses to a
        // single line, which doubles how many files fit on screen — the whole point of this theme.
        row: Object.assign({}, base.row, {
          display: "grid",
          gridTemplateColumns: "auto auto minmax(0, 1fr) auto auto auto",
          gridTemplateRows: "auto",
          alignItems: "center", columnGap: "8px", rowGap: "0",
          height: "30px", minHeight: "0", lineHeight: "30px",
          padding: "0 10px", borderRadius: 0,
          borderTop: "1px solid color-mix(in oklab, " + c.borderSoft + " 55%, transparent)"
        }),
        name: Object.assign({}, base.name, {
          gridColumn: "3", gridRow: "1", maxWidth: "none", minWidth: 0,
          fontSize: "12px", fontWeight: 600
        }),
        dir: Object.assign({}, base.dir, { display: "none", gridColumn: "1", gridRow: "1" }),
        // The glyph is the first cell; keep it centred across the three text lines.
        dot: Object.assign({}, base.dot, { gridColumn: "1", gridRow: "1" }),
        // The session tag becomes a real label: filled, tinted, and the first thing on line 2.
        // Row 2, left: the session this file came from. Spanning the name and counter columns
        // keeps it from being clipped by them when the title is long.
        // The session chip leads line 1, right before the name: a coloured badge is easier to
        // scan down a tile than a suffix, and it cannot collide with the counters on line 2.
        // One row: glyph | session | name (flexible) | deleted | counters | time.
        tag: {
          gridColumn: "2", gridRow: "1", justifySelf: "start",
          padding: "0 5px", borderRadius: "3px", background: c.accentSoft, color: c.accent,
          whiteSpace: "nowrap", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis",
          fontSize: "10px", lineHeight: "15px", fontWeight: 600
        },
        // The deleted marker needs a fixed column. Without one it participates in auto-placement,
        // so rows that carry it push the name and the counters one column to the right — which is
        // exactly what made half the rows look misaligned.
        tagMissing: Object.assign({}, base.tagMissing, { gridColumn: "4", gridRow: "1", justifySelf: "end" }),
        io: Object.assign({}, base.io, {
          gridColumn: "5", gridRow: "1", justifySelf: "end",
          fontSize: "10px", minWidth: "auto", textAlign: "right"
        }),
        times: Object.assign({}, base.times, {
          gridColumn: "6", gridRow: "1", justifySelf: "end",
          fontSize: "10px", minWidth: "auto", textAlign: "right"
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
