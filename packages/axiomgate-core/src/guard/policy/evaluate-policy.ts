import type { ActionRequest } from "../action-request.js";
import type { IdentityReport } from "../identity/index.js";
import {
  compareIntentBoundaries,
  type IntentBoundary,
  type MissionContract,
} from "../../mission/index.js";

export type PolicyDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export const DEMO_SEMANTIC_ACTIONS = [
  "repository.read",
  "file.modify",
  "branch.create",
  "pull_request.create",
  "preview.deploy",
  "production.deploy",
  "verification.run",
] as const;

const demoSemanticActions = new Set<string>(DEMO_SEMANTIC_ACTIONS);

export interface PolicyEvaluationInput {
  readonly policy: MissionContract["actionPolicy"];
  readonly missionBoundary: IntentBoundary;
  readonly request: ActionRequest;
  readonly identity: IdentityReport;
}

export interface PolicyEvaluation {
  readonly decision: PolicyDecision;
  readonly reasons: readonly string[];
}

type RestrictionKey =
  | "branchPrefix"
  | "githubRepo"
  | "vercelProject"
  | "githubLogin"
  | "vercelUser";

const restrictionKeys = new Set<RestrictionKey>([
  "branchPrefix",
  "githubRepo",
  "vercelProject",
  "githubLogin",
  "vercelUser",
]);

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function restrictionFailures(
  restrictions: Readonly<Record<string, unknown>>,
  request: ActionRequest,
  identity: IdentityReport,
): string[] {
  const failures: string[] = [];
  const unknownKeys = Object.keys(restrictions)
    .filter((key) => !restrictionKeys.has(key as RestrictionKey))
    .sort();
  for (const key of unknownKeys) {
    failures.push(`Unsupported policy restriction "${key}" fails closed.`);
  }

  if ("branchPrefix" in restrictions) {
    const prefix = requiredString(restrictions.branchPrefix);
    if (prefix === undefined) {
      failures.push("Restriction branchPrefix must be a non-empty string.");
    } else if (request.target.branch === undefined) {
      failures.push(
        `Action "${request.semanticAction}" did not provide a branch for prefix "${prefix}".`,
      );
    } else if (!request.target.branch.startsWith(prefix)) {
      failures.push(
        `Branch "${request.target.branch}" does not start with required prefix "${prefix}".`,
      );
    }
  }

  if ("githubRepo" in restrictions) {
    const expected = requiredString(restrictions.githubRepo);
    const actual = `${request.target.owner}/${request.target.repo}`;
    if (expected === undefined) {
      failures.push("Restriction githubRepo must be a non-empty string.");
    } else if (actual.toLowerCase() !== expected.toLowerCase()) {
      failures.push(
        `GitHub target "${actual}" does not match required repository "${expected}".`,
      );
    }
  }

  if ("vercelProject" in restrictions) {
    const expected = requiredString(restrictions.vercelProject);
    if (expected === undefined) {
      failures.push("Restriction vercelProject must be a non-empty string.");
    } else if (request.target.project !== expected) {
      failures.push(
        `Vercel target "${request.target.project ?? "unavailable"}" does not match required project "${expected}".`,
      );
    }
  }

  if ("githubLogin" in restrictions) {
    const expected = requiredString(restrictions.githubLogin);
    if (expected === undefined) {
      failures.push("Restriction githubLogin must be a non-empty string.");
    } else if (identity.githubLogin.status !== "RESOLVED") {
      failures.push(
        `GitHub identity is unavailable; required login is "${expected}".`,
      );
    } else if (
      identity.githubLogin.value.toLowerCase() !== expected.toLowerCase() ||
      request.identity.githubLogin.toLowerCase() !== expected.toLowerCase()
    ) {
      failures.push(
        `GitHub identity does not match required login "${expected}".`,
      );
    }
  }

  if ("vercelUser" in restrictions) {
    const expected = requiredString(restrictions.vercelUser);
    if (expected === undefined) {
      failures.push("Restriction vercelUser must be a non-empty string.");
    } else if (identity.vercelUser.status !== "RESOLVED") {
      failures.push(
        `Vercel identity is unavailable; required user is "${expected}".`,
      );
    } else if (
      identity.vercelUser.value.toLowerCase() !== expected.toLowerCase() ||
      request.identity.vercelUser?.toLowerCase() !== expected.toLowerCase()
    ) {
      failures.push(
        `Vercel identity does not match required user "${expected}".`,
      );
    }
  }

  return failures;
}

export function evaluatePolicy(
  input: PolicyEvaluationInput,
): PolicyEvaluation {
  if (!demoSemanticActions.has(input.request.semanticAction)) {
    return {
      decision: "DENY",
      reasons: [
        `Semantic action "${input.request.semanticAction}" is outside the supported demo action set; deny-by-default applies.`,
      ],
    };
  }

  const matching = input.policy.filter(
    (entry) => entry.action === input.request.semanticAction,
  );

  if (matching.length === 0) {
    return {
      decision: "DENY",
      reasons: [
        `No policy entry lists semantic action "${input.request.semanticAction}"; deny-by-default applies.`,
      ],
    };
  }

  if (
    compareIntentBoundaries(
      input.request.intentBoundaryRequired,
      input.missionBoundary,
    ) > 0
  ) {
    return {
      decision: "DENY",
      reasons: [
        `Action "${input.request.semanticAction}" requires ${input.request.intentBoundaryRequired}, above mission boundary ${input.missionBoundary}.`,
      ],
    };
  }

  if (matching.some((entry) => entry.decision === "DENY")) {
    return {
      decision: "DENY",
      reasons: [
        `Policy explicitly denies semantic action "${input.request.semanticAction}".`,
      ],
    };
  }

  const failures = matching.flatMap((entry) =>
    entry.restrict === undefined
      ? []
      : restrictionFailures(entry.restrict, input.request, input.identity),
  );
  if (failures.length > 0) {
    return { decision: "DENY", reasons: failures };
  }

  if (matching.some((entry) => entry.decision === "REQUIRE_APPROVAL")) {
    return {
      decision: "REQUIRE_APPROVAL",
      reasons: [
        `Policy requires approval for semantic action "${input.request.semanticAction}" after all restrictions passed.`,
      ],
    };
  }

  if (matching.every((entry) => entry.decision === "ALLOW")) {
    return {
      decision: "ALLOW",
      reasons: [
        `Policy allows semantic action "${input.request.semanticAction}" and all restrictions passed.`,
      ],
    };
  }

  return {
    decision: "DENY",
    reasons: [
      `Policy for semantic action "${input.request.semanticAction}" is not actionable; deny-by-default applies.`,
    ],
  };
}
