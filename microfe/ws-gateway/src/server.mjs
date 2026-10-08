import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import { WebSocketServer } from "ws";
import { connect, StringCodec } from "nats";

const app = express();
app.use(express.json({ limit: "32kb" }));
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Set();
const subscriptions = new Map();
const seen = new Set();
let nats;

function cookie(header, name) {
  for (const part of String(header || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}
async function authenticated(req) {
  const token = cookie(
    req.headers.cookie,
    process.env.AUTH_COOKIE_NAME || "__Secure-microfe_session",
  );
  if (!token) return false;
  const url = process.env.AUTH_SERVICE_URL;
  if (!url) return false;
  const r = await fetch(new URL("/auth/me", url), {
    headers: { cookie: req.headers.cookie || "" },
    signal: AbortSignal.timeout(2000),
  });
  return r.ok;
}
function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}
function broadcast(message) {
  if (seen.has(message.id)) return;
  seen.add(message.id);
  if (seen.size > 2048) seen.delete(seen.values().next().value);
  for (const ws of clients) {
    if (subscriptions.get(ws)?.has(message.channel)) send(ws, message);
  }
}
async function publish(message) {
  if (!nats) throw new Error("NATS_UNAVAILABLE");
  nats.publish(message.channel, StringCodec().encode(JSON.stringify(message)));
}
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "microfe-ws", clients: clients.size }),
);
app.post("/internal/events", async (req, res) => {
  const body = req.body || {};
  const channel = String(body.channel || "");
  const event = String(body.event || "");
  if (!channel || !event || !channel.startsWith("platform.")) {
    return res.status(400).json({ code: "INVALID_EVENT" });
  }
  const message = {
    id: String(body.id || crypto.randomUUID()),
    channel,
    event,
    timestamp: new Date().toISOString(),
    sequence: Number(body.sequence) || Date.now(),
    data: body.data ?? {},
  };
  try {
    await publish(message);
    broadcast(message);
    return res.status(202).json({ accepted: true, id: message.id });
  } catch (error) {
    return res.status(503).json({ code: "NATS_UNAVAILABLE", message: error.message });
  }
});
wss.on("connection", async (ws, req) => {
  try {
    if (!(await authenticated(req))) {
      ws.close(4401, "auth_required");
      return;
    }
    clients.add(ws);
    subscriptions.set(ws, new Set());
    send(ws, {
      type: "ready",
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const set = subscriptions.get(ws);
        if (!set) return;
        if (
          msg.type === "subscribe" &&
          typeof msg.channel === "string" &&
          msg.channel.startsWith("platform.")
        ) {
          set.add(msg.channel);
        }
        if (msg.type === "unsubscribe" && typeof msg.channel === "string") {
          set.delete(msg.channel);
        }
        if (msg.type === "ping") {
          send(ws, { type: "pong", timestamp: new Date().toISOString() });
        }
      } catch {}
    });
    ws.on("close", () => {
      clients.delete(ws);
      subscriptions.delete(ws);
    });
  } catch {
    ws.close(1011, "gateway_error");
  }
});
async function main() {
  nats = await connect({
    servers:
      process.env.NATS_URL ||
      "nats://nats.microfe-platform.svc.cluster.local:4222",
  });
  const sc = StringCodec();
  const sub = nats.subscribe("platform.>");
  (async () => {
    for await (const m of sub) {
      try {
        const msg = JSON.parse(sc.decode(m.data));
        broadcast(msg);
      } catch {}
    }
  })();
  const port = Number(process.env.PORT || 8080);
  httpServer.listen(port, "0.0.0.0", () =>
    console.log("microfe-ws listening on :" + port),
  );
}
main().catch((error) => {
  console.error("[WS_BOOTSTRAP]", error);
  process.exit(1);
});
