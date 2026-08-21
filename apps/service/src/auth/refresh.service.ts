import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';

@Injectable()
export class RefreshService {
  constructor(private readonly auth: AuthService, private readonly repo: AuthRepository, private readonly jwt: JwtService) {}

  async rotate(presented: string, ip?: string, userAgent?: string) {
    if (!presented) throw new UnauthorizedException('Refresh token required');
    const next = this.auth.issueRefreshToken();
    const oldHash = createHash('sha256').update(presented).digest('hex');
    const newHash = createHash('sha256').update(next).digest('hex');
    const expiresAt = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_SECONDS || 2592000) * 1000);
    const row = await this.repo.rotateRefreshToken(oldHash, newHash, expiresAt, ip, userAgent);
    return { accessToken: this.jwt.issue(row.user_id, row.role), refreshToken: next };
  }
}
