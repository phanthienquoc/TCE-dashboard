import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from './jwt.service';
import { AuthService } from './auth.service';

@Injectable()
export class RefreshService {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  rotate(userId: string, role: string, presented: string) {
    if (!presented) throw new UnauthorizedException('Refresh token required');
    const tokenHash = createHash('sha256').update(presented).digest('hex');
    const next = this.auth.issueRefreshToken();
    const familyId = randomUUID();
    // Persistence adapter will atomically revoke old token and insert the replacement.
    return { accessToken: this.jwt.issue(userId, role), refreshToken: next, tokenHash, familyId };
  }
}
