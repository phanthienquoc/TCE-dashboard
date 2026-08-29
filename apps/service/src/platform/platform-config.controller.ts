import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

@Controller('platform/config')
export class PlatformConfigController {
  constructor(
    private readonly db: SupabaseClientService,
    private readonly jwt: JwtService
  ) {}
  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }
  @Get('fastapi')
  async getFastApi(@Headers('authorization') auth?: string) {
    const userId = this.userId(auth);
    const { data } = await this.db.db
      .from('platform_configs')
      .select('provider,config,updated_at')
      .eq('user_id', userId)
      .eq('provider', 'fastapi')
      .maybeSingle();
    return data
      ? { provider: data.provider, config: data.config, updatedAt: data.updated_at }
      : { provider: 'fastapi', config: null };
  }
  @Post('fastapi')
  async saveFastApi(
    @Headers('authorization') auth: string | undefined,
    @Body() body: { baseUrl: string; healthPath?: string }
  ) {
    const userId = this.userId(auth);
    if (!body?.baseUrl) throw new UnauthorizedException('FastAPI baseUrl is required');
    const { data, error } = await this.db.db
      .from('platform_configs')
      .upsert(
        {
          user_id: userId,
          provider: 'fastapi',
          config: { baseUrl: body.baseUrl, healthPath: body.healthPath ?? '/health' },
        },
        { onConflict: 'user_id,provider' }
      )
      .select('provider,config,updated_at')
      .single();
    if (error) throw error;
    return data;
  }
}
