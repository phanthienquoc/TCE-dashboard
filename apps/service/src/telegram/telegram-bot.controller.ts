import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { TelegramBotService, TelegramDebugLevel } from './telegram-bot.service';

@Controller('platform/telegram')
export class TelegramBotController {
  constructor(private readonly bot: TelegramBotService, private readonly jwt: JwtService) {}
  private userId(auth?: string) { if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required'); return this.jwt.verify(auth.slice(7)).sub; }
  @Get('bots') bots(@Headers('authorization') auth?: string) { return this.bot.listBots(this.userId(auth)); }
  @Post('save') save(@Headers('authorization') auth: string | undefined, @Body() body: { token?: string; chatId?: string; environment?: string; name?: string }) { return this.bot.configure(this.userId(auth), String(body?.token ?? ''), body?.chatId, body?.environment ?? 'production', body?.name ?? 'default'); }
  @Post('test') test(@Body() body: { token?: string }) { return this.bot.testToken(String(body?.token ?? '')); }
  @Delete() remove(@Headers('authorization') auth: string | undefined, @Body() body?: { environment?: string; name?: string }) { return this.bot.removeBot(this.userId(auth), body?.environment ?? 'production', body?.name ?? 'default'); }
  @Get('debug/assignments') assignments(@Headers('authorization') auth?: string) { return this.bot.listAssignments(this.userId(auth)); }
  @Post('debug/assignments') assign(@Headers('authorization') auth: string | undefined, @Body() body: { telegramCredentialId?: string; serviceName?: string; minLevel?: TelegramDebugLevel; enabled?: boolean }) { if (!body?.telegramCredentialId) throw new UnauthorizedException('Telegram bot is required'); return this.bot.assignDebug(this.userId(auth), { telegramCredentialId: body.telegramCredentialId, serviceName: String(body.serviceName ?? ''), minLevel: body.minLevel, enabled: body.enabled }); }
  @Delete('debug/assignments/:id') unassign(@Headers('authorization') auth: string | undefined, @Param('id') id: string) { return this.bot.removeAssignment(this.userId(auth), id); }
}
