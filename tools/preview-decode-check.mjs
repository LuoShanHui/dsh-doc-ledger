/**
 * Regression checks for the preview decoder (lib/preview-text.js).
 *
 * Run with `node tools/preview-decode-check.mjs`. The fixtures are built in
 * memory, so the check needs no sample files and cannot drift with the machine.
 */
import assert from "node:assert/strict";
import { decodePreview, countLines, countReplacements } from "../lib/preview-text.js";

const cases = [];

/** GB18030 for "数据库脚本" — the shape of a legacy Chinese SQL dump. */
const GBK_LINE = Buffer.from([0xca, 0xfd, 0xbe, 0xdd, 0xbf, 0xe2, 0xbd, 0xc5, 0xb1, 0xbe]);

function utf16le(text, bom = true) {
  const body = Buffer.from(text, "utf16le");
  return bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), body]) : body;
}

{
  const got = decodePreview(Buffer.from("# 标题\n正文\n", "utf8"));
  assert.equal(got.encoding, "utf-8");
  assert.equal(got.replacements, 0);
  assert.equal(got.text, "# 标题\n正文\n");
  cases.push("plain utf-8 stays utf-8");
}

{
  const got = decodePreview(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("你好", "utf8")]));
  assert.equal(got.encoding, "utf-8");
  assert.equal(got.text, "你好");
  cases.push("utf-8 BOM is dropped, not shown as a character");
}

{
  // A GB18030 file has no valid UTF-8 reading, so before this decoder the preview
  // showed one U+FFFD per byte.
  const buffer = Buffer.concat([Buffer.from("-- 注释\n", "utf8"), GBK_LINE, Buffer.from("\n", "utf8")]);
  const naive = Buffer.from(buffer).toString("utf8");
  assert.ok(countReplacements(naive) >= 5, "fixture must look broken as plain UTF-8");
  const got = decodePreview(buffer);
  assert.equal(got.encoding, "utf-8+gb18030");
  assert.equal(got.replacements, 0);
  assert.equal(got.text, "-- 注释\n数据库脚本\n");
  cases.push("gb18030 file decodes instead of turning into U+FFFD");
}

{
  // The mixed shape: UTF-8 header, GBK lines appended by an old tool.
  const buffer = Buffer.concat([
    Buffer.from("# UTF-8 标题\n", "utf8"),
    GBK_LINE,
    Buffer.from("\nUTF-8 tail\n", "utf8")
  ]);
  const got = decodePreview(buffer);
  assert.equal(got.encoding, "utf-8+gb18030");
  assert.equal(got.replacements, 0);
  assert.equal(got.text, "# UTF-8 标题\n数据库脚本\nUTF-8 tail\n");
  cases.push("mixed utf-8 + gb18030 decodes per line");
}

{
  const got = decodePreview(utf16le("数据库 脚本\n第二行\n"));
  assert.equal(got.encoding, "utf-16le");
  assert.equal(got.replacements, 0);
  assert.equal(got.text, "数据库 脚本\n第二行\n");
  cases.push("utf-16le BOM (PowerShell redirect) decodes");
}

{
  const body = Buffer.from("ab", "utf16le");
  const got = decodePreview(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from([0x00, 0x61, 0x00, 0x62])]));
  assert.equal(got.encoding, "utf-16be");
  assert.equal(got.text, "ab");
  assert.equal(body.length, 4);
  cases.push("utf-16be BOM decodes");
}

{
  // The cap cuts a 3-byte character in half; that artifact must not render as U+FFFD.
  const full = Buffer.from("汉字", "utf8");
  const cut = full.subarray(0, 4);
  const got = decodePreview(cut, { truncated: true });
  assert.equal(countReplacements(got.text), 0);
  assert.equal(got.text, "汉");
  assert.equal(got.encoding, "utf-8");
  cases.push("cap cutting a multi-byte character leaves no U+FFFD");
}

{
  // One stray byte must not flip a whole line to GB18030.
  const buffer = Buffer.concat([Buffer.from("abc", "utf8"), Buffer.from([0xff]), Buffer.from("\ndef\n", "utf8")]);
  const got = decodePreview(buffer);
  assert.equal(got.encoding, "utf-8");
  assert.equal(got.replacements, 1);
  assert.ok(got.text.startsWith("abc"));
  cases.push("a stray byte that is not valid GBK stays UTF-8");
}

{
  const got = decodePreview(Buffer.alloc(0));
  assert.deepEqual(got, { text: "", encoding: "utf-8", replacements: 0 });
  cases.push("empty file decodes to empty text");
}

{
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a"), 1);
  assert.equal(countLines("a\nb\n"), 3);
  cases.push("line count matches editors");
}

console.log("ok - " + cases.length + " checks");
for (const label of cases) console.log("  · " + label);
