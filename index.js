/**
 * dsh-doc-ledger host plugin.
 *
 * Serves the document ledger of the sessions in this profile: which documents a
 * session used (reads) and which it created or modified (writes), with per-file
 * timestamps so the page can order by usage time, creation time or update time,
 * group by document type and search.
 *
 * Data comes from ctx.sessionQuery: listSessions() orders the corpus, readSession()
 * replays one log, readTitleSnapshots() supplies the titles. Sessions are replayed
 * lazily and cached; the live session is re-read on a short timer.
 *
 * Sessions produced by the PTC agent preset run their file operations inside a
 * program, so their logs record only that program's text and their ledger stays
 * empty; see README for the fs-interception follow-up.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { gunzipSync, gzipSync } from "node:zlib";
import { buildLedger } from "./lib/ledger.js";
import { countLines, decodePreview } from "./lib/preview-text.js";

export const name = "doc-ledger";
export const inject = ["webServer"];

const execFileAsync = promisify(execFile);

const MAX_PREVIEW_BYTES = 200 * 1024;
const BINARY_SNIFF = /[\u0000-\u0008\u000E-\u001F]/;
const LIVE_TTL_MS = 5000;
/**
 * Minimum interval between two full replays of the *same live* session.
 *
 * A working session appends to its log on every streamed token, so the `size:mtime`
 * fingerprint changes on every poll and the exact-stamp cache never hits: each 8 s poll
 * re-read and re-folded the whole log (measured 1 067 ms on a long session). Silent polls
 * inside this window are served from the previous fold; `force=1` and `timing=1` bypass it,
 * and the panel's 刷新 button sends `force=1`.
 */
const LIVE_REPLAY_FLOOR_MS = 15 * 1000;
const COLD_TTL_MS = 300000;
/** Reuse one whole snapshot for this long; 刷新 sends force=1 to bypass it. */
const SNAPSHOT_TTL_MS = 3000;
/** Session titles barely change; re-reading them is the slowest part of a full snapshot. */
const TITLE_TTL_MS = 30 * 60 * 1000;
/** A live session can be renamed at any moment, so its title is re-read sooner. */
const TITLE_TTL_LIVE_MS = 60 * 1000;
/** Even a title that keeps getting refreshed is re-read once a day. */
const TITLE_HARD_TTL_MS = 24 * 60 * 60 * 1000;
/** Persisted so a client restart does not pay the whole storage read again. */
const TITLE_FILE = join(homedir(), ".dsh", "doc-ledger-titles.json");
/**
 * Folded per-session ledgers, keyed by the log's `size:mtime` stamp. A restart then only
 * replays the sessions whose logs actually changed instead of all of them, and the data
 * it serves is current (unlike a snapshot of the previous response).
 */
const LEDGER_FILE = join(homedir(), ".dsh", "doc-ledger-ledgers.json.gz");
const LEDGER_VERSION = 2;
/**
 * Bumped whenever the ledger *meaning* changes (scanner rules, how created is decided):
 * cached ledgers carry it, so an upgraded plugin re-derives instead of trusting old rows.
 */
const LEDGER_ENGINE = 2;
const LEDGER_KEEP_MAX = 250;
const LEDGER_SAVE_DELAY_MS = 1500;
/** Registry associations change when the user installs software, not every minute. */
const OPENWITH_TTL_MS = 10 * 60 * 1000;

/**
 * The per-file fields the panel renders. `uses` alone is ~30% of the payload and
 * nothing on the client reads it, so it never leaves the host.
 */
function slimFile(file, stat) {
  return {
    name: file.name,
    path: file.path,
    rel: file.rel,
    category: file.category,
    reads: file.reads,
    writes: file.writes,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    firstUsedAt: file.firstUsedAt,
    lastUsedAt: file.lastUsedAt,
    created: file.created,
    exists: stat === undefined ? (file.exists ?? null) : stat.exists,
    // Current size on disk, or null when the file is gone. Part of the payload rather than
    // of the cached ledger: a file that grows does not change the log, so a cached size would
    // be wrong the moment the next write lands.
    bytes: stat === undefined ? (file.bytes ?? null) : stat.bytes
  };
}

/**
 * Whether a cached ledger may be reused instead of folding the log again, ignoring the
 * exact-stamp case (which `replay` handles itself, because it also refreshes recency).
 *
 * Two reasons to reuse:
 * - no stamp available (the session directory layout is not the expected one): fall back to
 *   the adaptive TTL;
 * - a live session inside the replay floor: the log is growing while the agent streams, and a
 *   silent poll should cost a cache read rather than a full replay.
 *
 * Exported so `tools/cache-check.mjs` can pin these decisions without a live host.
 */
export function ledgerReusable(hit, options = {}) {
  if (hit === undefined || hit === null) return false;
  const live = options.live === true;
  const stamp = options.stamp ?? null;
  const floor = Number.isFinite(options.floor) ? options.floor : 0;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const age = now - (hit.at ?? 0);
  if (stamp === null && hit.live === live && hit.ttl !== undefined && age < hit.ttl) return true;
  if (floor > 0 && live === true && age < floor) return true;
  return false;
}

/**
 * Remove cache files that earlier versions wrote and nothing reads now.
 *
 * `doc-ledger-snapshot.json.gz` cached the whole `/api/all` response before per-session
 * ledgers replaced it: 32 KB of dead weight that would otherwise sit in `~/.dsh` forever.
 * (The icon directory has its own TTL pruning in `pruneIcons`, so it is not repeated here.)
 *
 * Exported with an explicit `dir` so `tools/cache-check.mjs` can prove the deletion against a
 * temporary directory. Returns the names it actually removed.
 */
