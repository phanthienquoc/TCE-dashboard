import test from "node:test";
import assert from "node:assert/strict";
import { app } from "./server.mjs";

test("health endpoint", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch("http://127.0.0.1:" + port + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "microfe-auth" });
  server.close();
});

test("auth/me rejects missing session", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch("http://127.0.0.1:" + port + "/auth/me");
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_REQUIRED");
  server.close();
});