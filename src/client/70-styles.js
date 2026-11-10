    var S = {
      root: { display: "flex", flexDirection: "column", height: "100%", minHeight: "320px", fontSize: "12px", color: "var(--dsw-alias-label-primary, #1f2329)", overflow: "hidden", position: "relative" },
      bar: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid rgba(128,128,128,0.22)", flexWrap: "wrap" },
      title: { fontWeight: 600, fontSize: "13px", marginRight: "4px" },
      input: { flex: "1 1 120px", minWidth: "90px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.32)", background: "transparent", color: "inherit", fontSize: "12px" },
      button: { padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.32)", background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer" },
      buttonOn: { padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(79,124,247,0.9)", background: "rgba(79,124,247,0.14)", color: "inherit", fontSize: "12px", cursor: "pointer" },
      summary: { padding: "6px 10px", color: "rgba(128,128,128,0.95)", borderBottom: "1px solid rgba(128,128,128,0.16)" },
      notice: { padding: "5px 10px", fontSize: "11px", color: "rgba(180,83,9,0.95)", borderBottom: "1px solid rgba(128,128,128,0.16)", cursor: "pointer" },
      list: { flex: 1, overflowY: "auto", padding: "6px 8px 16px" },
      card: { border: "1px solid rgba(128,128,128,0.24)", borderRadius: "8px", marginBottom: "8px", overflow: "hidden" },
      cardHead: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", cursor: "pointer", background: "rgba(128,128,128,0.08)" },
      // minWidth 0 is what lets a flex child shrink below its text width, so the title
      // ellipsizes instead of pushing the modal head past the dialog edge.
      cardTitle: { fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      cardMeta: { color: "rgba(128,128,128,0.95)", whiteSpace: "nowrap" },
      sectionHead: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 9px 3px", color: "rgba(128,128,128,0.95)", fontWeight: 600, userSelect: "none" },
      sectionTitle: { cursor: "pointer", flex: 1, background: "transparent", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", fontWeight: 600 },
      // Same pill vocabulary as the filter chips: both are state controls, so they should
      // not be drawn in two different dialects.
      sortChip: { display: "inline-flex", alignItems: "baseline", gap: "3px", padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(128,128,128,0.24)", background: "rgba(128,128,128,0.07)", cursor: "pointer", fontWeight: 400, whiteSpace: "nowrap", color: "inherit", fontSize: "11px", lineHeight: "16px", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
      row: { display: "flex", alignItems: "center", gap: "6px", padding: "3px 9px", cursor: "pointer", borderTop: "1px solid rgba(128,128,128,0.1)" },
      rowMissing: { opacity: 0.55 },
      mark: { background: "rgba(250,204,21,0.45)", color: "inherit", borderRadius: "2px", padding: "0 1px" },
      tagMissing: { padding: "0 5px", borderRadius: "4px", background: "rgba(185,28,28,0.16)", color: "rgba(185,28,28,0.95)", whiteSpace: "nowrap", flex: "0 0 auto" },
      filterBar: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderBottom: "1px solid rgba(128,128,128,0.16)", flexWrap: "wrap" },
      filterLabel: { color: "rgba(128,128,128,0.9)", fontSize: "11px", marginRight: "1px" },
      filterChip: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid rgba(128,128,128,0.24)", background: "rgba(128,128,128,0.07)", color: "inherit", fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
      filterChipOn: { display: "inline-flex", alignItems: "baseline", gap: "4px", padding: "2px 9px", borderRadius: "999px", border: "1px solid rgba(79,124,247,0.72)", background: "rgba(79,124,247,0.16)", color: "inherit", fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, border-color 120ms ease" },
      chipCount: { color: "rgba(128,128,128,0.95)", fontSize: "10px", fontVariantNumeric: "tabular-nums" },
      chipCountOn: { color: "rgba(79,124,247,0.95)", fontSize: "10px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
      filterDivider: { width: "1px", height: "12px", background: "rgba(128,128,128,0.26)", flex: "0 0 auto", margin: "0 1px" },
      // Actions (clear filters / expand all) are deliberately NOT pills: a filtered chip
      // and a reset button must not look like the same kind of control.
      filterAction: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", border: "none", borderRadius: "5px", background: "transparent", color: "rgba(118,118,126,0.98)", fontSize: "11px", lineHeight: "16px", cursor: "pointer", whiteSpace: "nowrap", font: "inherit", transition: "background 120ms ease, color 120ms ease" },
      filterActionGlyph: { fontSize: "10px", lineHeight: "16px", opacity: 0.75 },
      moreRow: { padding: "5px 9px", cursor: "pointer", color: "rgba(79,124,247,0.95)", borderTop: "1px solid rgba(128,128,128,0.1)", textAlign: "center" },
      dot: { width: "7px", height: "7px", borderRadius: "2px", flex: "0 0 auto" },
      name: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "38%" },
      dir: { color: "rgba(128,128,128,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: "40px" },
      io: { color: "rgba(128,128,128,0.95)", whiteSpace: "nowrap", flex: "0 0 auto" },
      times: { color: "rgba(128,128,128,0.95)", whiteSpace: "nowrap", flex: "0 0 auto", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "11px" },
      tag: { padding: "0 5px", borderRadius: "4px", background: "rgba(79,124,247,0.14)", color: "rgba(79,124,247,0.95)", whiteSpace: "nowrap", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", flex: "0 0 auto" },
      empty: { padding: "24px 12px", textAlign: "center", color: "rgba(128,128,128,0.95)" },
      modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "24px" },
      modalBox: { background: "var(--dsw-alias-bg-layer-1, #ffffff)", color: "inherit", borderRadius: "10px", width: "min(900px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "visible", border: "1px solid rgba(128,128,128,0.32)" },
      // `flex: 0 0 auto` on every row is what keeps them from being squeezed: a flex
      // column with a `maxHeight` box distributes the deficit over all children, so the
      // 11px rows used to shrink below their text and clip mid-glyph while the body
      // (which should absorb everything) kept its height.
      modalHead: { display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", minWidth: 0, flex: "0 0 auto", borderBottom: "1px solid rgba(128,128,128,0.2)" },
      pre: { margin: 0, padding: "10px 12px", overflow: "auto", fontSize: "12px", lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: "1 1 auto", minHeight: 0 },
      modalFoot: { padding: "6px 12px", borderTop: "1px solid rgba(128,128,128,0.22)", fontSize: "11px", lineHeight: "16px", color: "rgba(128,128,128,0.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
      modalMeta: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: "rgba(128,128,128,0.95)", borderBottom: "1px solid rgba(128,128,128,0.14)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto" },
      modalWarn: { padding: "5px 12px", fontSize: "11px", lineHeight: "16px", color: "rgba(176,108,16,0.98)", background: "rgba(240,180,60,0.14)", borderBottom: "1px solid rgba(240,180,60,0.3)", flex: "0 0 auto" },
      menu: { position: "absolute", zIndex: 80, padding: "4px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-1, #ffffff)", border: "1px solid rgba(128,128,128,0.32)", boxShadow: "0 8px 24px rgba(0,0,0,0.28)" },
      menuItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" },
      menuLabel: { padding: "4px 10px 2px", color: "rgba(128,128,128,0.9)", fontSize: "11px" },
      menuSep: { height: "1px", margin: "4px 2px", background: "rgba(128,128,128,0.22)" },
      menuPath: { padding: "4px 10px 6px", color: "rgba(128,128,128,0.95)", fontSize: "11px", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      appIcon: { position: "relative", width: "16px", height: "16px", flex: "0 0 auto", display: "inline-block" },
      headActions: { display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" },
      split: { position: "relative", display: "flex", alignItems: "stretch" },
      splitMain: { display: "flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "6px 0 0 6px", border: "1px solid rgba(128,128,128,0.32)", background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
      splitArrow: { padding: "3px 6px", borderRadius: "0 6px 6px 0", border: "1px solid rgba(128,128,128,0.32)", borderLeft: "none", background: "transparent", color: "inherit", fontSize: "10px", cursor: "pointer" },
      dropdown: { position: "absolute", right: 0, top: "calc(100% + 6px)", width: "230px", maxHeight: "280px", overflowY: "auto", padding: "4px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-1, #ffffff)", border: "1px solid rgba(128,128,128,0.32)", boxShadow: "0 8px 24px rgba(0,0,0,0.28)", zIndex: 85 },
      // One toast shape, two moods: a successful copy is not an error, and the old
      // single dark-red bubble made every message read like a failure.
      toast: { position: "absolute", left: "12px", right: "12px", bottom: "12px", padding: "8px 10px", borderRadius: "8px", color: "#fff", fontSize: "12px", zIndex: 70, wordBreak: "break-word", boxShadow: "0 4px 14px rgba(0,0,0,0.22)" },
      toastOk: { background: "rgba(21,128,91,0.95)" },
      toastError: { background: "rgba(178,44,44,0.95)" },
    };

