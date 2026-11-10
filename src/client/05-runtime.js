    /**
     * Translator installed by apply() once the host's locale service exists.
     *
     * The client is one factory closure: components are declared at evaluation time but
     * only rendered after apply(), so `t` cannot be imported as a module. Instead the
     * whole bundle calls this single `t(key, params)`; apply() swaps the underlying
     * function to `ctx.locale.bind(NS)`. Before that (and in the harness / static report,
     * which have no real locale service) it falls back to the Chinese source strings, so
     * a raw "a.b.c" key is never shown and evaluation-time constants stay readable.
     *
     * `{name}` placeholders are substituted here rather than relying on the host's
     * translator, so dictionaries and call sites do not depend on host interpolation.
     */
    var ZH_FALLBACK = {};
    var rawT = null;

    function t(key, params) {
      var text = rawT !== null ? rawT(key) : undefined;
      if (text === undefined || text === null || text === "" || text === key) {
        text = ZH_FALLBACK[key];
      }
      if (text === undefined || text === null) return String(key);
      if (!params) return String(text);
      return String(text).replace(/\{(\w+)\}/g, function (all, name) {
        return params[name] === undefined || params[name] === null ? all : String(params[name]);
      });
    }

    function setTranslator(fn) { rawT = fn; }
    function setFallback(dict) { ZH_FALLBACK = dict || {}; }

