# `.local/` - Private Local Workspace

Everything in this directory except this README and `.gitkeep` is ignored by Git.

Use it for:

- raw test output;
- browser traces and videos;
- private screenshots;
- local databases;
- provider usage snapshots;
- browser profiles;
- temporary credentials;
- downloaded repositories;
- experimental patches;
- generated reports before sanitization;
- test accounts and private fixture data;
- benchmark raw data;
- agent transcripts and local session exports.

## Public evidence promotion

Before copying anything to `evidence/public/`:

1. remove secrets and account identifiers;
2. remove private source or user data;
3. confirm the artifact is necessary;
4. make it deterministic or explain variability;
5. record its generating command;
6. include a hash;
7. review it manually.

Never use `.local/` data as hidden proof for a public claim. Publish a sanitized derivative or state that the evidence is private and unavailable.
