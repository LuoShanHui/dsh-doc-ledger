    var CATEGORY_COLOR = {
      doc: "#4f7cf7",
      sheet: "#1f9d55",
      slide: "#d97706",
      image: "#a855f7",
      code: "#0ea5e9",
      web: "#ef4444",
      config: "#64748b",
      data: "#0891b2",
      archive: "#b45309",
      other: "#94a3b8"
    };

    var CATEGORY_LABEL = {
      doc: "文档",
      sheet: "表格",
      slide: "演示",
      image: "图片",
      code: "代码",
      web: "网页",
      config: "配置",
      data: "数据",
      archive: "压缩",
      other: "其他"
    };

    function categoryColor(category) {
      return CATEGORY_COLOR[category] || CATEGORY_COLOR.other;
    }

    function categoryLabel(category) {
      return CATEGORY_LABEL[category] || String(category || "其他");
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
      if (encoding === "utf-8+gb18030") return "GB18030 混合解码";
      if (encoding === "utf-16le") return "UTF-16LE";
      if (encoding === "utf-16be") return "UTF-16BE";
      return null;
    }

