    function report(step, detail) {
      // Opt-in only: the host ignores these posts unless its config sets debug: true,
      // and a normal session should not pay a POST per lifecycle step.
      if (typeof window === "undefined" || window.__DOC_LEDGER_DEBUG__ !== true) return;
      try {
        var body = JSON.stringify({ step: step, detail: String(detail === undefined ? "" : detail), href: String(location.href).slice(0, 200) });
        if (typeof fetch === "function") fetch(BASE + "/api/_clienterror", { method: "POST", body: body, keepalive: true }).catch(function () {});
      } catch (error) {
        /* diagnostics must never throw */
      }
    }

    function decodeJson(response) {
      return response.json().catch(function () { return null; }).then(function (payload) {
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error((payload && payload.error) || "HTTP " + response.status);
        }
        return payload.data;
      });
    }

    /**
     * `cache` defaults to "no-store" because the list is polled and must never be
     * served stale; the preview passes "no-cache" so the browser revalidates with the
     * host's ETag and an unchanged file costs a 304 instead of a full body.
     */
    function getJson(path, init) {
      var options = { headers: { accept: "application/json" }, cache: "no-store" };
      if (init !== null && typeof init === "object") {
        for (var key in init) {
          if (Object.prototype.hasOwnProperty.call(init, key)) options[key] = init[key];
        }
      }
      return fetch(BASE + path, options).then(decodeJson);
    }

    /**
     * Launching is a POST: the host refuses a GET there so a cross-site <img> cannot run a
     * program on the user's machine.
     */
    function postJson(path) {
      return fetch(BASE + path, { method: "POST", headers: { accept: "application/json" }, cache: "no-store" }).then(decodeJson);
    }

    /**
     * The active session id. Slot bodies receive it directly as the standard
     * "sessionId" prop; the snapshot selector is only a fallback.
     */
    function readSessionId(props) {
      try {
        var direct = props && (props.sessionId || (props.session && props.session.id));
        if (typeof direct === "string" && direct !== "") return direct;
        var useSession = props && props.useSession;
        if (typeof useSession !== "function") return null;
        var picked = useSession(function (state) {
          if (state === null || state === undefined) return null;
          if (typeof state === "string") return state;
          return state.sessionId || state.id || (state.session && state.session.id) || null;
        });
        if (typeof picked === "string" && picked !== "") return picked;
      } catch (error) {
        report("session-hook", (error && error.stack) || error);
      }
      return null;
    }

