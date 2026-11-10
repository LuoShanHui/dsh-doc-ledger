    /**
     * DSH's workspace/navigation service, captured in apply() when the build has one.
     * `openSession(sessionId)` is exactly "select that session and show its conversation",
     * which is what jumping from a ledger card uses; without it the menu simply omits the
     * entry instead of failing.
     */
    var workspaceNav = null;

    /** Whether this build can switch the conversation from a ledger card. */
    function canJumpToSession() {
      return workspaceNav !== null && typeof workspaceNav.openSession === "function";
    }

    /**
     * Switch the GUI to a session.
     * @returns true when the navigation was handed off.
     */
    function jumpToSession(sessionId) {
      if (!canJumpToSession()) return false;
      if (typeof sessionId !== "string" || sessionId === "") return false;
      try {
        workspaceNav.openSession(sessionId);
        return true;
      } catch (error) {
        report("session-jump-error", (error && error.message) || error);
        return false;
      }
    }

    /**
     * DSH's own right-sidebar service, captured in apply(). `openResource` opens the
     * host's document-preview tab by resource address, and that tab already renders
     * text / markdown / html / image / pdf / office / excel / code — which is why this
     * plugin ships no image or markdown rendering of its own.
     */
    var hostSidebar = null;

    /**
     * `dsh-resource://file/session/<id>/<path>`, spelled exactly like DSH's own
     * address grammar: backslashes normalize to `/`, every segment is
     * component-encoded, and `:` stays literal so a Windows drive letter survives.
     */
    function hostFileAddress(sessionId, path) {
      var encodeSegment = function (segment) {
        return encodeURIComponent(segment).replace(/%3A/gi, ":");
      };
      var normalized = String(path).replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
      return "dsh-resource://file/session/" + encodeSegment(String(sessionId)) + "/" +
        normalized.split("/").map(encodeSegment).join("/");
    }

    /** Whether this DSH build can open a file in its own document preview. */
    function hostPreviewReady() {
      return hostSidebar !== null && typeof hostSidebar.openResource === "function";
    }

    /**
     * Open a file in the host's document preview.
     * @param file - the ledger row (its `path` is the payload).
     * @param sessionId - the session whose sidebar is on screen: the address is scoped
     *   to it so the tab lands where the reader is looking, even for a row that came
     *   from another session in the "all sessions" view. Absolute paths resolve the
     *   same way against any session's root.
     * @returns true when the host took it; false leaves the caller on the in-panel modal.
     */
    function hostPreviewOpen(file, sessionId) {
      if (file === null || file === undefined || file.path === undefined) return false;
      if (!hostPreviewReady()) return false;
      try {
        hostSidebar.openResource(hostFileAddress(sessionId || file.sessionId, file.path));
        return true;
      } catch (error) {
        report("host-preview-error", (error && error.message) || error);
        return false;
      }
    }

