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
    var EN_FALLBACK = {};
    var rawT = null;
    var currentLocale = "zh";
    var pluralRules = null;

    /**
     * Which dictionary our own strings actually come from.
     *
     * The host walks `<active> → its fallback chain → common` and only then shows the key,
     * so a language we do not translate (ja, ko, ru…) resolves to **English** — every
     * `addLanguage` fallback chain has to terminate there. The plural form must agree with
     * the language the *text* is in, not with the language the user picked: otherwise a
     * Japanese user gets English sentences with Japanese plural rules ("1 files").
     *
     * zh and en are the only dictionaries we ship, so everything else behaves like en.
     */
    function pluralLocale() {
      return currentLocale === "zh" ? "zh" : "en";
    }

    function lookup(key) {
      var text = rawT !== null ? rawT(key) : undefined;
      if (text === undefined || text === null || text === "" || text === key) {
        // The host answered with the key itself, so it has no entry for the active
        // language and no fallback hit: use our own dictionary for the same language
        // rather than dropping to Chinese under an English/Japanese UI.
        text = fallbackDict()[key];
      }
      return text;
    }

    function pluralForm(count) {
      try {
        if (pluralRules === null && typeof Intl !== "undefined" && Intl.PluralRules) {
          pluralRules = new Intl.PluralRules(pluralLocale());
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
    /**
     * Offline fallbacks, used when the host translator cannot answer (no locale service,
     * a key we never registered, or a dictionary that has not arrived yet).
     *
     * `zh` backs `currentLocale === "zh"`; everything else falls back to `en`, matching
     * the host's own fallback chain. Passing both keeps the degraded path in the same
     * language as the sentences it sits next to.
     */
    function setFallback(dicts) {
      if (dicts !== null && typeof dicts === "object" && dicts.zh !== undefined) {
        ZH_FALLBACK = dicts.zh || {};
        EN_FALLBACK = dicts.en || {};
        return;
      }
      ZH_FALLBACK = dicts || {};
      EN_FALLBACK = {};
    }

    function fallbackDict() {
      return currentLocale === "zh" ? ZH_FALLBACK : EN_FALLBACK;
    }

    /**
     * The active language tag, read from the host's locale service.
     *
     * `getLocale()` returns a LocaleSnapshot — `{ active, locales, revision }` — not a
     * string, so it must be unwrapped through `.active`. (Passing the object straight to
     * Intl.PluralRules throws RangeError, which silently degrades every English plural to
     * the `_other` form: "1 files".) Anything unexpected falls back to zh, whose
     * dictionary has a single form.
     */
    function readActiveLocale(ctx) {
      try {
        if (ctx === null || ctx === undefined || ctx.locale === null || ctx.locale === undefined) return "en";
        if (typeof ctx.locale.getLocale !== "function") return "en";
        var snapshot = ctx.locale.getLocale();
        if (typeof snapshot === "string" && snapshot !== "") return snapshot;
        if (snapshot !== null && typeof snapshot === "object" && typeof snapshot.active === "string" && snapshot.active !== "") {
          return snapshot.active;
        }
        return "en";
      } catch (error) {
        return "en";
      }
    }
