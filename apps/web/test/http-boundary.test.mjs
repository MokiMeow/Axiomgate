import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApprovalRequest, listPending } from "@axiomgate/core";

describe("local dashboard HTTP boundary", () => {
  let workspace;
  let missionDir;
  let child;
  let port;
  let origin;

  function send(path, { method = "GET", headers = {}, body } = {}) {
    return new Promise((resolveResponse, reject) => {
      const req = request({
        host: "127.0.0.1", port, path, method, headers,
        timeout: 5_000,
      }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("error", reject);
        res.on("end", () => resolveResponse({
          status: res.statusCode, headers: res.headers, text,
        }));
      });
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("HTTP test timed out")));
      req.end(body);
    });
  }

  beforeAll(async () => {
    await mkdir(resolve(".local"), { recursive: true });
    workspace = await mkdtemp(resolve(".local/http-boundary-"));
    missionDir = join(workspace, ".axiomgate", "missions", "msn_http_fixture");
    await mkdir(missionDir, { recursive: true });
    await writeFile(join(missionDir, "contract.json"), JSON.stringify({
      id: "msn_http_fixture", objective: "Synthetic HTTP boundary proof",
      status: "DRAFT", acceptanceCriteria: [],
    }));
    for (const id of ["act_http_approve", "act_http_deny"]) {
      createApprovalRequest(missionDir, {
        id, missionId: "msn_http_fixture", semanticAction: "pull_request.create",
        mechanism: "fixture", target: {
          type: "github_repo", owner: "sample-owner", repo: "sample-repo",
          verifiedOwnership: true,
        },
        identity: { githubLogin: "sample-owner", source: "fixture" },
        rawCommandHash: `sha256:${"a".repeat(64)}`,
        intentBoundaryRequired: "PUBLISH", risk: "medium",
        rollback: "Close the synthetic pull request", decision: "AWAITING_APPROVAL",
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }, ["Synthetic request; no external action executes"]);
    }
    child = spawn(process.execPath, [
      "apps/web/server.mjs", "--workspace", workspace, "--port", "0",
    ], { cwd: resolve("."), env: { ...process.env, AXIOMGATE_DEMO: "false" }, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((ready, reject) => {
      const timer = setTimeout(() => reject(new Error("Dashboard startup timed out")), 10_000);
      let output = "";
      const finish = (error) => {
        clearTimeout(timer);
        child.off("exit", exited);
        child.off("error", failed);
        error ? reject(error) : ready();
      };
      const exited = () => finish(new Error("Dashboard exited before listening"));
      const failed = (error) => finish(error);
      child.once("exit", exited);
      child.once("error", failed);
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /http:\/\/localhost:(\d+)/u.exec(output);
        if (match) {
          port = Number(match[1]);
          origin = `http://127.0.0.1:${port}`;
          finish();
        }
      });
    });
  }, 15_000);

  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    if (workspace) await rm(workspace, { recursive: true, force: true });
  });

  it("serves normal loopback reads, aliases, and static pages", async () => {
    const list = await send("/api/missions");
    expect(list.status).toBe(200);
    expect(list.headers["x-content-type-options"]).toBe("nosniff");
    expect(list.headers["x-frame-options"]).toBe("DENY");
    expect(list.headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(JSON.parse(list.text).missions[0].id).toBe("msn_http_fixture");
    expect((await send("/api/missions", { headers: { host: `localhost:${port}` } })).status).toBe(200);
    expect((await send("/dashboard")).status).toBe(200);
  });

  it.each(["/", "/api/missions", "/api/mission/msn_http_fixture", "/api/capacity", "/api/approve"])(
    "rejects hostile Host headers before routing %s", async (path) => {
      const result = await send(path, { headers: { host: `attacker.example:${port}` } });
      expect(result.status).toBe(403);
      expect(result.text).not.toContain(workspace);
    },
  );

  it.each(["https://attacker.example", "null", "http://localhost:1"])(
    "rejects untrusted read Origin %s", async (untrustedOrigin) => {
      expect((await send("/api/missions", { headers: { origin: untrustedOrigin } })).status).toBe(403);
    },
  );

  it.each(["/api/mission/%", "/api/mission/%E0%A4%A", "http://[", "//attacker.example/api/missions"])(
    "rejects malformed request target %s and remains available", async (path) => {
      expect((await send(path)).status).toBe(400);
      expect((await send("/api/missions")).status).toBe(200);
    },
  );

  it("enforces route methods and handles HEAD without a body", async () => {
    const read = await send("/api/missions", { method: "POST" });
    expect(read.status).toBe(405);
    expect(read.headers.allow).toBe("GET, HEAD");
    const approve = await send("/api/approve");
    expect(approve.status).toBe(405);
    expect(approve.headers.allow).toBe("POST");
    const head = await send("/api/missions", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.text).toBe("");
  });

  it("contains unexpected data-layer errors without leaking paths or exiting", async () => {
    const runs = join(missionDir, "runs");
    await mkdir(runs);
    try {
      await writeFile(join(runs, "one.json"), JSON.stringify({ startedAt: 1 }));
      await writeFile(join(runs, "two.json"), JSON.stringify({ startedAt: 2 }));
      const result = await send("/api/missions");
      expect(result.status).toBe(500);
      expect(JSON.parse(result.text)).toEqual({ ok: false, error: "dashboard request failed" });
    } finally {
      await rm(runs, { recursive: true, force: true });
    }
    expect((await send("/api/missions")).status).toBe(200);
  });

  const intent = JSON.stringify({
    missionId: "msn_http_fixture", actionRequestId: "act_http_approve", decision: "approve",
  });

  it("requires an exact browser origin and JSON before approval mutations", async () => {
    for (const headers of [
      { "content-type": "application/json" },
      { origin: "null", "content-type": "application/json" },
      { origin: `http://localhost:${port}`, "content-type": "application/json" },
      { origin, host: `attacker.example:${port}`, "content-type": "application/json" },
    ]) {
      expect((await send("/api/approve", { method: "POST", headers, body: intent })).status).toBe(403);
    }
    for (const type of [undefined, "text/plain", "application/x-www-form-urlencoded"]) {
      const headers = { origin, ...(type ? { "content-type": type } : {}) };
      expect((await send("/api/approve", { method: "POST", headers, body: intent })).status).toBe(415);
    }
    expect(listPending(missionDir)).toHaveLength(2);
  });

  it("rejects malformed and oversized bodies without mutating approvals", async () => {
    const headers = { origin, "content-type": "application/json" };
    expect((await send("/api/approve", { method: "POST", headers, body: "{" })).status).toBe(400);
    expect((await send("/api/approve", { method: "POST", headers, body: "x".repeat(65 * 1024) })).status).toBe(413);
    expect(listPending(missionDir)).toHaveLength(2);
    expect((await send("/api/missions")).status).toBe(200);
  });

  it("does not expose storage paths when an approval record is unavailable", async () => {
    const result = await send("/api/approve", {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        missionId: "msn_http_fixture", actionRequestId: "act_missing", decision: "approve",
      }),
    });
    expect(result.status).toBe(500);
    expect(JSON.parse(result.text)).toEqual({ ok: false, error: "approval record unavailable" });
  });

  it("approves and denies canonical records once from the same origin", async () => {
    const options = { method: "POST", headers: { origin, "content-type": "application/json; charset=utf-8" }, body: intent };
    const approved = await send("/api/approve", options);
    expect(approved.status).toBe(200);
    expect(JSON.parse(approved.text)).toMatchObject({ ok: true, status: "APPROVED" });
    expect((await send("/api/approve", options)).status).toBe(409);
    const denied = await send("/api/approve", { ...options, headers: {
      host: `localhost:${port}`, origin: `http://localhost:${port}`, "content-type": "application/json",
    }, body: JSON.stringify({
      missionId: "msn_http_fixture", actionRequestId: "act_http_deny", decision: "deny",
    }) });
    expect(denied.status).toBe(200);
    expect(JSON.parse(denied.text)).toMatchObject({ ok: true, status: "DENIED" });
    expect(listPending(missionDir)).toHaveLength(0);
  });
});
