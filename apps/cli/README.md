# AxiomGate

AxiomGate turns Codex work into proof-carrying missions. It bounds agent authority, verifies outcomes with machine evidence, and emits receipts that anyone can check offline.

## Quickstart

```sh
npx -y axiomgate@0.1.3 doctor
npx -y axiomgate@0.1.3 replay all
npx -y axiomgate@0.1.3 mission create --objective "Add a tested security fix" --project .
npx -y axiomgate@0.1.3 mission run <mission-id> --project .
npx -y axiomgate@0.1.3 mission verify <mission-id> --project .
npx -y axiomgate@0.1.3 mission receipt <mission-id> --format json --project .
npx -y axiomgate@0.1.3 receipt verify ./evidence/<mission-id>-receipt.json
```

The completion gate accepts fresh command, API, or hook evidence - never model prose. Consequential actions remain bound to the mission policy, identity, target, and exact approved command.

Telegram approval callbacks default to allowlisted private chats. Group use requires both an allowlisted chat and an explicit `TELEGRAM_USER_ID` actor allowlist.

Repository and full documentation: [github.com/mokimeow/axiomgate](https://github.com/mokimeow/axiomgate)
