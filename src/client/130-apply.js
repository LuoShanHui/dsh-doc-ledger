    function TabTitle() {
      try {
        return react.createElement("span", null, t("tab.title"));
      } catch (error) {
        return null;
      }
    }

    function apply(ctx) {
      report("apply", "enter");
      try {
        return applyInner(ctx);
      } catch (error) {
        report("apply-error", (error && error.stack) || error);
        throw error;
      }
    }

    /**
     * Turn on the client diagnostics channel when the plugin runs with `debug: true`.
     *
     * `report()` gates on `window.__DOC_LEDGER_DEBUG__`, but nothing in the bundle can read the
     * host config: the client is evaluated in the browser against a Loader entry it cannot see.
     * Before this, all seventeen report() call sites were dead and the host's client log only
     * ever held stale lines. The host now answers `/api/config`, and this is the one place that
     * sets the flag, early enough for the startup reports that follow.
     *
     * Fire-and-forget on purpose: diagnostics must not delay (or be able to block) mounting.
     */
    function enableDiagnostics() {
      if (typeof window === "undefined" || typeof fetch !== "function") return;
      try {
        fetch(BASE + "/api/config").then(function (response) {
          return response.ok ? response.json() : null;
        }).then(function (payload) {
          var data = payload && payload.data ? payload.data : null;
          // Resolves the queue either way: true flushes it, false discards it. Leaving the
          // flag undefined would keep buffering forever.
          reportEnable(data !== null && data.debug === true);
        }).catch(function () {
          /* a missing endpoint only costs the diagnostics channel */
          reportEnable(false);
        });
      } catch (error) {
        /* diagnostics must never break apply */
      }
    }

    function applyInner(ctx) {
      enableDiagnostics();
      // Install the host translator BEFORE any dictionary registration / render, so
      // evaluation-time constants (category labels, sort labels) and TabTitle all see it.
      setFallback({ zh: zh, en: en });
      setTranslator(ctx.locale.bind(NS), readActiveLocale(ctx));
      // Follow the host's appearance. DSH marks the scheme on <html>/<body> and emits
      // `theme/change`; the CSS variables the palette reads update by themselves, and this
      // listener repaints the panel so a derived value cannot lag behind.
      ctx.effect(function () {
        if (typeof ctx.on !== "function") return undefined;
        return ctx.on("theme/change", function () {
          try {
            report("theme-change", JSON.stringify({ dark: readDarkScheme() }));
            refreshStyles();
          } catch (error) {
            report("theme-change-error", String((error && error.message) || error));
          }
        });
      }, "doc-ledger: theme change");

      // A user can also flip the OS scheme while DSH follows `system`; that never emits
      // theme/change, so the media query is watched as well.
      ctx.effect(function () {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
        var query = window.matchMedia("(prefers-color-scheme: dark)");
        var onChange = function () {
          try { refreshStyles(); } catch (error) { /* repaint is best effort */ }
        };
        if (typeof query.addEventListener === "function") {
          query.addEventListener("change", onChange);
          return function () { query.removeEventListener("change", onChange); };
        }
        return undefined;
      }, "doc-ledger: os scheme change");

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "doc-ledger: dictionaries");

      // Follow language switches at runtime. Registering dictionaries does NOT emit
      // locale/change (boot does that once per package), so listening here only reacts to a
      // real switch; Intl.PluralRules is rebuilt for the new tag on the next t() call.
      ctx.effect(function () {
        if (typeof ctx.on !== "function") return undefined;
        return ctx.on("locale/change", function (snapshot) {
          try {
            var next = snapshot !== null && typeof snapshot === "object" ? snapshot.active : snapshot;
            setTranslator(ctx.locale.bind(NS), typeof next === "string" ? next : readActiveLocale(ctx));
          } catch (error) {
            report("locale-change-error", (error && error.message) || error);
          }
        });
      }, "doc-ledger: locale change");

      function registerTab() {
        var base = { id: TAB_ID, kind: KIND, title: function () { return t("tab.title"); } };
        var guide = {
          id: "ledger",
          order: 20,
          title: function () { return t("guide.title"); },
          description: function () { return t("guide.description"); }
        };
        if (tabIcon !== null) guide.icon = tabIcon;
        var attempts = [
          Object.assign({}, base, { guide: [guide] }),
          Object.assign({}, base, { guide: [guide], priority: "extension" }),
          Object.assign({}, base, { priority: "extension" }),
          base
        ];
        var lastError = null;
        for (var i = 0; i < attempts.length; i++) {
          try {
            return ctx.sidebarRightTabs.register(attempts[i]);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      }

      // `openResource` is the host's own "open this file in the document preview"
      // door; capturing the service here keeps the component free of service lookups
      // (and of the cordis guard that a bare `ctx.get` inside a render path can trip).
      try {
        hostSidebar = ctx.sidebarRight ?? null;
      } catch (error) {
        hostSidebar = null;
      }
      report("apply", "host-preview:" + (hostPreviewReady() ? "yes" : "no"));

      // Session jumping is optional: `uiWorkspace` is a host client service this plugin
      // may not have on older builds, and `ctx.inject` keeps the plugin mounted either way.
      ctx.inject(["uiWorkspace"], function (injected) {
        ctx.effect(function () {
          try {
            workspaceNav = injected.uiWorkspace ?? null;
          } catch (error) {
            workspaceNav = null;
          }
          report("apply", "session-nav:" + (canJumpToSession() ? "yes" : "no"));
          return function () { workspaceNav = null; };
        }, "doc-ledger: session nav");
      });

      ctx.effect(function () {
        report("apply", "before-tab");
        var dispose = registerTab();
        report("apply", "tab-ok");
        return dispose;
      }, "doc-ledger: tab type");

      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab", function () {
          return ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID, locale: NS }, Frame);
        });
      }, "doc-ledger: tab body");

      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab.title", function () {
          return ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_ID }, TabTitle);
        });
      }, "doc-ledger: tab title");

      ctx.inject(["shortcuts"], function (ctx) {
        ctx.effect(function () {
          try {
            return ctx.shortcuts.register({
              id: "doc-ledger.open",
              label: function () { return t("guide.title"); },
              aliases: ["documents", "doc ledger", "文档", "文档台账"],
              run: function () { ctx.sidebarRight.openTab(KIND); }
            });
          } catch (error) {
            return undefined;
          }
        }, "doc-ledger: shortcut");
      });
    }

    report("eval", "bundle-evaluated");
    exports.apply = apply;
    exports.inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];
    return module.exports;
  }
});
