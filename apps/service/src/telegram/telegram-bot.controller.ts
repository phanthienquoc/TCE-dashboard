import { Body, Controller, Delete, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { TelegramBotService } from './telegram-bot.service';

@Controller('platform/telegram')
export class TelegramBotController {
  constructor(private readonly bot: TelegramBotService, private readonly jwt: JwtService) {}
  private userId(auth?: string) { if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required'); return this.jwt.verify(auth.slice(7)).sub; }
  @Post('save') save(@Headers('authorization') auth: string | undefined, @Body() body: { token?: string; chatId?: string; environment?: string }) { return this.bot.configure(this.userId(auth), String(body?.token ?? ''), body?.chatId, body?.environment ?? 'production'); }
  @Post('test') async test(@Headers('authorization') auth: string | undefined, @Body() body: { token?: string }) { const result = this.bot.parseSignal('TEST BUY ENTRY 1 TP 2 SL 0.5'); return { ok: true, parser: result.symbol === 'TEST' && result.side === 'BUY' }; }
  @Delete() remove(@Headers('authorization') auth: string | undefined, @Body() body?: { environment?: string }) { return this.bot.stop(this.userId(auth), body?.environment ?? 'production'); }
}
