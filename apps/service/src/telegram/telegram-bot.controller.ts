import { Body, Controller, Delete, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { TelegramBotService } from './telegram-bot.service';

@Controller('platform/telegram')
export class TelegramBotController {
  constructor(private readonly bot: TelegramBotService, private readonly jwt: JwtService) {}
  private userId(auth?: string) { if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required'); return this.jwt.verify(auth.slice(7)).sub; }
  @Post('save') save(@Headers('authorization') auth: string | undefined, @Body() body: { token?: string; chatId?: string; environment?: string }) { return this.bot.configure(this.userId(auth), String(body?.token ?? ''), body?.chatId, body?.environment ?? 'production'); }
  @Post('test') test(@Body() body: { token?: string }) { return this.bot.testToken(String(body?.token ?? '')); }
  @Delete() remove(@Headers('authorization') auth: string | undefined, @Body() body?: { environment?: string }) { return this.bot.stop(this.userId(auth), body?.environment ?? 'production'); }
}
