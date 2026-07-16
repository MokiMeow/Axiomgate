import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import lodash from "lodash";

const DEMO_CREDENTIAL = "demo-pass";
const MAX_BODY_BYTES = 16 * 1024;

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

const SYNTHETIC_USERS = Object.freeze({
  "demo.user@example.test": Object.freeze({
    username: "demo.user@example.test",
    credentialDigest: digest(DEMO_CREDENTIAL),
  }),
});

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      const error = new Error("request body is too large");
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function credentialMatches(user, suppliedCredential) {
  if (typeof suppliedCredential !== "string") return false;
  const suppliedDigest = digest(suppliedCredential);
  return timingSafeEqual(user.credentialDigest, suppliedDigest);
}

export function createLoginHandler() {
  return async function loginHandler(request, response) {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "POST" || url.pathname !== "/login") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      sendJson(response, error.statusCode ?? 400, { error: error.message });
      return;
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { error: "request body must be a JSON object" });
      return;
    }

    const user = lodash.get(SYNTHETIC_USERS, [body.username]);
    if (user === undefined || !credentialMatches(user, body.password)) {
      sendJson(response, 401, { error: "invalid_credentials" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      user: { username: user.username },
      sessionId: "synthetic-session",
    });
  };
}

export function createLoginServer() {
  return createServer((request, response) => {
    void createLoginHandler()(request, response).catch(() => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: "internal_error" });
      } else {
        response.destroy();
      }
    });
  });
}

export const SYNTHETIC_DEMO_ACCOUNT = Object.freeze({
  username: "demo.user@example.test",
  credential: DEMO_CREDENTIAL,
});
