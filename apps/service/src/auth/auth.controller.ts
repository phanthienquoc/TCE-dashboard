import { Body, Controller, Get, Headers, Param, Delete, Patch, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { isIP } from 'node:net';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { RefreshService } from './refresh.service';
import { PasskeyService } from './passkey.service';

@Controller('auth')
export class AuthController {
 constructor(private readonly repo:AuthRepository,private readonly auth:AuthService,private readonly passwords:PasswordService,private readonly jwt:JwtService,private readonly refresh:RefreshService,private readonly mfa:MfaService,private readonly mfaCrypto:MfaCryptoService,private readonly passkey:PasskeyService){}
 @Get('status') async status(){const configured=!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY&&!!process.env.JWT_SECRET&&!!process.env.MFA_ENCRYPTION_KEY;const passkeyConfigured=!!process.env.PASSKEY_RP_ID&&!!process.env.PASSKEY_ORIGIN;if(!configured)return {configured:false,database:'not_configured',passkeyConfigured};try{await this.repo.checkDatabase();return {configured:true,database:'connected',passkeyConfigured};}catch(error){console.error('[AUTH_DB_STATUS]',error);return {configured:true,database:'unavailable',passkeyConfigured};}}
 private bearer(authHeader?:string){if(!authHeader?.startsWith('Bearer '))throw new UnauthorizedException('Bearer token required');return this.jwt.verify(authHeader.slice(7));}
 private clientIp(value?:string){const candidate=value?.split(',')[0]?.trim();return candidate&&isIP(candidate)?candidate:undefined;}
 @Post('login') async login(@Body() body:{email:string;password:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){const email=body?.email?.trim().toLowerCase();if(!email||typeof body?.password!=='string')throw new UnauthorizedException('Invalid credentials');let user;try{user=await this.repo.findUserByEmail(email);}catch(error){console.error('[AUTH_LOGIN_USER_LOOKUP]',error);throw new ServiceUnavailableException('Authentication database unavailable');}if(!user||!(await this.passwords.verify(body.password,user.password_hash)))throw new UnauthorizedException('Invalid credentials');if(user.mfa_enabled)return {mfaRequired:true,userId:user.id};try{return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,this.clientIp(ip),ua)};}catch(error){console.error('[AUTH_LOGIN_SESSION_CREATE]',error);throw new ServiceUnavailableException('Authentication session unavailable');}}
 @Post('refresh') async refreshToken(@Body() body:{refreshToken:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){return this.refresh.rotate(body.refreshToken,this.clientIp(ip),ua);}
 @Post('mfa/login') async mfaLogin(@Body() body:{userId:string;code:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){const user=await this.repo.findUserById(body.userId);if(!user?.mfa_enabled||!user.mfa_secret_encrypted)throw new UnauthorizedException('Invalid MFA configuration');let secret:string;try{secret=this.mfaCrypto.decrypt(user.mfa_secret_encrypted);}catch{throw new UnauthorizedException('Invalid MFA configuration');}if(!this.mfa.verifyTotp(secret,body.code))throw new UnauthorizedException('Invalid MFA code');return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,this.clientIp(ip),ua)};}
 @Post('mfa/recovery') async recovery(@Body() body:{userId:string;code:string},@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){const user=await this.repo.findUserById(body.userId);if(!user?.mfa_enabled||!await this.repo.consumeRecoveryCode(user.id,this.auth.hashRefreshToken(body.code)))throw new UnauthorizedException('Invalid recovery code');return {accessToken:this.jwt.issue(user.id,user.role),refreshToken:await this.auth.createRefreshSession(user.id,this.clientIp(ip),ua)};}
 @Post('passkey/register/options') async registerOptions(@Headers('authorization') authHeader?:string){const token=this.bearer(authHeader);return this.passkey.registrationOptions(token.sub);}
 @Post('passkey/register/verify') async registerVerify(@Headers('authorization') authHeader:string|undefined,@Body() body:any){const token=this.bearer(authHeader);return this.passkey.registrationVerify(token.sub,body);}
 @Post('passkey/login/options') async loginOptions(){return this.passkey.authenticationOptions();}
 @Post('passkey/login/verify') async loginVerify(@Body() body:any,@Headers('x-forwarded-for') ip?:string,@Headers('user-agent') ua?:string){return this.passkey.authenticationVerify(body,this.clientIp(ip),ua);}
 @Get('passkeys') async listPasskeys(@Headers('authorization') authHeader?:string){return this.passkey.list(this.bearer(authHeader).sub);}
 @Patch('passkeys/:id') async renamePasskey(@Headers('authorization') authHeader:string|undefined,@Param('id') id:string,@Body() body:{friendlyName:string}){return this.passkey.rename(this.bearer(authHeader).sub,id,body.friendlyName);}
 @Delete('passkeys/:id') async deletePasskey(@Headers('authorization') authHeader:string|undefined,@Param('id') id:string){return this.passkey.remove(this.bearer(authHeader).sub,id);}
}