export function cleanObsoleteFiles(dir) {
  const target = dir ?? join(homedir(), ".dsh");
  const gone = [];
  for (const name of ["doc-ledger-snapshot.json.gz", "doc-ledger-snapshot.json"]) {
    try {
      const file = join(target, name);
      if (existsSync(file)) {
        rmSync(file, { force: true });
        gone.push(name);
      }
    } catch {
      /* an undeletable leftover is not worth a warning */
    }
  }
  return gone;
}
export function apply(ctx, config = {}) {
  const maxSessions = Number(config.maxSessions ?? 40);
  const base = typeof config.basePath === "string" ? config.basePath.replace(/\/$/, "") : "/doc-ledger";
  /** sessionId -> { ledger, live, at } */
  const cache = new Map();

  // The panel is served from the same loopback origin as this route, so every request it
  // makes carries Sec-Fetch-Site: same-origin. A cross-site one is either a page the user
  // happened to visit (drive-by: an <img> to /api/open would launch a program) or a
  // rebinding attempt that would make /api/all and /api/file readable. Reject those.
  function originProblem(req) {
    const headers = req?.headers ?? {};
    const host = String(headers.host ?? "");
    const site = String(headers["sec-fetch-site"] ?? "").toLowerCase();
    if (site === "cross-site" || site === "same-site") return "Sec-Fetch-Site: " + site;
    const origin = headers.origin;
    if (typeof origin === "string" && origin !== "") {
      if (origin === "null") return "Origin: null";
      try {
        if (new URL(origin).host !== host) return "Origin: " + origin;
      } catch {
        return "Origin: unparsable";
      }
    }
    const referer = headers.referer;
    if (typeof referer === "string" && referer !== "") {
      try {
        if (new URL(referer).host !== host) return "Referer: " + referer;
      } catch {
        return "Referer: unparsable";
      }
    }
    return "";
  }

  /**
   * Paths this ledger knows about. Preview and open only ever address a document from the
   * panel, so anything else — C:\\Windows\\win.ini included — is not this plugin's business.
   * Windows paths compare case-insensitively.
   */
  let ledgerEpoch = 0;
  let knownPaths = new Set();
  let knownPathsEpoch = -1;

  function knownPathSet() {
    loadLedgerCache();
    if (knownPathsEpoch === ledgerEpoch) return knownPaths;
    const paths = new Set();
    for (const entry of cache.values()) {
      for (const file of entry?.ledger?.files ?? []) {
        if (typeof file?.path === "string" && file.path !== "") paths.add(file.path.toLowerCase());
      }
    }
    knownPaths = paths;
    knownPathsEpoch = ledgerEpoch;
    return knownPaths;
  }

  function isKnownPath(path) {
    return typeof path === "string" && path !== "" && knownPathSet().has(path.toLowerCase());
  }

  function readEvents(read) {
    if (Array.isArray(read)) return read;
    return Array.isArray(read?.events) ? read.events : [];
  }

  /**
   * Cheap content fingerprint: enough to tell "nothing happened since the last replay"
   * apart from "a file was read/written again", without diffing the whole ledger.
   */
  function ledgerFingerprint(ledger) {
    let latest = 0;
    for (const file of ledger.files ?? []) {
      if ((file.lastUsedAt ?? 0) > latest) latest = file.lastUsedAt ?? 0;
      if ((file.updatedAt ?? 0) > latest) latest = file.updatedAt ?? 0;
    }
    const counts = ledger.counts ?? {};
    return {
      key: (counts.files ?? 0) + ":" + (counts.reads ?? 0) + ":" + (counts.writes ?? 0) + ":" + latest,
      latest,
    };
  }

  /**
   * Sessions that are open but idle keep their `live` flag forever (crashed or abandoned
   * windows). Re-replaying those on every poll used to cost ~0.8 s; when their documents
   * have not moved for a while they are treated like cold sessions instead.
   */
  const ABANDONED_IDLE_MS = 15 * 60 * 1000;

  /**
   * Replaying a cold session means decompressing one log; on a cold disk that is
   * hundreds of milliseconds each, so a few run at once instead of one after another.
   */
  const REPLAY_CONCURRENCY = 4;

  /** Run `worker` over `items` with at most `limit` in flight; preserves order. */
  async function mapPool(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = [];
    for (let slot = 0; slot < Math.min(limit, items.length); slot += 1) {
      runners.push((async () => {
        while (true) {
          const index = cursor;
          cursor += 1;
          if (index >= items.length) return;
          results[index] = await worker(items[index], index);
        }
      })());
    }
    await Promise.all(runners);
    return results;
  }

  /**
   * A session log never changes once the session is closed, and it grows while one is
   * running. `size + mtime` therefore identifies the exact content of a log: replay only
   * what actually moved instead of replaying every closed session on a 5 minute timer.
   * Returns id -> stamp, or null when the layout is not what we expect (fall back to TTL).
   */
  function sessionLogIndex() {
    try {
      const root = join(homedir(), ".dsh", "sessions");
      if (!existsSync(root)) return null;
      const index = new Map();
      for (const project of readdirSync(root, { withFileTypes: true })) {
        if (!project.isDirectory()) continue;
        let entries;
        try {
          entries = readdirSync(join(root, project.name), { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          try {
            const info = statSync(join(root, project.name, entry.name, "session.v4.jsonl.zstd"));
            index.set(entry.name, info.size + ":" + Math.round(info.mtimeMs));
          } catch {
            /* a session without a log simply keeps using the TTL */
          }
        }
      }
      return index.size > 0 ? index : null;
    } catch {
      return null;
    }
  }

  /**
   * `exists` and `bytes` are properties of the disk right now, not of the log, so they are
   * resolved per snapshot (and cached for a few seconds) instead of being baked into the
   * cached ledger. One `statSync` answers both — asking twice for the same file would double
   * the syscall count on a 900-row table for no reason.
   */
  const existsCache = new Map();
  const EXISTS_TTL_MS = 20 * 1000;
  const EXISTS_CACHE_MAX = 4000;

  /** `{ exists, bytes }`; `bytes` is null for a missing file or a stat failure. */
  function statOf(path) {
    const hit = existsCache.get(path);
    const now = Date.now();
    if (hit !== undefined && now - hit.at < EXISTS_TTL_MS) return hit;
    let entry = { at: now, exists: false, bytes: null };
    try {
      const info = statSync(path);
      if (info.isFile()) {
        entry = { at: now, exists: true, bytes: info.size };
      }
    } catch {
      /* missing, unreadable or gone: the row shows as deleted */
    }
    if (existsCache.size >= EXISTS_CACHE_MAX) existsCache.clear();
    existsCache.set(path, entry);
    return entry;
  }


  async function replay(query, record, options = {}) {
    const sessionId = record.id;
    const live = record.live;
    const stamp = options.stamp ?? null;
    const floor = Number.isFinite(options.floor) ? options.floor : 0;
    const hit = cache.get(sessionId);
    // Exact invalidation: the cached ledger is reused while the log bytes are the same,
    // no matter how old the entry is. Closed sessions therefore never replay twice.
    if (hit !== undefined && stamp !== null && hit.stamp === stamp) {
      hit.at = Date.now();
      return hit.ledger;
    }
    if (ledgerReusable(hit, { live, stamp, floor })) return hit.ledger;
    const ledger = buildLedger(readEvents(await query.readSession(sessionId)), { header: record.header });
    const fingerprint = ledgerFingerprint(ledger);
    const unchanged = hit !== undefined && hit.fingerprint === fingerprint.key;
    const idle = unchanged ? Math.min((hit.idle ?? 0) + 1, 4) : 0;
    let ttl = COLD_TTL_MS;
    if (live === true) {
      const fresh = options.fresh === true;
      if (fresh) ttl = LIVE_TTL_MS;
      else if (fingerprint.latest > 0 && Date.now() - fingerprint.latest > ABANDONED_IDLE_MS) ttl = COLD_TTL_MS;
      else ttl = Math.min(LIVE_TTL_MS * Math.pow(2, idle), 20 * 1000);
    }
    cache.set(sessionId, { ledger, live, at: Date.now(), fingerprint: fingerprint.key, idle, ttl, stamp });
    ledgerEpoch += 1;
    ledgerDirty = true;
    return ledger;
  }

  function titlesOf(snapshots, ids) {
    const titles = new Map();
    if (!Array.isArray(snapshots)) return titles;
    for (let i = 0; i < snapshots.length && i < ids.length; i++) {
      const entry = snapshots[i];
      if (entry === null || entry === undefined || entry.status === "rejected") continue;
      const raw = entry.value?.title ?? entry.value?.text;
      const title = typeof raw === "string" ? raw : raw?.title ?? raw?.text ?? raw?.value ?? null;
      if (typeof title === "string" && title.trim() !== "") titles.set(ids[i], title.trim());
    }
    return titles;
  }

  /**
   * id -> { title, at, fetchedAt }. `at` is the last successful read and slides forward on
   * every use, so a title that is being displayed never expires under the user. Entries are
   * persisted: reading 40 titles from storage costs ~1.2 s, and a restart should not pay it.
   */
  const titleCache = new Map();
  let titleCacheLoaded = false;
  let titleSaveTimer = null;
  let titleRefreshTimer = null;
  let titleRefreshBusy = false;

  function loadTitleCache() {
    if (titleCacheLoaded) return;
    titleCacheLoaded = true;
    try {
      if (!existsSync(TITLE_FILE)) return;
      const parsed = JSON.parse(readFileSync(TITLE_FILE, "utf8"));
      for (const [id, entry] of Object.entries(parsed ?? {})) {
        const title = typeof entry?.title === "string" ? entry.title : null;
        const at = Number(entry?.at ?? 0);
        const fetchedAt = Number(entry?.fetchedAt ?? at);
        if (at > 0) titleCache.set(id, { title, at, fetchedAt });
      }
    } catch {
      /* a corrupt cache is not fatal: titles are refetched on demand */
    }
  }

  function saveTitleCacheSoon() {
    if (titleSaveTimer !== null) return;
    titleSaveTimer = setTimeout(() => {
      titleSaveTimer = null;
      try {
        const entries = [...titleCache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, 300);
        const out = {};
        for (const [id, entry] of entries) out[id] = { title: entry.title, at: entry.at, fetchedAt: entry.fetchedAt };
        mkdirSync(dirname(TITLE_FILE), { recursive: true });
        const tmp = TITLE_FILE + ".tmp";
        writeFileSync(tmp, JSON.stringify(out), "utf8");
        renameSync(tmp, TITLE_FILE);
      } catch {
        /* persisting titles is best effort */
      }
    }, 2000);
    if (typeof titleSaveTimer.unref === "function") titleSaveTimer.unref();
  }

  /** Read titles for the given ids and store them; never throws. */
  async function fetchTitles(query, ids) {
    loadTitleCache();
    const now = Date.now();
    let fetched = new Map();
    try {
      fetched = titlesOf(await query.readTitleSnapshots(ids), ids);
    } catch {
      fetched = new Map();
    }
    const failed = fetched.size === 0;
    for (const id of ids) {
      const previous = titleCache.get(id);
      const title = fetched.get(id) ?? previous?.title ?? null;
      // On failure keep the old title but retry soon instead of waiting the full TTL.
      const at = failed ? now - TITLE_TTL_MS + 30 * 1000 : now;
      titleCache.set(id, { title, at, fetchedAt: failed ? (previous?.fetchedAt ?? 0) : now });
    }
    saveTitleCacheSoon();
    return fetched;
  }

  /** Stale titles refresh in the background: the response never waits for them. */
  function refreshTitlesSoon(query, ids) {
    if (titleRefreshTimer !== null || titleRefreshBusy) return;
    titleRefreshTimer = setTimeout(() => {
      titleRefreshTimer = null;
      titleRefreshBusy = true;
      fetchTitles(query, ids).catch(() => {}).then(() => {
        titleRefreshBusy = false;
      });
    }, 400);
    if (typeof titleRefreshTimer.unref === "function") titleRefreshTimer.unref();
  }

  let ledgersLoaded = false;
  let ledgerSaveTimer = null;
  let ledgerDirty = false;

  /** Only the fields the panel and the fingerprint read; `uses` is deliberately dropped. */
  function ledgerForDisk(ledger) {
    return {
      sessionId: ledger.sessionId,
      createdAt: ledger.createdAt ?? null,
      cwd: ledger.cwd ?? "",
      agentPreset: ledger.agentPreset ?? null,
      counts: ledger.counts,
      files: (ledger.files ?? []).map((file) => ({
        name: file.name,
        path: file.path,
        rel: file.rel,
        category: file.category,
        reads: file.reads,
        writes: file.writes,
        createdAt: file.createdAt ?? null,
        updatedAt: file.updatedAt ?? null,
        firstUsedAt: file.firstUsedAt ?? null,
        lastUsedAt: file.lastUsedAt ?? null,
        created: file.created ?? null,
      })),
    };
  }

  function loadLedgerCache() {
    if (ledgersLoaded) return;
    ledgersLoaded = true;
    try {
      if (!existsSync(LEDGER_FILE)) return;
      const parsed = JSON.parse(gunzipSync(readFileSync(LEDGER_FILE)).toString("utf8"));
      if (parsed?.version !== LEDGER_VERSION) return;
      for (const [id, entry] of Object.entries(parsed.entries ?? {})) {
        if (typeof entry?.stamp !== "string" || entry?.ledger?.counts === undefined) continue;
        if (entry.engine !== LEDGER_ENGINE) continue;
        // at: 0 keeps the TTL fallback from trusting a stale entry when no stamp is available.
        cache.set(id, { ledger: entry.ledger, live: false, at: 0, fingerprint: entry.fingerprint ?? "", idle: 0, ttl: COLD_TTL_MS, stamp: entry.stamp });
        ledgerEpoch += 1;
      }
    } catch {
      /* an unreadable cache only costs one slow build */
    }
  }

  function saveLedgerCacheSoon() {
    if (ledgerSaveTimer !== null) return;
    ledgerSaveTimer = setTimeout(() => {
      ledgerSaveTimer = null;
      if (ledgerDirty !== true) return;
      ledgerDirty = false;
      try {
        const entries = [...cache.entries()]
          .filter(([, entry]) => typeof entry.stamp === "string")
          .sort((left, right) => (right[1].at ?? 0) - (left[1].at ?? 0))
          .slice(0, LEDGER_KEEP_MAX);
        if (entries.length === 0) return;
        const out = { version: LEDGER_VERSION, savedAt: Date.now(), entries: {} };
        for (const [id, entry] of entries) {
          out.entries[id] = {
            stamp: entry.stamp,
            engine: LEDGER_ENGINE,
            fingerprint: entry.fingerprint ?? "",
            ledger: ledgerForDisk(entry.ledger),
          };
        }
        mkdirSync(dirname(LEDGER_FILE), { recursive: true });
        const tmp = LEDGER_FILE + ".tmp";
        writeFileSync(tmp, gzipSync(Buffer.from(JSON.stringify(out), "utf8")));
        renameSync(tmp, LEDGER_FILE);
      } catch {
        /* persisting ledgers is best effort */
      }
    }, LEDGER_SAVE_DELAY_MS);
    if (typeof ledgerSaveTimer.unref === "function") ledgerSaveTimer.unref();
  }

  /**
   * Remove cache files that earlier versions of this plugin wrote and nothing reads now.
   *
   * `doc-ledger-snapshot.json.gz` cached the whole `/api/all` response before per-session
   * ledgers replaced it. It is 32 KB of dead weight that would otherwise sit in `~/.dsh`
   * forever. (The icon directory has its own pruning in `pruneIcons`, keyed by TTL, so it is
   * deliberately not repeated here.)
   *
   * Best effort: a permission error must never stop the plugin from loading.
   */

  /**
   * @param liveIds ids of sessions that are still running (their title may change)
   *
   * Unknown ids block the response (first run, or a session created a moment ago); stale
   * ones do not — they are returned as-is and refreshed in the background.
   */
  async function titlesFor(query, ids, liveIds) {
    loadTitleCache();
    const now = Date.now();
    const titles = new Map();
    const stale = [];
    const missing = [];
    for (const id of ids) {
      const hit = titleCache.get(id);
      if (hit === undefined) {
        missing.push(id);
        continue;
      }
      if (hit.title !== null) titles.set(id, hit.title);
      const ttl = liveIds?.has(id) === true ? TITLE_TTL_LIVE_MS : TITLE_TTL_MS;
      if (now - hit.at >= ttl || now - hit.fetchedAt >= TITLE_HARD_TTL_MS) stale.push(id);
      else hit.at = now;
    }
    if (missing.length > 0) {
      const fetched = await fetchTitles(query, missing);
      for (const [id, title] of fetched) titles.set(id, title);
    }
    if (stale.length > 0) refreshTitlesSoon(query, stale);
    return titles;
  }

  /**
   * Content fingerprint of a snapshot. Polling compares it with what the client already
   * shows: an unchanged revision means the panel does not have to re-render ~900 rows.
   */
  function snapshotRev(sessions) {
    const hash = createHash("sha1");
    for (const session of sessions) {
      let latest = 0;
      let missing = 0;
      for (const file of session.files ?? []) {
        if ((file.lastUsedAt ?? 0) > latest) latest = file.lastUsedAt ?? 0;
        if ((file.updatedAt ?? 0) > latest) latest = file.updatedAt ?? 0;
        // A file disappearing from disk changes what the panel shows but no event, so the
        // revision has to carry it; the title is hashed for the same reason (rename).
        if (file.exists === false) missing += 1;
      }
      const counts = session.counts ?? {};
      hash.update(session.sessionId + ":" + (session.files?.length ?? 0) + ":" + (counts.reads ?? 0) + ":" + (counts.writes ?? 0) + ":" + latest + ":" + missing + ":" + (session.title ?? "") + "\n");
    }
    return hash.digest("hex").slice(0, 12);
  }

    /**
     * `listSessions()` rows -> flat records with a guaranteed non-empty id.
     *
     * The host returns `{ header: { id, createdAt, cwd, agentPreset }, live, persisted }`, but
     * older shapes put those fields at the top level, so every field is read from both. Records
     * without an id are dropped: they cannot be replayed or addressed.
     */
    function normalizeRecords(listed, limit) {
      return (Array.isArray(listed) ? listed : []).slice(0, limit).map((item) => {
        const header = item?.header ?? item ?? {};
        const id = header.id ?? item?.id ?? item?.sessionId ?? "";
        const createdAt = header.createdAt ?? item?.createdAt ?? null;
        const cwd = header.cwd ?? item?.cwd ?? "";
        const agentPreset = header.agentPreset ?? item?.agentPreset ?? null;
        return {
          header: { id, createdAt, cwd, agentPreset },
          id,
          createdAt,
          cwd,
          agentPreset,
          live: item?.live === true,
          // A subagent names its parent here; the panel turns it into "jump to parent".
          parentSession: typeof header.parentSession === "string" ? header.parentSession : null,
        };
      }).filter((record) => record.id !== "");
    }

    /**
     * Replay the wanted sessions and build the panel's `sessions[]`.
     *
     * Replaying is the expensive half, so it happens through `mapPool` (bounded concurrency) and
     * a failed session is skipped rather than failing the whole response.
     */
    async function foldSessions(query, wanted, options) {
      const preferredId = options.preferredId;
      const titles = options.titles ?? new Map();
      const logs = sessionLogIndex();
      const ledgers = await mapPool(wanted, REPLAY_CONCURRENCY, async (record) => {
        try {
          return await replay(query, record, { fresh: record.id === preferredId, stamp: logs?.get(record.id) ?? null, floor: options.floor ?? 0 });
        } catch {
          return null;
        }
      });
      const sessions = [];
      for (let index = 0; index < wanted.length; index += 1) {
        const record = wanted[index];
        const ledger = ledgers[index];
        if (ledger === null || ledger === undefined) continue;
        // Keep the session the client asked about even when it has no documents yet, so the
        // panel can say so instead of silently showing a different conversation.
        if (ledger.counts.files === 0 && record.id !== preferredId) continue;
        sessions.push({
          sessionId: ledger.sessionId || record.id,
          title: titles.get(record.id) ?? record.id,
          createdAt: ledger.createdAt ?? record.createdAt,
          cwd: ledger.cwd || record.cwd,
          agentPreset: ledger.agentPreset ?? record.agentPreset,
          live: record.live,
          parentSessionId: record.parentSession,
          counts: ledger.counts,
          files: ledger.files.map((file) => slimFile(file, statOf(file.path))),
        });
      }
      sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return sessions;
    }

    /** The response body: revision, scope flags and the truncation notice. */
    function shapePayload(sessions, ctxInfo) {
      const { preferred, preferredId, listedCount, limit, scope } = ctxInfo;
      return {
        generatedAt: Date.now(),
        rev: snapshotRev(sessions),
        currentSessionId: preferred ? preferredId : (sessions[0]?.sessionId ?? null),
        sessions,
        partial: scope === "current" && preferred,
        totalSessions: listedCount,
        truncated: listedCount > limit,
        maxSessions: limit,
      };
    }

    /** Every session with at least one document, newest first. */
    async function snapshot(preferredId, options = {}) {
      const scope = options.scope === "current" ? "current" : "all";
      const requestedLimit = Number(options.limit);
      const limit = requestedLimit > 0 ? Math.min(300, Math.max(1, Math.floor(requestedLimit))) : maxSessions;
      const timing = options.timing === true ? {} : null;
      const started = Date.now();
      loadLedgerCache();
      const query = ctx.get("sessionQuery");
      if (query === undefined) {
        return { generatedAt: Date.now(), currentSessionId: null, sessions: [], partial: false, warning: "sessionQuery is unavailable in this profile" };
      }
      const listed = await query.listSessions();
      const listedCount = Array.isArray(listed) ? listed.length : 0;
      if (timing !== null) timing.listSessions = Date.now() - started;
      const records = normalizeRecords(listed, limit);

      // One session asked for: replay only it, so opening the panel does not pay for
      // every other conversation in the profile.
      const preferred = preferredId !== null && preferredId !== undefined && preferredId !== "";
      const wanted = scope === "current" && preferred ? records.filter((record) => record.id === preferredId) : records;
      const ids = wanted.map((record) => record.id);
      const liveIds = new Set(wanted.filter((record) => record.live === true).map((record) => record.id));
      let titles = new Map();
      try {
        titles = await titlesFor(query, ids, liveIds);
      } catch {
        titles = new Map();
      }
      if (timing !== null) timing.titles = Date.now() - started - timing.listSessions;

      const sessions = await foldSessions(query, wanted, { preferredId, titles, floor: options.floor ?? 0 });
      if (timing !== null) timing.replay = Date.now() - started - timing.listSessions - timing.titles;
      const payload = shapePayload(sessions, { preferred, preferredId, listedCount, limit, scope });
      if (timing !== null) payload.timings = Object.assign({}, timing, { total: Date.now() - started });
      saveLedgerCacheSoon();
      return payload;
    }

  /** Absolute Windows launcher paths: the host PATH can be scrubbed, so never trust a bare name. */
  const WINDIR = process.env.WINDIR || process.env.SystemRoot || "C:\\Windows";
  const EXPLORER = join(WINDIR, "explorer.exe");
  const RUNDLL = join(WINDIR, "System32", "rundll32.exe");
  const REG = join(WINDIR, "System32", "reg.exe");

  const regCache = new Map();
  const regRawCache = new Map();

  /**
   * One `reg.exe` query, cached forever by its argument list. Async on purpose: the
   * first "open with" enumeration spawns a dozen of these and used to block the whole
   * host event loop for a few hundred milliseconds.
   */
  function regRaw(args) {
    const key = args.join("|");
    const hit = regRawCache.get(key);
    if (hit !== undefined) return hit;
    const promise = execFileAsync(REG, args, { encoding: "utf8", windowsHide: true })
      .then((out) => out.stdout ?? "")
      .catch(() => "");
    regRawCache.set(key, promise);
    return promise;
  }

  /** Read one registry value; empty string when the key or value is absent. */
  async function regValue(key, name) {
    const cacheKey = key + "|" + (name === null ? "" : name);
    const hit = regCache.get(cacheKey);
    if (hit !== undefined) return hit;
    const args = name === null ? ["query", key, "/ve"] : ["query", key, "/v", name];
    const promise = regRaw(args).then((output) => {
      const line = output.split(/\r?\n/).find((row) => /REG_(SZ|EXPAND_SZ)/.test(row));
      if (line === undefined) return "";
      const parts = line.trim().split(/\s{2,}/);
      return parts[parts.length - 1] ?? "";
    });
    regCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * Names declared by one registry key, in either of the two shapes the shell uses:
   * subkeys (HKCR\<progId>) or values (OpenWithProgids / OpenWithList).
   */
  async function regNames(key) {
    const cacheKey = "names|" + key;
    const hit = regCache.get(cacheKey);
    if (hit !== undefined) return hit;
    const promise = regRaw(["query", key]).then((output) => {
      const names = [];
      for (const raw of output.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === "" || /^HKEY_/.test(line)) continue;
        // A value row looks like "Name    REG_SZ    data"; a subkey row is just the name.
        const name = /REG_/.test(line) ? line.split(/\s{2,}/)[0] : line;
        if (name === undefined || name === "" || name === "MRUList") continue;
        names.push(name);
      }
      return names;
    });
    regCache.set(cacheKey, promise);
    return promise;
  }

  /** The executable named by a shell "open" command line, without the %1 placeholder. */
  function exeFromCommand(command) {
    const match = /^\s*"([^"]+)"/.exec(command) ?? /^\s*(\S+\.exe)/i.exec(command);
    return match === null ? "" : match[1];
  }

  const EXE_LABEL = {
    "code.exe": "VS Code",
    "code - insiders.exe": "VS Code Insiders",
    "cursor.exe": "Cursor",
    "idea64.exe": "IntelliJ IDEA",
    "idea.exe": "IntelliJ IDEA",
    "notepad.exe": "记事本",
    "notepad++.exe": "Notepad++",
    "typora.exe": "Typora",
    "workbuddy.exe": "WorkBuddy",
    "wps.exe": "WPS",
    "winword.exe": "Word",
    "excel.exe": "Excel",
    "powerpnt.exe": "PowerPoint",
    "chrome.exe": "Chrome",
    "msedge.exe": "Edge",
    "firefox.exe": "Firefox",
    "git-bash.exe": "Git Bash",
    "explorer.exe": "文件资源管理器",
    "photos.exe": "照片",
    "photolaunch.exe": "照片",
    "iexplore.exe": "Internet Explorer",
    "winrar.exe": "WinRAR",
    "7zfm.exe": "7-Zip",
    "mspaint.exe": "画图"
  };

  /** Friendly program name for an executable path. */
  function exeLabel(exe) {
    if (exe === "") return "";
    const base = (exe.split(/[\\/]/).pop() ?? "").toLowerCase();
    return EXE_LABEL[base] ?? base.replace(/\.exe$/i, "");
  }

  /** Real application icons, extracted from the executable and cached as PNG. */
  const ICON_DIR = join(homedir(), ".dsh", "doc-ledger-icons");
  const ICON_CACHE_MAX = 300;
  const ICON_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  /** exe -> cached PNG path, or null when extraction is known to fail (LRU order). */
  const iconCache = new Map();
  /** exe -> in-flight promise, so concurrent requests spawn PowerShell once. */
  const iconPending = new Map();
  let iconPruned = false;

  function rememberIcon(exe, file) {
    if (iconCache.has(exe)) iconCache.delete(exe);
    iconCache.set(exe, file);
    if (iconCache.size > ICON_CACHE_MAX) {
      const oldest = iconCache.keys().next().value;
      if (oldest !== undefined) iconCache.delete(oldest);
    }
  }

  /** Drop PNGs of uninstalled or upgraded programs so the cache cannot grow forever. */
  function pruneIcons() {
    if (iconPruned === true) return;
    iconPruned = true;
    const timer = setTimeout(() => {
      try {
        const cutoff = Date.now() - ICON_TTL_MS;
        for (const name of readdirSync(ICON_DIR)) {
          const file = join(ICON_DIR, name);
          try {
            const info = statSync(file);
            if (info.isFile() && info.mtimeMs < cutoff) unlinkSync(file);
          } catch {
            /* a file that vanished mid-scan is fine */
          }
        }
      } catch {
        /* no icon directory yet */
      }
    }, 5000);
    if (typeof timer.unref === "function") timer.unref();
  }

  /** The PNG path one executable would use, without touching the disk beyond stat(). */
  function iconPlan(exe) {
    let stamp;
    try {
      stamp = statSync(exe).mtimeMs;
    } catch {
      return null;
    }
    const name = createHash("sha1").update(exe.toLowerCase() + "|" + stamp).digest("hex") + ".png";
    return { exe, file: join(ICON_DIR, name) };
  }

  function iconOnDisk(file) {
    try {
      return existsSync(file) && statSync(file).size > 0;
    } catch {
      return false;
    }
  }

  /** One PowerShell start for N icons, then a per-file existence check. */
  function runIconBatch(jobs) {
    return new Promise((resolve) => {
      const listFile = join(tmpdir(), "doc-ledger-icons-" + process.pid + "-" + Date.now() + ".txt");
      const lines = jobs.map((job) => job.exe + "|" + job.file).join("\r\n");
      try {
        mkdirSync(ICON_DIR, { recursive: true });
        // A BOM keeps Windows PowerShell from re-reading the paths as ANSI.
        writeFileSync(listFile, "\uFEFF" + lines, "utf8");
      } catch {
        resolve(new Set());
        return;
      }
      const powershell = join(WINDIR, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      const script = [
        "Add-Type -AssemblyName System.Drawing",
        "$out = New-Object System.Collections.Generic.List[string]",
        "foreach ($line in (Get-Content -LiteralPath $env:DOC_LEDGER_ICON_LIST -Encoding UTF8)) {",
        "  $parts = $line.Split([char]124)",
        "  if ($parts.Length -lt 2) { continue }",
        "  try {",
        "    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($parts[0])",
        "    if ($icon -ne $null) { $icon.ToBitmap().Save($parts[1], [System.Drawing.Imaging.ImageFormat]::Png); $icon.Dispose() }",
        "  } catch { }",
        "}"
      ].join("; ");
      execFileAsync(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], {
        encoding: "utf8",
        timeout: 20000,
        windowsHide: true,
        env: Object.assign(launchEnv(), { DOC_LEDGER_ICON_LIST: listFile })
      }).then(() => {
        const ok = new Set();
        for (const job of jobs) if (iconOnDisk(job.file)) ok.add(job.file);
        resolve(ok);
      }, () => resolve(new Set())).finally(() => {
        try {
          unlinkSync(listFile);
        } catch {
          /* temp file cleanup is best effort */
        }
      });
    });
  }

  /**
   * Real Windows file icons, extracted per *extension* through the shell.
   *
   * `app.getFileIcon` (Electron) would be the obvious route, but the plugin's host half runs in
   * a plain Node child of Electron: `process.versions.electron` is undefined there, so there is
   * no `app` object and no `electron` module to require. `SHGetFileInfo` from shell32 is the
   * association Explorer itself uses, which makes it the honest B tier.
   *
   * Extracted per extension, not per path: the icon is an association, so 40 `.md` files cost
   * one extraction. When this 404s the client falls back to its own drawing (tier C).
   */
  const FILEICON_DIR = join(homedir(), ".dsh", "doc-ledger-fileicons");
  const FILEICON_KEEP_MAX = 200;
  /** ext -> cached PNG path ("" when extraction is known to fail), LRU ordered. */
  const fileIconCache = new Map();
  const fileIconPending = new Map();
  let fileIconPruned = false;

  /** Strip a leading dot and sanity-check an extension so it cannot escape the cache dir. */
  function safeExt(value) {
    const ext = String(value ?? "").toLowerCase().replace(/^\.+/, "");
    return /^[a-z0-9_+-]{1,16}$/.test(ext) ? ext : "";
  }

  function fileIconPath(ext) {
    return join(FILEICON_DIR, ext + "-" + createHash("sha1").update("v1:" + ext).digest("hex").slice(0, 8) + ".png");
  }

  function fileIconOnDisk(file) {
    try {
      return existsSync(file) && statSync(file).size > 0;
    } catch {
      return false;
    }
  }

  /** Drop icons of extensions that stopped appearing, so the directory cannot grow forever. */
  function pruneFileIcons() {
    if (fileIconPruned === true) return;
    fileIconPruned = true;
    const timer = setTimeout(() => {
      try {
        const entries = readdirSync(FILEICON_DIR)
          .map((name) => ({ name, file: join(FILEICON_DIR, name) }))
          .map((entry) => {
            try {
              return { ...entry, at: statSync(entry.file).mtimeMs };
            } catch {
              return { ...entry, at: 0 };
            }
          })
          .sort((left, right) => right.at - left.at);
        for (const stale of entries.slice(FILEICON_KEEP_MAX)) {
          try {
            unlinkSync(stale.file);
          } catch {
            /* one file */
          }
        }
      } catch {
        /* the directory does not exist yet */
      }
    }, 3000);
    if (typeof timer.unref === "function") timer.unref();
  }

  /**
   * One PowerShell run for a batch of extensions.
   *
   * SHGetFileInfo hands back an HICON that must be cloned and then released with DestroyIcon;
   * skipping the release leaks a GDI handle per icon, which is why the P/Invoke block is spelled
   * out instead of relying on `ExtractAssociatedIcon` (that one only reads executables).
   */
  function runFileIconBatch(jobs) {
    return new Promise((resolve) => {
      const listFile = join(tmpdir(), "doc-ledger-fileicons-" + process.pid + "-" + Date.now() + ".txt");
      const lines = jobs.map((job) => job.ext + "|" + job.file).join("\r\n");
      try {
        mkdirSync(FILEICON_DIR, { recursive: true });
        writeFileSync(listFile, "\uFEFF" + lines, "utf8");
      } catch {
        resolve(new Set());
        return;
      }
      const powershell = join(WINDIR, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      const script = [
        "Add-Type -AssemblyName System.Drawing",
        "Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public class DocLedgerShellIcon {",
        "  [DllImport(\"shell32.dll\", CharSet = CharSet.Unicode)]",
        "  public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);",
        "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]",
        "  public struct SHFILEINFO {",
        "    public IntPtr hIcon; public int iIcon; public uint dwAttributes;",
        "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName;",
        "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName;",
        "  }",
        "  public static System.Drawing.Icon Get(string path) {",
        "    SHFILEINFO info = new SHFILEINFO();",
        "    IntPtr res = SHGetFileInfo(path, 0, ref info, (uint)Marshal.SizeOf(info), 0x000000100u);",
        "    if (res == IntPtr.Zero || info.hIcon == IntPtr.Zero) return null;",
        "    try { return (System.Drawing.Icon)System.Drawing.Icon.FromHandle(info.hIcon).Clone(); }",
        "    finally { DestroyIcon(info.hIcon); }",
        "  }",
        "  [DllImport(\"user32.dll\")] public static extern bool DestroyIcon(IntPtr hIcon);",
        "}",
        "'@",
        "$out = New-Object System.Collections.Generic.List[string]",
        "foreach ($line in (Get-Content -LiteralPath $env:DOC_LEDGER_FILEICON_LIST -Encoding UTF8)) {",
        "  $parts = $line.Split([char]124)",
        "  if ($parts.Length -lt 2) { continue }",
        "  try {",
        // A probe file on disk makes the shell resolve the extension association; create once.
        "    $probe = Join-Path ([System.IO.Path]::GetTempPath()) ('doc-ledger-probe.' + $parts[0])",
        "    if (-not (Test-Path -LiteralPath $probe)) { [System.IO.File]::WriteAllText($probe, '') }",
        "    $icon = [DocLedgerShellIcon]::Get($probe)",
        "    if ($icon -ne $null) { $icon.ToBitmap().Save($parts[1], [System.Drawing.Imaging.ImageFormat]::Png); $icon.Dispose() }",
        "  } catch { }",
        "}"
        // Real newlines on purpose: the Add-Type here-string (`@'` … `'@`) is line-based and
        // silently fails to compile when the whole script is joined onto one line.
      ].join("\r\n");
      execFileAsync(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], {
        encoding: "utf8",
        timeout: 25000,
        windowsHide: true,
        env: Object.assign(launchEnv(), { DOC_LEDGER_FILEICON_LIST: listFile })
      }).then(() => {
        const ok = new Set();
        for (const job of jobs) if (fileIconOnDisk(job.file)) ok.add(job.ext);
        resolve(ok);
      }, () => resolve(new Set())).finally(() => {
        try {
          unlinkSync(listFile);
        } catch {
          /* temp file cleanup is best effort */
        }
      });
    });
  }

  /** Resolve file icons for a set of extensions; missing ones share one PowerShell run. */
  function resolveFileIcons(exts) {
    pruneFileIcons();
    const result = new Map();
    const todo = [];
    for (const raw of exts) {
      const ext = safeExt(raw);
      if (ext === "") continue;
      if (fileIconCache.has(ext)) {
        result.set(ext, fileIconCache.get(ext));
        continue;
      }
      const pending = fileIconPending.get(ext);
      if (pending !== undefined) {
        result.set(ext, pending);
        continue;
      }
      const file = fileIconPath(ext);
      if (fileIconOnDisk(file)) {
        fileIconCache.set(ext, file);
        result.set(ext, file);
        continue;
      }
      todo.push({ ext, file });
    }
    if (todo.length === 0) return Promise.resolve(result);
    const batch = runFileIconBatch(todo).then((ok) => {
      for (const job of todo) {
        const file = ok.has(job.ext) ? job.file : "";
        fileIconCache.set(job.ext, file);
        fileIconPending.delete(job.ext);
        result.set(job.ext, file);
      }
      return result;
    });
    for (const job of todo) {
      fileIconPending.set(job.ext, batch.then((map) => map.get(job.ext) ?? ""));
    }
    return batch;
  }

  /** Serve one extracted file icon, or 404 so the client draws its own fallback. */
  async function handleFileIcon(res, url) {
    const ext = safeExt(url.searchParams.get("ext"));
    if (ext === "") {
      sendJson(res, 400, { error: "ext required" });
      return;
    }
    const resolved = await resolveFileIcons([ext]);
    const file = resolved.get(ext) ?? "";
    if (file === "" || !fileIconOnDisk(file)) {
      sendJson(res, 404, { error: "no shell icon for this extension" });
      return;
    }
    try {
      const bytes = readFileSync(file);
      res.writeHead(200, {
        "content-type": "image/png",
        "content-length": String(bytes.length),
        // An extension association changes only when the user installs software.
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff"
      });
      res.end(bytes);
    } catch {
      sendJson(res, 404, { error: "icon unreadable" });
    }
  }

  /**
   * Resolve icons for a set of executables. Programs already cached or on disk cost
   * nothing; the rest share one PowerShell run (measured: 6 icons in 510 ms serially
   * versus 308 ms batched, and the gap grows with the number of programs).
   */
  function resolveIcons(exes) {
    pruneIcons();
    const result = new Map();
    const todo = [];
    for (const exe of exes) {
      if (typeof exe !== "string" || exe === "") continue;
      if (iconCache.has(exe)) {
        result.set(exe, iconCache.get(exe));
        continue;
      }
      const pending = iconPending.get(exe);
      if (pending !== undefined) {
        result.set(exe, pending);
        continue;
      }
      const plan = iconPlan(exe);
      if (plan === null) {
        rememberIcon(exe, null);
        result.set(exe, null);
        continue;
      }
      if (iconOnDisk(plan.file)) {
        rememberIcon(exe, plan.file);
        result.set(exe, plan.file);
        continue;
      }
      todo.push(plan);
    }
    if (todo.length === 0) return Promise.resolve(result);
    const batch = runIconBatch(todo).then((ok) => {
      for (const job of todo) {
        rememberIcon(job.exe, ok.has(job.file) ? job.file : null);
        iconPending.delete(job.exe);
      }
    }, () => {
      for (const job of todo) {
        rememberIcon(job.exe, null);
        iconPending.delete(job.exe);
      }
    });
    for (const job of todo) {
      iconPending.set(job.exe, batch.then(() => iconCache.get(job.exe) ?? null));
    }
    return batch.then(() => {
      for (const job of todo) result.set(job.exe, iconCache.get(job.exe) ?? null);
      return result;
    });
  }

  /** The PNG icon of one executable (the path used by the /icon route). */
  function iconPath(exe) {
    if (iconCache.has(exe)) {
      const cached = iconCache.get(exe);
      rememberIcon(exe, cached);
      return Promise.resolve(cached);
    }
    return resolveIcons([exe]).then((map) => map.get(exe) ?? null);
  }

  /** Serve the cached PNG icon of one executable. */
  async function handleIcon(res, url) {
    const exe = url.searchParams.get("path") ?? "";
    if (exe === "" || !isAbsolute(exe) || !/\.(exe|ico|lnk)$/i.test(exe) || !existsSync(exe)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("no icon");
      return;
    }
    const file = await iconPath(exe);
    if (file === null) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("no icon");
      return;
    }
    try {
      const bytes = readFileSync(file);
      // Keyed by the executable that produced it; a cheap revalidation avoids a stale icon
      // when the program is updated in place.
      const etag = '"' + createHash("sha1").update(file).update(String(bytes.length)).digest("hex").slice(0, 16) + '"';
      if (String(res.req?.headers?.["if-none-match"] ?? "") === etag) {
        res.writeHead(304, { etag, "cache-control": "public, max-age=86400" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=86400", etag });
      res.end(bytes);
    } catch {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("icon read failed");
    }
  }

  /** The application Windows would use for this file: ProgId, executable, and label. */
  async function defaultHandler(filePath) {
    const ext = extname(filePath).toLowerCase();
    if (ext === "") return null;
    let progId = await regValue("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\" + ext + "\\UserChoice", "ProgId");
    // No UserChoice (fresh profile, or Windows reset it): fall back to the class default,
    // otherwise the menu would show no "（默认）" marker at all.
    if (progId === "") progId = await regValue("HKCR\\" + ext, null);
    if (progId === "") return null;
    const command = await regValue("HKCR\\" + progId + "\\shell\\open\\command", null);
    const exe = exeFromCommand(command);
    return { progId, exe, label: exeLabel(exe) || progId };
  }

  /** One explorer "open with" entry: a ProgId, or an executable name from OpenWithList. */
  async function resolveHandlerName(name) {
    if (name === "" || name === "MRUList") return null;
    if (/\.exe$/i.test(name)) {
      const command = (await regValue("HKCR\\Applications\\" + name + "\\shell\\open\\command", null)) || (await regValue("HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" + name, null));
      const exe = exeFromCommand(command) || (isAbsolute(command) ? command : "");
      return exe === "" ? null : { progId: name, exe };
    }
    const command = await regValue("HKCR\\" + name + "\\shell\\open\\command", null);
    const exe = exeFromCommand(command);
    return exe === "" ? null : { progId: name, exe };
  }

  const openWithCache = new Map();
  const openWithPending = new Map();
  let openWithLoaded = false;
  let openWithSaveTimer = null;

  /** Extension -> programs changes only when software is installed, so it survives restarts. */
  const OPENWITH_FILE = join(homedir(), ".dsh", "doc-ledger-openwith.json");
  const OPENWITH_SAVE_MAX = 200;

  function loadOpenWithCache() {
    if (openWithLoaded) return;
    openWithLoaded = true;
    try {
      if (!existsSync(OPENWITH_FILE)) return;
      const parsed = JSON.parse(readFileSync(OPENWITH_FILE, "utf8"));
      for (const [ext, entry] of Object.entries(parsed ?? {})) {
        if (!Array.isArray(entry?.list) || typeof entry.at !== "number") continue;
        if (Date.now() - entry.at >= OPENWITH_TTL_MS) continue;
        openWithCache.set(ext, { at: entry.at, list: entry.list });
      }
    } catch {
      /* a corrupt cache only costs one registry sweep */
    }
  }

  function saveOpenWithCacheSoon() {
    if (openWithSaveTimer !== null) return;
    openWithSaveTimer = setTimeout(() => {
      openWithSaveTimer = null;
      try {
        const out = {};
        const entries = [...openWithCache.entries()].sort((left, right) => right[1].at - left[1].at).slice(0, OPENWITH_SAVE_MAX);
        for (const [ext, entry] of entries) out[ext] = { at: entry.at, list: entry.list };
        mkdirSync(dirname(OPENWITH_FILE), { recursive: true });
        const tmp = OPENWITH_FILE + ".tmp";
        writeFileSync(tmp, JSON.stringify(out));
        renameSync(tmp, OPENWITH_FILE);
      } catch {
        /* best effort */
      }
    }, 1000);
    if (typeof openWithSaveTimer.unref === "function") openWithSaveTimer.unref();
  }

  /**
   * Every program Windows would offer for this file: the default handler plus the
   * ProgIds and executables registered under OpenWithProgids / OpenWithList.
   * Concurrent callers share one enumeration.
   */
  function openWithCandidates(filePath) {
    const ext = extname(filePath).toLowerCase();
    if (ext === "") return Promise.resolve([]);
    loadOpenWithCache();
    const cached = openWithCache.get(ext);
    if (cached !== undefined && Date.now() - cached.at < OPENWITH_TTL_MS) return Promise.resolve(cached.list);
    const pending = openWithPending.get(ext);
    if (pending !== undefined) return pending;
    const promise = enumerateOpenWith(ext).then((list) => {
      openWithCache.set(ext, { at: Date.now(), list });
      saveOpenWithCacheSoon();
      openWithPending.delete(ext);
      return list;
    }, (error) => {
      openWithPending.delete(ext);
      throw error;
    });
    openWithPending.set(ext, promise);
    return promise;
  }

  async function enumerateOpenWith(ext) {
    const current = await defaultHandler("x" + ext);
    const defaultProgId = current === null ? "" : current.progId;
    const names = [];
    if (defaultProgId !== "") names.push(defaultProgId);
    for (const name of await regNames("HKCU\\Software\\Classes\\" + ext + "\\OpenWithProgids")) names.push(name);
    for (const name of await regNames("HKCR\\" + ext + "\\OpenWithProgids")) names.push(name);
    const fileExts = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\" + ext;
    for (const valueName of await regNames(fileExts + "\\OpenWithList")) {
      if (valueName === "MRUList") continue;
      const mapped = await regValue(fileExts + "\\OpenWithList", valueName);
      names.push(mapped === "" ? valueName : mapped);
    }
    const handlers = [];
    for (const name of names) {
      const handler = await resolveHandlerName(name);
      if (handler === null) continue;
      if (!existsSync(handler.exe)) continue;
      handlers.push(handler);
    }

    const list = [];
    const seen = new Set();
    for (const handler of handlers) {
      const key = handler.exe.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: handler.exe,
        exe: handler.exe,
        label: exeLabel(handler.exe) || handler.progId,
        progId: handler.progId,
        isDefault: defaultProgId !== "" && handler.progId === defaultProgId
      });
    }
    if (list.length > 0 && !list.some((entry) => entry.isDefault)) list[0].isDefault = true;
    return list;
  }

  /**
   * Environment handed to a launched GUI application.
   *
   * The host runs under Electron and carries Electron's own switches in its process
   * environment. `ELECTRON_RUN_AS_NODE` is the harmful one: an Electron-based editor
   * (VS Code, Cursor, ...) started with it runs as plain Node instead of a GUI, so
   * `Code.exe file.md` tries to execute the document as JavaScript and exits with a
   * SyntaxError in milliseconds — no window ever appears. Strip the Electron switches
   * so the child starts as the ordinary desktop application the user picked.
   */
  function launchEnv() {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (/^ELECTRON_/i.test(key)) continue;
      env[key] = value;
    }
    return env;
  }

  /**
   * Run one GUI launcher and resolve once Windows accepted the spawn.
   * Never pass windowsHide here: it maps to STARTF_USESHOWWINDOW=SW_HIDE, which makes Explorer
   * and GUI editors create their window hidden — the "click does nothing" symptom.
   */
  function launch(command, args) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      let child;
      try {
        child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false, env: launchEnv() });
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error.message : String(error) });
        return;
      }
      child.on("error", (error) => finish({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      child.on("spawn", () => {
        child.unref();
        finish({ ok: true, command });
      });
      setTimeout(() => finish({ ok: true, command, timeout: true }), 1500);
    });
  }

  /** Focus the Explorer window titled after the folder, so a reveal is visible instead of opening behind. */
  function activateExplorer(title) {
    if (title === "") return;
    const safe = title.replace(/'/g, "''");
    const script = "try { $null = (New-Object -ComObject WScript.Shell).AppActivate('" + safe + "') } catch { }";
    try {
      const child = spawn(join(WINDIR, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script], { windowsHide: true, detached: true, stdio: "ignore" });
      child.unref();
    } catch (error) {
      /* focus is best effort */
    }
  }

  /** Hand one file to a chosen application, reveal it, or show the Windows "open with" dialog. */
  async function handleOpen(req, res, url) {
    // Launching a program must never be a GET: a link, an <img> or a prefetch would be
    // enough to run it. The panel posts to this route, the browser does not preflight it
    // for us, so the method itself is the first line of defence.
    if (String(req?.method ?? "GET").toUpperCase() !== "POST") {
      sendJson(res, 405, { ok: false, error: "请用 POST 调用" });
      return;
    }
    const rawMode = url.searchParams.get("mode") ?? "open";
    const mode = rawMode === "reveal" || rawMode === "choose" ? rawMode : "open";
    const target = url.searchParams.get("path") ?? "";
    let appId = url.searchParams.get("app") ?? "";
    if (target === "" || !isAbsolute(target)) {
      sendJson(res, 400, { ok: false, error: "路径必须是绝对路径" });
      return;
    }
    if (!isKnownPath(target)) {
      sendJson(res, 403, { ok: false, error: "只能打开台账里出现过的文件" });
      return;
    }
    const fileExists = existsSync(target);
    if (!fileExists) {
      const parent = dirname(target);
      if ((mode === "reveal" || mode === "choose") && existsSync(parent)) {
        const result = await launch(EXPLORER, [parent]);
        sendJson(res, result.ok ? 200 : 500, result.ok ? { ok: true, data: { mode, path: parent, fallback: true } } : { ok: false, error: "打开所在目录失败：" + result.error });
        return;
      }
      sendJson(res, 404, { ok: false, error: "文件已不存在：" + target });
      return;
    }
    if (mode === "choose") {
      const result = await launch(RUNDLL, ["shell32.dll,OpenAs_RunDLL", target]);
      sendJson(res, result.ok ? 200 : 500, result.ok ? { ok: true, data: { mode, path: target, command: RUNDLL } } : { ok: false, error: "打开「打开方式」失败：" + result.error });
      return;
    }
    if (mode === "reveal") {
      const result = await launch(EXPLORER, ["/select,", target]);
      if (result.ok) {
        const folder = dirname(target);
        const name = folder.split(/[\\/]/).pop() || "";
        setTimeout(function () { activateExplorer(name); }, 700);
        sendJson(res, 200, { ok: true, data: { mode, path: target, command: EXPLORER } });
        return;
      }
      sendJson(res, 500, { ok: false, error: "定位失败：" + result.error });
      return;
    }

    // Only executables this machine already offers for the extension may be launched.
    const candidates = await openWithCandidates(target);
    let chosen = null;
    if (appId === "" || appId === "default") {
      chosen = candidates.find((entry) => entry.isDefault) ?? null;
    } else {
      chosen = candidates.find((entry) => entry.exe.toLowerCase() === appId.toLowerCase()) ?? null;
      if (chosen === null) {
        sendJson(res, 400, { ok: false, error: "这个程序没有为 " + extname(target) + " 注册打开方式" });
        return;
      }
      appId = chosen.exe;
    }
    const command = chosen === null ? EXPLORER : chosen.exe;
    const result = await launch(command, [target]);
    if (result.ok) {
      sendJson(res, 200, { ok: true, data: { mode, path: target, app: appId || "default", label: chosen === null ? "" : chosen.label, command } });
      return;
    }
    sendJson(res, 500, { ok: false, error: "启动失败：" + result.error + "（" + command + "）" });
  }

  /** The "open with" list for one file, default first. */
  async function handleOpenWith(res, url) {
    const target = url.searchParams.get("path") ?? "";
    if (target === "" || !isAbsolute(target)) {
      sendJson(res, 400, { ok: false, error: "路径必须是绝对路径" });
      return;
    }
    if (!isKnownPath(target)) {
      sendJson(res, 403, { ok: false, error: "只能查询台账里出现过的文件" });
      return;
    }
    const list = (await openWithCandidates(target)).map((entry) => Object.assign({}, entry, {
      icon: base + "/icon?path=" + encodeURIComponent(entry.exe),
    }));
    // Warm the whole icon set in one PowerShell run so the menu's <img> requests hit
    // memory instead of each spawning PowerShell.
    void resolveIcons(list.map((entry) => entry.exe));
    sendJson(res, 200, { ok: true, data: { ext: extname(target), apps: list, default: list.find((entry) => entry.isDefault) ?? null } });
  }

  /** Client diagnostics are opt-in (config.debug) and the log is capped at 1 MB. */
  const CLIENT_LOG = join(homedir(), ".dsh", "doc-ledger-client.log");
  const CLIENT_LOG_MAX = 1024 * 1024;

  function appendCapped(file, line) {
    try {
      if (existsSync(file) && statSync(file).size > CLIENT_LOG_MAX) {
        try {
          renameSync(file, file + ".1");
        } catch {
          /* rotation is best effort */
        }
      }
      appendFileSync(file, line, "utf8");
    } catch {
      /* logging must never break a request */
    }
  }

  /** Client-side diagnostics sink: the browser half posts its boot trace here. */
  function handleClientReport(res, url, body) {
    if (config.debug === true) {
      appendCapped(CLIENT_LOG, JSON.stringify({ at: Date.now(), url: url.search ?? "", body: String(body).slice(0, 4000) }) + "\n");
    }
    sendJson(res, 200, { ok: true });
  }

  function sendJson(res, status, payload, extra) {
    const json = Buffer.from(JSON.stringify(payload), "utf8");
    const headers = Object.assign(
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "accept-encoding" },
      extra ?? {}
    );
    const accept = String(res.req?.headers?.["accept-encoding"] ?? "");
    if (json.length > 1024 && accept.includes("gzip")) {
      res.writeHead(status, Object.assign({}, headers, { "content-encoding": "gzip" }));
      res.end(gzipSync(json));
      return;
    }
    res.writeHead(status, Object.assign({}, headers, { "content-length": String(json.length) }));
    res.end(json);
  }

  /** Snapshot cache: the panel polls, so identical requests within the TTL must be free. */
  const snapshotCache = new Map();



  async function handleAll(res, url) {
    const session = url.searchParams.get("session");
    const scope = url.searchParams.get("scope") === "current" ? "current" : "all";
    const force = url.searchParams.get("force") === "1";
    const timing = url.searchParams.get("timing") === "1";
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = limitParam > 0 ? Math.min(300, Math.max(1, Math.floor(limitParam))) : maxSessions;
    const key = scope + "|" + (session ?? "") + "|" + limit;
    try {
      let data = null;
      if (!force && !timing) {
        const hit = snapshotCache.get(key);
        if (hit !== undefined && Date.now() - hit.at < SNAPSHOT_TTL_MS) data = hit.payload;
      }
      if (data === null) {
        // Only a silent poll gets the floor; 刷新 (force=1) and diagnostics (timing=1) replay.
        const floor = force || timing ? 0 : LIVE_REPLAY_FLOOR_MS;
        data = await snapshot(session, { scope, timing, limit, floor });
        if (!timing) snapshotCache.set(key, { at: Date.now(), payload: data });
      }
      sendJson(res, 200, { ok: true, data });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function handleFile(res, url) {
    const path = url.searchParams.get("path");
    if (path === null || path === "") {
      sendJson(res, 400, { ok: false, error: "缺少 path 参数" });
      return;
    }
    let stat;
    try {
      stat = statSync(path);
    } catch {
      sendJson(res, 404, { ok: false, error: "文件已不存在：" + path });
      return;
    }
    if (!stat.isFile()) {
      sendJson(res, 400, { ok: false, error: "不是文件：" + path });
      return;
    }
    if (!isKnownPath(path)) {
      sendJson(res, 403, { ok: false, error: "只能预览台账里出现过的文件" });
      return;
    }
    // The preview is read-only and keyed by size+mtime, so a repeat open can be a 304.
    const etag = '"' + stat.size + "-" + Math.round(stat.mtimeMs) + '"';
    if (String(res.req?.headers?.["if-none-match"] ?? "") === etag) {
      res.writeHead(304, { etag, "cache-control": "no-cache" });
      res.end();
      return;
    }
    try {
      const cap = Math.min(stat.size, MAX_PREVIEW_BYTES);
      const buffer = Buffer.alloc(cap);
      let read = 0;
      const fd = openSync(path, "r");
      try {
        // readSync may return fewer bytes than asked (network drives, files being
        // rewritten); decoding the whole zero-filled buffer would append NULs.
        read = readSync(fd, buffer, 0, cap, 0);
      } finally {
        closeSync(fd);
      }
      const bytes = buffer.subarray(0, read < 0 ? 0 : read);
      const truncated = stat.size > bytes.length;
      const decoded = decodePreview(bytes, { truncated });
      const headers = { etag, "cache-control": "no-cache" };
      if (BINARY_SNIFF.test(decoded.text.slice(0, 2048))) {
        sendJson(res, 200, {
          ok: true,
          data: { text: "(二进制文件，未预览)", bytes: stat.size, truncated, binary: true, lines: 0, encoding: null, replacements: 0, mtime: stat.mtimeMs }
        }, headers);
        return;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          text: decoded.text,
          bytes: stat.size,
          shown: bytes.length,
          truncated,
          lines: countLines(decoded.text),
          encoding: decoded.encoding,
          replacements: decoded.replacements,
          mtime: stat.mtimeMs
        }
      }, headers);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: "读取失败：" + (error instanceof Error ? error.message : String(error)) });
    }
  }

  // Clear leftovers from earlier versions once, off the startup path.
  ctx.effect(() => {
    const timer = setTimeout(cleanObsoleteFiles, 0);
    if (typeof timer.unref === "function") timer.unref();
    return () => clearTimeout(timer);
  });

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: base,
    handler: (req, res) => {
      const url = new URL(req.url ?? base, "http://127.0.0.1");
      const blocked = originProblem(req);
      if (blocked !== "") {
        sendJson(res, 403, { ok: false, error: "跨站请求被拒绝（" + blocked + "）" });
        return undefined;
      }
      if (url.pathname === base + "/api/all") return handleAll(res, url);
      if (url.pathname === base + "/api/open") return handleOpen(req, res, url);
      if (url.pathname === base + "/api/openwith") return handleOpenWith(res, url);
      if (url.pathname === base + "/api/_clienterror") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => handleClientReport(res, url, body));
        return undefined;
      }
      if (url.pathname === base + "/api/file") return handleFile(res, url);
      if (url.pathname === base + "/icon") return handleIcon(res, url);
      if (url.pathname === base + "/fileicon") return handleFileIcon(res, url);
      // The client has no other way to learn the plugin config: it is evaluated in the browser
      // against a bundle that cannot see the host's Loader entry. Without this the client's
      // whole diagnostics channel is dead, because report() gates on a flag nobody set.
      if (url.pathname === base + "/api/config") {
        sendJson(res, 200, { ok: true, data: { debug: config.debug === true, maxSessions: maxSessions } });
        return;
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("doc-ledger: not found");
    },
  }), "doc-ledger: routes");
}
