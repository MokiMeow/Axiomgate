export type IdentitySource =
  | "gh api user"
  | "git remote -v"
  | "vercel whoami"
  | ".vercel/project.json";

export type IdentityConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ResolvedIdentityField<T, S extends IdentitySource> {
  readonly status: "RESOLVED";
  readonly value: T;
  readonly source: S;
  readonly confidence: IdentityConfidence;
  readonly capturedAt: string;
}

export interface UnavailableIdentityField<S extends IdentitySource> {
  readonly status: "UNAVAILABLE";
  readonly source: S;
  readonly reason: string;
  readonly capturedAt: string;
}

export type IdentityField<T, S extends IdentitySource> =
  | ResolvedIdentityField<T, S>
  | UnavailableIdentityField<S>;

export interface GitRemote {
  readonly name: string;
  readonly url: string;
  readonly direction: "fetch" | "push";
}

export interface VercelProjectIdentity {
  readonly projectId: string;
  readonly orgId: string;
  readonly projectName?: string;
}

export interface IdentityReport {
  readonly githubLogin: IdentityField<string, "gh api user">;
  readonly gitRemotes: IdentityField<readonly GitRemote[], "git remote -v">;
  readonly vercelUser: IdentityField<string, "vercel whoami">;
  readonly vercelProject: IdentityField<
    VercelProjectIdentity,
    ".vercel/project.json"
  >;
}
