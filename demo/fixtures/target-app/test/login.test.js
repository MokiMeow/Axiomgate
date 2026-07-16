import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  createLoginServer,
  SYNTHETIC_DEMO_ACCOUNT,
} from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  server = createLoginServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

async function login(username, password) {
  return fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

test("accepts the synthetic demo user", async () => {
  const response = await login(
    SYNTHETIC_DEMO_ACCOUNT.username,
    SYNTHETIC_DEMO_ACCOUNT.credential,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    user: { username: SYNTHETIC_DEMO_ACCOUNT.username },
    sessionId: "synthetic-session",
  });
});

test("rejects an invalid credential without revealing account existence", async () => {
  const known = await login(SYNTHETIC_DEMO_ACCOUNT.username, "wrong-demo-value");
  const unknown = await login("nobody@example.test", "wrong-demo-value");
  assert.equal(known.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await known.json(), { error: "invalid_credentials" });
  assert.deepEqual(await unknown.json(), { error: "invalid_credentials" });
});

test("documents the security gap: repeated failures do not lock the account", async () => {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await login(
      SYNTHETIC_DEMO_ACCOUNT.username,
      `wrong-demo-value-${attempt}`,
    );
    assert.equal(response.status, 401);
  }

  const valid = await login(
    SYNTHETIC_DEMO_ACCOUNT.username,
    SYNTHETIC_DEMO_ACCOUNT.credential,
  );
  assert.equal(valid.status, 200);
});

test("rejects malformed JSON and unknown routes", async () => {
  const malformed = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  const missing = await fetch(`${baseUrl}/missing`);
  assert.equal(malformed.status, 400);
  assert.equal(missing.status, 404);
});
