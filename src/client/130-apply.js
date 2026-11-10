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

    function applyInner(ctx) {
      // Install the host translator BEFORE any dictionary registration / render, so
      // evaluation-time constants (category labels, sort labels) and TabTitle all see it.
      setFallback(zh);
      // The active language drives Intl.PluralRules; without a host hint we stay on zh,
      // whose dictionary has a single form, so plurals degrade gracefully.
      var activeLocale = "zh";
      try {
        if (typeof ctx.locale.getLocale === "function") activeLocale = String(ctx.locale.getLocale() || "zh");
      } catch (error) {
        activeLocale = "zh";
      }
      setTranslator(ctx.locale.bind(NS), activeLocale);
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "doc-ledger: dictionaries");

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
