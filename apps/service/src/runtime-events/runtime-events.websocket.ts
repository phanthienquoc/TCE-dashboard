import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { isTceRuntimeEventType } from '@tce/contracts';
import { JwtService } from '../auth/jwt.service';
import { RuntimeEventsQueryService } from './runtime-events.query.service';

type UpgradeRequest = import('node:http').IncomingMessage;

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function originAllowed(request: UpgradeRequest, hasCookie: boolean): boolean {
  const origin = request.headers.origin;
  if (!origin) return !hasCookie;
  const allowed = (process.env.TCE_EVENT_WS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function resolveAccountId(request: UpgradeRequest, jwt: JwtService): Promise<string> {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return jwt.verify(authorization.slice(7)).sub;
  }

  const cookie = request.headers.cookie;
  if (!cookie || !process.env.AUTH_SERVICE_URL) {
    throw new Error('Authentication required');
  }
  const response = await fetch(new URL('/auth/me', process.env.AUTH_SERVICE_URL), {
    headers: { cookie },
    signal: AbortSignal.timeout(Number(process.env.AUTH_INTROSPECTION_TIMEOUT_MS ?? 2000)),
  });
  if (!response.ok) throw new Error('Authentication required');
  const body = (await response.json()) as { user?: { id?: string } };
  if (!body.user?.id) throw new Error('Invalid authentication context');
  return body.user.id;
}

function rejectUpgrade(socket: Duplex, status: 400 | 401 | 403, message: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : 'Forbidden'}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n` +
      message
  );
  socket.destroy();
}

/**
 * Attaches a read-only WebSocket transport to the existing Nest HTTP server.
 * The authenticated identity determines account scope; clients cannot select
 * another account or publish commands over this channel.
 */
export function attachRuntimeEventsWebSocket(
  server: Server,
  events: RuntimeEventsQueryService,
  jwt: JwtService
): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/runtime/events/ws') return;

    void (async () => {
      const hasCookie = Boolean(cookieValue(request.headers.cookie, 'microfe_session'));
      if (!originAllowed(request, hasCookie)) {
        rejectUpgrade(socket, 403, 'WebSocket origin not allowed');
        return;
      }

      let accountId: string;
      try {
        accountId = await resolveAccountId(request, jwt);
      } catch {
        rejectUpgrade(socket, 401, 'Authentication required');
        return;
      }

      const afterParam = url.searchParams.get('after') ?? undefined;
      if (afterParam && !Number.isFinite(Date.parse(afterParam))) {
        rejectUpgrade(socket, 400, 'Invalid after cursor');
        return;
      }
      const eventType = url.searchParams.get('eventType') ?? undefined;
      if (eventType && !isTceRuntimeEventType(eventType)) {
        rejectUpgrade(socket, 400, 'Unsupported event type');
        return;
      }

      wss.handleUpgrade(request, socket, head, client => {
        wss.emit('connection', client, request);
        let cursor = afterParam ?? new Date(Date.now() - 2000).toISOString();
        let polling = false;
        const sent = new Set<string>();

        const poll = async () => {
          if (polling || client.readyState !== WebSocket.OPEN) return;
          polling = true;
          try {
            const batch = await events.listForAccount(accountId, {
              after: cursor,
              limit: 200,
              ...(eventType ? { eventType } : {}),
            });
            for (const event of batch) {
              cursor = event.occurredAt;
              if (sent.has(event.eventId)) continue;
              sent.add(event.eventId);
              while (sent.size > 1000) {
                sent.delete(sent.values().next().value as string);
              }
              if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
            }
          } catch {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  eventType: 'transport.error',
                  data: { code: 'RUNTIME_EVENT_STORE_UNAVAILABLE', retryable: true },
                })
              );
            }
          } finally {
            polling = false;
          }
        };

        const timer = setInterval(() => void poll(), 2000);
        client.on('close', () => clearInterval(timer));
        client.on('error', () => clearInterval(timer));
        client.on('message', () => client.close(1008, 'Read-only event stream'));
        void poll();
      });
    })().catch(() => rejectUpgrade(socket, 401, 'Authentication required'));
  });
}
