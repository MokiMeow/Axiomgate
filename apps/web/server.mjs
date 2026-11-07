// AxiomGate local dashboard - self-contained Node HTTP server (no runtime deps).
// Reads real mission state from a governed workspace's `.axiomgate/` directory
// and serves it to the single-page dashboard. The bundled sample is used only
// when AXIOMGATE_DEMO=true; a clean clone otherwise has an honest empty state.
//
// Usage:
//   node apps/web/server.mjs [--workspace <path>] [--port 4319]
//   AXIOMGATE_WORKSPACE=<path> node apps/web/server.mjs
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { approve, deny, readCodexRateLimits } from "@axiomgate/core";
import {
  applyDashboardApproval,
  isAllowedDashboardHost,
  isAllowedDashboardOrigin,
  isPendingApproval,
  resolveMissionDirectory,
  resolveStaticPath,
  validateApprovalIntent,
} from "./security.mjs";
import {
  demoModeEnabled,
  resolveDashboardMissions,
} from "./dashboard-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const SAMPLE_DIR = join(__dirname, "sample");

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const PORT = Number(argValue("--port") || process.env.AXIOMGATE_PORT || 4319);
const WORKSPACE = resolve(
  argValue("--workspace") || process.env.AXIOMGATE_WORKSPACE || process.cwd()
);
const MISSIONS_DIR = join(WORKSPACE, ".axiomgate", "missions");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

