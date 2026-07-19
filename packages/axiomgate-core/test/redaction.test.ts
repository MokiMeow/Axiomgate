import { describe, expect, it } from "vitest";

import { redactSensitiveText, redactSensitiveValue } from "../src/index.js";

describe("persisted diagnostic redaction", () => {
  it.each([
    ["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_"),
    ["github", "pat", "abcdefghijklmnopqrstuvwxyz123456"].join("_"),
    ["npm", "abcdefghijklmnopqrstuvwxyz123456"].join("_"),
    `AKIA${"1234567890ABCDEF"}`,
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.fixture.signature",
    'api_' + 'key="abcdefghijklmnopqrstuvwxyz123456"',
    "https://operator:supersecretpassword@example.test/path",
  ])("removes a credential-shaped value from %s", (secret) => {
    const redacted = redactSensitiveText(`before ${secret} after`);
    expect(redacted).toContain("[REDACTED");
    expect(redacted).not.toContain(secret);
  });

  it("redacts nested event values without mutating their shape", () => {
    expect(
      redactSensitiveValue({
        message: "password=" + "abcdefghijklmnopqrstuvwxyz",
        nested: ["safe", ["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_")],
      }),
    ).toEqual({
      message: "password=[REDACTED]",
      nested: ["safe", "[REDACTED_TOKEN]"],
    });
  });
});
