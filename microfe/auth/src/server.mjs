import crypto from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import argon2 from "argon2";

const scrypt = promisify(crypto.scrypt);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const csrfSecret = process.env.JWT_SECRET || "";
const dbConfigured = Boolean(supabaseUrl && supabaseKey && csrfSecret);

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
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function csrfForSession(sessionToken) {
  if (!csrfSecret) return "";
  return crypto.createHmac("sha256", csrfSecret).update("microfe-csrf:" + sessionToken).digest("base64url");
}
function cookieFlags(maxAge) {
  const domain = cookieDomain ? "; Domain=" + cookieDomain : "";
  return "Max-Age=" + maxAge + "; Path=/; HttpOnly; Secure; SameSite=Lax" + domain;
}
function csrfFlags(maxAge) {
  const domain = cookieDomain ? "; Domain=" + cookieDomain : "";
  return "Max-Age=" + maxAge + "; Path=/; Secure; SameSite=Lax" + domain;
}
function setSessionCookies(res, sessionToken) {
  const csrfToken = csrfForSession(sessionToken);
  res.append("Set-Cookie", cookieName + "=" + encodeURIComponent(sessionToken) + "; " + cookieFlags(sessionTtlSeconds));
  res.append("Set-Cookie", csrfCookieName + "=" + encodeURIComponent(csrfToken) + "; " + csrfFlags(sessionTtlSeconds));
}
function clearSessionCookies(res) {
  res.append("Set-Cookie", cookieName + "=; " + cookieFlags(0));
  res.append("Set-Cookie", csrfCookieName + "=; " + csrfFlags(0));
}
function requireCsrf(req, sessionToken) {
  const header = req.get("x-csrf-token") || "";
  const cookie = parseCookie(req.headers.cookie, csrfCookieName);
  const expected = csrfForSession(sessionToken);
  if (!header || !cookie || !safeEqual(header, cookie) || !safeEqual(header, expected)) {
    const error = new Error("CSRF_REQUIRED");
    error.code = "CSRF_REQUIRED";
    throw error;
  }
}

async function dbRequest(resource, options = {}) {
  if (!supabaseUrl || !supabaseKey) {
    const error = new Error("SUPABASE_NOT_CONFIGURED");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  const url = new URL("/rest/v1/" + resource, supabaseUrl);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const headers = {
    apikey: supabaseKey,
    Authorization: "Bearer " + supabaseKey,
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.returnRepresentation) headers.Prefer = "return=representation";
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Supabase request failed");
    error.code = data?.code || "SUPABASE_REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return data;
}
function requireDbConfiguration() {
  if (!dbConfigured) {
    const error = new Error("SUPABASE_NOT_CONFIGURED");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
}
async function userByEmail(email) {
  const rows = await dbRequest("users", {
    query: {
      select: "id,email,password_hash,role,mfa_enabled",
      email: "eq." + email.toLowerCase(),
      limit: "1",
    },
  });
  return rows?.[0] || null;
}
async function userById(id) {
  const rows = await dbRequest("users", {
    query: {
      select: "id,email,password_hash,role,mfa_enabled",
      id: "eq." + id,
      limit: "1",
    },
  });
  return rows?.[0] || null;
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return salt + ":" + Buffer.from(key).toString("hex");
}
async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return false;
  if (stored.startsWith("$argon2")) return argon2.verify(stored, password);
  const separator = stored.indexOf(":");
  if (separator <= 0) return false;
  const salt = stored.slice(0, separator);
  const expected = Buffer.from(stored.slice(separator + 1), "hex");
  if (!expected.length) return false;
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return safeEqual(actual, expected);
}
async function rehashPasswordIfNeeded(user, password) {
  if (!String(user.password_hash || "").startsWith("$argon2")) return;
  await dbRequest("users", {
    method: "PATCH",
    query: { id: "eq." + user.id },
    body: { password_hash: await hashPassword(password), updated_at: new Date().toISOString() },
  });
}
async function createSession(userId, ip, userAgent) {
  const sessionToken = opaque();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
  await dbRequest("refresh_sessions", {
    method: "POST",
    returnRepresentation: true,
    body: {
      user_id: userId,
      token_hash: hash(sessionToken),
      family_id: crypto.randomUUID(),
      expires_at: expiresAt.toISOString(),
      ip: ip || null,
      user_agent: userAgent || null,
    },
  });
  return sessionToken;
}
async function findSession(sessionToken) {
  if (!sessionToken) return null;
  const rows = await dbRequest("refresh_sessions", {
    query: {
      select: "id,user_id,token_hash,family_id,expires_at,revoked_at",
      token_hash: "eq." + hash(sessionToken),
      revoked_at: "is.null",
      expires_at: "gt." + new Date().toISOString(),
      limit: "1",
    },
  });
  const session = rows?.[0];
  if (!session) return null;
  const user = await userById(session.user_id);
  if (!user) return null;
  return { ...session, email: user.email, role: user.role, mfa_enabled: user.mfa_enabled };
}
async function revokeSession(sessionId) {
  await dbRequest("refresh_sessions", {
    method: "PATCH",
    query: { id: "eq." + sessionId, revoked_at: "is.null" },
    body: { revoked_at: new Date().toISOString(), last_used_at: new Date().toISOString() },
  });
}
async function checkDatabase() {
  requireDbConfiguration();
  await dbRequest("users", { query: { select: "id", limit: "1" } });
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
    await checkDatabase();
    return res.json({ ok: true, service: "microfe-auth", database: "connected" });
  } catch {
    return res.status(503).json({ ok: false, service: "microfe-auth", database: "unavailable" });
  }
});

