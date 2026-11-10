Ten commits since `v0.2.0`, all in panel interaction, keyboard accessibility, performance and engineering. **The data model and cache format are unchanged**, so upgrading needs no cleanup of `~/.dsh/doc-ledger-*`.

![overview](https://raw.githubusercontent.com/LuoShanHui/dsh-doc-ledger/v0.3.0/docs/overview.png)

## Added

- **Multi-word AND search**: every space-separated term must match; each term highlights independently and overlapping ranges merge (`ord` + `order` marks one span), and the empty state lists every term.
- **Subagent lineage jumps**: the session payload gained `parentSessionId`; a child card offers "Jump to parent: <title>" and a parent card lists its loaded children (up to 5).
- **Roving tabindex on file rows**: each card keeps one Tab-reachable row, with `↑`/`↓`/`Home`/`End` moving inside it — 40 expanded cards go from 400+ tab stops to 40.
- **Narrow-window support**: below 640 px the quick-look dialog's split button keeps only the program icon (the text moves into `title`/`aria-label`), so the file name is no longer squeezed to a few characters.
- **The full path at the bottom of the quick-look dialog copies on click.**
- **"Expand all" runs in batches of 8 cards**: 40 cards went from two 85 ms long tasks (~170 ms blocking) to five short tasks totalling 78 ms with no task over 50 ms, the first 16 appearing within 10–30 ms; the button becomes "Collapse all" during the run and one click interrupts it.
- **A 15-second replay floor for live sessions**: a silent poll inside the window reuses the previous fold, while `force=1` (the refresh button) and `timing=1` still replay fully.
- **Private vulnerability reporting**: enabled, with a custom form in `.github/VULNERABILITY_REPORT.yml` (requires plugin / DSH / Windows versions, reproduction steps of at least 100 characters, and an impact statement).

## Engineering

- **39 new regression assertions** (`npm test`, zero dependencies): engine 7 + decoder 10 + **host routes and security 14** (same-origin 403, ledger allowlist, `/api/open` POST-only, 400/404/405, unknown route 404) + **cache decisions 8** (exact stamp / TTL fallback / live replay floor).
- **The UI harness lives in the repo**: `npm run harness` serves a fake cordis context and a synthetic ledger running the real `client.js`, so UI work no longer needs a GUI login.
- **CI**: a Node 18 / 20 / 22 matrix runs the syntax check and every regression; `actions/checkout` and `actions/setup-node` moved to v7 (dependabot PRs).
- Repository plumbing: `CHANGELOG.md`, `SECURITY.md`, issue forms, `dependabot.yml`, `.editorconfig`, `.gitattributes` (LF normalization).
- Marketplace assets: `docs/awesome-plugin-entry.yml`, `docs/icon-512.png` (raster — the list refuses SVG), `docs/social-preview.png` (1280×640), `screenshots.json`.

## Install / upgrade

Pin the new version in an existing install (`~/.dsh/profiles/<profile>/package.json`):

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.3.0"
```

```powershell
node <runtime>/dependencies/pnpm/bin/pnpm.mjs install `
  --config.store-dir=<pnpm-store> `
  --config.confirmModulesPurge=false
```

Then reload the page (the client bundle has to be re-injected). Full steps are in the README's
[Installation](https://github.com/LuoShanHui/dsh-doc-ledger#installation-as-a-plugin) section.

## Compatibility

- DSH `>=0.2.0-rc.1 <0.3.0-0`; Node `>=18`; verified on **Windows** only.
- Two host capabilities remain optional and degrade silently when missing: `uiWorkspace.openSession` (the jump entry disappears) and `sidebarRight.openResource` (falls back to this plugin's own dialog).

## Known limitations

- The session directory layout is an implicit contract; `exists` is cached for 20 seconds; files created indirectly by a shell do not count as created; mixed-encoding detection is heuristic; quick look shows only the first 200 KB. See
  [Known limitations](https://github.com/LuoShanHui/dsh-doc-ledger#known-limitations) in the README.

## Tests

```bash
npm test    # engine 7 + decoder 10 + routes/security 14 + cache 8 = 39 assertions, no external deps
```

The full change history is in [CHANGELOG.md](https://github.com/LuoShanHui/dsh-doc-ledger/blob/main/CHANGELOG.md).
