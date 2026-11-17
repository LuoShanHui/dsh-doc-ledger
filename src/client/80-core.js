    /** One sort axis: key plus direction. */
    function defaultDir(key) {
      return key === "type" || key === "path" || key === "exists" ? "asc" : "desc";
    }

    /**
     * The three section-level decisions, isolated so they can be tested without React.
     *
     * `rowsOf` used to inline all three inside a hook-heavy component, which put the roving
     * index arithmetic — the part that actually broke twice — out of reach of any test.
     */

    /** Section prefixes used by SessionCard: used / created / created-split / modified-split. */
    var SECTION_PREFIXES = ["u", "c", "cs", "ms"];

    /**
     * Which sort spec drives a section. The split views (`cs` / `ms`) share the created
     * sort because they are the two halves of the same "Created / Modified" column.
     */
    function sortSpecOf(prefix, usedSort, createdSort, modifiedSort) {
      if (prefix === "u") return usedSort;
      if (prefix === "ms") return modifiedSort;
      return createdSort;
    }

    /** Which timestamp a section's rows show (see rowTime). */
    function rowModeOf(prefix) {
      if (prefix === "u") return "used";
      if (prefix === "ms") return "modified";
      return "created";
    }

    /**
     * Whether a section's rows take part in the card's roving tab order.
     *
     * Both conditions matter and both have caused bugs: a collapsed section builds no DOM,
     * and the merged view computes the split arrays without rendering them. Counting either
     * kind would offset every index past the last focusable row.
     */
    function rowsReachable(open, rendered) {
      return open !== false && rendered !== false;
    }

    /** Rows a section shows: its own page limit, or the default. */
    function rowLimitOf(prefix, limits, defaultLimit) {
      var value = limits === null || limits === undefined ? 0 : Number(limits[prefix]);
      return value > 0 ? value : defaultLimit;
    }

    /**
     * The next active index for ArrowUp/ArrowDown inside one card.
     * Clamped, not wrapped: stepping past the end should stay put rather than jump to the
     * other end, which is what a list of rows means.
     */
    function clampRowIndex(from, delta, total) {
      if (total <= 0) return 0;
      return Math.min(total - 1, Math.max(0, from + delta));
    }

    /**
     * The one predicate a file must pass to be listed.
     *
     * It used to be written twice — once in the frame (for counts and which cards survive) and once
     * inside SessionCard (for the rows themselves) — and the two drifted: the extension term was
     * added to the frame's copy only, so choosing `.java` narrowed every count while the card went
     * on listing `build.py` and `deploy.ps1`. One function, used by both, is the fix; the tests
     * below cover the terms that drifted.
     *
     * `opts.extFilter`: `null`/`undefined` = no extension chosen, `""` = the no-extension bucket
     * (compared as a value, not treated as "unset").
     */
    function rowPasses(file, opts) {
      var options = opts || {};
      if (options.deletedOnly === true && file.exists !== false) return false;
      var typeSet = options.typeSet;
      if (typeSet !== null && typeSet !== undefined && typeSet[String(file.category || "other")] !== true) return false;
      var want = options.extFilter;
      if (want !== null && want !== undefined && extOf(file.name || file.path || "") !== want) return false;
      return matches(file, options.query);
    }

    /**
     * The type filter as one value instead of two independent ones.
     *
     * The two levels used to live in separate `useState` calls, so nothing enforced their
     * relationship: every code path that changed the families had to remember to clear the
     * extension, and the ones that forgot left an invisible filter narrowing the list (a board of
     * zero cards reading "no documents", with no chip or button showing why). Keeping both in one
     * object means the invariant cannot be omitted — it is applied by `typeFilterOf`, which every
     * state change goes through, and can be asserted on its own.
     *
     * Shape: `{ families: { [family]: true }, ext: string | null }`.
     *
     * `ext === null` means "no extension chosen"; `ext === ""` is a *real* value meaning "the files
     * with no extension at all". Those two used to share the empty string, which made the
     * "no extension" row impossible to un-tick: clicking it passed "" to clear the filter, but ""
     * was also the key being filtered on, so the state never changed and the tick stayed on.
     *
     * The invariant: **if no family is selected, `ext` is always null**. An extension is only
     * meaningful inside a family, so it is dropped the moment the last family goes away.
     */
    function typeFilterOf(families, ext) {
      // Only null/undefined mean "none"; "" is kept as the no-extension bucket.
      var name = ext === null || ext === undefined ? null : String(ext);
      var map = {};
      var any = false;
      var source = families === null || families === undefined ? null : families;
      if (source !== null && typeof source === "object") {
        var keys = Object.keys(source);
        for (var i = 0; i < keys.length; i += 1) {
          if (source[keys[i]] === true && keys[i] !== "") { map[keys[i]] = true; any = true; }
        }
      }
      return { families: map, ext: any === true ? name : null };
    }

    /** Toggle one family, keeping the extension only while a family remains selected. */
    function withFamilyToggled(state, family) {
      var current = state === null || state === undefined ? typeFilterOf(null, null) : state;
      var next = Object.assign({}, current.families);
      if (next[family] === true) delete next[family]; else next[family] = true;
      // Any change to the family selection invalidates the extension that was chosen inside it.
      return typeFilterOf(next, null);
    }

    /** Choose an extension ("" = the no-extension bucket), or pass null to clear the choice. */
    function withExtensionChosen(state, ext) {
      var current = state === null || state === undefined ? typeFilterOf(null, null) : state;
      return typeFilterOf(current.families, ext);
    }

    /**
     * Choose an extension *inside a family*, selecting that family if it was not already selected.
     *
     * Without this, ticking an extension under an un-ticked family did nothing at all: the
     * invariant above drops an extension that has no family, so the click was silently discarded.
     * Wanting `.yml` implies wanting the config family, and selecting it makes that visible.
     * Passing `null` clears the choice and never touches the family selection.
     */
    function withExtensionInFamily(state, family, ext) {
      var current = state === null || state === undefined ? typeFilterOf(null, null) : state;
      if (ext === null || ext === undefined) return typeFilterOf(current.families, null);
      var families = Object.assign({}, current.families);
      families[family] = true;
      return typeFilterOf(families, ext);
    }

    /** The selected family names, sorted, so a stable key can be derived from them. */
    function familiesOf(state) {
      if (state === null || state === undefined) return [];
      return Object.keys(state.families || {}).filter(function (name) {
        return state.families[name] === true;
      }).sort();
    }

    /** True when anything in either level is narrowing the list. */
    function typeFilterActive(state) {
      if (state === null || state === undefined) return false;
      return familiesOf(state).length > 0 || state.ext !== null && state.ext !== undefined;
    }

    /**
     * Extensions inside one family, counted from the live data.
     *
     * This is the second filter level, and it is deliberately derived rather than declared: a
     * language table would be biased toward whatever the current project uses (one real ledger
     * was 44% `.java`, so a fixed "Code" chip filtered nothing), while a derived census is
     * correct for every project and needs no maintenance when a new extension appears.
     *
     * @param files  the files to census
     * @param family the family to restrict to, or null for every family
     * @returns `[{ ext, count }]`, most frequent first; `ext` is "" for extension-less files
     */
    function extensionCensus(files, family) {
      var counts = {};
      (files || []).forEach(function (file) {
        if (family !== null && family !== undefined && String(file.category || "other") !== family) return;
        var ext = extOf(file.name || file.path || "");
        counts[ext] = (counts[ext] || 0) + 1;
      });
      return Object.keys(counts).map(function (ext) {
        return { ext: ext, count: counts[ext] };
      }).sort(function (left, right) {
        // Most frequent first; ties alphabetical so the order is stable between renders.
        return right.count - left.count || left.ext.localeCompare(right.ext);
      });
    }

    /**
     * How many extension chips to show before folding the rest into a counter.
     * Kept small because this is a second row under an already busy first one.
     */
    var EXT_CHIP_MAX = 8;

    /** Split a census into the chips to show and the remainder's totals. */
    function extensionChips(census, max) {
      var limit = max > 0 ? max : EXT_CHIP_MAX;
      var list = census || [];
      if (list.length <= limit + 1) return { shown: list, hidden: 0, hiddenFiles: 0 };
      var shown = list.slice(0, limit);
      var rest = list.slice(limit);
      return {
        shown: shown,
        hidden: rest.length,
        hiddenFiles: rest.reduce(function (total, entry) { return total + entry.count; }, 0)
      };
    }

    /**
     * A row that counts as "activity": the engine records a file the moment it sees a read
     * or a write, but a file can also arrive with only a timestamp and no counters. A card
     * with none of these must not claim a slot in the merged view.
     */
    function isActiveRow(file) {
      if (file === null || file === undefined) return false;
      return (file.reads || 0) > 0 || Boolean(file.firstUsedAt) || Boolean(file.createdAt) || (file.writes || 0) > 0;
    }

    /** Whether any file of a session survives the active filters and counts as activity. */
    function hasActiveRow(files, passes) {
      var list = files || [];
      for (var i = 0; i < list.length; i += 1) {
        if (typeof passes === "function" && !passes(list[i])) continue;
        if (isActiveRow(list[i])) return true;
      }
      return false;
    }

    /**
     * The page size after "show more": one more page, seeded from the default when the
     * section has never been widened. Kept pure so the arithmetic is not buried in a setState.
     */
    function nextRowLimit(current, page) {
      var step = page > 0 ? page : 100;
      var base = Number(current) > 0 ? Number(current) : step;
      return base + step;
    }

    function sortFiles(files, spec) {
      var key = spec.key;
      var dir = spec.dir === "asc" ? 1 : -1;
      var list = files.slice();
      list.sort(function (left, right) {
        var a;
        var b;
        if (key === "type") { a = String(left.category); b = String(right.category); }
        else if (key === "path") { a = String(left.rel || left.path); b = String(right.rel || right.path); }
        else if (key === "exists") { a = left.exists === false ? 1 : 0; b = right.exists === false ? 1 : 0; }
        else if (key === "reads") { a = left.reads || 0; b = right.reads || 0; }
        else if (key === "writes") { a = left.writes || 0; b = right.writes || 0; }
        else if (key === "createdAt") { a = left.createdAt || 0; b = right.createdAt || 0; }
        else if (key === "updatedAt") { a = left.updatedAt || 0; b = right.updatedAt || 0; }
        else if (key === "firstUsed") { a = left.firstUsedAt || 0; b = right.firstUsedAt || 0; }
        else { a = left.lastUsedAt || 0; b = right.lastUsedAt || 0; }
        if (a === b) return String(left.name).localeCompare(String(right.name));
        if (typeof a === "string") return a.localeCompare(b) * (dir < 0 ? -1 : 1);
        return (a < b ? -1 : 1) * (dir < 0 ? -1 : 1);
      });
      return list;
    }

    /** Lowercased search terms; a space separates independent terms (all of them must match). */
    function termsOf(query) {
      var text = String(query === null || query === undefined ? "" : query).trim().toLowerCase();
      if (text === "") return [];
      return text.split(/\s+/).filter(function (term) { return term !== ""; });
    }

    function matches(file, query) {
      var terms = termsOf(query);
      if (terms.length === 0) return true;
      // `sessionId` is part of the haystack because it is the one identifier a reader can copy
      // from the session menu or from a log, and searching it previously matched nothing.
      var haystack = (
        String(file.name) + " " + String(file.rel) + " " + String(file.path) + " " +
        String(file.category) + " " + String(file.sessionTitle || "") + " " +
        String(file.sessionId || "") + " " +
        // A pasted id may carry the `session-` prefix or not, so both spellings match.
        String(file.sessionId || "").replace(/^session-/, "")
      ).toLowerCase();
      for (var index = 0; index < terms.length; index += 1) {
        if (haystack.indexOf(terms[index]) === -1) return false;
      }
      return true;
    }

    /**
     * Timestamp helpers for merging: null/undefined stay null instead of becoming Infinity.
     *
     * `Math.min(a || Infinity, b || Infinity)` looks defensive but produces Infinity when both
     * sides are missing, and Infinity is truthy — so it silently turned "never read" into
     * "was read". These two keep a missing stamp missing.
     */
    function minStamp(left, right) {
      var a = typeof left === "number" && isFinite(left) ? left : null;
      var b = typeof right === "number" && isFinite(right) ? right : null;
      if (a === null) return b;
      if (b === null) return a;
      return a < b ? a : b;
    }

    function maxStamp(left, right) {
      var a = typeof left === "number" && isFinite(left) ? left : null;
      var b = typeof right === "number" && isFinite(right) ? right : null;
      if (a === null) return b;
      if (b === null) return a;
      return a > b ? a : b;
    }

    function mergeSessions(sessions) {
      var byPath = new Map();
      sessions.forEach(function (session) {
        (session.files || []).forEach(function (file) {
          var existing = byPath.get(file.path);
          if (existing === undefined) {
            byPath.set(file.path, Object.assign({}, file, { sessionTitle: session.title || session.sessionId, sessionId: session.sessionId }));
            return;
          }
          existing.reads = (existing.reads || 0) + (file.reads || 0);
          existing.writes = (existing.writes || 0) + (file.writes || 0);
          // A missing timestamp must stay missing. `|| Infinity` used to win the Math.min and
          // leave Infinity on the row: `fmtTime` then printed "NaN-NaN-NaN NaN:NaN", the sort
          // key became Infinity, and — because Infinity is truthy — a write-only file landed
          // in the "Used" section with reads 0 (25 such rows on this machine's data).
          existing.firstUsedAt = minStamp(existing.firstUsedAt, file.firstUsedAt);
          existing.lastUsedAt = maxStamp(existing.lastUsedAt, file.lastUsedAt);
          existing.createdAt = minStamp(existing.createdAt, file.createdAt);
          existing.updatedAt = maxStamp(existing.updatedAt, file.updatedAt);
        });
      });
      return Array.from(byPath.values());
    }

    var APP_BADGE = ["#f5a623", "#0f9ce8", "#fe315d", "#1f9d55", "#a855f7", "#ef4444"];

    /** The executable's real icon, served and cached by the host. */
    function iconUrl(exe) {
      return BASE + "/icon?path=" + encodeURIComponent(String(exe));
    }

    /**
     * The platform's association icon for an extension (tier B of FileGlyph).
     * A 404 is the normal answer for an extension Windows does not know, and the client then
     * draws its own badge instead.
     */
    function fileIconUrl(ext) {
      return BASE + "/fileicon?ext=" + encodeURIComponent(String(ext || "").toLowerCase());
    }

    /** The extension of a path, lowercased, without the dot. "" when there is none. */
    function extOf(path) {
      var name = String(path || "");
      var slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
      var base = slash >= 0 ? name.slice(slash + 1) : name;
      var dot = base.lastIndexOf(".");
      if (dot <= 0 || dot === base.length - 1) return "";
      return base.slice(dot + 1).toLowerCase();
    }

