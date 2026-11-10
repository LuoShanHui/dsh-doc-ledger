    var artwork = {};
    try {
      artwork = require("@deepseek-ai/dsh-client-ui-primitives") || {};
    } catch (error) {
      artwork = {};
    }
    var tabIcon = artwork.GuideArtworkFiles || artwork.PluginArtworkDefault || null;

    /** App icons reuse the shell's own probe so the menu matches the workspace menus. */
    /** Shell icon ids differ from our own: the host serves "intellij" and "gitbash". */
    var APP_ICON = { explorer: "explorer", vscode: "vscode", idea: "intellij", "git-bash": "gitbash", finder: "finder" };

