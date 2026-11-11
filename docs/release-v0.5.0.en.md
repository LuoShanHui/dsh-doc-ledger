# v0.5.0 · Themes, real file icons, and file sizes

[Read this in Chinese](release-v0.5.0.md) · **English**

Sixteen commits after v0.4.0, four of them change what you actually see: four switchable themes,
real file icons, a size on every row — and a fix for "the whole panel is broken in dark mode",
which is the first item below because it was a failure, not a matter of taste.

## Dark mode was completely broken

The panel referenced three host tokens that **do not exist**:

| Written | Actually declared |
|---|---|
| `--dsw-alias-accent` | `--dsw-alias-brand-primary` |
| `--dsw-alias-border` | `--dsw-alias-border-l1` / `-l2` |
| `--dsw-alias-label-tertiary` | nothing (only `-primary` / `-secondary`) |

A misspelled `var()` does not fail — it **silently takes the fallback literal**, and every one of
those literals was a light-mode colour. So in a dark theme the panel had a white background, dark
grey text, and buttons you could barely find.

Two related fixes: `hoverOff` hardcoded the label to dark grey (moving the pointer away made the
text vanish on a dark theme), and hover wrote to `element.style` imperatively, so the old theme's
wash survived a theme switch.

All fourteen tokens are now spelled exactly as the Theme provider declares them, and the semantic
colours are derived with `color-mix(in oklab, …)`. `theme-check` gained two assertions to keep it
that way: colours may only name a real token, and the style table may not contain a literal
hex/rgba value.

## Four themes

The toolbar's **Theme** dropdown offers four looks, ticks the active one, and remembers the choice
across reloads:

| Theme | Structure |
|---|---|
| **Compact** | VS Code density: 22px rows, hairline separators, no decoration (default) |
| **Airy** | every separator removed; whitespace groups the rows, type grows, weight carries the hierarchy |
| **Table** | monospace names, zebra stripes, right-aligned tabular numbers, uppercase headings |
| **Card** | floating panels with a 3px accent rail on each head, shadow and large radii |

These are not tuned by eye. The references were read:

- **shadcn/ui `globals.css`** — one `--radius` expanded into a five-step scale, and every
  translucent value mixed in `oklab`, so a 6% wash looks equally dense on white and on near-black.
- **VS Code `explorerviewlet.css`** — dense rows are a fixed 22px with `line-height` equal to the
  row height, `flex-wrap: nowrap`, `min-width: 0` and ellipsis. **Those four points are why a
  narrow list stays readable**, not the palette.

## Real file icons, with a three-tier fallback

The 7×7 colour block in front of each row is now a real icon, resolved A → B → C:

- **A** — DSH's own `FileTypeIcon`, reached through the platform seed table with
  `require("@deepseek-ai/dsh-client-ui-primitives")`; that package is one of the ten modules every
  client bundle may require by name. **Confirmed on a real session (`tier-A: ok`)**, so the glyph
  is identical to the one the rest of the DSH UI draws.
- **B** — the actual Windows association icon, extracted per extension by the host through
  shell32's `SHGetFileInfo` and cached in `~/.dsh/doc-ledger-fileicons/`. `app.getFileIcon` is
  unreachable from the plugin process (a plain Node child of Electron), so this is the honest
  substitute. Verified against IntelliJ's Java icon, the JSON braces, Markdown's M.
- **C** — a drawn badge with the extension on a per-type tint. Always available, and it sits
  underneath the tier-B image, so it doubles as the loading placeholder and the 404 fallback —
  which is why switching tiers never shifts a row.

## File size on every row

The read/write counters now carry `· 4.2 KB`.

The size comes from the host's `statOf()`: it already ran one `statSync` per file to answer
`exists`, and the same call now returns `size` too, so this adds **no I/O at all**. Size describes
the disk right now rather than the log, so it is cached on the same 20-second TTL and stays out of
the ledger cache — a file that grows emits no event, and a cached size would be wrong the moment
the next write landed. A deleted file shows no size, because there is no honest number to show.

## A diagnostics channel that had never worked

`report()` gated on `window.__DOC_LEDGER_DEBUG__ === true`, and **nothing in the codebase ever set
that global**. All seventeen call sites returned silently; the host log had not been written since
11-04, and setting `config.debug: true` changed nothing.

The host now serves `GET /api/config` with `{ debug, maxSessions }` and the client reads it at the
top of `applyInner`. Because that answer is asynchronous while the most valuable reports (`eval`,
`apply: enter`, `tab-ok`) are emitted before it arrives, reports queue until it resolves: flushed if
debug is on, discarded if it is off.

It worked immediately — the log confirmed `apply: tab-ok`, `host-preview:yes`, `session-nav:yes`.

## Also

- **One timestamp per row**, chosen by the section it sits in (used → last-used, modified →
  updated, created → created). Every section used to print both "created" and "updated", two
  stamps that are usually minutes apart, and the width pushed rows onto two lines. The long-standing
  horizontal scrollbar is gone too.
- **Tests** went from 101 to 128: new `theme-check` (9) and `row-time-check` (6), plus the section
  decisions extracted from `SessionCard` into eight pure functions (`client-core-check` 43 → 53).
- **Host refactor**: the 105-line `snapshot()` became `normalizeRecords` / `foldSessions` /
  `shapePayload` plus an orchestrator.

## Upgrade

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.5.0"
```

Or npm: `"dsh-doc-ledger": "0.5.0"`.

Reload the page afterwards. The theme choice lives in `localStorage`, so if you picked one before,
it is kept.