app.get("/health", (_req, res) => {
  return res.json({ ok: true, service: "microfe-auth" });
});

app.get("/auth/status", async (_req, res) => {
  if (!dbConfigured) return res.json({ configured: false, database: "not_configured" });
  try {
    await checkDatabase();
    return res.json({ configured: true, database: "connected" });
  } catch {
    return res.json({ configured: true, database: "unavailable" });
  }
});

app.post("/auth/signup", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ code: "INVALID_INPUT", message: "Valid email and password are required" });
  }
  try {
    requireDbConfiguration();
    const existing = await userByEmail(email);
    if (existing) return res.status(409).json({ code: "EMAIL_EXISTS", message: "Email already registered" });
    const rows = await dbRequest("users", {
      method: "POST",
      returnRepresentation: true,
      body: { email, password_hash: await hashPassword(password), role: "USER", mfa_enabled: false },
      query: { select: "id,email,role,mfa_enabled" },
    });
    const user = rows?.[0];
    if (!user) throw new Error("SUPABASE_INSERT_RETURNED_NO_USER");
    return res.status(201).json({ user: { id: user.id, email: user.email, role: user.role || "USER" } });
  } catch (error) {
    if (error?.code === "23505") return res.status(409).json({ code: "EMAIL_EXISTS", message: "Email already registered" });
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Unable to create account" });
  }
});

app.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password;
  if (!email || typeof password !== "string") {
    return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid credentials" });
  }
  try {
    requireDbConfiguration();
    const user = await userByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid credentials" });
    }
    if (user.mfa_enabled) {
      return res.status(403).json({ code: "MFA_REQUIRED", message: "Additional authentication is required" });
    }
    await rehashPasswordIfNeeded(user, password);
    const sessionToken = await createSession(user.id, req.ip, req.get("user-agent"));
    setSessionCookies(res, sessionToken);
    return res.json({ user: { id: user.id, email: user.email, role: user.role || "USER" } });
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
    await dbRequest("refresh_sessions", {
      method: "PATCH",
      query: { id: "eq." + session.id, revoked_at: "is.null" },
      body: { last_used_at: new Date().toISOString() },
    });
    return res.json({ authenticated: true, user: { id: session.user_id, email: session.email, role: session.role || "USER" } });
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
    requireCsrf(req, token);
    const nextToken = opaque();
    const nextExpiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
    const rows = await dbRequest("rpc/rotate_refresh_token", {
      method: "POST",
      body: {
        p_token_hash: hash(token),
        p_new_token_hash: hash(nextToken),
        p_new_expires_at: nextExpiresAt.toISOString(),
        p_ip: req.ip || null,
        p_user_agent: req.get("user-agent") || null,
      },
    });
    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result || result.reuse_detected || result.user_id !== session.user_id) {
      clearSessionCookies(res);
      return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
    }
    setSessionCookies(res, nextToken);
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
    if (!session) {
      clearSessionCookies(res);
      return res.status(204).end();
    }
    requireCsrf(req, token);
    await revokeSession(session.id);
    clearSessionCookies(res);
    return res.status(204).end();
  } catch (error) {
    if (error?.code === "CSRF_REQUIRED") return res.status(403).json({ code: "CSRF_REQUIRED", message: "CSRF token required" });
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Unable to revoke session" });
  }
});

app.post("/auth/logout-all", async (req, res) => {
  const token = parseCookie(req.headers.cookie, cookieName);
  if (!token) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
  try {
    const session = await findSession(token);
    if (!session) return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
    requireCsrf(req, token);
    await dbRequest("refresh_sessions", {
      method: "PATCH",
      query: { user_id: "eq." + session.user_id, revoked_at: "is.null" },
      body: { revoked_at: new Date().toISOString() },
    });
    clearSessionCookies(res);
    return res.status(204).end();
  } catch (error) {
    if (error?.code === "CSRF_REQUIRED") return res.status(403).json({ code: "CSRF_REQUIRED", message: "CSRF token required" });
    return res.status(503).json({ code: "AUTH_DB_UNAVAILABLE", message: "Unable to revoke sessions" });
  }
});

export { app };

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, "0.0.0.0", () => console.log("microfe-auth listening on :" + port));
}