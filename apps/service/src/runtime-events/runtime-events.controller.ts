import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { isTceRuntimeEventType } from '@tce/contracts';
import { catchError, exhaustMap, from, interval, map, of, startWith } from 'rxjs';
import { JwtService } from '../auth/jwt.service';
import { RuntimeEventsQueryService } from './runtime-events.query.service';

@Controller('runtime/events')
export class RuntimeEventsController {
  constructor(
    private readonly events: RuntimeEventsQueryService,
    private readonly jwt: JwtService
  ) {}

  private accountId(authorization?: string): string {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Bearer token required' },
      });
    }
    try {
      return this.jwt.verify(authorization.slice(7)).sub;
    } catch {
      throw new UnauthorizedException({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired bearer token' },
      });
    }
  }

  @Get()
  async list(
    @Headers('authorization') authorization?: string,
    @Query('after') after?: string,
    @Query('limit') rawLimit?: string,
    @Query('eventType') eventType?: string,
    @Query('afterEventId') afterEventId?: string
  ) {
    const accountId = this.accountId(authorization);
    if (after !== undefined && !Number.isFinite(Date.parse(after))) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_CURSOR', message: 'after must be an ISO-8601 timestamp' },
      });
    }
    if (afterEventId !== undefined && (!after || !/^[A-Za-z0-9._:-]{1,256}$/.test(afterEventId))) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_CURSOR', message: 'afterEventId requires a valid after timestamp' },
      });
    }
    if (eventType && !isTceRuntimeEventType(eventType)) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_EVENT_TYPE', message: 'Unsupported runtime event type' },
      });
    }
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_LIMIT', message: 'limit must be an integer between 1 and 200' },
      });
    }
    const data = await this.events.listForAccount(accountId, {
      ...(after ? { after } : {}),
      ...(afterEventId ? { afterEventId } : {}),
      limit,
      ...(eventType ? { eventType } : {}),
    });
    return {
      ok: true,
      data,
      meta: {
        limit,
        nextCursor: data.at(-1)?.occurredAt ?? after ?? null,
        nextEventId: data.at(-1)?.eventId ?? afterEventId ?? null,
      },
    };
  }

  @Sse('stream')
  stream(
    @Headers('authorization') authorization?: string,
    @Query('after') after?: string,
    @Query('eventType') eventType?: string,
    @Query('afterEventId') afterEventId?: string
  ) {
    const accountId = this.accountId(authorization);
    if (eventType && !isTceRuntimeEventType(eventType)) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_EVENT_TYPE', message: 'Unsupported runtime event type' },
      });
    }
    if (after !== undefined && !Number.isFinite(Date.parse(after))) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_CURSOR', message: 'after must be an ISO-8601 timestamp' },
      });
    }
    if (afterEventId !== undefined && (!after || !/^[A-Za-z0-9._:-]{1,256}$/.test(afterEventId))) {
      throw new BadRequestException({
        ok: false,
        error: { code: 'INVALID_CURSOR', message: 'afterEventId requires a valid after timestamp' },
      });
    }

    let cursor = after;
    let cursorEventId = afterEventId;
    const sent = new Set<string>();
    return interval(2000).pipe(
      startWith(0),
      exhaustMap(() =>
        from(
          this.events.listForAccount(accountId, {
            ...(cursor ? { after: cursor } : {}),
            ...(cursorEventId ? { afterEventId: cursorEventId } : {}),
            limit: 200,
            ...(eventType ? { eventType } : {}),
          })
        ).pipe(
          map(events => {
            const fresh = events.filter(event => !sent.has(event.eventId));
            for (const event of events) {
              sent.add(event.eventId);
              cursor = event.occurredAt;
              cursorEventId = event.eventId;
            }
            while (sent.size > 1000) {
              sent.delete(sent.values().next().value as string);
            }
            return fresh.map(
              event =>
                ({
                  id: event.eventId,
                  type: event.eventType,
                  data: event,
                }) satisfies MessageEvent
            );
          }),
          catchError(() =>
            of([
              {
                type: 'transport.error',
                data: {
                  type: 'transport.error',
                  error: {
                    code: 'RUNTIME_EVENT_STORE_UNAVAILABLE',
                    message: 'Runtime event store is temporarily unavailable',
                    retryable: true,
                  },
                },
              } satisfies MessageEvent,
            ])
          )
        )
      ),
      exhaustMap(messages => from(messages))
    );
  }
}
