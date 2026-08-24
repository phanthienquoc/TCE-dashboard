import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AccessClaims { sub: string; role: string; typ: 'access'; iat: number; exp: number; jti: string; }

@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET || 'CHANGE_ME_IN_ENV';
  private readonly ttl = Number(process.env.JWT_ACCESS_TTL_SECONDS || 900);

  issue(userId: string, role: string): string {
    if (this.secret === 'CHANGE_ME_IN_ENV') throw new Error('JWT_SECRET is required');
    const header = this.b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = this.b64(JSON.stringify({ sub: userId, role, typ: 'access', iat: now, exp: now + this.ttl, jti: randomBytes(16).toString('hex') }));
    const body = `${header}.${payload}`;
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): AccessClaims {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s || !this.safeEqual(this.sign(`${h}.${p}`), s)) throw new UnauthorizedException('Invalid token');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as AccessClaims;
    if (claims.typ !== 'access' || claims.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Expired token');
    return claims;
  }
  private sign(value: string) { return createHmac('sha256', this.secret).update(value).digest('base64url'); }
  private b64(value: string) { return Buffer.from(value).toString('base64url'); }
  private safeEqual(a: string, b: string) { const aa=Buffer.from(a); const bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
}
