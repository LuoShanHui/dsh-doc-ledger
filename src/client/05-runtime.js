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
     *
     * PLURALS: a caller may pass `count`. The dictionary then supplies variants under
     * `<key>_one` / `<key>_other` (plus `_few` / `_many` / `_zero` where a language needs
     * them), chosen with Intl.PluralRules. Chinese has one form, so its `_other` entry is
     * used for every count; English gets `1 file` / `2 files` without the call sites
     * knowing which language is active.
     */
    var ZH_FALLBACK = {};
    var rawT = null;
    var currentLocale = "zh";
    var pluralRules = null;

    function lookup(key) {
      var text = rawT !== null ? rawT(key) : undefined;
      if (text === undefined || text === null || text === "" || text === key) {
        text = ZH_FALLBACK[key];
      }
      return text;
    }

    function pluralForm(count) {
      try {
        if (pluralRules === null && typeof Intl !== "undefined" && Intl.PluralRules) {
          pluralRules = new Intl.PluralRules(currentLocale);
        }
        if (pluralRules !== null) return pluralRules.select(Number(count));
      } catch (error) {
        /* an old runtime without Intl falls through to the _other form */
      }
      return "other";
    }

    /**
     * The number a plural variant should agree with: `count`, or the first numeric
     * param the call site supplied. Dictionary keys stay language-neutral, so a
     * caller that says `{ n: 3 }` or `{ files: 2 }` gets `_one` / `_other` selected
     * without declaring which of its params drives the plural.
     */
    function countOf(params) {
      if (!params) return null;
      if (typeof params.count === "number") return params.count;
      for (var name in params) {
        if (!Object.prototype.hasOwnProperty.call(params, name)) continue;
        if (typeof params[name] === "number") return params[name];
      }
      return null;
    }

    function t(key, params) {
      var text;
      var num = countOf(params);
      if (num !== null) {
        var form = pluralForm(num);
        text = lookup(key + "_" + form);
        if (text === undefined) text = lookup(key + "_other");
        if (text === undefined) text = lookup(key + "_one");
      }
      if (text === undefined) text = lookup(key);
      if (text === undefined || text === null) return String(key);
      if (!params) return String(text);
      return String(text).replace(/\{(\w+)\}/g, function (all, name) {
        return params[name] === undefined || params[name] === null ? all : String(params[name]);
      });
    }

    function setTranslator(fn, locale) {
      rawT = fn;
      if (typeof locale === "string" && locale !== "") {
        currentLocale = locale;
        pluralRules = null;
      }
    }
    function setFallback(dict) { ZH_FALLBACK = dict || {}; }

