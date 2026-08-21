import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  hashRefreshToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
  issueRefreshToken() { return randomBytes(48).toString('base64url'); }
  assertAuthenticated(userId?: string) { if (!userId) throw new UnauthorizedException(); return userId; }
}
