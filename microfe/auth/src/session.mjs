import { createHash, randomBytes, randomUUID } from "node:crypto";

export function hashOpaqueToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionMaterial() {
  return {
    sessionId: randomUUID(),
    refreshToken: randomBytes(48).toString("base64url"),
    csrfToken: randomBytes(32).toString("base64url")
  };
}

export function rotateRefreshToken(existing, now = new Date()) {
  if (!existing || existing.revokedAt || new Date(existing.expiresAt) <= now) {
    throw new Error("SESSION_INVALID");
  }
  return {
    ...createSessionMaterial(),
    previousSessionId: existing.sessionId
  };
}