// ---------- data layer (tolerant readers) ----------
async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}
async function readJsonl(path) {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function listMissionIds() {
  try {
    const entries = await readdir(MISSIONS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Build a normalized view model for one mission directory.
async function loadMission(dir, id) {
  const base = join(dir, id);
  const contract = await readJson(join(base, "contract.json"));
  if (!contract) return null;
  const snapshot = await readJson(join(base, "mission-snapshot.json"), {});
  const events = await readJsonl(join(base, "events.jsonl"));
  const ledger = await readJsonl(join(base, "ledger.jsonl"));
  const sessions = (await readJson(join(base, "sessions.json"), [])) || [];
  const findings = (await readJson(join(base, "findings.json"), [])) || [];

  // runs
  let runs = [];
  try {
    const runFiles = (await readdir(join(base, "runs"))).filter((f) =>
      f.endsWith(".json")
    );
    runs = (
      await Promise.all(runFiles.map((f) => readJson(join(base, "runs", f))))
    ).filter(Boolean);
  } catch {}

  // verification runs
  let verifications = [];
  try {
    const vFiles = (await readdir(join(base, "verification"))).filter((f) =>
      f.endsWith(".json")
    );
    verifications = (
      await Promise.all(vFiles.map((f) => readJson(join(base, "verification", f))))
    ).filter(Boolean);
  } catch {}

  // approvals (pending)
  let approvals = [];
  try {
    const aFiles = (await readdir(join(base, "approvals"))).filter((f) =>
      f.endsWith(".json")
    );
    approvals = (
      await Promise.all(aFiles.map((f) => readJson(join(base, "approvals", f))))
    ).filter(Boolean);
  } catch {}

  const identity =
    snapshot.identity || snapshot.identityReport || contract.identity || null;
  const evidence = events.filter((e) => e.source && e.id);
  const denials = events.filter(
    (e) => e.decision === "DENY" || e.hookEvent === "PreToolUse" && e.decision === "DENY"
  );

  // The authoritative completion projection is the CLI-generated receipt.
  // The governed workspace sits one level above the missions dir:
  // <workspace>/.axiomgate/missions/<id>  →  <workspace>/evidence/<id>-receipt.json
  let receipt = contract.__receipt || null;
  if (!receipt) {
    const workspaceRoot = resolve(dir, "..", "..");
    for (const cand of [
      join(workspaceRoot, "evidence", `${id}-receipt.json`),
      join(base, "receipt.json"),
    ]) {
      const parsed = await readJson(cand);
      if (parsed && (parsed.criteria || parsed.outcome)) {
        receipt = parsed;
        break;
      }
    }
  }

  return {
    id,
    contract,
    identity,
    events,
    evidence,
    denials,
    ledger,
    sessions,
    findings,
    runs: runs.sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || "")),
    verifications: verifications.sort((a, b) =>
      (a.startedAt || "").localeCompare(b.startedAt || "")
    ),
    approvals: approvals.filter((a) => isPendingApproval(a)),
    receipt,
    label: events.length || runs.length ? "LIVE" : "REPLAY",
  };
}

async function loadDashboardData() {
  const ids = await listMissionIds();
  return resolveDashboardMissions({
    liveMissionIds: ids,
    loadLiveMission: (id) => loadMission(MISSIONS_DIR, id),
    loadSampleMissions: () => readJson(join(SAMPLE_DIR, "missions.json"), []),
    demoMode: demoModeEnabled(),
  });
}

// Live Codex account capacity via the shared, timeout-bounded app-server probe.
// The core probe completes as soon as the JSON-RPC response arrives and caches
// it for 60 seconds, so opening Runway never pays an artificial fixed delay.
async function readCapacity() {
  const result = await readCodexRateLimits({ timeoutMs: 5_000 });
  if (result.status !== "AVAILABLE") return null;
  const primary =
    result.sources.find((source) => source.windowLabel === "weekly") ||
    result.sources[0];
  if (!primary) return null;
  return {
    rateLimits: {
      planType: primary.planType,
      primary: {
        usedPercent: primary.usedPercent,
        resetsAt: Math.floor(new Date(primary.resetsAt).getTime() / 1_000),
      },
    },
  };
}

// ---------- http ----------
function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(data);
}

// Clean routes via directory indexes: "/" → index.html (landing),
// "/dashboard" → dashboard/index.html. Works on any static host too.
async function serveStatic(res, urlPath) {
  // tolerate trailing slashes ("/dashboard/" → "/dashboard")
  const key = urlPath.length > 1 ? urlPath.replace(/\/+$/, "") : urlPath;
  let file = resolveStaticPath(PUBLIC_DIR, key);
  if (file === null) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {}
  if (!existsSync(file)) {
    // Unknown page paths bounce to the landing instead of a dead "Not found".
    if (!extname(file)) {
      res.writeHead(302, { location: "/" });
      res.end();
      return;
    }
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(500).end("Read error");
  }
}

class RequestBodyError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function readBody(req, limitBytes = 64 * 1024) {
  const chunks = [];
  let length = 0;
  // Keep the socket alive long enough to return a bounded, explicit rejection.
  for await (const c of req.iterator({ destroyOnReturn: false })) {
    length += c.length;
    if (length > limitBytes) {
      req.resume();
      throw new RequestBodyError("request body exceeds 64 KiB", 413);
    }
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    throw new RequestBodyError("request body is not valid JSON");
  }
}

async function handleRequest(req, res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("content-security-policy", "frame-ancestors 'none'");
  res.setHeader("referrer-policy", "no-referrer");

  // Loopback binding does not stop DNS rebinding. Check the authority before
  // reading mission data, probing Codex, serving assets, or mutating approvals.
  const port = req.socket.localPort;
  if (!isAllowedDashboardHost(req.headers.host, port)) {
    return json(res, 403, { ok: false, error: "untrusted dashboard host" });
  }
  if (!isAllowedDashboardOrigin(req.headers.origin, port)) {
    return json(res, 403, { ok: false, error: "cross-origin request refused" });
  }

  let path;
  try {
    // This is an origin server, not a proxy. Reject ambiguous absolute/network
    // targets and malformed encodings instead of letting URL parsing kill it.
    if (!req.url?.startsWith("/") || req.url.startsWith("//") || /[\\#]/u.test(req.url)) {
      throw new Error("invalid request target");
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    path = decodeURIComponent(url.pathname);
    if (path.includes("\0")) throw new Error("invalid request target");
  } catch {
    return json(res, 400, { ok: false, error: "invalid request target" });
  }

  const allowedMethods = path === "/api/approve" ? ["POST"] : ["GET", "HEAD"];
  if (!allowedMethods.includes(req.method)) {
    res.setHeader("allow", allowedMethods.join(", "));
    return json(res, 405, { ok: false, error: "method not allowed" });
  }

  if (path === "/api/missions") {
    const { demo, missions } = await loadDashboardData();
    return json(res, 200, {
      workspace: demo ? "hosted-demo · SAMPLE" : WORKSPACE,
      demo,
      count: missions.length,
      missions: missions.map((m) => ({
        id: m.id,
        objective: m.contract?.objective,
        intentBoundary: m.contract?.intentBoundary,
        status: m.contract?.status,
        label: m.label,
        criteria: (m.contract?.acceptanceCriteria || []).length,
        denials: (m.denials || []).length,
        pendingApprovals: (m.approvals || []).length,
      })),
    });
  }

  if (path.startsWith("/api/mission/")) {
    const id = path.slice("/api/mission/".length);
    const { missions: all } = await loadDashboardData();
    const m = all.find((x) => x.id === id);
    if (!m) return json(res, 404, { error: "mission not found" });
    return json(res, 200, m);
  }

  if (path === "/api/capacity") {
    const { demo, missions } = await loadDashboardData();
    if (demo && missions.length > 0) {
      const capacity = await readJson(join(SAMPLE_DIR, "capacity.json"));
      return json(res, 200, { capacity, source: "sample", demo: true });
    }
    const cap = await readCapacity();
    return json(res, 200, { capacity: cap, source: cap ? "codex-app-server" : "unavailable" });
  }

  // Browser approval channel: only the same local origin may mutate state.
  if (path === "/api/approve") {
    try {
      const expectedOrigin = new URL(`http://${req.headers.host}`).origin;
      if (req.headers.origin !== expectedOrigin) {
        return json(res, 403, { ok: false, error: "cross-origin request refused" });
      }
      const contentType = req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        return json(res, 415, { ok: false, error: "application/json content type required" });
      }
      const parsed = validateApprovalIntent(await readBody(req));
      if (!parsed.ok) return json(res, 400, { ok: false, error: parsed.reason });
      const missionDir = resolveMissionDirectory(
        MISSIONS_DIR,
        parsed.value.missionId,
      );
      if (missionDir === null || !existsSync(missionDir)) {
        return json(res, 404, { ok: false, error: "mission not found" });
      }
      const mutation = applyDashboardApproval(missionDir, parsed.value, {
        approve,
        deny,
      });
      if (!mutation.ok) {
        const knownRejection = [
          "request is approved", "request is denied", "approval request expired",
        ].includes(mutation.reason);
        return json(res, knownRejection ? 409 : 500, {
          ok: false,
          error: knownRejection ? mutation.reason : "approval record unavailable",
        });
      }
      return json(res, 200, mutation);
    } catch (e) {
      return json(res, e instanceof RequestBodyError ? e.statusCode : 500, {
        ok: false,
        error: e instanceof RequestBodyError ? e.message : "approval request failed",
      });
    }
  }

  return serveStatic(res, path);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    // Do not expose filesystem paths or raw exceptions to HTTP clients.
    if (res.headersSent) res.destroy();
    else json(res, 500, { ok: false, error: "dashboard request failed" });
  });
});

server.listen(PORT, "127.0.0.1", async () => {
  const live = (await listMissionIds()).length > 0;
  const demo = demoModeEnabled();
  console.log(`AxiomGate dashboard → http://localhost:${server.address().port}`);
  console.log(`workspace: ${WORKSPACE}`);
  console.log(
    live
      ? "reading live .axiomgate mission data"
      : demo
        ? "demo mode - showing bundled SAMPLE mission"
        : "no governed missions yet - showing empty state",
  );
});
