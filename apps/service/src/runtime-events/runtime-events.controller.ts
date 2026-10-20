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
      throw new UnauthorizedException('Bearer token required');
    }
    return this.jwt.verify(authorization.slice(7)).sub;
  }

  @Get()
  async list(
    @Headers('authorization') authorization?: string,
    @Query('after') after?: string,
    @Query('limit') rawLimit?: string,
    @Query('eventType') eventType?: string
  ) {
    const accountId = this.accountId(authorization);
    if (after !== undefined && !Number.isFinite(Date.parse(after))) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'after must be an ISO-8601 timestamp',
      });
    }
    if (eventType && !isTceRuntimeEventType(eventType)) {
      throw new BadRequestException({
        code: 'INVALID_EVENT_TYPE',
        message: 'Unsupported runtime event type',
      });
    }
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException({
        code: 'INVALID_LIMIT',
        message: 'limit must be an integer between 1 and 200',
      });
    }
    const data = await this.events.listForAccount(accountId, {
      ...(after ? { after } : {}),
      limit,
      ...(eventType ? { eventType } : {}),
    });
    return {
      ok: true,
      data,
      meta: { limit, nextCursor: data.at(-1)?.occurredAt ?? after ?? null },
    };
  }

  @Sse('stream')
  stream(
    @Headers('authorization') authorization?: string,
    @Query('after') after?: string,
    @Query('eventType') eventType?: string
  ) {
    const accountId = this.accountId(authorization);
    if (eventType && !isTceRuntimeEventType(eventType)) {
      throw new BadRequestException({
        code: 'INVALID_EVENT_TYPE',
        message: 'Unsupported runtime event type',
      });
    }
    if (after !== undefined && !Number.isFinite(Date.parse(after))) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'after must be an ISO-8601 timestamp',
      });
    }

    let cursor = after;
    const sent = new Set<string>();
    return interval(2000).pipe(
      startWith(0),
      exhaustMap(() =>
        from(
          this.events.listForAccount(accountId, {
            ...(cursor ? { after: cursor } : {}),
            limit: 200,
            ...(eventType ? { eventType } : {}),
          })
        ).pipe(
          map(events => {
            const fresh = events.filter(event => !sent.has(event.eventId));
            for (const event of events) {
              sent.add(event.eventId);
              cursor = event.occurredAt;
            }
            while (sent.size > 1000) {
              sent.delete(sent.values().next().value as string);
            }
            return fresh;
          }),
          catchError(() =>
            of([
              {
                eventId: 'transport-error',
                eventType: 'transport.error',
                data: {
                  code: 'RUNTIME_EVENT_STORE_UNAVAILABLE',
                  retryable: true,
                },
              } as const,
            ])
          )
        )
      ),
      exhaustMap(events => from(events)),
      map(event => ({
        id: event.eventId,
        type: event.eventType,
        data: event,
      }) satisfies MessageEvent)
    );
  }
}
