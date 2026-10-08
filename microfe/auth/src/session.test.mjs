import test from "node:test";
import assert from "node:assert/strict";
import { createSessionMaterial, hashOpaqueToken, rotateRefreshToken } from "./session.mjs";

test("session material contains opaque tokens", () => {
  const m = createSessionMaterial();
  assert.ok(m.sessionId);
  assert.ok(m.refreshToken);
  assert.ok(m.csrfToken);
  assert.notEqual(m.refreshToken, m.csrfToken);
  assert.equal(hashOpaqueToken(m.refreshToken), hashOpaqueToken(m.refreshToken));
});

test("expired sessions cannot rotate", () => {
  assert.throws(() => rotateRefreshToken({ sessionId: "s", revokedAt: null, expiresAt: "2020-01-01T00:00:00Z" }));
});

test("revoked sessions cannot rotate", () => {
  assert.throws(() => rotateRefreshToken({ sessionId: "s", revokedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" }));
});