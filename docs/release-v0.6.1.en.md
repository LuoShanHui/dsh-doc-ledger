# v0.6.1 · Documentation fixes

[Read this in Chinese](release-v0.6.1.md) · **English**

No code changes. After publishing 0.6.0, a review found that both READMEs still described the
interface from **before** the rewrite.

## What changed

| Where | Said | Actually |
|---|---|---|
| Type filter | "click one and a second row appears below" | three flat rows: family / narrow / selected |
| "Deleted only" | "the chip on the same row" | at the **end of the family row** |
| Clear filters | "a hairline divider right of the chips" | at the **end of the third row** |
| Test tally | 173 checks | 187 checks |

Four behaviours the docs never mentioned are now documented:

- **A family and its own extensions are exclusive**: ticking "code" clears `code/*`, ticking
  `code/java` un-ticks "code".
- **Multi-select is a union**: two ticked families list both kinds, never an intersection.
- **A two-column grid**: the label owns one column and the chips wrap inside the other, so every
  wrapped line keeps the same left edge.
- **Extensions fold past 8** into a counter that expands in place and collapses again; a ticked
  extension is always promoted to the front.

Two easily-misread details are documented too: "deleted only" is a **view switch, not a type**, so
it reflects its own state rather than its count (armed with nothing matching shows 0 and stays
highlighted); and "clear filters" appears when only "deleted" is on — that is the only way back out
of that toggle.

## Upgrading

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.6.1"
```

Or npm: `"dsh-doc-ledger": "0.6.1"`.

The code is identical to 0.6.0; there is no need to upgrade if you are already on 0.6.0.