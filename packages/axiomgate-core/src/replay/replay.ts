import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ActionRequestSchema,
  approve,
  consumeApproval,
  createApprovalRequest,
  verifyDeployTarget,
  type CommandRunner,
} from "../guard/index.js";
import { completionGate } from "../evidence/index.js";
import { compileMission } from "../mission/index.js";

export interface ReplayResult {
  readonly id: string;
  readonly title: string;
  readonly status: "PASS" | "FAIL";
  readonly expected: string;
  readonly observed: string;
}

function commandHash(command: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(command, "utf8").digest("hex")}`;
}

function wrongTargetReplay(): ReplayResult {
  const runner: CommandRunner = (command, args) => ({
    command,
    args,
    status: "SUCCESS",
    exitCode: 0,
    stdout: JSON.stringify({ owner: { login: "fixture-other-owner" } }),
    stderr: "",
    durationMs: 1,
  });
  const result = verifyDeployTarget(
    {
      type: "github_repo",
      owner: "fixture-other-owner",
      repo: "target-app",
      expectedOwner: "fixture-expected-owner",
    },
    {
      missionId: "msn_replay_wrong_target",
      criterionId: "criterion_target",
      freshForCommit: "REPLAY",
      label: "REPLAY",
    },
    {
      runner,
      createEvidenceId: () => "ev_replay_wrong_target",
      writeEvidence: () => undefined,
      now: () => new Date("2026-07-19T00:00:00.000Z"),
    },
  );
  return {
    id: "wrong-target",
    title: "Wrong deploy target is blocked",
    status: result.verdict === "EXISTS_NOT_OWNED" ? "PASS" : "FAIL",
    expected: "EXISTS_NOT_OWNED",
    observed: result.verdict,
  };
}

function approvalMutationReplay(): ReplayResult {
  const missionDir = mkdtempSync(join(tmpdir(), "axiomgate-replay-approval-"));
  try {
    const requestedAt = new Date("2026-07-19T00:00:00.000Z");
    const command = "git push origin agent/replay";
    const request = ActionRequestSchema.parse({
      id: "act_replay_mutation",
      missionId: "msn_replay_approval",
      semanticAction: "pull_request.create",
      mechanism: "command",
      target: {
        type: "github_repo",
        owner: "fixture-owner",
        repo: "target-app",
        verifiedOwnership: true,
        branch: "agent/replay",
      },
      identity: {
        githubLogin: "fixture-owner",
        source: "replay fixture",
      },
      rawCommandHash: commandHash(command),
      intentBoundaryRequired: "PUBLISH",
      risk: "high",
      rollback: "close the pull request",
      decision: "AWAITING_APPROVAL",
      requestedAt: requestedAt.toISOString(),
      expiresAt: new Date(requestedAt.getTime() + 15 * 60_000).toISOString(),
    });
    createApprovalRequest(missionDir, request, ["publish requires approval"], {
      now: () => requestedAt,
    });
    const approved = approve(missionDir, request.id, {
      approver: "replay-operator",
      now: () => new Date("2026-07-19T00:01:00.000Z"),
    });
    const consumed = consumeApproval(
      missionDir,
      request.id,
      commandHash(`${command} --force`),
      { now: () => new Date("2026-07-19T00:02:00.000Z") },
    );
    const observed =
      approved.status === "APPROVED" && consumed.status === "NOT_AUTHORIZED"
        ? consumed.reason
        : `${approved.status}/${consumed.status}`;
    return {
      id: "approval-binding",
      title: "Mutated command cannot reuse approval",
      status:
        approved.status === "APPROVED" &&
        consumed.status === "NOT_AUTHORIZED" &&
        consumed.reason === "approval command hash does not match"
          ? "PASS"
          : "FAIL",
      expected: "approval command hash does not match",
      observed,
    };
  } finally {
    rmSync(missionDir, { recursive: true, force: true });
  }
}

function missingEvidenceReplay(): ReplayResult {
  const mission = compileMission(
    {
      objective: "Add a safe login lockout",
      criteria: [
        {
          id: "criterion_lockout",
          statement: "Lockout behavior is verified",
          risk: "high",
          evidenceTypes: ["test"],
        },
        {
          id: "criterion_regression",
          statement: "Existing behavior remains regression-safe",
          risk: "medium",
          evidenceTypes: ["regression_test"],
        },
        {
          id: "criterion_secrets",
          statement: "The change exposes no credentials",
          risk: "high",
          evidenceTypes: ["secret_scan"],
        },
      ],
    },
    { id: "msn_replay_evidence" },
  ).contract;
  const gate = completionGate(mission, [], "REPLAY");
  const verdict = gate.criteria[0]?.verdict ?? "UNKNOWN";
  return {
    id: "evidence-gate",
    title: "Missing evidence prevents false completion",
    status:
      gate.outcome === "INCOMPLETE" && verdict === "UNVERIFIED"
        ? "PASS"
        : "FAIL",
    expected: "INCOMPLETE / UNVERIFIED",
    observed: `${gate.outcome} / ${verdict}`,
  };
}

export function runSubmissionReplay(): readonly ReplayResult[] {
  return [wrongTargetReplay(), approvalMutationReplay(), missingEvidenceReplay()];
}

export function selectSubmissionReplay(
  scenario: string,
): readonly ReplayResult[] {
  const results = runSubmissionReplay();
  if (scenario === "all") return results;
  const selected = results.filter((result) => result.id === scenario);
  if (selected.length === 0) {
    throw new Error(
      "replay scenario must be all, wrong-target, approval-binding, or evidence-gate",
    );
  }
  return selected;
}
