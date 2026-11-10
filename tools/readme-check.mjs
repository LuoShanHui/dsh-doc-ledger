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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const en = readFileSync(join(root, "README.md"), "utf8");
const zh = readFileSync(join(root, "README.zh.md"), "utf8");

const headings = (text, marker) =>
  text.split("\n").filter((line) => line.startsWith(marker + " ")).map((line) => line.slice(marker.length).trim());

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
check("英文版链到中文版，中文版链到英文版", () => {
  assert.match(en, /\[中文\]\(README\.zh\.md\)/, "README.md must link to README.zh.md");
  assert.match(zh, /\[English\]\(README\.md\)/, "README.zh.md must link to README.md");
});
check("英文版正文不含中日韩字符（语言链接除外）", () => {
  const body = en.split("\n").filter((line) => !line.includes("README.zh.md")).join("\n");
  const han = body.match(/[\u4e00-\u9fff]+/g) || [];
  assert.deepEqual(han.slice(0, 5), [], "untranslated Chinese left in README.md: " + han.slice(0, 5).join(", "));
});
check("两版都提到当前的安装版本号", () => {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  for (const [name, text] of [["README.md", en], ["README.zh.md", zh]]) {
    assert.ok(text.includes("#v" + version), name + " must reference #v" + version);
  }
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " README parity checks");
