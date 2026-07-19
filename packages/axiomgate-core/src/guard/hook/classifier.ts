import type { IntentBoundary } from "../../mission/index.js";
import type { ActionRequest } from "../action-request.js";

export interface HookToolPayload {
  readonly tool_name: string;
  readonly tool_input: Readonly<Record<string, unknown>>;
}

export interface ClassifiedHookAction {
  readonly command: string;
  readonly semanticAction: string;
  readonly mechanism: string;
  readonly intentBoundaryRequired: IntentBoundary;
  readonly risk: ActionRequest["risk"];
  readonly rollback: string;
  readonly stateChanging: boolean;
}

function exactCommand(payload: HookToolPayload): string {
  if (typeof payload.tool_input.command === "string") {
    return payload.tool_input.command;
  }
  if (typeof payload.tool_input.patch === "string") {
    return payload.tool_input.patch;
  }

  return JSON.stringify(payload.tool_input);
}

function classification(
  command: string,
  semanticAction: string,
  mechanism: string,
  intentBoundaryRequired: IntentBoundary,
  risk: ActionRequest["risk"],
  rollback: string,
  stateChanging: boolean,
): ClassifiedHookAction {
  return {
    command,
    semanticAction,
    mechanism,
    intentBoundaryRequired,
    risk,
    rollback,
    stateChanging,
  };
}

/**
 * Ordered, conservative rules for the Build Week demo action set.
 * Publish/deploy patterns are evaluated before local/read patterns so a
 * compound command cannot hide a consequential action behind a safe prefix.
 */
export function classifyHookPayload(
  payload: HookToolPayload,
): ClassifiedHookAction {
  const command = exactCommand(payload);
  const normalized = command.trim().toLowerCase();
  const toolName = payload.tool_name.toLowerCase();

  if (
    toolName === "github_create_pull_request" ||
    toolName === "mcp__github__create_pull_request"
  ) {
    return classification(
      command,
      "pull_request.create",
      `mcp:${payload.tool_name}`,
      "PUBLISH",
      "high",
      "close the pull request or delete the remote branch",
      true,
    );
  }

  if (
    /\bvercel(?:\.cmd|\.exe)?(?:\s+deploy)?\b[^\r\n]*\s--prod(?:uction)?\b/u.test(
      normalized,
    )
  ) {
    return classification(
      command,
      "production.deploy",
      "vercel_cli",
      "DEPLOY_PRODUCTION",
      "critical",
      "restore the prior production deployment",
      true,
    );
  }

  if (/\bvercel(?:\.cmd|\.exe)?(?:\s+deploy)?\b/u.test(normalized)) {
    return classification(
      command,
      "preview.deploy",
      "vercel_cli",
      "DEPLOY_PREVIEW",
      "high",
      "remove the preview deployment",
      true,
    );
  }

  if (
    /\bgh(?:\.exe)?\s+pr\s+create\b/u.test(normalized) ||
    /\bgit(?:\.exe)?\s+push\b/u.test(normalized)
  ) {
    return classification(
      command,
      "pull_request.create",
      normalized.includes("gh ") ? "gh_cli" : "git_cli",
      "PUBLISH",
      "high",
      "close the pull request or delete the remote branch",
      true,
    );
  }

  if (
    toolName === "apply_patch" ||
    typeof payload.tool_input.patch === "string"
  ) {
    return classification(
      command,
      "file.modify",
      "apply_patch",
      "MODIFY_LOCAL",
      "medium",
      "revert the local file change",
      true,
    );
  }

  if (
    /\b(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?test\b/u.test(normalized) ||
    /\b(?:vitest|pytest|go\s+test|cargo\s+test)\b/u.test(normalized)
  ) {
    return classification(
      command,
      "verification.run",
      "shell_cli",
      "MODIFY_LOCAL",
      "low",
      "remove test-generated local output",
      true,
    );
  }

  if (
    /\b(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?(?:build|install|add|remove)\b/u.test(
      normalized,
    ) ||
    /\b(?:mkdir|touch|copy|move|new-item|set-content|add-content)\b/u.test(
      normalized,
    )
  ) {
    return classification(
      command,
      "file.modify",
      "shell_cli",
      "MODIFY_LOCAL",
      "medium",
      "revert generated or modified local files",
      true,
    );
  }

  const unknownStateChanging =
    /(?:^|[;&|]\s*)(?:rm|del|rmdir|remove-item|git\s+(?:commit|reset|rebase|merge|tag)|gh\s+(?:repo|release)|curl\b[^\r\n]*\|\s*(?:sh|bash|pwsh|powershell)|invoke-expression)\b/u.test(
      normalized,
    );
  if (unknownStateChanging) {
    return classification(
      command,
      "UNKNOWN",
      "unclassified",
      "MODIFY_LOCAL",
      "high",
      "no verified rollback available",
      true,
    );
  }

  if (toolName !== "bash" && toolName !== "apply_patch") {
    return classification(
      command,
      "UNKNOWN",
      `mcp:${payload.tool_name}`,
      "MODIFY_LOCAL",
      "high",
      "no verified rollback available",
      true,
    );
  }

  return classification(
    command,
    "repository.read",
    "shell_cli",
    "OBSERVE",
    "low",
    "no state change expected",
    false,
  );
}
