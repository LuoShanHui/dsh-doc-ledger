# v0.6.0 · A three-row type filter, and three silent data losses

[Read this in Chinese](release-v0.6.0.md) · **English**

Two things in this version: the type filter moves from a pop-up tree to three inline rows (which
also fixes the fact that it was never keyboard-operable), and three engine defects that **lost
data without reporting anything**.

## The type filter: three rows, exclusive levels, union results

The previous pop-up had two problems: the second level hid behind a click, and it was **completely
unusable from the keyboard** — every row was `tabIndex: -1` with no `onKeyDown`, so you could open
it, see it, and select nothing.

Now there are three rows:

| Row | Content | Behaviour |
|---|---|---|
| 1 | Every family, plus "deleted only" | Flat, wraps, multi-select |
| 2 | Extensions of the ticked families | Multi-select, **across families** |
| 3 | The ticks, plus `✕ Clear filters` | Each with its own `×` |

Three rules live in one constructor, `typeFilterOf`, which every state change goes through:

- **A family and its own extensions are exclusive**: ticking "code" clears `code/*`, ticking
  `code/java` un-ticks "code". "All of it" and "part of it" are different questions, and holding
  both would be a filter that cannot be explained. Other families are untouched — which is what
  lets `code/java` and `config/yml` coexist.
- **The result is a union**: two ticked families list both kinds. An intersection would be empty
  the moment a second family was ticked.
- **`""` is a real value**: it means "files with no extension", not "nothing chosen".

## Three silent data losses

### 1. Path concatenation swallowed writes

The scanner checked whether a string was followed by `+`, but never whether it was the right-hand
side of one. So the tail of `process.cwd() + "/lib/ledger.js"` was recorded as a document of its own:

```js
const mod = await import(pathToFileURL(process.cwd() + "/lib/ledger.js").href);
// -> a row for "/lib/ledger.js" that cannot be previewed or opened
```

Across 717 literal-derived uses on this machine, 55 resolved to a non-absolute path; of the 132
rows supported only by a literal, **63 do not exist on disk at all**. With the symmetric check in
place, phantom rows went from 17 to 0 without losing a single real one.

### 2. Path prefixes were flattened

`resolvePath` split a path into segments and joined them again, throwing the prefix away:

| Input | Before | After |
|---|---|---|
| `\\server\share\x.md` | `server\share\x.md` | `\\server\share\x.md` |
| `/abs/x.md` | `abs\x.md` | `D:\abs\x.md` |

This is not merely ugly: reduced to a bare name, it can **collide with a real file in the working
directory**, making an unrelated document look like the one that was opened. The four shapes —
UNC, drive-letter, rooted, relative — are now handled separately, and `..` cannot walk past the
anchor.

### 3. The engine fingerprint ignored the scanner

`ENGINE_FINGERPRINT` hashed only the classifier tables and the engine number. Fixing the two
defects above therefore **left every cached ledger valid**, so users kept seeing the old rows until
someone bumped the engine number by hand.

The content hash of `lib/ledger.js` is now part of the fingerprint. The gap was found by testing,
not by reasoning: after the scanner fix the phantom rows were still on screen.

## The rest of the UI defects

- **The "deleted" count disagreed with its own list**: the count accumulated every missing file
  while the list went through the filter. On a real ledger, 18 of 20 filter combinations were
  wrong — the chip read 548 no matter what, while the actual row count ranged from 0 to 210. Both
  now share one condition set.
- **The toggle was bound to its own count**: `aria-pressed` followed the count, so "deleted only"
  read 0 and looked switched off under a type that contained no missing files. The toggle now
  reflects its own state; the number is information.
- **Search highlighting never rendered**: `highlight()` was always correct, but `Section` read a
  `props.query` that nobody passed. Rather than passing it, the second channel was **deleted** —
  the query now lives only inside `conditions`, for the same reason the filter terms were
  collapsed into one object.
- **Highlighting drifted on characters whose case folding changes length**: `İ` lowercases to two
  code units, so slicing the original with lowered offsets marks the wrong text. Searching
  `notes` in `doc-İstanbul-notes.md` highlighted `otes.` Now each code point is folded on its own
  with a map back to the original.

## Tests

128 -> 139. Beyond covering each defect above, two **structural guards** were added, because the
lesson of this round was not "a function was wrong" but "the function was right and nobody called it":

1. Every tested pure function must have at least one call site in `client.js`. `extensionChips`
   had four green assertions while a refactor had left it with **no caller at all** — the tests
   supplied false confidence.
2. The query must not have a second channel. If `props.query` ever comes back, the wiring has
   forked again.

The **harness now works offline**: the React 18 UMD builds are vendored into
`tools/harness/vendor/`. It is the only way to verify UI work, yet it depended on an unpkg
redirect and showed a blank page on a machine without a network.

## Upgrading

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.6.0"
```

Or npm: `"dsh-doc-ledger": "0.6.0"`.

**The first open after upgrading will pause noticeably** — the engine fingerprint changed, so every
cached ledger is discarded and re-folded. About 4.5s for 82 sessions on this machine, then normal
again (later polls use the exact `size:mtime` stamp).

If your dependency uses `file:`, note that pnpm treats a local directory as a **one-time copy**:
after editing the source you must reinstall or copy over it, or you will keep running the old bundle.