/**
 * Release-note parity check.
 *
 * Every `docs/release-v<version>.md` should have a `.en.md` twin: the same `##`/`###`
 * structure, the same image URLs pinned to that version's tag, and the same version
 * mentioned in the install snippet. A one-sided edit is otherwise invisible until
 * someone opens the GitHub release page in the other language.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const docs = join(root, "docs");

const notes = readdirSync(docs).filter((name) => /^release-v\d+\.\d+\.\d+\.md$/.test(name)).sort();
assert.ok(notes.length > 0, "no release notes found under docs/");

const lines = (text) => text.split(/\r?\n/);
const headings = (text, marker) =>
  lines(text).filter((line) => line.startsWith(marker + " ")).map((line) => line.slice(marker.length).trim());
const images = (text) => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
const tagOf = (name) => name.match(/^release-(v\d+\.\d+\.\d+)\.md$/)[1];

const cases = [];
function check(name, body) { cases.push([name, body]); }

for (const zhName of notes) {
  const version = tagOf(zhName);
  const enName = zhName.replace(/\.md$/, ".en.md");
  const zh = readFileSync(join(docs, zhName), "utf8");
  let en;
  try {
    en = readFileSync(join(docs, enName), "utf8");
  } catch {
    check(version + " 有英文版 " + enName, () => {
      assert.fail("missing English twin: docs/" + enName);
    });
    continue;
  }

  check(version + " 中英两版 `##` 数量一致", () => {
    assert.equal(headings(en, "##").length, headings(zh, "##").length,
      "h2 count differs for " + version);
  });
  check(version + " 中英两版 `###` 数量一致", () => {
    assert.equal(headings(en, "###").length, headings(zh, "###").length,
      "h3 count differs for " + version);
  });
  check(version + " 配图 URL 指向同一个 tag", () => {
    const zhImages = images(zh).sort();
    const enImages = images(en).sort();
    assert.deepEqual(enImages, zhImages, "image URLs differ for " + version);
    for (const url of zhImages) {
      assert.ok(url.includes("/" + version + "/"), "image not pinned to " + version + ": " + url);
    }
  });
  check(version + " 英文版正文不含中日韩字符", () => {
    const han = en.match(/[\u4e00-\u9fff]+/g) || [];
    assert.deepEqual(han.slice(0, 5), [], "untranslated Chinese in " + enName + ": " + han.slice(0, 5).join(", "));
  });
}

check("每个 release note 都提到对应版本号", () => {
  for (const zhName of notes) {
    const version = tagOf(zhName);
    const text = readFileSync(join(docs, zhName), "utf8");
    assert.ok(text.includes("#" + version), zhName + " must reference #" + version);
  }
});

for (const [name, body] of cases) {
  body();
  console.log("  · " + name);
}
console.log("ok - " + cases.length + " release-note checks (" + notes.length + " versions)");
