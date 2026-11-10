    /**
     * Wrap every search-term match so a multi-word query explains itself. Ranges are
     * merged before rendering, so overlapping terms (`ord` + `order`) mark one span
     * instead of nesting a <mark> inside another.
     */
    function highlight(text, query) {
      var value = String(text === null || text === undefined ? "" : text);
      var terms = termsOf(query);
      if (terms.length === 0) return value;
      var lower = value.toLowerCase();
      var ranges = [];
      for (var t = 0; t < terms.length; t += 1) {
        var term = terms[t];
        var at = lower.indexOf(term);
        while (at !== -1) {
          ranges.push([at, at + term.length]);
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

