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

async function login(password) {
  return fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: SYNTHETIC_DEMO_ACCOUNT.username,
      password,
    }),
  });
}

test("locks the synthetic account after 5 failures for 15 minutes", async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await login(`wrong-demo-value-${attempt}`);
    assert.equal(response.status, 401);
  }

  const locked = await login(SYNTHETIC_DEMO_ACCOUNT.credential);
  assert.equal(locked.status, 429);
  const body = await locked.json();
  assert.equal(body.error, "account_locked");
  assert.equal(typeof body.retryAfterSeconds, "number");
  assert.ok(body.retryAfterSeconds > 0 && body.retryAfterSeconds <= 15 * 60);
});
