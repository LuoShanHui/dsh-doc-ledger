    function Frame(props) {
      try {
        return FrameInner(props);
      } catch (error) {
        report("frame-error", (error && error.stack) || error);
        return react.createElement("div", { style: { padding: "12px", fontSize: "12px", color: "#b91c1c" } }, t("frame.errorPrefix") + ((error && error.message) || String(error)));
      }
    }

    /** Small, failure-tolerant preference store: sorting and view switches survive a reload. */
    var PREF_PREFIX = "dsh.docLedger.v1.";
    function loadPref(key, fallback) {
      try {
        var raw = window.localStorage.getItem(PREF_PREFIX + key);
        if (raw === null) return fallback;
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (error) {
        return fallback;
      }
    }
    function savePref(key, value) {
      try {
        window.localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value));
      } catch (error) {
        /* private mode or a full quota: preferences are optional */
      }
    }

