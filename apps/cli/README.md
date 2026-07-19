# AxiomGate

AxiomGate turns Codex work into proof-carrying missions. It bounds agent authority, verifies outcomes with machine evidence, and emits receipts that anyone can check offline.

## Quickstart

```sh
npx axiomgate doctor
npx axiomgate replay all
npx axiomgate mission create --objective "Add a tested security fix" --project .
npx axiomgate mission run <mission-id> --project .
npx axiomgate mission verify <mission-id> --project .
npx axiomgate mission receipt <mission-id> --format json --project .
npx axiomgate receipt verify ./evidence/<mission-id>-receipt.json
```

The completion gate accepts fresh command, API, or hook evidence—never model prose. Consequential actions remain bound to the mission policy, identity, target, and exact approved command.

Repository and full documentation: [github.com/mokimeow/axiomgate](https://github.com/mokimeow/axiomgate)
