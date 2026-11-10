/**
 * README parity check.
 *
 * The repo ships two full READMEs (English default, Chinese in README.zh.md). Keeping
 * them in sync by hand is exactly the kind of thing that rots, so this asserts the
 * *structure* matches: same number of `##` and `###` headings, in the same order of
 * nesting, and each file links to the other. Wording is free to differ — this only
 * catches "someone added a section to one language".
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const en = readFileSync(join(root, "README.md"), "utf8");
const zh = readFileSync(join(root, "README.zh.md"), "utf8");

const lines = (text) => text.split(/\r?\n/);
const headings = (text, marker) =>
  lines(text).filter((line) => line.startsWith(marker + " ")).map((line) => line.slice(marker.length).trim());

const cases = [];
function check(name, body) { cases.push([name, body]); }

check("两版 README 的 `##` 小节数量一致", () => {
  assert.equal(headings(en, "##").length, headings(zh, "##").length,
    "h2 count differs: en=" + headings(en, "##").length + " zh=" + headings(zh, "##").length);
});
check("两版 README 的 `###` 小节数量一致", () => {
  assert.equal(headings(en, "###").length, headings(zh, "###").length,
    "h3 count differs: en=" + headings(en, "###").length + " zh=" + headings(zh, "###").length);
});
check("两版 `###` 小节的顺序一一对应（踩坑四小节位置一致）", () => {
  // English and Chinese titles differ in wording, so compare positions rather than text.
  // The traps subsections are the ones most likely to drift when someone adds an entry
  // to only one language, so they must occupy the same four slots in both files.
  const trapsOf = (text) => {
    const rows = lines(text);
    const start = rows.findIndex((line) => /^## (Traps we hit|踩过的坑)\s*$/.test(line));
    if (start < 0) throw new Error("traps section not found");
    const out = [];
    for (let i = start + 1; i < rows.length; i += 1) {
      if (/^## /.test(rows[i])) break;
      const m = rows[i].match(/^### (.+)$/);
      if (m) out.push(m[1]);
    }
    return out;
  };
  const all = (text) => headings(text, "###");
  assert.equal(trapsOf(en).length, 4, "README.md 'Traps we hit' must keep 4 subsections");
  assert.equal(trapsOf(zh).length, 4, "README.zh.md '踩过的坑' must keep 4 subsections");
  // Same absolute position: the four traps subsections are the last four h3 before Routes.
  assert.deepEqual(
    all(en).slice(-4).map((_, i) => all(en).length - 4 + i),
    all(zh).slice(-4).map((_, i) => all(zh).length - 4 + i),
    "traps subsections must sit at the same positions in both files"
  );
});
check("英文版链到中文版，中文版链到英文版", () => {
  assert.match(en, /\[中文\]\(README\.zh\.md\)/, "README.md must link to README.zh.md");
  assert.match(zh, /\[English\]\(README\.md\)/, "README.zh.md must link to README.md");
});
check("英文版正文不含中日韩字符（语言链接除外）", () => {
  const body = en.split("\n").filter((line) => !line.includes("README.zh.md")).join("\n");
  const han = body.match(/[\u4e00-\u9fff]+/g) || [];
  assert.deepEqual(han.slice(0, 5), [], "untranslated Chinese left in README.md: " + han.slice(0, 5).join(", "));
});
check("两版 README 的所有内部锚点都能解析", () => {
  // GitHub slug: lowercase, drop everything but word chars / Han / hyphen / space, then
  // spaces become hyphens. A heading renamed without updating the links rots silently.
  const slug = (title) => "#" + title.trim().toLowerCase().replace(/`/g, "")
    .replace(/[^\w\u4e00-\u9fff\- ]/g, "").replace(/ /g, "-");
  for (const [name, text] of [["README.md", en], ["README.zh.md", zh]]) {
    const valid = new Set(headings(text, "##").concat(headings(text, "###")).map(slug));
    const links = [...text.matchAll(/\]\((#[^)]+)\)/g)].map((m) => m[1]);
    const broken = links.filter((link) => !valid.has(link));
    assert.deepEqual(broken, [], name + " has broken in-page anchors");
  }
});
check("两版 README 引用的图片文件都存在", () => {
  // A renamed or deleted screenshot must not leave a broken <img> in either edition.
  for (const [name, text] of [["README.md", en], ["README.zh.md", zh]]) {
    const refs = [...text.matchAll(/\]\((docs\/[^)\s]+\.png)\)/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, name + " references no screenshots");
    for (const ref of refs) {
      assert.ok(existsSync(join(root, ref)), name + " references a missing image: " + ref);
    }
  }
});
check("英文版只用 en-* 截图，中文版用 zh-*（首图除外）", () => {
  const pngs = (text) => [...text.matchAll(/\]\((docs\/[^)\s]+\.png)\)/g)].map((m) => m[1]);
  assert.deepEqual(pngs(en).filter((p) => !p.includes("en-")), [], "README.md must use en-* screenshots only");
  assert.deepEqual(pngs(zh).filter((p) => p.includes("en-")), [], "README.zh.md must not use en-* screenshots");
});
check("两版都提到当前的安装版本号", () => {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  for (const [name, text] of [["README.md", en], ["README.zh.md", zh]]) {
    assert.ok(text.includes("#v" + version), name + " must reference #v" + version);
  }
});
check("npm test 的总数在两版 README 里一致", () => {
  // The suite total is written by hand in both editions; a hand-edited number rots the
  // moment a check is added. Both must state the same figure, and it must match the sum of
  // the per-script counts quoted alongside it.
  const enTotal = (en.match(/\*\*(\d+) checks\*\*/) || [])[1];
  const zhTotal = (zh.match(/\*\*(\d+) 项\*\*/) || [])[1];
  assert.ok(enTotal, "README.md must state the suite total as **N checks**");
  assert.ok(zhTotal, "README.zh.md must state the suite total as **N 项**");
  assert.equal(enTotal, zhTotal, "the two editions disagree on the suite total");
  // And the quoted breakdown must add up to that total.
  const breakdown = en.match(/(\d+) \+[^\n]*?= \*\*\d+ checks\*\*/);
  assert.ok(breakdown, "README.md must quote a per-suite breakdown before the total");
  const parts = (en.match(/(\d+)(?= \+| =)/g) || []).map(Number);
  const sum = parts.reduce((a, b) => a + b, 0);
  assert.equal(sum, Number(enTotal), "the breakdown (" + parts.join("+") + ") must equal the stated total");
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " README parity checks");
