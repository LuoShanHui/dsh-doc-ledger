    /**
     * A lowercased copy of `text`, plus the map from every lowered index back to the original.
     *
     * `String.prototype.toLowerCase` is **not** length-preserving. "İ" (U+0130) lowercases to
     * "i" + U+0307, two code units; "ẞ" expands the same way. Searching the lowered copy and then
     * slicing the original with those offsets therefore marks the wrong characters — measured:
     * searching "notes" in "doc-İstanbul-notes.md" produced the match "otes." instead of "notes".
     *
     * Each code point is folded on its own (a surrogate pair as one unit) and contributes one
     * entry per code unit it produced, so `map[lowerIndex]` always names the code point that
     * generated it. For text whose folds are 1:1 this is an identity map and nothing changes.
     */
    function foldCase(text) {
      var lowered = "";
      var map = [];
      var index = 0;
      while (index < text.length) {
        var width = 1;
        var unit = text.charAt(index);
        var code = text.charCodeAt(index);
        if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length) {
          var next = text.charCodeAt(index + 1);
          if (next >= 0xDC00 && next <= 0xDFFF) { width = 2; unit = text.slice(index, index + 2); }
        }
        var folded = unit.toLowerCase();
        for (var k = 0; k < folded.length; k += 1) map.push({ start: index, width: width });
        lowered += folded;
        index += width;
      }
      return { text: lowered, map: map };
    }

    /**
     * Wrap every search-term match so a multi-word query explains itself. Ranges are
     * merged before rendering, so overlapping terms (`ord` + `order`) mark one span
     * instead of nesting a <mark> inside another.
     */
    function highlight(text, query) {
      var value = String(text === null || text === undefined ? "" : text);
      var terms = termsOf(query);
      if (terms.length === 0) return value;
      // Search the folded copy, but report every range in the *original* string's coordinates:
      // the two coordinate systems differ wherever a character expanded when lowercased.
      var folded = foldCase(value);
      var lower = folded.text;
      var ranges = [];
      for (var t = 0; t < terms.length; t += 1) {
        var term = terms[t];
        var at = lower.indexOf(term);
        while (at !== -1) {
          var first = folded.map[at];
          var last = folded.map[at + term.length - 1];
          ranges.push([first.start, last.start + last.width]);
          at = lower.indexOf(term, at + term.length);
        }
      }
      if (ranges.length === 0) return value;
      ranges.sort(function (left, right) { return left[0] - right[0]; });
      var merged = [];
      for (var r = 0; r < ranges.length; r += 1) {
        var last = merged[merged.length - 1];
        if (last !== undefined && ranges[r][0] <= last[1]) {
          last[1] = Math.max(last[1], ranges[r][1]);
        } else {
          merged.push(ranges[r]);
        }
      }
      var parts = [];
      var cursor = 0;
      for (var m = 0; m < merged.length; m += 1) {
        if (merged[m][0] > cursor) parts.push(value.slice(cursor, merged[m][0]));
        parts.push(react.createElement("mark", { key: "h" + parts.length, style: S.mark }, value.slice(merged[m][0], merged[m][1])));
        cursor = merged[m][1];
      }
      if (cursor < value.length) parts.push(value.slice(cursor));
      return parts;
    }

    function shortPath(dir, max) {
      if (!dir) return "";
      if (dir.length <= max) return dir;
      return "…" + dir.slice(dir.length - max + 1);
    }

