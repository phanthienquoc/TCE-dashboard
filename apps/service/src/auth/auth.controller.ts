import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { RefreshService } from './refresh.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly repo: AuthRepository, private readonly auth: AuthService, private readonly passwords: PasswordService, private readonly jwt: JwtService, private readonly refresh: RefreshService, private readonly mfa: MfaService) {}
  @Get('status') status() { return { configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.JWT_SECRET }; }
  @Post('login')
  async login(@Body() body:{email:string;password:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){ const user=await this.repo.findUserByEmail(body.email); if(!user||!(await this.passwords.verify(body.password,user.password_hash))) throw new UnauthorizedException('Invalid credentials'); if(user.mfa_enabled) return {mfaRequired:true,userId:user.id}; return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,ip,ua)}; }
  @Post('refresh') async refreshToken(@Body() body:{refreshToken:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){ return this.refresh.rotate(body.refreshToken,ip,ua); }
  @Post('mfa/login')
  async mfaLogin(@Body() body:{userId:string;code:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){ const user=await this.repo.findUserById(body.userId); if(!user?.mfa_enabled||!user.mfa_secret_encrypted||!this.mfa.verifyTotp(user.mfa_secret_encrypted,body.code)) throw new UnauthorizedException('Invalid MFA code'); return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,ip,ua)}; }
  @Post('mfa/recovery')
  async recovery(@Body() body:{userId:string;code:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){ const user=await this.repo.findUserById(body.userId); if(!user?.mfa_enabled||!await this.repo.consumeRecoveryCode(user.id,this.auth.hashRefreshToken(body.code))) throw new UnauthorizedException('Invalid recovery code'); return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,ip,ua)}; }
}
