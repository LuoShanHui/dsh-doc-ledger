# dsh-doc-ledger

[![ci](https://github.com/LuoShanHui/dsh-doc-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/LuoShanHui/dsh-doc-ledger/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-doc-ledger.svg)](https://www.npmjs.com/package/dsh-doc-ledger)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**English** · [中文](README.zh.md)

**One document ledger per session**: which documents a session used, created or modified — with time ordering, type grouping, search, a cross-session summary, and two ways to preview.

A DSH sidebar plugin that keeps a per-session document ledger — which documents a session read, created or modified — with time ordering, type grouping, search, two preview modes and a cross-session view. Windows only, UI in Chinese and English.

![overview](docs/overview.png)

## 30-second setup

```jsonc
// ~/.dsh/profiles/<profile>/package.json
"dependencies": {
  "dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.4.0"
}
```

1. Add the dependency line above (`#v0.4.0` pins the version; drop the tag to track the latest commit).
   It is also published to npm, so `"dsh-doc-ledger": "0.4.0"` works too.
2. Install with the pnpm bundled in your DSH runtime, reusing an existing store (full command under
   [Installation](#installation-as-a-plugin) below).
3. Append one `doc-ledger` row to `cordis.patch.yml` (also in that section), reload the page, and the
   **Doc ledger** tab appears in the right sidebar.

Requires DSH `>=0.2.0-rc.1 <0.3.0-0` and Windows. If the install fails, or you want to modify the code,
see the local-directory option under [Installation](#installation-as-a-plugin); for behaviour boundaries
see [Known limitations](#known-limitations).

> Experimental: it depends on host internals (`sessionQuery`, `webServer` prefix routes, bundle-patch
> injection) and has only been verified on DSH `>=0.2.0-rc.1 <0.3.0-0`. When the host changes those
> interfaces, this plugin has to follow.

## Shapes

| Shape | Entry point | Notes |
|---|---|---|
| Plugin (in-session tab) | A new **Doc ledger** tab in the right sidebar | The host half serves the page routes; the client half only mounts the tab. The current session refreshes **silently** every 8 seconds (no loading state, no list rebuild), and pauses while the quick-look dialog is open. |
| Static report | `node tools/report.mjs --limit 40` | Emits `report.html`; double-click to read it, no plugin install needed. The output contains real paths and is gitignored. |

The React panel is the **only maintained UI**; the static report just assembles a self-contained HTML file
with `lib/ui.js` at export time. The old `/doc-ledger/ui` page was retired — that second UI had no
open-with menu, no icons and no split view, so keeping it in sync bought nothing.

In the **data model**, `uses[]`, `ext`, `birthtime`, `mtime`, `exists` and `presented` stay in host memory
only: HTTP responses are trimmed by `slimFile()`, because `uses` alone was 30% of the payload and the
client never renders it.

## Screenshots

| File | Content |
|---|---|
| `docs/overview.png` | All sessions: summary line, type chips, expanded Used / Created / Modified |
| `docs/current.png` | Current-session view (folds only this session, so opening the panel never waits for a full replay) |
| `docs/preview.png` | Quick-look dialog: file facts row, truncation/decode notice, body, full path, Esc to close |
| `docs/menu.png` | Context menu: "Preview in sidebar" / "Quick look" first, then "Open with" listing the programs registered for the extension (real icons) |
| `docs/filter.png` | A type filter in effect: the selected chip turns blue and `✕ Clear filters` plus "Expand all" appear on the right |
| `docs/session.png` | Session-card context menu: copy session name / session ID, jump to this session |
| `docs/sort.png` | Per-section sort menu: each section sorts independently, clicking again reverses direction |
| `docs/en-overview.png` | **English UI** (`?locale=en`): same code, same data, different language only |

The workspace in the screenshots (`C:\work\demo-workspace`), the document names and the program list are
all synthetic sample data, not anyone's real project.

## Data model

Each session's log is folded into one record per file:

```
{ path, rel, name, ext, category,
  reads, writes, presented,
  firstUsedAt, lastUsedAt,      // usage history
  createdAt, updatedAt,          // creation / modification time
  created: "confirmed" | "inferred" | null,
  uses: [{ kind, op, time, seq, turn }] }
```

- **Used**: `read`-class tool calls (including `mcp__*__read_file`). Every call keeps a timestamp, which is
  what makes "first / latest / count" and the per-call timeline possible.
- **Created / modified**: `write` and `edit` calls. `created` is tri-state:
  - `confirmed` — delivered explicitly through the `present` tool (event `deliverables/presented` carries the path);
  - `inferred` — the first write had no preceding read. The default observation policy reads before
    overwriting, so "wrote without reading" is effectively a new file;
  - `null` — modified only, not a creation.
- **Failed calls roll back**: a `tool/result` with `isError` is removed from the ledger, so errors never count
  as "used".
- **Working directory**: starts from the session header's `cwd` and follows successful
  `working_directory` calls; relative paths are normalized against the cwd in effect at the time.

## Interface

- **Current session**: two lists, created/modified and used.
- **All sessions**: "Group by session" is on by default (one card per session, split into created/used
  inside the card); turn it off to merge everything into two cross-session lists where each row carries a
  session tag.
- **Sorting**: the used list supports recently used / first used / read count / existence / type / path;
  the created list supports created time / updated time / type / path / existence.
- **Search**: paths, file names, delivery notes, session titles; Ctrl/⌘+K focuses it; matches are **highlighted**.
- **Type filter**: a row of type chips under the summary (docs / sheets / slides / images / code / web /
  config / data / archives / other) showing the actual counts in the current data. Click to filter to one
  type, click again to clear; types with a count of 0 are not shown, and the selection is remembered.
  Chips use a "label + small count" two-level layout (the count is `tabular-nums` and turns blue when
  selected) with a background tint and a 120 ms transition, sharing one shape language with the sort pill
  on the right of each section title.
- **Deleted only**: the "Deleted N" chip on the same row keeps only files that no longer exist on disk
  (123 rows across 23 sessions on this machine) and stacks with type and search. It is a temporary toggle
  and is not persisted.
- **Clear filters**: whenever a type or "deleted" condition is active, a hairline divider and `✕ Clear
  filters` appear to the right of the chips. It is a **text action, not a pill** — visibly a different kind
  of control from a filter chip, in neutral grey (a faint background appears on hover), with feedback for
  both mouse and keyboard. It resets type and "deleted" and keeps the search text (the tooltip says so).
  The "▾ Expand all / ▴ Collapse all" control on the right uses the same action style, right-aligned.
- **Filter feedback**: once search, type or deleted is active, the summary line gains
  "filtered X files / Y sessions", so the list and the summary no longer disagree.
- **Clicking a row**: by default hands the file to DSH's own document preview in the right sidebar
  (Markdown rendering, images, PDF, Office, spreadsheets and syntax highlighting are all the host's job —
  see the next section); `Shift+Enter`, or "Quick look" in the menu, opens this plugin's own dialog.

### Interaction

- **Session cards**: click a title to fold or unfold the whole card. "All sessions" starts collapsed,
  "Current session" starts expanded. The "Expand all / Collapse all" control at the bottom right of a card
  handles every card at once (43 cards go from 43 clicks to 1).
- **Session-card context menu**: when two cards look alike in "All sessions", right-click the card title
  (not a row) to get "Copy session name" / "Copy session ID", with "Jump to this session" below a divider.
  Below that divider sit **subagent links**: the payload carries `parentSessionId`, so a child card gains
  "Jump to parent: <title>" and a parent card lists its loaded children ("Jump to child: <title>", up to 5).
  Jumping calls the host's own `uiWorkspace.openSession(sessionId)` — literally "select that session and
  show its conversation" — so the conversation pane switches and the right sidebar stays put. That service is
  an **optional injection** (`ctx.inject(["uiWorkspace"], …)`); on older DSH builds the menu simply shows the
  two copy entries instead of failing.
- **Lazy mounting**: only cards near the viewport (or focused, or opened) actually build row nodes; the rest
  render just a title. "Collapse all" clears the mounted set — a collapsed card builds no rows anyway, so
  clearing is free, and the next expansion mounts only the cards near the viewport. Fully expanding 43 cards
  went from 204 ms / 8356 nodes to 79 ms / 4172 nodes, filling in as you scroll, with no collapse on scroll-back.
- **Two sections**: "Used" and "Created / Modified" each fold independently; the ▾ or ▸ in front of the
  title is the state.
- **Per-row times**: `created 11-03 14:20 · updated 11-04 09:12` — created and modified times are shown
  together instead of being inferred from the sort; stamps from another year keep their year
  (`2025-11-04 10:33`).
- **Deleted marker**: rows for files that no longer exist on disk are dimmed and tagged "Deleted", with a
  "file no longer exists" tooltip; the preview can still read the historical content (and says why when it
  cannot). The `rev` fingerprint includes the deleted count and the titles, so a file vanishing from disk
  **shows up on a silent poll too** (the old `rev` looked at event counts only and never refreshed).
- **Sorting**: each section title has its own sort button that opens a menu; **clicking the same button again
  closes it**, and clicking the current item toggles ascending/descending (↑/↓).
  - Used: recently used / first used / read count / existence / type / path
  - Created: created time / updated time / write count / existence / type / path
  - Modified: updated time / created time / write count / existence / type / path
  - "Existence ↑" puts files that still exist first; "↓" puts deleted files first.
- **Splitting "Created / Modified"**: "Split" on the right of the section title turns the merged section
  into two independent sections, each with its own fold state and sort:
  - "Created (n)" = files this session **created** (the engine's `created` rule; `present` counts as
    confirmed, write-without-read counts as inferred);
  - "Modified (only) (m)" = files this session **only modified** (`writes > 0 && created === null`), with no
    overlap against the created list; the card title mirrors it as `used u · created n · modified m`;
  - while split, the "Created" section title offers "Merge" to restore the merged list (including every
    written file).
- **Group by session**: on = cards grouped per session; off = one merged list, deduplicated by path, each row
  tagged with its session.
- **Search**: filters file names, relative paths, absolute paths, types and session titles; 150 ms debounce,
  Ctrl/⌘+K to focus. Space-separated terms must **all** match (AND); each term highlights independently and
  overlapping ranges merge; the empty state lists every term. The input's draft state is local, so typing
  re-renders only the input, not a 900-row list.
- **Long sections**: past 100 rows a section shows 100 and offers "Show more (N left)", adding 100 per click —
  the old version truncated at 400 rows with no notice at all.
- **Export**: "Export" in the toolbar copies a Markdown table / CSV / all paths / a summary, scoped to the
  **currently filtered list**.
- **Keyboard**: each card has exactly **one Tab stop** (roving tabindex: only the active row has
  `tabIndex=0`, the rest -1), with ↑/↓ moving row by row and Home/End jumping to the ends — so 40 expanded
  cards cost 40 Tab presses rather than 400+. Enter opens in the host document preview, Shift+Enter opens
  quick look, Shift+F10 opens the row menu, Esc dismisses dropdown → menu → dialog in that order. Card
  titles, section titles and type chips are real `<button>`s (Tab-reachable, Enter/Space activate); the sort
  menu moves with ↑/↓/Home/End, selects with Enter, closes with Esc and returns focus to the chip that opened
  it; the preview dialog is `role="dialog" aria-modal="true"` — focus moves in on open, Tab cycles inside,
  and focus returns to the originating row on close; toasts are `role="status" aria-live="polite"`.
- **Toast bar**: one shape, two tones — copy / refresh / reveal-in-Explorer is teal `✓`, failures are red `!`.
  Click to dismiss immediately, otherwise it fades after 4 seconds (the old version used one dark red for
  everything, which made a successful copy look like an error).
- **Remembered state**: the three sorts, the split toggle, group-by-session, the type filter and the session
  cap are written to `localStorage` (key prefix `dsh.docLedger.v1.`), surviving reloads and panel remounts.
- **Truncation notice**: past `maxSessions` (40 by default) the summary says "latest 40 sessions of 49" and a
  "Load earlier sessions" button appears; each click raises the cap by 40 and refetches until every session is in.
- **Auto refresh**: on by default, every 8 seconds. Refreshing is **silent** — the current list and scroll
  position are preserved and no "Loading…" appears; when the returned `rev` matches the current one the panel
  **does not re-render at all** (0 DOM mutations measured while polling). It pauses while the quick-look
  dialog is open, while the panel is hidden (`document.hidden`), when switched to "All sessions", or when the
  toggle is turned off (`Auto` ⇄ `Paused`, persisted). Closing the dialog triggers one silent refresh.
- **Offline notice**: a failed background refresh adds "Refresh failed: <reason> — click to retry" below the
  summary and keeps the last good data instead of blanking the list.
- **File-row context menu**: Preview in sidebar (the host document preview) / Quick look (this plugin's
  dialog) / Open with (programs registered on this machine, real icons and a default marker) / Choose another
  program… / Reveal in Explorer / Copy full path. Deleted rows only offer a preview.
- **Quick-look dialog**: the top right is a "default program + ▾" split button; the `▾` switches programs,
  opens the system "Open with" dialog, or reveals the file. Next to it, "Sidebar" hands the current file to
  the host's document preview (next section); the full path at the bottom copies on click. A facts row under
  the title shows size · lines · decoding · created/updated · read/write counts; past 200 KB, or when some
  bytes cannot be decoded, a yellow notice row appears above the body (the old version appended `… truncated`
  straight into the body, where it got copied along with the content). "Refresh" re-reads the current file
  and keeps the scroll position.

### Preview: handed to DSH's own document preview by default

DSH's right sidebar already ships a document preview tab
(`@deepseek-ai/dsh-client-ui-sidebar-documentpreview`). It opens a file by **resource address** and
dispatches to eight renderers: `text` / `markdown` / `html` / `image` / `pdf` / `office` / `excel` / `code`.
So this plugin no longer implements image or Markdown rendering of its own; clicking a row hands the address
to the host:

```js
// dsh-resource://file/session/<sessionId>/<path>: backslashes normalize to /, every segment is
// component-encoded, `:` stays literal so a Windows drive letter still reads as C:/…
ctx.sidebarRight.openResource(address);
```

Three boundaries are deliberate:

- **Older DSH without `openResource`**: a failed `typeof` probe falls back to this plugin's own dialog, no error;
- **Deleted files**: the host preview cannot read bytes, so it goes straight to the dialog (which can say
  "file no longer exists: <path>") and the menu never shows a dead button;
- **Reading source rather than rendered output**: `Shift+Enter`, or "Quick look" in the menu, opens the
  dialog with this plugin's own decoder (next section).

### Encoding in preview (applies to the quick-look dialog only)

A ledger records everything a session touched, so encodings are naturally mixed: UTF-8 source, GB18030 SQL
exported from an old project, UTF-16LE from PowerShell redirection, a UTF-8 file with a few GBK lines. Early
versions decoded everything as UTF-8; in the real ledger on this machine, three GB18030 `.sql` files
previewed as 4845 / 6315 / 4022 literal `�`.

The current order (`lib/preview-text.js`, pure functions, unit-tested):

1. BOM first: `EF BB BF` → UTF-8, `FF FE` / `FE FF` → UTF-16LE / BE; the BOM never reaches the body;
2. whole-file UTF-8 when it decodes cleanly (the vast majority of files);
3. otherwise split on `\n` and decode each line as both UTF-8 and GB18030, taking whichever has fewer
   replacement characters, line by line with no cross-talk;
4. a multi-byte character cut at the 200 KB boundary is trimmed by its UTF-8 sequence length before that
   decision, so "half a character" cannot make the tail look like GBK.

Same real files, after: `4845 → 0`, `6315 → 0`, `497 → 29`, `271 → 26`, `425 → 2`. Whatever still cannot be
decoded is reported honestly in `replacements` ("N characters could not be decoded") rather than faked, and a
Node build with a small ICU table (no `gb18030` decoder) falls back to UTF-8.

### Opening files (what bit us)

The host process's PATH may be stripped (`cmd.exe` and `explorer.exe` by bare name give ENOENT), and spawn
errors are asynchronous. Early versions returned 200 right after `spawn`, swallowing the error, which looked
like "clicked, nothing happened". Now:

- always launch by absolute path: `%WINDIR%\explorer.exe`;
- reply 200 only after the `spawn` event confirms, and 500 with a reason on `error`;
- a missing file returns 404 "file no longer exists: <path>", surfaced as a red toast (failures red `!`,
  successes teal `✓`);
- revealing uses the single argument `/select,<path>`; opening uses `explorer.exe <path>` (ShellExecute, i.e.
  the system default association).

Endpoints:

- `GET /doc-ledger/api/apps` → `{apps:[{id,label}]}`, the launchers detected on this machine;
- `POST /doc-ledger/api/open?mode=open|reveal&path=<absolute>[&app=<id>]` (GET returns 405 so a cross-site
  `<img>` cannot start a program);
- icons reuse the host's own `/open-in-app/icon/<id>`.

### Open with: every associated program

There is no separate "open with the system default" entry any more — the menu lists **every program this
machine has registered for the extension**, with the default marked "(default)". All of it comes from the
registry, none of it is guessed:

1. `HKCU\...\Explorer\FileExts\.<ext>\UserChoice` → its `ProgId` is the default;
2. the **value names** of `HKCU\Software\Classes\.<ext>\OpenWithProgids` and `HKCR\.<ext>\OpenWithProgids` are
   the other ProgIds (in these two keys the names live as values, not subkeys);
3. each value of `HKCU\...\Explorer\FileExts\.<ext>\OpenWithList` is either a ProgId (`WorkBuddy.WorkBuddy`)
   or an exe name (`Code.exe`);
4. a ProgId resolves to a command line via `HKCR\<ProgId>\shell\open\command`, then to its first executable;
   an exe name resolves via `HKCR\Applications\<exe>\shell\open\command` or App Paths;
5. deduplicate by lowercased exe path, drop files that no longer exist, mark the `UserChoice` default.

For `.md` on this machine the enumeration yields `VS Code (default)` / `WorkBuddy` / `IntelliJ IDEA`. Results
are cached per extension for 60 seconds.

**Security**: the exe in `/api/open?mode=open&app=<exe>` must appear in that extension's enumeration, or the
request returns 400 ("this program is not registered for .md"); `path` must also be a file that appeared in
the ledger, or 403. Together with POST-only and the same-origin check, this local route cannot be turned into
an arbitrary program launcher by a web page.

### Real program icons

The icons in the list are **extracted from the executable** (what Explorer shows), not initial-letter blocks:

- the host adds `GET /doc-ledger/icon?path=<exe>`, using .NET's
  `[System.Drawing.Icon]::ExtractAssociatedIcon` to pull a 32×32 icon and save it as PNG;
- cache directory `~/.dsh/doc-ledger-icons/`, file name `sha1(exe + mtime)`, so upgrading a program refreshes
  its icon automatically; an in-process Map cache makes the second request roughly 10 ms;
- extraction failure (or a missing file) returns 404 and the client falls back to the letter block, never a
  broken image.

Every item from `/api/openwith` carries an `icon` field that the client loads with `<img>`.

### "Open with" inside the quick-look dialog

The top right of the preview dialog is a **split button** matching the host's own open-with look:

```
[ icon  Open with VS Code ] [▾]     [Close]
```

- left half: the default program's real icon plus "Open with <default>", clicking opens with it;
- right half `▾`: a dropdown listing every program registered for the extension (real icon + name +
  "(default)"), followed by "Choose another program…" and "Reveal in Explorer";
- the dropdown is positioned with `position: absolute` inside the dialog, right-aligned; the dialog container
  is `overflow: visible` so a short preview cannot clip the menu.

"Choose another program…" still calls `rundll32 shell32.dll,OpenAs_RunDLL <path>`, the native Windows
"Open with" dialog, where any installed program can be picked on the spot.

### The launcher was hidden by `windowsHide` (important)

"Reveal in Explorer" and "open with the default program" both used to look like "clicked, nothing happened",
and the root cause was the same:

```js
spawn(explorer, ["/select,", path], { windowsHide: true })   // ← the fatal line
```

On Windows, `windowsHide: true` sets `STARTUPINFO.wShowWindow = SW_HIDE`, so **explorer.exe creates the new
window hidden** — and GUI programs (VS Code, IDEA, …) likewise. The process starts fine, exits with a normal
code, the API returns 200, and nothing appears on screen.

How to verify (whether the window is actually visible, not how many windows exist):

```powershell
# count visible vs hidden among CabinetWClass top-level windows
[W]::EnumWindows(...) + [W]::IsWindowVisible($h)
```

Before the fix: `visible=2 hidden=15`; after dropping `windowsHide`, every reveal bumps `visible` by one and
leaves `hidden` unchanged.

**Rule: any launch the user is supposed to see must not pass `windowsHide`.** Only the helper process that
brings Explorer to the foreground with PowerShell stays hidden (otherwise it flashes a black box).

Also note: `explorer.exe /select,<path>` always opens a **new window**; it does not reuse an existing one.

### The launcher inherited `ELECTRON_RUN_AS_NODE` (subtler, important)

After fixing `windowsHide` one oddity remained, and only on "close the program, then click again": the first
click on VS Code opened a window, and after closing it subsequent clicks did nothing at all.

The cause is that the host itself is Electron, and its process environment carries:

```
ELECTRON_RUN_AS_NODE=1
```

Inherited through `spawn`, **any Electron app (VS Code, Cursor, …) starts in plain Node mode**: `Code.exe
some-doc.md` is executed as `node some-doc.md`, which fails 78 ms later with
`SyntaxError: Invalid or unexpected token` and exits, so a window never appears. It also writes nothing to
`%APPDATA%\Code\logs`, so from the outside it is simply "clicked, nothing happened".

Reproduce (inside the host environment):

```text
Code.exe file.md → stderr: file.md:1  SyntaxError: Invalid or unexpected token → exit 1
```

Fix: launch GUI programs with an environment stripped of the Electron switches:

```js
const env = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^ELECTRON_/i.test(key)) continue;
  env[key] = value;
}
spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false, env });
```

Verify: same exe, same file — with the variable removed the window title immediately becomes
`file.md - Visual Studio Code`, and closing and clicking again works second and third time too.

> Note: native programs such as IntelliJ IDEA are unaffected by that variable; when it is already running, a
> new `idea64.exe` hands the file to the existing instance and exits (the window title becomes the file). That
> is normal JetBrains single-instance behaviour, not a launch failure.

### Sort menu

The menu is positioned with `position: absolute` inside the panel (not fixed), and narrowed horizontally,
flipped vertically and scrolled to the panel's real size, so a narrow sidebar cannot clip it. Each section
binds its own target, so the "Created / Modified" sort no longer pops the "Used" menu.

### Refreshing does not interrupt reading

Early versions set the state to `loading` on every poll, the render function early-returned on that, and the
**preview dialog and the list were unmounted** — after `<pre>` remounted, the scroll position was back at the
top, which looked like "auto-refresh breaks the preview". Three guarantees now:

1. polling is always `silent`: `payload` is replaced only when new data arrives, with no loading state in between;
2. **no polling at all while the preview is open** (`previewRef`); closing it triggers one silent refresh, so
   nothing is missed;
3. the preview dialog is rendered by `renderModal()` **outside** the data branch, so even a real
   `loading`/`error` transition cannot unmount it.

Measured: open the preview, scroll to 260 px, wait 10 seconds (which should have triggered a poll) — same DOM
node, `scrollTop` still 260, 0 loading flashes, 0 requests; close the preview — exactly 1 silent refresh. The
list's scroll position is likewise preserved across polls.

## Security model

The plugin sits on the loopback port the host provides (`127.0.0.1`), but loopback is not safety: any page the
user browses can send requests to `http://127.0.0.1:<port>/doc-ledger/api/...`. So the host side honours
exactly three rules:

1. **Same-origin check**: `Sec-Fetch-Site` of `cross-site`/`same-site`, an `Origin`/`Referer` pointing at
   another site, or `Origin: null` all return 403.
2. **Ledger paths only**: `/api/file`, `/api/open` and `/api/openwith` accept only files present in the
   current cached ledger — `C:\Windows\win.ini` and friends return 403; `/icon` accepts only existing
   `.exe/.ico/.lnk`.
3. **Launching must be POST**: `/api/open` refuses GET, so `<img src=...>`, links and prefetches cannot start
   a program.

The plugin's routes do **not** go through the GUI's login state (the host only protects `/`), so those three
rules are its entire defence.

## Installation (as a plugin)

**A profile is a pnpm project** (`~/.dsh/profiles/<profile>` holds `package.json`, `pnpm-lock.yaml` and
`pnpm-workspace.yaml`). DeepSeek Harness runs an install at startup and **deletes directories that are not
listed as dependencies**, so do not `cp` the package into `node_modules/` — it will disappear on the next
start.

1. Add one GitHub-hosted dependency to the `dependencies` of
   `~/.dsh/profiles/<profile>/package.json` (pnpm clones the repo itself, **no local clone needed**;
   `#v0.4.0` pins the version, dropping the tag tracks the development head):

   ```json
   "dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.4.0"
   ```

   To modify the code or work offline, point it at a local directory instead:

   ```json
   "dsh-doc-ledger": "file:<path>/dsh-doc-ledger"
   ```

   The npm package works as well (`https://www.npmjs.com/package/dsh-doc-ledger`; same code as the GitHub
   tag, without cloning — a private mirror may lag behind):

   ```json
   "dsh-doc-ledger": "0.4.0"
   ```

2. Install with the pnpm bundled in your runtime (`<runtime>` is your runtime directory; **reuse an existing
   store**, otherwise pnpm offers to wipe the whole `node_modules`):

   ```powershell
   node <runtime>/dependencies/pnpm/bin/pnpm.mjs install `
     --config.store-dir=<pnpm-store> `
     --config.confirmModulesPurge=false
   ```

3. Append to the end of `~/.dsh/profiles/<profile>/cordis.patch.yml`:

   ```yaml
   # dsh-doc-ledger: per-session document ledger sidebar tab
   - insert:
       - id: doc-ledger
         name: dsh-doc-ledger
         config:
           maxSessions: 40
           debug: false
   ```

4. Reload the page (the client bundle has to be re-injected) — the **Doc ledger** tab appears in the right
   sidebar.

Verify:

- `GET /doc-ledger/api/all?scope=all` returns 200 with a `sessions[]`;
- `GET /doc-ledger/api/all?scope=current&session=<id>&timing=1` returns 200 and `data.timings.total` is
  usually under 20 ms;
- the **Doc ledger** tab is in the right sidebar and shows the current session.

## Switching profiles

The same three steps with `desktop` replaced by the target profile name.

## Known limitations

- **The session directory layout is an implicit contract**: the fingerprint comes from
  `~/.dsh/sessions/<project>/<session id>/session.v4.jsonl.zstd`. If that structure is missing (different
  `DSH_HOME`, changed runtime layout) it falls back to the old TTL invalidation — still correct, just slower.
- **Lazy card mounting**: cards far from the viewport show only a title, and rows are built once you scroll or
  focus them. Dragging the scrollbar to the far end shows a few frames of titles before the rows fill in; that
  is the price of "build on demand" against a full first frame for 43 expanded cards.
- **`exists` is cached for 20 seconds**: a file deleted on disk shows as "Deleted" up to 20 seconds later.
- **UI is bilingual (zh / en)**: the `locale` dictionary covers every string in the panel (159 keys) and
  follows the host's UI language; data itself (session titles, file names, paths, program names) is shown
  as-is and not translated. See [`docs/i18n.md`](docs/i18n.md) for how it works and how it is verified.
- **Files created by a shell do not count as created**: a file written by `git diff > x.diff`, PowerShell
  redirection or an unzip has no path argument to capture, so it only shows up under "used" once something
  reads it. Covering that would require the runtime to report shell file writes.
- **A whole-file write counts as creation**: if a program overwrites an existing file without reading it
  first (PTC's `fs.writeFileSync` allows this), it is recorded as created. Checked against file birth times
  across all 43 sessions on this machine: 0 false positives.
- **Mixed encoding is heuristic**: if exactly one line of a UTF-8 file is left with a single bad byte, it may
  be read as "looks fine" GBK; bytes that truly cannot be decoded are reported as such.
- **Quick look shows only the first 200 KB**: use "Sidebar" or "Open with" for the full content.
- **Windows only**: registry enumeration, `explorer.exe` and the PowerShell icon extraction are all Windows
  implementations.
- **Two host capabilities are optional** and degrade silently when missing: `uiWorkspace.openSession` (no jump
  entry) and `sidebarRight.openResource` (falls back to this plugin's own dialog).

## Traps we hit

Each entry follows **symptom → cause → fix**. The long reproductions stay in the body sections
linked from here.

### Host API contracts

- **`listSessions()` returns nested records, not flat ones.** Symptom: reading `record.id` or
  `record.cwd` gives `undefined`. Cause: the shape is
  `{ header: { id, createdAt, cwd, agentPreset }, live, persisted }`. Fix: read through `header`.
- **A live session may have no header event at all.** Symptom: relative paths cannot be resolved and
  `/api/file` answers ENOENT. Cause: the header event is folded into `data`, and sometimes never appears
  in the stream. Fix: `buildLedger` accepts `options.header` so the caller can seed it from the session
  listing.
- **`readTitleSnapshots()` has two value shapes.** Symptom: titles render as `[object Object]`. Cause:
  it returns `[{ status, value: { session, title } }]`, and `title` is either a string or a snapshot
  object. Fix: accept both.
- **Desktop loads the front end over `file://`.** Symptom: `/plugins/*` client-asset routes never
  resolve, so an HTTP probe cannot tell whether the tab registered. Cause: the desktop shell does not
  serve those routes. Fix: the client bundle is injected from the boot manifest after a browser reload;
  verify in the page, not over HTTP.

### Runtime and platform

- **`windowsHide: true` hides the window you just launched.** Symptom: the process starts, exits 0, the
  API returns 200, and nothing appears. Cause: it sets `STARTUPINFO.wShowWindow = SW_HIDE`, so
  `explorer.exe` and GUI apps create a hidden window. Fix: never pass `windowsHide` for a launch the user
  should see — see [the launcher section](#the-launcher-was-hidden-by-windowshide-important).
- **`ELECTRON_RUN_AS_NODE` leaks into spawned GUI apps.** Symptom: the first click opens VS Code, and
  after closing it, later clicks do nothing. Cause: the host's environment carries
  `ELECTRON_RUN_AS_NODE=1`, so `Code.exe doc.md` runs as `node doc.md` and dies with a SyntaxError. Fix:
  spawn GUI programs with an environment stripped of `^ELECTRON_` — see
  [the launcher section](#the-launcher-inherited-electron_run_as_node-subtler-important).

### Front-end rendering

- **A flex column with `maxHeight` squeezes the small rows.** Symptom: the 11px rows in the preview
  dialog clip mid-glyph and look like they are covered by the body. Cause: a height deficit is distributed
  over *every* child, so the rows shrink while the body keeps its height. Fix: `flex: 0 0 auto` plus an
  explicit `lineHeight` on every non-body row, and `flex: 1 1 auto; minHeight: 0` on the body. Measured in
  a 520×320 window: the meta / notice / footer rows stay 27 / 27 / 29 px, nothing clipped.
- **`requestAnimationFrame` is throttled to ~1 s** in a non-composited page (measured 594/1000/1000 ms).
  Symptom: chunked expansion appears frozen. Fix: chunk with `setTimeout(…, 0)`; rAF would make
  "Expand all" feel broken.
- **A roving index must count only rows that actually render.** Symptom: collapsing the first section
  leaves the card with no Tab-reachable row, and arrow keys land on the wrong row. Cause: indices were
  assigned over all sections while collapsed ones build no DOM. Fix: number only rendered, expanded rows.

### Caching, tests and other

- **Polling a live session used to replay the whole log.** Symptom: a CPU spike on every 8 s poll of a
  busy session. Cause: every streamed token changes the log's `size:mtime` fingerprint, so the
  exact-stamp cache never hit. Fix: a 15-second replay floor for silent polls (`force=1` and `timing=1`
  still replay fully). Measured on a 290 KB log: a real replay is 26–42 ms of `replay`, 51–67 ms wall
  clock — the ~1 s figure from profiling was 32 sessions replaying cold, not one poll.
- **A stale assertion hides a real behaviour change.** Symptom: a passing test that no longer describes
  the code. Cause: after the i18n pass, `categoryLabel("unknown")` returns the localized "Other" instead
  of echoing the raw category, and the old expectation still passed for the wrong reason. Fix: make the
  assertion state the new contract.
- **The dictionary must not be frozen at evaluation time.** Symptom: switching language leaves category
  and sort labels in Chinese. Cause: `CATEGORY_LABEL` and the sort-key tables are built when the factory
  is evaluated, before `apply()` installs the translator. Fix: store keys in those tables and resolve
  them through `t()` at render time.

## Routes

`http://127.0.0.1:<port>/doc-ledger/...`

| Route | Method | Purpose |
|---|---|---|
| `/api/all?scope=all\|current&session=<id>&limit=<n>&timing=1&force=1` | GET | The ledger payload; `scope=current` folds only one session, `timing=1` adds timings and bypasses caches, `force=1` forces a replay |
| `/api/file?path=<absolute>` | GET | Quick-look bytes (≤200 KB), with `ETag` / `If-None-Match` → 304 |
| `/api/openwith?path=<absolute>` | GET | Programs registered for the extension, with icons and the default marker |
| `/api/open?mode=open\|reveal&path=<absolute>[&app=<id>]` | **POST** | Launch or reveal; GET returns 405 |
| `/icon?path=<exe>` | GET | Real 32×32 PNG icon extracted from the executable |
| `/api/_clienterror` | POST | Opt-in client diagnostics, ignored unless `debug: true` |

## Requests and caching (performance)

| Technique | Effect |
|---|---|
| `?scope=current&session=` folds one session | 613 KB → 19 KB, 1.7 s → 15 ms |
| gzip + `slimFile()` | 613 KB → 31 KB full payload |
| 3-second snapshot cache + `rev` fingerprint | repeat requests and polling cost ≈ 0; 0 DOM changes while `rev` is unchanged |
| Log `size+mtime` fingerprint + per-session ledger on disk | cold full build 8.3 s → **0.9 s**; closed sessions never replay again |
| "Expand all" in batches of 8 cards | 170 ms of blocking → **78 ms**, no task over 50 ms |
| Batched icon extraction (one PowerShell call for N) | 6 icons 1288 ms → 255 ms |
| 200 KB preview cap + `ETag` | big files cannot blow up memory; unchanged files answer 304 |
| 15-second replay floor for live sessions | a silent poll of a busy session reuses the last fold |

Ledger caching lives in `~/.dsh/doc-ledger-ledgers.json.gz`, keyed by the log's `size:mtime` stamp. The cache
format and the ledger engine each carry a version (`LEDGER_VERSION`, `LEDGER_ENGINE`), so a change to either
invalidates every entry rather than producing a wrong answer, and at most 250 sessions are kept.

## Verified / not verified

Verified on this machine (Windows, DSH `>=0.2.0-rc.1 <0.3.0-0`, 43 sessions of which 32 are on disk):

- the ledger engine: 7 PTC scenarios (`write`/`edit` tools, in-program `fs.writeFileSync`, absolute-path
  literals, failed-call rollback, `working_directory` switching);
- the decoder: 10 encoding scenarios (BOM, UTF-8, per-line GB18030, truncated tail);
- host routes and the security matrix: 14 assertions (same-origin 403, ledger allowlist, POST-only,
  400/404/405, unknown route 404);
- cache decisions: 8 assertions (exact stamp, TTL fallback, live replay floor);
- client pure functions: 32 assertions (AND search, sorting, cross-session merge, formatting, highlight range
  merging, `dsh-resource://` addresses);
- i18n: 159 keys with matching zh/en sets, references and placeholders;
- the UI, in a browser via `npm run harness` in both languages.

Not verified:

- real GUI slots and the aria tree of the actual window (the GUI answers 401 to automation, so the harness
  stands in; it uses the real `client.js` against a fake cordis context);
- Linux and macOS (the launch and icon code is Windows-only by construction);
- very large ledgers (thousands of files in one session).

## How a PTC preset session is recorded

PTC (programmatic tool calling) sessions do not call `write`/`edit` as separate tool calls; they run a program
that calls `fs.writeFileSync` inside it. The engine therefore reads three channels:

1. tool calls with a `file_path` argument (`write`, `edit`, `mcp__*__read_file`, …);
2. `tools.xxx({ file_path })` calls inside a PTC program, found in the program text;
3. absolute-path literals in the program text.

All three run through the same first-touch creation rule, so a PTC session and a plain tool-calling session
produce the same ledger shape.

## How the current session is located

The panel receives the active session id directly as the standard `sessionId` prop; the snapshot selector is
only a fallback for older slot signatures. That is why the tab opens instantly on the right session without
any extra round trip.

## Files

```
index.js             host plugin: routes, snapshots and caches, registry enumeration, icon extraction
client.js            client plugin: the sidebar tab (assembled from src/client/*.js — do not edit by hand)
src/client/*.js      client sources, 15 fragments by responsibility; run npm run build:client after editing
lib/ledger.js        engine: events -> per-file ledger (pure functions, no dependencies)
lib/ui.js            static report only: assembles a self-contained HTML file
lib/ui.css           static report only
lib/ui.client.js     static report only: list / sort / search in the browser
lib/preview-text.js  preview decoding: BOM / UTF-8 / per-line GB18030 fallback (pure functions, no dependencies)
tools/build-client.mjs      deterministic concatenation of src/client/*.js into client.js (--check verifies)
tools/i18n-check.mjs        i18n integrity: key sets, references, placeholders
tools/i18n-extract.mjs      extracts remaining hard-coded Chinese strings into docs/i18n-strings.md
tools/report.mjs     static report generator (reuses the same engine)
tools/ledger-scan-check.mjs    engine regression: 7 PTC write scenarios
tools/preview-decode-check.mjs decoder regression: 10 encoding scenarios
tools/harness/                 UI verification: real client.js + fake ctx + synthetic ledger (npm run harness)
tools/route-check.mjs          host route and security regression: 14 assertions
tools/cache-check.mjs          cache decision regression: 8 assertions
tools/client-core-check.mjs    client pure functions: 36 assertions
tools/readme-check.mjs         bilingual README parity: section counts and order, links, anchors
tools/release-notes-check.mjs  release-note parity: English twin, structure, tag-pinned images
```

`npm test` runs six regression scripts in order (engine 7 + decoder 10 + routes/security 14 + cache 8 +
client 36 + i18n's 159-key integrity check + README parity 7 + release notes 9 = **91 checks**, no external
dependencies), and CI runs them on three Node versions. CI also runs `npm run check:client` to prove that the
committed `client.js` matches `src/client/*.js` byte for byte.

For UI changes, look at the panel in a browser with `npm run harness`: it serves the real `client.js` against
a fake cordis context and a synthetic ledger, and its fixture deliberately contains "a multi-word search that
must match only one file", "a deleted file" and "a subagent session". See `tools/harness/README.md`. Add
`?locale=en` (or `?locale=zh`) to check both languages.

The engine depends on no `@deepseek-ai/*` package; the host and client use only Node built-ins and `ctx`
services. The client bundle is hand-written — **the split into fragments is for readability and testability
only**: the host loads a single `factory` closure (`require` injects react and nothing else), so the sources
are concatenated in a fixed order into one `client.js` with no bundler. Every UI string goes through `t("key")`;
see `docs/i18n.md` for the dictionaries and how they are verified.
