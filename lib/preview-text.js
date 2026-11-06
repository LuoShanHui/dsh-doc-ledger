/**
 * Text decoding for the preview route.
 *
 * A ledger is a mix of everything a session touched: UTF-8 sources, GB18030 SQL
 * dumps from legacy Chinese Windows projects, UTF-16LE files produced by
 * PowerShell redirection, and the occasional mostly-UTF-8 file with a few GBK
 * lines appended by an old tool. Decoding all of them as UTF-8 turns the
 * non-UTF-8 ones into a wall of U+FFFD, so the preview scores the candidates
 * instead of trusting one.
 *
 * Line-by-line scoring keeps mixed files readable: 3 of the 5 non-UTF-8 files
 * measured on a real 868-file ledger were pure GB18030, the other 2 were mixed.
 */

const REPLACEMENT = /\uFFFD/g;

/** How many bytes could not be decoded. */
export function countReplacements(text) {
  const matched = text.match(REPLACEMENT);
  return matched === null ? 0 : matched.length;
}

function decoderFor(label) {
  try {
    return new TextDecoder(label, { fatal: false });
  } catch {
    return null;
  }
}

// Built once: TextDecoder construction is cheap but this runs per preview.
const UTF8 = decoderFor("utf-8");
const UTF16LE = decoderFor("utf-16le");
const UTF16BE = decoderFor("utf-16be");
// "gb18030" is a superset of GBK/GB2312; the plain "gbk" label is the fallback for
// builds whose ICU exposes only that alias.
const GB18030 = decoderFor("gb18030") ?? decoderFor("gbk");

function decodeUtf8(buffer) {
  return UTF8 === null ? buffer.toString("utf8") : UTF8.decode(buffer);
}

function decodeWith(decoder, buffer) {
  if (decoder === null) return null;
  try {
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}

/**
 * A file cut at MAX_PREVIEW_BYTES usually ends in the middle of a multi-byte
 * character. Drop that incomplete tail **before** the encodings are scored:
 * otherwise a UTF-8 file cut mid-character looks "more decodable" as GB18030 and
 * the whole tail would be reread as legacy bytes.
 */
function trimPartialUtf8Tail(buffer) {
  const end = buffer.length;
  for (let back = 1; back <= 3 && end - back >= 0; back += 1) {
    const byte = buffer[end - back];
    if ((byte & 0x80) === 0) return buffer; // trailing byte is ASCII: nothing was cut
    if ((byte & 0xc0) !== 0xc0) continue; // continuation byte: keep walking back
    const need = (byte & 0xe0) === 0xc0 ? 2 : (byte & 0xf0) === 0xe0 ? 3 : (byte & 0xf8) === 0xf0 ? 4 : 0;
    if (need === 0) return buffer;
    return need > back ? buffer.subarray(0, end - back) : buffer;
  }
  return buffer;
}

/**
 * A last-resort scrub for U+FFFD left at the very end of a truncated preview
 * (e.g. an encodable single-byte cut in a legacy file).
 */
function trimCapArtifact(text, truncated) {
  if (truncated !== true) return text;
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0xfffd) end -= 1;
  return end === text.length ? text : text.slice(0, end);
}

/**
 * A line is retried as GB18030 whenever UTF-8 produced any replacement character.
 * The threshold has to be 1: a GBK character is a two-byte sequence whose lead byte
 * is also a valid UTF-8 lead byte, so a line holding a single GBK character decodes
 * as **one** U+FFFD and would otherwise be left broken (measured: 16 such lines in a
 * 1555-line GB18030 SQL dump). A lone corrupt byte that is not valid GBK stays UTF-8,
 * because GB18030 then replaces it too and the UTF-8 reading wins on the tie.
 */
const LEGACY_LINE_THRESHOLD = 1;

function splitLines(buffer) {
  const lines = [];
  let offset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline === -1) {
      lines.push(buffer.subarray(offset));
      break;
    }
    lines.push(buffer.subarray(offset, newline + 1));
    offset = newline + 1;
  }
  return lines;
}

/**
 * Decode a preview byte range.
 *
 * @param {Buffer} buffer bytes actually read from the file
 * @param {{ truncated?: boolean }} [options] whether the range was cut short
 * @returns {{ text: string, encoding: string, replacements: number }}
 *   `encoding` is a short label for the UI: `utf-8`, `utf-8+gb18030`,
 *   `utf-16le`, `utf-16be`; `replacements` counts bytes no decoder could read.
 */
export function decodePreview(buffer, options = {}) {
  const truncated = options.truncated === true;
  if (buffer.length === 0) return { text: "", encoding: "utf-8", replacements: 0 };
  const bytes = truncated ? trimPartialUtf8Tail(buffer) : buffer;

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = trimCapArtifact(decodeUtf8(bytes.subarray(3)), truncated);
    return { text, encoding: "utf-8", replacements: countReplacements(text) };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = trimCapArtifact(decodeWith(UTF16LE, bytes.subarray(2)) ?? decodeUtf8(bytes), truncated);
    return { text, encoding: "utf-16le", replacements: 0 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = trimCapArtifact(decodeWith(UTF16BE, bytes.subarray(2)) ?? decodeUtf8(bytes), truncated);
    return { text, encoding: "utf-16be", replacements: 0 };
  }

  const whole = decodeUtf8(bytes);
  if (countReplacements(whole) === 0) {
    return { text: trimCapArtifact(whole, truncated), encoding: "utf-8", replacements: 0 };
  }
  if (GB18030 === null) {
    // No legacy decoder in this build: a UTF-8 decode with U+FFFD is still better
    // than nothing, and the UI surfaces the replacement count.
    const text = trimCapArtifact(whole, truncated);
    return { text, encoding: "utf-8", replacements: countReplacements(text) };
  }

  const lines = splitLines(bytes);
  const parts = new Array(lines.length);
  let legacyLines = 0;
  let replacements = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const utf8Text = decodeUtf8(line);
    const utf8Bad = countReplacements(utf8Text);
    if (utf8Bad === 0) {
      parts[index] = utf8Text;
      continue;
    }
    const legacyText = utf8Bad >= LEGACY_LINE_THRESHOLD ? decodeWith(GB18030, line) : null;
    if (legacyText === null) {
      parts[index] = utf8Text;
      replacements += utf8Bad;
      continue;
    }
    const legacyBad = countReplacements(legacyText);
    if (legacyBad < utf8Bad) {
      parts[index] = legacyText;
      legacyLines += 1;
    } else {
      parts[index] = utf8Text;
      replacements += utf8Bad;
    }
  }
  const text = trimCapArtifact(parts.join(""), truncated);
  return {
    text,
    encoding: legacyLines === 0 ? "utf-8" : "utf-8+gb18030",
    replacements: replacements === 0 ? countReplacements(text) : replacements
  };
}

/** Line count of the decoded text, for the "共 N 行" hint. */
export function countLines(text) {
  if (text === "") return 0;
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x0a) lines += 1;
  }
  return lines;
}
