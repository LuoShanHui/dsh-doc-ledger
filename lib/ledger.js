/**
 * doc-ledger engine: fold a DSH session event log into a per-file ledger.
 *
 * Pure functions, no dependencies, no I/O. The same fold runs in three places:
 * the host projection (live session), the host history service (cold replay of
 * persisted logs) and the standalone report generator (tools/report.mjs).
 *
 * A ledger answers two questions about one session: which documents were *used*
 * (read), and which were *created or modified* (written), with the timestamp of
 * every occurrence so the UI can sort by time, draw a timeline and search.
 */

/**
 * File families, keyed by extension.
 *
 * These twelve are a *semantic* split — what the reader is looking for — not a language split.
 * A language-keyed table is unmaintainable and biased: whatever the current project happens to
 * use dominates the list, while every other reader sees a chip that filters nothing. The
 * concrete extensions inside a family are enumerated from the live data by the client, so a
 * project that is 47% Java and one that is 90% Markdown both get a usable second level without
 * this table knowing anything about either.
 *
 * Every family here answers an intent ("the docs", "the spreadsheets", "the configs"); the
 * extension list under each is a mapping cost every classifier has to pay once.
 */
const EXTENSION_CATEGORIES = {
  doc: ["md", "markdown", "mdx", "txt", "rst", "pdf", "doc", "docx", "odt", "rtf", "epub", "tex", "adoc", "org"],
  sheet: ["xlsx", "xls", "csv", "tsv", "ods", "numbers", "xlsm", "xlsb"],
  slide: ["pptx", "ppt", "odp", "key", "pps", "ppsx"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tif", "tiff", "avif", "heic", "psd", "ai", "fig", "sketch"],
  code: [
    "java", "kt", "kts", "scala", "groovy", "ts", "tsx", "js", "jsx", "mjs", "cjs",
    "py", "pyi", "rb", "go", "rs", "c", "h", "cc", "cpp", "cxx", "hpp", "cs", "php",
    "swift", "m", "mm", "lua", "dart", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
    "pl", "r", "jl", "ex", "exs", "erl", "hs", "clj", "vue", "svelte", "astro", "sol", "zig",
    "sql", "graphql", "gql", "proto", "asm", "s", "vbs", "ahk", "tcl", "awk"
  ],
  web: ["html", "htm", "css", "scss", "sass", "less", "styl", "xhtml"],
  config: [
    "json", "jsonc", "json5", "yml", "yaml", "toml", "ini", "cfg", "conf", "xml",
    "properties", "env", "plist", "gradle", "mk", "cmake", "lock", "editorconfig",
    "gitignore", "gitattributes", "npmrc", "nvmrc", "dockerignore", "babelrc", "eslintrc"
  ],
  data: ["db", "sqlite", "sqlite3", "parquet", "arrow", "avro", "orc", "log", "ndjson", "jsonl", "diff", "patch", "dump", "bak"],
  media: ["mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "flac", "aac", "m4a", "ogg", "gifv", "m4v"],
  archive: ["zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz", "zst", "zstd", "jar", "war", "ear", "iso"],
  binary: ["exe", "dll", "so", "dylib", "bin", "o", "obj", "lib", "a", "pdb", "msi", "app", "deb", "rpm", "class", "pyc", "wasm"]
};

const CATEGORY_BY_EXT = new Map();
for (const [category, exts] of Object.entries(EXTENSION_CATEGORIES)) {
  for (const ext of exts) CATEGORY_BY_EXT.set(ext, category);
}

/** Lowercased extension without the dot, or an empty string. */
export function extOf(path) {
  const name = String(path).split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** Category label for a path, or "other" when the extension is unknown. */
/**
 * Files with no extension at all, mapped by their whole name.
 *
 * Without this, `.gitignore`, `LICENSE`, `Dockerfile` and `Makefile` all fell to "other", which
 * on a real ledger was 72 files — the third largest group. They are configuration by intent, so
 * they are classified rather than dumped.
 */
const BY_FILENAME = new Map([
  ["dockerfile", "config"], ["makefile", "config"], ["cmakelists.txt", "config"],
  ["procfile", "config"], ["vagrantfile", "config"], ["gemfile", "config"],
  ["rakefile", "config"], ["jenkinsfile", "config"], ["brewfile", "config"],
  ["license", "doc"], ["licence", "doc"], ["notice", "doc"], ["copying", "doc"],
  ["authors", "doc"], ["contributors", "doc"], ["changelog", "doc"], ["readme", "doc"]
]);

/**
 * The family a path belongs to.
 *
 * Resolution order:
 *   1. the dot-less file name (`Dockerfile`, `LICENSE`) — checked before the extension, because
 *      `CMakeLists.txt` is a build file even though it ends in `.txt`;
 *   2. the extension table;
 *   3. a dotfile with no recognised suffix (`.gitignore`, `.npmrc`) — configuration by intent;
 *   4. `other`.
 */
export function categoryOf(path) {
  const name = baseName(String(path ?? "")).toLowerCase();
  const byName = BY_FILENAME.get(name);
  if (byName !== undefined) return byName;
  const ext = extOf(path);
  const byExt = CATEGORY_BY_EXT.get(ext);
  if (byExt !== undefined) return byExt;
  // `.editorconfig` has the "extension" `editorconfig`, which is already in the table; a name
  // like `.env.local` resolves through `local`. Anything else that starts with a dot is config.
  if (name.startsWith(".") && ext === "") return "config";
  if (name.startsWith(".") && !CATEGORY_BY_EXT.has(ext)) return "config";
  return "other";
}

/** Final path segment. */
export function baseName(path) {
  return String(path).split(/[\\/]/).pop() ?? String(path);
}

/**
 * Absolute, backslash-normalised, drive-letter-upper-cased identity for a path
 * that a tool reported relative to the session working directory.
 */
export function resolvePath(raw, cwd) {
  let path = String(raw ?? "").trim();
  if (path.length === 0) return "";
  if (/^file:\/\//i.test(path)) path = decodeURIComponent(path.replace(/^file:\/\//i, ""));
  const absolute = /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\") || path.startsWith("/");
  let full = absolute ? path : (cwd ?? "") + "\\" + path;
  full = full.replace(/\//g, "\\");
  const parts = full.split("\\");
  const out = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") { if (out.length > 1) out.pop(); continue; }
    out.push(part);
  }
  let identity = out.join("\\");
  if (/^[a-zA-Z]:/.test(identity)) identity = identity[0].toUpperCase() + identity.slice(1);
  return identity;
}

/** Path relative to the session root when it lives inside it, else the absolute path. */
export function relativeTo(identity, cwd) {
  if (!cwd) return identity;
  const prefix = cwd.endsWith("\\") ? cwd : cwd + "\\";
  return identity.toLowerCase().startsWith(prefix.toLowerCase()) ? identity.slice(prefix.length) : identity;
}

/** Built-in tool names whose path argument is a document read. */
const READ_TOOLS = new Set(["read", "read_file", "read_text_file", "read_image"]);
/** Built-in tool names whose path argument is a document write, with the stored label. */
const WRITE_TOOLS = new Map([["write", "write"], ["edit", "edit"]]);

/**
 * IDE / refactoring tools whose *write* is a file operation, with the label to store.
 *
 * These were falling through both tables: `mcp__intellij__create_new_file`, `apply_patch` and
 * `rename_refactoring` write files through the IDE instead of the fs tools, so a session that
 * created a class through the IDE showed no created file at all. On this machine the IDE
 * reads were already covered (they end in `read_file`) but `read_image` and
 * `modlens_read_image` were not, which hid 165 image reads.
 *
 * Their path argument may be workspace-relative (`pathInProject`), which is the same shape a
 * session-relative path has, so the existing resolver handles both.
 */
const WRITE_TOOLS_EXTRA = new Map([
  ["mcp__intellij__create_new_file", "write"],
  ["mcp__intellij__apply_patch", "edit"],
  ["mcp__intellij__rename_refactoring", "edit"],
  ["mcp__intellij__move_file", "edit"],
  ["mcp__intellij__refactor_safe_delete", "delete"],
  ["mcp__index__ide_refactor_rename", "edit"],
  ["mcp__index__ide_refactor_safe_delete", "delete"],
  ["mcp__index__ide_move_file", "edit"]
]);

/** Tools that read a whole image rather than a text document, but are still a document use. */
const IMAGE_READ_TOOLS = new Set(["read_image", "modlens_read_image"]);

function pathArgumentOf(args) {
  if (!args || typeof args !== "object") return "";
  if (typeof args.file_path === "string") return args.file_path;
  if (typeof args.filePath === "string") return args.filePath;
  if (typeof args.path === "string") return args.path;
  if (typeof args.file === "string") return args.file;
  if (typeof args.target_file === "string") return args.target_file;
  // IDE tools address files relative to the project root.
  if (typeof args.pathInProject === "string") return args.pathInProject;
  return "";
}

/** Drop heuristic uses for one path that the same program later reported precisely. */
function dropScannedUses(state, identity, parentCallId) {
  const entry = state.files.get(identity);
  if (entry === undefined) return;
  entry.uses = entry.uses.filter((use) => !(use.via === "code" && use.callId === parentCallId));
  if (entry.uses.length === 0) state.files.delete(identity);
}

function parseArguments(raw) {
  if (typeof raw !== "string") return raw && typeof raw === "object" ? raw : null;
  try { return JSON.parse(raw); } catch { return null; }
}

function readKind(name) {
  if (READ_TOOLS.has(name)) return "read";
  // MCP filesystem and IDE readers all end in read_file, e.g. mcp__intellij__read_file.
  if (name.endsWith("read_file") || name.endsWith("read_text_file")) return "read";
  if (name.endsWith("read_image")) return "read";
  return "";
}

function writeKind(name) {
  return WRITE_TOOLS.get(name) ?? WRITE_TOOLS_EXTRA.get(name) ?? "";
}


/**
 * Tool calls that carry a JS program which itself calls the fs tools. The PTC
 * runtime executes these programs in the host, so the session log only records
 * the program text: the individual reads and writes have to be recovered from
 * it. This is a heuristic scanner, not a parser: it recognises the literal
 * argument object of a call and ignores anything computed at runtime.
 */
const PROGRAM_TOOLS = new Set(["run_code"]);

const CALL_PATTERN = /\btools\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\])\s*\(/g;
const PATH_FIELD_PATTERN = /\b(?:file_path|filePath|path|target_file|file)\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/s;
const PATH_IDENT_FIELD_PATTERN = /\b(?:file_path|filePath|path|target_file|file)\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/;

/**
 * `const target = "dir/File.java"` followed by `fs.writeFileSync(target, ...)` is how
 * these programs usually create a file: the path never sits next to the write call, so
 * both the fs-call scan and the absolute-literal scan miss it.
 */
const PATH_VARIABLE_PATTERN = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])([^"'\r\n]{2,300})\2/g;
const FS_CALL_ANY_PATTERN = /\b(readFileSync|readFile|writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\s*\(\s*([A-Za-z_$][\w$]*|["'][^"']+["'])/g;

/** True for a string that can only be a file path: has a separator and an extension. */
function looksLikePath(value) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) return false;
  if (value.startsWith("node:")) return false;
  if (/[\\/]/.test(value) !== true && /^[A-Za-z]:/.test(value) !== true) return false;
  return /[^\\/]\.[A-Za-z0-9]{1,8}$/.test(value);
}

/** `name = "path"` bindings, which is how a program usually holds its target path. */
function pathBindings(code) {
  const bindings = new Map();
  PATH_VARIABLE_PATTERN.lastIndex = 0;
  let match;
  while ((match = PATH_VARIABLE_PATTERN.exec(code)) !== null) {
    const value = unescapeLiteral(match[3]);
    if (looksLikePath(value) !== true) continue;
    bindings.set(match[1], value);
  }
  return bindings;
}

/**
 * The arguments of one call, up to its own closing bracket. Scanning a fixed window
 * instead picks up the `path:` of a later call — that is how a directory turned into a
 * document in the ledger.
 */
function callArguments(code, open) {
  let depth = 0;
  let quote = "";
  const limit = Math.min(code.length, open + 4000);
  for (let index = open; index < limit; index += 1) {
    const ch = code[index];
    if (quote !== "") {
      if (ch === "\\") { index += 1; continue; }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, index);
    }
  }
  return code.slice(open + 1, limit);
}

/**
 * True when the text right after a quoted literal starts a concatenation — "dir/" + name.
 *
 * \`tools.read({ file_path: "E:\\root\\" + f })\` is how a program reads a list of files, and the
 * literal there is only the directory. Recording it put folders into real ledgers as
 * "documents" that cannot be previewed or opened (app.asar, os-services, .tmp-fastdiff/diff).
 * Missing a read is recoverable; inventing a folder as a document is not, so a concatenated
 * literal is dropped instead of being guessed at.
 */
function isConcatenatedLiteral(text, from) {
  return /^\s*(?:\+|\.(?:concat|replace|trim|slice|join)\s*\()/.test(String(text).slice(from, from + 16));
}

/** The path a call names, either as a literal or through a variable. */
function pathOfArguments(args, bindings) {
  const quoted = PATH_FIELD_PATTERN.exec(args);
  if (quoted !== null) {
    if (isConcatenatedLiteral(args, quoted.index + quoted[0].length)) return "";
    return unescapeLiteral(quoted[2]);
  }
  const ident = PATH_IDENT_FIELD_PATTERN.exec(args);
  if (ident !== null) return bindings.get(ident[1]) ?? "";
  return "";
}

/** Paths handed to an fs call, literal or through a variable. */
function scanFsCalls(code, bindings, found) {
  const seen = new Set(found.map((entry) => entry.op + "|" + entry.path));
  FS_CALL_ANY_PATTERN.lastIndex = 0;
  let match;
  while ((match = FS_CALL_ANY_PATTERN.exec(code)) !== null) {
    const arg = match[2];
    let path = "";
    if (arg.startsWith('"') || arg.startsWith("'")) {
      if (isConcatenatedLiteral(code, match.index + match[0].length)) continue;
      path = unescapeLiteral(arg.slice(1, -1));
    } else {
      path = bindings.get(arg) ?? "";
    }
    if (path === "") continue;
    const isWrite = match[1].startsWith("write") || match[1].startsWith("append") || match[1] === "createWriteStream";
    const kind = isWrite ? "write" : "read";
    const key = kind + "|" + path;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name: match[1], path, op: kind, kind, via: "code" });
  }
}

/** Extract the tool calls written inside one program, with their path. */
export function scanProgram(code) {
  const found = [];
  if (typeof code !== "string" || code.length === 0) return found;
  const bindings = pathBindings(code);
  CALL_PATTERN.lastIndex = 0;
  let match;
  while ((match = CALL_PATTERN.exec(code)) !== null) {
    const name = match[1] ?? match[2] ?? "";
    const read = readKind(name);
    const write = writeKind(name);
    if (read === "" && write === "") continue;
    const path = pathOfArguments(callArguments(code, match.index + match[0].length - 1), bindings);
    if (path === "") continue;
    found.push({ name, path, op: read || write, kind: read ? "read" : write, via: "code" });
  }
  // Before scanLiterals, so a path written through a variable is not also reported as
  // a plain read by the "unknown literal" fallback.
  scanFsCalls(code, bindings, found);
  scanLiterals(code, found, containerPaths(code, bindings));
  // There used to be a second fs pass here (FS_CALL_PATTERN, same four functions). It
  // re-recorded what scanFsCalls had just added under a different name, so one
  // fs.readFileSync("x") became two reads: 515 duplicate pairs across this machine and
  // 150 extra uses in 10 sessions. scanFsCalls is the superset, so the pass is gone.
  return found;
}

/** Absolute path literals inside a program: the only trace of Node-level file use. */
const LITERAL_PATH_PATTERN = /"((?:[A-Za-z]:[\\/]|\/)[^"\r\n]{2,300}?\.[A-Za-z0-9]{1,8})"/g;
const WRITE_CONTEXT_PATTERN = /(?:writeFile|appendFile|writeFileSync|appendFileSync|createWriteStream|rename|copyFile|mkdir)[A-Za-z]*\s*\(\s*$/;

/** fs functions that only *inspect* a path: stat, exists, access, readdir, watch. */
const STAT_ONLY_CALL = "(?:statSync|stat|lstat|fstat|existsSync|exists|accessSync|access|readdirSync|readdir|realpathSync|realpath|opendirSync|opendir|watchFile|watch)\\s*\\(\\s*$";

/**
 * Paths a program only ever *inspects*, never opens as a document.
 *
 * `fs.readdirSync("E:\\root")` names a directory; `fs.statSync(p)` checks something that may be a
 * file, a directory or an archive (app.asar is a bundle, not a document). The literal fallback
 * used to record all of them as reads, which is how folders ended up in real ledgers as
 * unopenable rows. A path counts as a container when it is passed straight to such a call, or
 * when the variable holding it is used *only* that way.
 */
function containerPaths(code, bindings) {
  const containers = new Set();
  const inspectCall = new RegExp(STAT_ONLY_CALL);
  LITERAL_PATH_PATTERN.lastIndex = 0;
  let match;
  while ((match = LITERAL_PATH_PATTERN.exec(code)) !== null) {
    const before = code.slice(Math.max(0, match.index - 40), match.index);
    if (inspectCall.test(before)) containers.add(unescapeLiteral(match[1]));
  }
  const INSPECT = "(?:statSync|stat|lstat|fstat|existsSync|exists|accessSync|access|readdirSync|readdir|realpathSync|realpath|opendirSync|opendir|watchFile|watch)";
  const OPEN = "(?:readFileSync|readFile|writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)";
  for (const [name, value] of bindings) {
    const ident = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inspected = new RegExp(INSPECT + "\\s*\\(\\s*" + ident + "\\s*[),]").test(code);
    const opened = new RegExp(OPEN + "\\s*\\(\\s*" + ident + "\\s*[),]").test(code);
    if (inspected && !opened) containers.add(value);
  }
  return containers;
}

function scanLiterals(code, found, containers) {
  const seen = new Set(found.map((entry) => entry.path));
  const skip = containers instanceof Set ? containers : new Set();
  LITERAL_PATH_PATTERN.lastIndex = 0;
  let match;
  while ((match = LITERAL_PATH_PATTERN.exec(code)) !== null) {
    const raw = unescapeLiteral(match[1]);
    if (seen.has(raw)) continue;
    const base = raw.split(/[\\/]/).pop() ?? "";
    // Reject dot-directories and extension-less fragments: a file name is
    // "something.ext", never ".dsh".
    if (!/^[^.\s][^\\/]*\.[A-Za-z0-9]{1,8}$/.test(base)) continue;
    // A path handed to stat/exists/readdir is a container being inspected, not a document.
    if (skip.has(raw)) continue;
    seen.add(raw);
    const before = code.slice(Math.max(0, match.index - 80), match.index);
    const isWrite = WRITE_CONTEXT_PATTERN.test(before);
    found.push({ name: "literal", path: raw, op: isWrite ? "write" : "read", kind: isWrite ? "write" : "read", via: "literal" });
  }
  return found;
}

function unescapeLiteral(text) {
  return text.replace(/\\(["'\\])/g, "$1");
}

/** Empty ledger state for one session. */
export function createLedger(header = {}) {
  // Live sessions hand back the header folded into data, persisted logs keep it flat.
  const meta = header !== null && typeof header.data === "object" && header.data !== null ? header.data : header;
  return {
    sessionId: meta.id ?? "",
    cwd: typeof meta.cwd === "string" ? meta.cwd : "",
    createdAt: meta.createdAt ?? null,
    agentPreset: meta.agentPreset ?? null,
    /** callId -> call site, kept until the matching result settles. */
    calls: new Map(),
    files: new Map(),
    eventCount: 0,
    lastSeq: 0,
  };
}

function touchFile(state, identity, time) {
  let entry = state.files.get(identity);
  if (entry === undefined) {
    entry = {
      path: identity,
      uses: [],
      firstSeenAt: time,
      lastSeenAt: time,
    };
    state.files.set(identity, entry);
  }
  if (time < entry.firstSeenAt) entry.firstSeenAt = time;
  if (time > entry.lastSeenAt) entry.lastSeenAt = time;
  return entry;
}

function addUse(state, identity, use) {
  const entry = touchFile(state, identity, use.time);
  entry.uses.push(use);
  return entry;
}

/**
 * Fold one committed session event into the state. Events that cannot change the
 * ledger return the same state reference, which the projection registry needs to
 * suppress downstream work.
 */
export function applyEvent(state, event) {
  if (event.type === "tool/call") {
    const data = event.data ?? {};
    const name = typeof data.name === "string" ? data.name : "";
    const args = parseArguments(data.arguments);
    const callId = data.callId ?? "";
    if (name === "working_directory" && args && typeof args.cd === "string") {
      state.calls.set(callId, { cwdCandidate: resolvePath(args.cd, state.cwd) });
      return state;
    }
    if (PROGRAM_TOOLS.has(name)) {
      const code = args && typeof args.code === "string" ? args.code : "";
      const found = scanProgram(code);
      if (found.length === 0) return state;
      // `callId` is kept on the record so a failed program can be rolled back: the scanner
      // cannot know at fold time whether the program eventually threw, and a program that
      // failed halfway still contributed a use per scanned path (measured: 73 failed
      // programs left 146 rows behind, so a `.md` whose write threw still showed as created).
      state.calls.set(callId, { program: true, callId });
      for (const call of found) {
        const identity = resolvePath(call.path, state.cwd);
        if (identity === "") continue;
        addUse(state, identity, {
          callId,
          kind: call.kind,
          op: call.op,
          via: call.via,
          time: event.time,
          seq: event.seq,
          turn: data.turn ?? null,
          step: data.step ?? null,
        });
      }
      state.eventCount += 1;
      state.lastSeq = event.seq;
      return state;
    }
    const read = readKind(name);
    const write = writeKind(name);
    if (read === "" && write === "") return state;
    const raw = pathArgumentOf(args);
    if (raw === "") return state;
    const identity = resolvePath(raw, state.cwd);
    if (identity === "") return state;
    state.calls.set(callId, { path: identity });
    addUse(state, identity, {
      callId,
      kind: read || write,
      op: read ? "read" : write,
      time: event.time,
      seq: event.seq,
      turn: data.turn ?? null,
      step: data.step ?? null,
    });
    state.eventCount += 1;
    state.lastSeq = event.seq;
    return state;
  }
  if (event.type === "tool/ptc-dispatch") {
    // The PTC runtime records every tool the program called, with its real
    // arguments: the exact ledger source for ptc sessions.
    const data = event.data ?? {};
    if (data.isError === true) return state;
    const name = typeof data.name === "string" ? data.name : "";
    const read = readKind(name);
    const write = writeKind(name);
    if (read === "" && write === "") return state;
    const args = parseArguments(data.arguments);
    const raw = pathArgumentOf(args);
    if (raw === "") return state;
    const identity = resolvePath(raw, state.cwd);
    if (identity === "") return state;
    const parent = typeof data.parentCallId === "string" ? data.parentCallId : "";
    dropScannedUses(state, identity, parent);
    addUse(state, identity, {
      callId: typeof data.subCallId === "string" ? data.subCallId : parent,
      kind: read || write,
      op: read ? "read" : write,
      via: "dispatch",
      time: event.time,
      seq: event.seq,
      turn: data.turn ?? null,
      step: null,
    });
    return state;
  }
  if (event.type === "tool/result") {
    const data = event.data ?? {};
    const callId = data.toolCallId ?? data.message?.toolCallId ?? "";
    const call = state.calls.get(callId);
    if (call === undefined) return state;
    state.calls.delete(callId);
    const failed = data.message?.isError === true || data.isError === true;
    if (!failed) {
      // A successful working_directory call moves the session working directory.
      if (call.cwdCandidate !== undefined) state.cwd = call.cwdCandidate;
      return state;
    }
    // Roll a failed call back out of the ledger.
    const touched = call.path !== undefined ? [call.path] : [...state.files.keys()];
    for (const identity of touched) {
      const entry = state.files.get(identity);
      if (entry === undefined) continue;
      entry.uses = entry.uses.filter((use) => use.callId !== callId);
      if (entry.uses.length === 0) state.files.delete(identity);
    }
    return state;
  }
  if (event.type === "deliverables/presented") {
    const data = event.data ?? {};
    for (const file of data.files ?? []) {
      const raw = typeof file?.path === "string" ? file.path : "";
      if (raw === "") continue;
      const identity = resolvePath(raw, state.cwd);
      addUse(state, identity, {
        callId: data.callId ?? "",
        kind: "present",
        op: "present",
        time: event.time,
        seq: event.seq,
        turn: data.turn ?? null,
        step: null,
        description: typeof file.description === "string" ? file.description : null,
      });
    }
    state.eventCount += 1;
    state.lastSeq = event.seq;
    return state;
  }
  return state;
}

function safeStat(stat, path) {
  try { return stat(path); } catch { return null; }
}

/**
 * Derive the UI-facing file records of a folded ledger.
 *
 * created is deliberately three-valued: "confirmed" when the agent explicitly
 * presented the file, "inferred" when the first write happened before any read
 * of that path (the fs observation policy requires a read before an overwrite,
 * so a first-touch write is a new file in practice), and null when the file was
 * only ever modified.
 */
export function finalize(state, options = {}) {
  const stat = options.stat ?? null;
  const files = [];
  for (const entry of state.files.values()) {
    const reads = entry.uses.filter((use) => use.kind === "read");
    // `delete` is a write-class operation: an IDE refactor that removes a file changes the
    // session's documents just as a `write` does, so it must not be dropped from the counters.
    const writes = entry.uses.filter((use) => use.op === "write" || use.op === "edit" || use.op === "delete");
    const presents = entry.uses.filter((use) => use.kind === "present");
    const firstUse = reads.length > 0 ? Math.min(...reads.map((use) => use.time)) : null;
    const lastUse = reads.length > 0 ? Math.max(...reads.map((use) => use.time)) : null;
    const firstWrite = writes.length > 0 ? Math.min(...writes.map((use) => use.time)) : null;
    const lastWrite = writes.length > 0 ? Math.max(...writes.map((use) => use.time)) : null;
    // The first touch decides: a whole-file write before any read of that path is a new
    // file; an edit can only apply to a file that already existed. Reads AFTER the write
    // are verification, not evidence of an older file — requiring "never read" classified
    // every created-then-inspected file as merely modified.
    const firstWriteUse = writes.length > 0 ? writes.reduce((best, use) => (use.time < best.time ? use : best)) : null;
    const wholeFileFirst = firstWriteUse !== null && firstWriteUse.op === "write";
    // "Presented" alone is not "created": a session can hand the user a document it only read
    // (or one that already existed). 14 of 38 confirmed rows on this machine had writes 0 and
    // still showed under "Created", which is a claim the log does not support. Confirmation
    // therefore requires a write *in this session*; a presentation with no write stays a
    // presentation (presented stays 1, created stays null).
    const created = presents.length > 0 && writes.length > 0
      ? "confirmed"
      : wholeFileFirst && (firstUse === null || firstWrite <= firstUse)
        ? "inferred"
        : null;
    const presentedAt = presents.length > 0 ? Math.min(...presents.map((use) => use.time)) : null;
    const fileStat = stat === null ? null : safeStat(stat, entry.path);
    files.push({
      path: entry.path,
      rel: relativeTo(entry.path, state.cwd),
      name: baseName(entry.path),
      ext: extOf(entry.path),
      category: categoryOf(entry.path),
      reads: reads.length,
      writes: writes.length,
      presented: presents.length,
      firstUsedAt: firstUse,
      lastUsedAt: lastUse,
      // A presented-only file was not created by this session, so it has no created time.
      createdAt: created === null ? null : (presentedAt ?? firstWrite),
      updatedAt: lastWrite,
      created,
      description: presents.find((use) => use.description)?.description ?? null,
      mtime: fileStat?.mtime ?? null,
      birthtime: fileStat?.birthtime ?? null,
      exists: fileStat?.exists ?? null,
      uses: entry.uses.map((use) => ({ kind: use.kind, op: use.op, time: use.time, seq: use.seq, turn: use.turn })),
    });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const used = files.filter((file) => file.reads > 0);
  const created = files.filter((file) => file.created !== null);
  const modified = files.filter((file) => file.writes > 0 && file.created === null);
  return {
    sessionId: state.sessionId,
    cwd: state.cwd,
    createdAt: state.createdAt,
    agentPreset: state.agentPreset,
    lastSeq: state.lastSeq,
    files,
    counts: {
      files: files.length,
      used: used.length,
      created: created.length,
      confirmed: created.filter((file) => file.created === "confirmed").length,
      modified: modified.length,
      reads: files.reduce((sum, file) => sum + file.reads, 0),
      writes: files.reduce((sum, file) => sum + file.writes, 0),
    },
  };
}

/** Fold every event of one session log into a finalized ledger. */
export function buildLedger(events, options = {}) {
  // A live observation may omit the header event, so callers can seed it.
  const header = options.header ?? events.find((event) => event.type === "session") ?? {};
  const state = createLedger(header);
  for (const event of events) {
    if (event.type === "session") continue;
    applyEvent(state, event);
  }
  return finalize(state, options);
}