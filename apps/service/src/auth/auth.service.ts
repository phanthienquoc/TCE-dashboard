import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(private readonly repo: AuthRepository) {}
  hashRefreshToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
  issueRefreshToken() { return randomBytes(48).toString('base64url'); }
  async createRefreshSession(userId: string, ip?: string, userAgent?: string) { const token=this.issueRefreshToken(); const ttl=Number(process.env.JWT_REFRESH_TTL_SECONDS||2592000); await this.repo.createRefreshSession(userId,this.hashRefreshToken(token),randomUUID(),new Date(Date.now()+ttl*1000),ip,userAgent); return token; }
  assertAuthenticated(userId?: string) { if (!userId) throw new UnauthorizedException(); return userId; }
}
