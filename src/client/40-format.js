    var CATEGORY_COLOR = {
      doc: "#3b6fe0",
      sheet: "#12805c",
      slide: "#c2640a",
      image: "#8b5cf6",
      code: "#0e7490",
      web: "#dc2626",
      config: "#64748b",
      data: "#0891b2",
      media: "#c026d3",
      archive: "#92400e",
      binary: "#525252",
      other: "#94a3b8"
    };

    // Keys, not literals: this table is built at factory-evaluation time, before the
    // host translator is installed. categoryLabel() resolves through t() at render time.
    var CATEGORY_LABEL = {
      doc: "category.doc",
      sheet: "category.sheet",
      slide: "category.slide",
      image: "category.image",
      code: "category.code",
      web: "category.web",
      config: "category.config",
      data: "category.data",
      media: "category.media",
      archive: "category.archive",
      binary: "category.binary",
      other: "category.other"
    };

    function categoryColor(category) {
      return CATEGORY_COLOR[category] || CATEGORY_COLOR.other;
    }

    function categoryLabel(category) {
      var key = CATEGORY_LABEL[category] || "category.other";
      return t(key);
    }

    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }

    var THIS_YEAR = new Date().getFullYear();

    /** Recent stamps stay short; anything from another year keeps its year. */
    function fmtTime(ms) {
      if (!ms) return "--";
      var date = new Date(ms);
      var stamp = pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
      return date.getFullYear() === THIS_YEAR ? stamp : date.getFullYear() + "-" + stamp;
    }

    /** "76.8 KB" / "1.2 MB" for the preview header; bare bytes below 1 KB. */
    function fmtBytes(bytes) {
      if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) {
        var kb = bytes / 1024;
        return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + " KB";
      }
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    /** Short label for how the preview bytes were decoded; null when it is plain UTF-8. */
    function encodingLabel(encoding) {
      if (encoding === "utf-8+gb18030") return t("encoding.gb18030Mixed");
      if (encoding === "utf-16le") return "UTF-16LE";
      if (encoding === "utf-16be") return "UTF-16BE";
      return null;
    }

