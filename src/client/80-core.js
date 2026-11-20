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
     * The filter condition set: one immutable value that every layer passes around whole.
     *
     * Two rounds of the same bug came from wiring this by hand. First the extension term was added
     * to the frame's copy of the predicate but not the card's, so a chosen extension narrowed the
     * counts while the rows stayed put. Then, even after the predicate was shared, each caller still
     * assembled `{ deletedOnly, typeSet, extFilter, query }` itself — so the next added term would
     * again have to be threaded through every call site by hand, and any site that forgot it would
     * silently filter differently from the others.
     *
     * A condition set removes that step: callers build it once (in the frame) and hand the whole
     * object down, and `rowPasses` reads only from it. Adding a term means changing this file, not
     * every caller — and `filterSignature` lets the UI detect a change without comparing fields.
     */
    function filterConditions(input) {
      var source = input || {};
      var query = String(source.query === null || source.query === undefined ? "" : source.query);
      var typeSet = source.typeSet === null || source.typeSet === undefined ? null : source.typeSet;
      // `{ [family]: { [ext]: true } }`; an absent family means "no extension ticked in it".
      // This replaced a single `extFilter` string when the second level became multi-select.
      var extSet = source.extSet === null || source.extSet === undefined ? null : source.extSet;
      return Object.freeze({
        query: query,
        typeSet: typeSet,
        extSet: extSet,
        deletedOnly: source.deletedOnly === true
      });
    }

    /** True when nothing in the condition set narrows the list. */
    function filterIsActive(conditions) {
      if (conditions === null || conditions === undefined) return false;
      return conditions.query !== ""
        || conditions.deletedOnly === true
        || (conditions.typeSet !== null && conditions.typeSet !== undefined && Object.keys(conditions.typeSet).length > 0)
        || (conditions.extSet !== null && conditions.extSet !== undefined && Object.keys(conditions.extSet).length > 0);
    }

    /**
     * A stable string for one condition set.
     *
     * Memoised cards need to know whether the conditions changed. Comparing the object identity is
     * not enough (a new object is built every render) and comparing fields by hand is exactly the
     * maintenance this refactor is removing, so the comparison is derived here too.
     */
    function filterSignature(conditions) {
      if (conditions === null || conditions === undefined) return "";
      var families = conditions.typeSet === null || conditions.typeSet === undefined
        ? []
        : Object.keys(conditions.typeSet).filter(function (name) { return conditions.typeSet[name] === true; }).sort();
      // Extensions are flattened to `family/ext` strings and sorted, so two different insertion
      // orders produce the same signature (a tick order difference must not invalidate the memo).
      var extensions = [];
      var extSet = conditions.extSet || {};
      var owners = Object.keys(extSet).sort();
      for (var i = 0; i < owners.length; i += 1) {
        var bucket = extSet[owners[i]] || {};
        var keys = Object.keys(bucket).filter(function (name) { return bucket[name] === true; }).sort();
        for (var k = 0; k < keys.length; k += 1) extensions.push(owners[i] + "/" + keys[k]);
      }
      return JSON.stringify([conditions.query, families, extensions, conditions.deletedOnly]);
    }

    /**
     * The one predicate a file must pass to be listed.
     *
     * Callers pass the whole condition set; there are no per-term options to forget.
     */
    /**
     * Whether a file passes the type filter.
     *
     * The rows are a **union**: a ticked family admits every file of that family, a ticked
     * extension admits the files with that extension, and a file needs to match only one of them.
     * Tick "code" and "doc" and you get both, which is the only reading that makes multi-select
     * useful — an intersection would be empty the moment two families were ticked.
     *
     * No ticks at all means "no type filter", so everything passes. A family and its own
     * extensions cannot both be ticked (`typeFilterOf` enforces it), so the two levels never
     * contradict each other, and they are checked independently here.
     */
    function passesTypeFilter(file, conditions) {
      var c = conditions || {};
      var category = String(file.category || "other");
      var ext = extOf(file.name || file.path || "");
      var typeSet = c.typeSet;
      var familyWanted = typeSet !== null && typeSet !== undefined && typeSet[category] === true;
      var bucket = (c.extSet || {})[category];
      // "" is the no-extension bucket and is a real key, so this must test the key, not truthiness.
      var extWanted = bucket !== null && bucket !== undefined && bucket[ext] === true;
      var filtersTypes = (typeSet !== null && typeSet !== undefined && Object.keys(typeSet).length > 0)
        || (c.extSet !== null && c.extSet !== undefined && Object.keys(c.extSet).length > 0);
      if (filtersTypes === false) return true;
      return familyWanted === true || extWanted === true;
    }

    function rowPasses(file, conditions) {
      var c = conditions || {};
      if (c.deletedOnly === true && file.exists !== false) return false;
      if (passesTypeFilter(file, c) === false) return false;
      return matches(file, c.query);
    }

    /**
     * Whether a row is a candidate for the "only deleted" toggle: it must be gone from disk and
     * survive the search and both levels of the type filter.
     *
     * Deliberately ignores `deletedOnly` itself. The chip that calls this is the control that
     * turns that term on and off, so letting the term narrow its own count would make the number
     * read 0 while the toggle is armed — the count would answer "how many pass the filter I just
     * applied" instead of "how many the filter would leave me".
     */
    function deletedPasses(file, conditions) {
      if (file === null || file === undefined) return false;
      if (file.exists !== false) return false;
      var c = conditions || {};
      if (passesTypeFilter(file, c) === false) return false;
      return matches(file, c.query);
    }

    /**
     * The number on the "only deleted" chip.
     *
     * This used to be incremented for every `exists === false` row while the list beside it was
     * built through `rowPasses`, so the two disagreed the moment any other term was active: with
     * the "code" family ticked the chip still read "deleted 1", and clicking it produced an empty
     * list under "no documents". A counter and the list it describes must share one predicate, so
     * both go through the condition set — this function is the single place that decides it.
     *
     * @param sessions    the sessions in scope, each with a `files` array
     * @param conditions  the same condition set `rowPasses` takes
     */
    function countDeleted(sessions, conditions) {
      var total = 0;
      (sessions || []).forEach(function (session) {
        (session && session.files ? session.files : []).forEach(function (file) {
          if (deletedPasses(file, conditions)) total += 1;
        });
      });
      return total;
    }
    /**
     * The type filter, as one value covering both levels.
     *
     * Shape: `{ families: { [family]: true }, exts: { [family]: { [ext]: true } } }`.
     *
     * Three rules have to hold at all times, and putting them in one constructor is what makes
     * them impossible to forget (the two-level filter has already shipped twice with a state
     * split across `useState` calls, leaving an invisible filter narrowing the list):
     *
     * 1. **A family and its own extensions are mutually exclusive.** Ticking `code` clears every
     *    extension filed under `code`; ticking `code/java` un-ticks the `code` family. The two
     *    levels mean different things — "all of it" and "part of it" — so holding both at once
     *    would be a filter that can never be explained to the reader. Other families are
     *    untouched: the exclusivity is per family, not global, which is what lets
     *    `code/java` and `config/yml` be ticked together.
     * 2. **Extensions are not nested under a selected family.** `exts` only ever has entries for
     *    families that are *not* selected, so the second row can show a family's extensions
     *    exactly when that family is a candidate for being narrowed.
     * 3. **An extension belongs to a real family.** `""` is a legal extension value (files with
     *    no extension at all) and is kept as itself, not treated as "nothing chosen".
     *
     * The rows are a union, not an intersection: any ticked family or extension lets a file in.
     */
    function typeFilterOf(families, exts) {
      var familyMap = {};
      var source = families === null || families === undefined ? null : families;
      if (source !== null && typeof source === "object") {
        var names = Object.keys(source);
        for (var i = 0; i < names.length; i += 1) {
          if (source[names[i]] === true && names[i] !== "") familyMap[names[i]] = true;
        }
      }
      var extMap = {};
      var from = exts === null || exts === undefined ? null : exts;
      if (from !== null && typeof from === "object") {
        var owners = Object.keys(from);
        for (var j = 0; j < owners.length; j += 1) {
          var family = owners[j];
          // Rule 1: a selected family owns no extensions, so nothing can be filed under it.
          if (familyMap[family] === true) continue;
          var bucket = from[family];
          if (bucket === null || bucket === undefined || typeof bucket !== "object") continue;
          var kept = {};
          var any = false;
          var keys = Object.keys(bucket);
          for (var k = 0; k < keys.length; k += 1) {
            if (bucket[keys[k]] === true) { kept[keys[k]] = true; any = true; }
          }
          if (any === true) extMap[family] = kept;
        }
      }
      return { families: familyMap, exts: extMap };
    }

    /**
     * Tick or untick one family.
     *
     * Selecting a family is what "I want all of this kind" means, so it supersedes any extension
     * already ticked inside it (rule 1). Un-ticking leaves the family with no extensions either:
     * clearing a selection must not silently promote the narrower one back.
     */
    function withFamilyToggled(state, family) {
      var current = state === null || state === undefined ? typeFilterOf(null, null) : state;
      var families = Object.assign({}, current.families);
      var exts = Object.assign({}, current.exts);
      if (families[family] === true) {
        delete families[family];
      } else {
        families[family] = true;
        delete exts[family];
      }
      return typeFilterOf(families, exts);
    }

    /**
     * Tick or untick one extension inside one family.
     *
     * Ticking `code/java` un-ticks the `code` family (rule 1, the mirror of the previous
     * function) and leaves every other family alone, so `code/java` + `config/yml` can coexist.
     * `ext === ""` is the no-extension bucket and is a real choice, not a clear.
     */
    function withExtensionToggled(state, family, ext) {
      var current = state === null || state === undefined ? typeFilterOf(null, null) : state;
      var key = ext === null || ext === undefined ? "" : String(ext);
      var families = Object.assign({}, current.families);
      delete families[family];
      var exts = {};
      var owners = Object.keys(current.exts || {});
      for (var i = 0; i < owners.length; i += 1) {
        exts[owners[i]] = Object.assign({}, current.exts[owners[i]]);
      }
      var bucket = Object.assign({}, exts[family]);
      if (bucket[key] === true) delete bucket[key]; else bucket[key] = true;
      if (Object.keys(bucket).length === 0) delete exts[family]; else exts[family] = bucket;
      return typeFilterOf(families, exts);
    }

    /** Remove one tick, whichever level it was on. Drives the × on the "selected" row. */
    function withoutType(state, family, ext) {
      if (ext === null || ext === undefined) return withFamilyToggled(state, family);
      return withExtensionToggled(state, family, ext);
    }

    /** The selected family names, sorted, so a stable key can be derived from them. */
    function familiesOf(state) {
      if (state === null || state === undefined) return [];
      return Object.keys(state.families || {}).filter(function (name) {
        return state.families[name] === true;
      }).sort();
    }

    /**
     * Every ticked extension as `[{ family, ext }]`, families then extensions sorted.
     *
     * `ext` may be "" (the no-extension bucket), which is why the array form is used instead of
     * a joined string: an empty string must survive as itself.
     */
    function extensionsOf(state) {
      if (state === null || state === undefined) return [];
      var out = [];
      var owners = Object.keys(state.exts || {}).sort();
      for (var i = 0; i < owners.length; i += 1) {
        var family = owners[i];
        var bucket = state.exts[family] || {};
        var keys = Object.keys(bucket).filter(function (name) { return bucket[name] === true; }).sort();
        for (var k = 0; k < keys.length; k += 1) out.push({ family: family, ext: keys[k] });
      }
      return out;
    }

    /** True when anything in either level is narrowing the list. */
    function typeFilterActive(state) {
      if (state === null || state === undefined) return false;
      return familiesOf(state).length > 0 || extensionsOf(state).length > 0;
    }

    /**
     * The ticks as one flat list, for the "selected" row.
     *
     * A selected family is one entry with `ext: null`; a selected extension is one entry per
     * extension. Kept here rather than in the component so the row and the state cannot drift.
     */
    function typeSelections(state) {
      var out = [];
      var families = familiesOf(state);
      for (var i = 0; i < families.length; i += 1) out.push({ family: families[i], ext: null });
      var extensions = extensionsOf(state);
      for (var k = 0; k < extensions.length; k += 1) out.push(extensions[k]);
      return out;
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

    /**
     * Split a census into the chips to show and the remainder, folded behind one counter.
     *
     * This exists because the extension row is inline: a polyglot ledger is 43 extensions, and at
     * 325px wide they wrapped into 13 rows and took 332px — 44% of the panel, leaving the list
     * almost invisible. The row has to have a ceiling that does not depend on how many extensions
     * the project happens to use.
     *
     * `rest` is returned alongside the totals so "N more" can expand in place and show the folded
     * chips, rather than only reporting a number.
     */
    function extensionChips(census, max) {
      var limit = max > 0 ? max : EXT_CHIP_MAX;
      var list = census || [];
      if (list.length <= limit + 1) return { shown: list, hidden: 0, hiddenFiles: 0, rest: [] };
      var shown = list.slice(0, limit);
      var rest = list.slice(limit);
      return {
        shown: shown,
        hidden: rest.length,
        hiddenFiles: rest.reduce(function (total, entry) { return total + entry.count; }, 0),
        rest: rest
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

