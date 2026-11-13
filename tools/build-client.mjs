/**
 * Build client.js from src/client/*.js by deterministic concatenation.
 *
 * WHY CONCATENATION, NOT A BUNDLER:
 * The host loads a client plugin as ONE factory registered through
 * `window.__ModuleLoader__.load({ id, factory })`. `require` inside that factory is
 * supplied by the host and only resolves "react"; relative `require`/ESM imports are
 * not guaranteed. Every helper in this plugin shares that single factory closure
 * (S, categoryLabel, termsOf, workspaceNav, ...), so the code cannot be split into
 * real modules without a bundler + a build toolchain in CI and publish.
 *
 * This script keeps the runtime artifact byte-for-byte identical while giving the
 * source readable, single-responsibility files. The manifest below is the order of
 * concatenation and the single source of truth; adding a fragment requires adding it
 * here. `npm run build:client` regenerates; `npm run check:client` fails CI if the
 * committed client.js drifted from the fragments.
 *
 * No dependencies, no minification, no transforms: ES5-style source stays as authored.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "src", "client");
const out = join(root, "client.js");

// Ordered. Numbers are only for readability in a directory listing; this list is authoritative.
const manifest = [
  "00-head.js",          // loader registration, namespace/base constants, react
  "05-runtime.js",       // t() translator + setTranslator / setFallback
  "10-locale.js",        // zh / en dictionaries (see docs/i18n-plan.md)
  "20-assets.js",        // host artwork + app icon id map
  "30-network.js",       // report / decodeJson / getJson / postJson / readSessionId
  "40-format.js",        // category tables, fmtTime, fmtBytes, encodingLabel
  "50-host.js",          // workspaceNav / hostSidebar bridges, hostFileAddress, openResource
  "60-search.js",        // highlight, shortPath
  "70-styles.js",        // the S style table
  "80-core.js",          // defaultDir, sortFiles, termsOf, matches, mergeSessions, iconUrl
  "90-widgets.js",       // AppIcon, useHandlers, SearchBox, focus helpers, onActivate
  "100-sections.js",     // Section, Menu, panelRect, labelOf, Frame
  "110-frame.js",        // PREF_PREFIX, loadPref, savePref
  "120-frame-inner.js",  // FrameInner: the main panel render (largest; split in a later pass)
  "130-apply.js"         // TabTitle, apply, applyInner, exports
];

const parts = manifest.map((name) => {
  const file = join(dir, name);
  if (!existsSync(file)) throw new Error("missing fragment: " + name);
  const text = readFileSync(file, "utf8");
  if (!text.endsWith("\n")) throw new Error("fragment must end with a newline: " + name);
  return text;
});
/**
 * Stamp the build time into the bundle.
 *
 * The client bundle lives in the DSH process until it is restarted, so a stale bundle and a
 * broken layout are indistinguishable from the outside: both look like "the fix did nothing".
 * The panel prints this tag on the toolbar, which makes the answer one glance instead of a
 * round trip. It is coarse (a minute) so rebuilding twice in the same minute is byte-identical
 * and `--check` stays meaningful.
 */
const now = new Date();
const stamp = now.getFullYear() + "-" +
  String(now.getMonth() + 1).padStart(2, "0") + "-" +
  String(now.getDate()).padStart(2, "0") + " " +
  String(now.getHours()).padStart(2, "0") + ":" +
  String(now.getMinutes()).padStart(2, "0");

// `--check` must not fail merely because the clock moved, so it reuses the tag already present in
// the committed artifact instead of computing a new one.
const checkMode = process.argv.includes("--check");
const committed = existsSync(out) ? readFileSync(out, "utf8") : "";
const committedTag = (committed.match(/"([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2})"/) || [])[1];

const tag = checkMode ? (committedTag ?? stamp) : stamp;
const built = parts.join("").replace(/__DOC_LEDGER_BUILD__/g, tag);

const check = process.argv.includes("--check");
const current = existsSync(out) ? readFileSync(out, "utf8") : "";
if (built === current) {
  console.log("client.js up to date (" + Buffer.byteLength(built) + " bytes, " + manifest.length + " fragments)");
  process.exit(check ? 0 : 0);
}
if (check) {
  console.error("client.js is out of date: run `npm run build:client` and commit the result.");
  process.exit(1);
}
writeFileSync(out, built, "utf8");
console.log("client.js rebuilt (" + Buffer.byteLength(built) + " bytes, " + manifest.length + " fragments)");
