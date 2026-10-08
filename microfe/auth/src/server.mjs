import crypto from "node:crypto";
import express from "express";
import argon2 from "argon2";
import pg from "pg";

const { Pool } = pg;
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX || 5) })
  : null;

const cookieName = process.env.AUTH_COOKIE_NAME || "__Secure-microfe_session";
const csrfCookieName = process.env.AUTH_CSRF_COOKIE_NAME || "__Secure-microfe_csrf";
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || ".mrcute.space";
const sessionTtlSeconds = Number(process.env.AUTH_SESSION_TTL_SECONDS || 2592000);

function reqId(req) {
  return req.get("x-request-id") || crypto.randomUUID();
}
function hash(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function opaque(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}
function parseCookie(header, name) {
  for (const part of String(header || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function cookieFlags(maxAge) {
  const domain = cookieDomain ? "; Domain=" + cookieDomain : "";
  return "Max-Age=" + maxAge + "; Path=/; HttpOnly; Secure; SameSite=Lax" + domain;
}
function csrfFlags(maxAge) {
  const domain = cookieDomain ? "; Domain=" + cookieDomain : "";
  return "Max-Age=" + maxAge + "; Path=/; Secure; SameSite=Lax" + domain;
}
function setSessionCookies(res, sessionToken, csrfToken) {
  res.append("Set-Cookie", cookieName + "=" + encodeURIComponent(sessionToken) + "; " + cookieFlags(sessionTtlSeconds));
  res.append("Set-Cookie", csrfCookieName + "=" + encodeURIComponent(csrfToken) + "; " + csrfFlags(sessionTtlSeconds));
}
function clearSessionCookies(res) {
  res.append("Set-Cookie", cookieName + "=; " + cookieFlags(0));
  res.append("Set-Cookie", csrfCookieName + "=; " + csrfFlags(0));
}
function requireCsrf(req, session) {
  const header = req.get("x-csrf-token") || "";
  if (!header || hash(header) !== session.csrf_token_hash) {
    const error = new Error("CSRF_REQUIRED");
    error.code = "CSRF_REQUIRED";
    throw error;
  }
}
async function ensureSchema() {
  if (!pool) return;
  await pool.query(
    "create table if not exists microfe_users (" +
      "id uuid primary key default gen_random_uuid(), " +
      "email text not null unique, password_hash text not null, " +
      "roles text[] not null default '{}', disabled_at timestamptz, " +
      "created_at timestamptz not null default now(), updated_at timestamptz not null default now()" +
    ");" +
    "create table if not exists microfe_sessions (" +
      "id uuid primary key default gen_random_uuid(), " +
      "user_id uuid not null references microfe_users(id) on delete cascade, " +
      "refresh_token_hash text not null unique, csrf_token_hash text not null, " +
      "expires_at timestamptz not null, revoked_at timestamptz, rotated_at timestamptz, " +
      "created_at timestamptz not null default now(), last_seen_at timestamptz not null default now()" +
    ");" +
    "create index if not exists microfe_sessions_user_idx on microfe_sessions(user_id);" +
    "create index if not exists microfe_sessions_expires_idx on microfe_sessions(expires_at);"
  );
}
async function findSession(token) {
  if (!pool || !token) return null;
  const result = await pool.query(
    "select s.id, s.user_id, s.csrf_token_hash, s.expires_at, s.revoked_at, " +
      "u.email, u.roles from microfe_sessions s join microfe_users u on u.id = s.user_id " +
      "where s.refresh_token_hash = $1 and s.revoked_at is null and s.expires_at > now() " +
      "and u.disabled_at is null limit 1",
    [hash(token)]
  );
  return result.rows[0] || null;
}
async function userByEmail(email) {
  if (!pool) return null;
  const result = await pool.query(
    "select id, email, password_hash, roles, disabled_at from microfe_users where email = $1 limit 1",
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}
async function createSession(userId) {
  const sessionToken = opaque();
  const csrfToken = opaque(32);
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
  await pool.query(
    "insert into microfe_sessions(user_id, refresh_token_hash, csrf_token_hash, expires_at) values($1,$2,$3,$4)",
    [userId, hash(sessionToken), hash(csrfToken), expiresAt.toISOString()]
  );
  return { sessionToken, csrfToken };
}
async function rotateSession(session) {
  const sessionToken = opaque();
  const csrfToken = opaque(32);
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
  const result = await pool.query(
    "update microfe_sessions set refresh_token_hash = $1, csrf_token_hash = $2, " +
      "expires_at = $3, rotated_at = now(), last_seen_at = now() " +
      "where id = $4 and revoked_at is null and expires_at > now() returning id",
    [hash(sessionToken), hash(csrfToken), expiresAt.toISOString(), session.id]
  );
  if (!result.rowCount) throw new Error("SESSION_INVALID");
  return { sessionToken, csrfToken };
}

app.use((req, res, next) => {
  res.setHeader("x-request-id", reqId(req));
  const origin = req.get("origin");
  if (origin === "https://app.mrcute.space" || origin === "https://tce.mrcute.space") {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-headers", "content-type,x-request-id,x-csrf-token");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS,PATCH,DELETE");
    res.setHeader("vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/health/live", (_req, res) => {
  return res.json({ ok: true, service: "microfe-auth" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    if (!pool) return res.status(503).json({ ok: false, service: "microfe-auth", database: "not_configured" });
    await pool.query("select 1");
    return res.json({ ok: true, service: "microfe-auth", database: "connected" });
  } catch {
    return res.status(503).json({ ok: false, service: "microfe-auth", database: "unavailable" });
  }
});

app.get("/health", async (_req, res) => {
  try {
    if (pool) await pool.query("select 1");
    return res.json({ ok: true, service: "microfe-auth" });
  } catch {
    return res.status(503).json({ ok: false, service: "microfe-auth" });
  }
});

app.get("/auth/status", async (_req, res) => {
  if (!pool) return res.json({ configured: false, database: "not_configured" });
  try {
    await ensureSchema();
    await pool.query("select 1");
    return res.json({ configured: true, database: "connected" });
  } catch {
    return res.json({ configured: true, database: "unavailable" });
  }
});

app.post("/auth/signup", async (req, res) => {
  if (!pool) return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Authentication database unavailable" });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ code: "INVALID_INPUT", message: "Valid email and password are required" });
  }
  try {
    const existing = await userByEmail(email);
    if (existing) return res.status(409).json({ code: "EMAIL_EXISTS", message: "Email already registered" });
    const passwordHash = await argon2.hash(password);
    const result = await pool.query(
      "insert into microfe_users(email,password_hash,roles) values($1,$2,$3) returning id,email,roles",
      [email, passwordHash, ["USER"]]
    );
    return res.status(201).json({ user: { id: result.rows[0].id, email: result.rows[0].email, role: result.rows[0].roles?.[0] || "USER" } });
  } catch (error) {
    if (error?.code === "23505") return res.status(409).json({ code: "EMAIL_EXISTS", message: "Email already registered" });
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Unable to create account" });
  }
});

app.post("/auth/login", async (req, res) => {
  if (!pool) return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Authentication database unavailable" });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password;
  if (!email || typeof password !== "string") return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid credentials" });
  try {
    const user = await userByEmail(email);
    if (!user || user.disabled_at) return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid credentials" });
    if (!(await argon2.verify(user.password_hash, password))) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid credentials" });
    }
    const session = await createSession(user.id);
    setSessionCookies(res, session.sessionToken, session.csrfToken);
    return res.json({ user: { id: user.id, email: user.email, role: user.roles?.[0] || "USER" } });
  } catch {
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Authentication unavailable" });
  }
});

app.get("/auth/me", async (req, res) => {
  const token = parseCookie(req.headers.cookie, cookieName);
  if (!token) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required", requestId: res.getHeader("x-request-id") });
  try {
    const session = await findSession(token);
    if (!session) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required", requestId: res.getHeader("x-request-id") });
    await pool.query("update microfe_sessions set last_seen_at = now() where id = $1", [session.id]);
    return res.json({ authenticated: true, user: { id: session.user_id, email: session.email, role: session.roles?.[0] || "USER" } });
  } catch {
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Authentication unavailable" });
  }
});

app.post("/auth/refresh", async (req, res) => {
  const token = parseCookie(req.headers.cookie, cookieName);
  if (!token) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
  try {
    const session = await findSession(token);
    if (!session) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
    requireCsrf(req, session);
    const next = await rotateSession(session);
    setSessionCookies(res, next.sessionToken, next.csrfToken);
    return res.status(204).end();
  } catch (error) {
    if (error?.code === "CSRF_REQUIRED") return res.status(403).json({ code: "CSRF_REQUIRED", message: "CSRF token required" });
    return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
  }
});

app.post("/auth/logout", async (req, res) => {
  const token = parseCookie(req.headers.cookie, cookieName);
  if (!token) {
    clearSessionCookies(res);
    return res.status(204).end();
  }
  try {
    const session = await findSession(token);
    if (session) {
      requireCsrf(req, session);
      await pool.query("update microfe_sessions set revoked_at = now() where id = $1", [session.id]);
    }
    clearSessionCookies(res);
    return res.status(204).end();
  } catch (error) {
    if (error?.code === "CSRF_REQUIRED") return res.status(403).json({ code: "CSRF_REQUIRED", message: "CSRF token required" });
    return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
  }
});

export { app, ensureSchema };

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 3000);

  // Keep the HTTP process alive even when the database is temporarily unavailable.
  // Kubernetes readiness will gate traffic until the database becomes reachable.
  app.listen(port, "0.0.0.0", () => console.log("microfe-auth listening on :" + port));

  const bootstrapDb = async () => {
    try {
      await ensureSchema();
      console.log("[AUTH_BOOTSTRAP] database ready");
    } catch (error) {
      console.error("[AUTH_BOOTSTRAP] database unavailable; retrying", error);
      setTimeout(bootstrapDb, 5000);
    }
  };

  void bootstrapDb();
}
