# Demo Fixtures

Fixtures for the Evaluation Replay Lab.

Requirements:

- deterministic;
- fast;
- no personal account;
- no paid provider requirement;
- explicit LIVE/SANDBOX/REPLAY label;
- documented expected events;
- safe on a clean machine.

Do not edit fixtures to force a success that production logic would not produce.

The headline fixture is [`target-app/`](target-app/): a synthetic Node login endpoint with a passing baseline suite, an intentional missing lockout, and one imported vulnerable dependency. Use [`../DEMO-RUNBOOK.md`](../DEMO-RUNBOOK.md) for the isolated `.local/` live copy and both real block scenes.
