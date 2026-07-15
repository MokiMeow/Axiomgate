import type { IntentBoundary } from "./intent-boundary.js";

export type SandboxMapping =
  | {
      readonly status: "READY";
      readonly sandbox: "read-only" | "workspace-write";
      readonly networkAccess: boolean;
      readonly codexArgs: readonly string[];
    }
  | { readonly status: "REFUSED"; readonly reason: string };

export function mapBoundaryToSandbox(
  boundary: IntentBoundary,
): SandboxMapping {
  if (boundary === "DEPLOY_PRODUCTION") {
    return {
      status: "REFUSED",
      reason: "DEPLOY_PRODUCTION is prohibited during Build Week",
    };
  }

  if (boundary === "OBSERVE" || boundary === "PLAN") {
    return {
      status: "READY",
      sandbox: "read-only",
      networkAccess: false,
      codexArgs: ["--sandbox", "read-only"],
    };
  }

  const networkAccess =
    boundary === "PUBLISH" || boundary === "DEPLOY_PREVIEW";
  return {
    status: "READY",
    sandbox: "workspace-write",
    networkAccess,
    codexArgs: [
      "--sandbox",
      "workspace-write",
      "-c",
      `sandbox_workspace_write.network_access=${String(networkAccess)}`,
    ],
  };
}
