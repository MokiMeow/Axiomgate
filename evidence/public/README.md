# Public Evidence

This directory contains reviewed evidence suitable for judges and the public repository.

Every artifact must:

- support a specific claim;
- be reproducible or explain why not;
- identify LIVE/SANDBOX/REPLAY;
- contain no secret or private data;
- include capture command/API and timestamp;
- include a hash where practical;
- remain fresh for the referenced commit.

Raw evidence begins under `.local/` and is promoted only after review.

## Current-state entry points

- [`authority-hardening-verification.md`](authority-hardening-verification.md): latest guard mitigation, exploit regression, live Codex denial, and full test count.
- [`repo-curation-verification.md`](repo-curation-verification.md): public GitHub and npm 0.1.1 synchronization proof.
- [`headline-run-verification.md`](headline-run-verification.md): actual live mission, with wrong-target Vercel work explicitly PENDING.
- [`telegram-verification.md`](telegram-verification.md): shipped Telegram card and notification behavior; use the private one-to-one safety limitation in current README/docs.
- [`full-matrix-verification.md`](full-matrix-verification.md): historical `bc012e8` / npm 0.1.0 matrix, retained for chronology rather than current release status.
