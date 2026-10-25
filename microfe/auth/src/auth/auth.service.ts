import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AuthRepository, UserRow } from './auth.repository';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';

export interface SessionMaterial { token:string; csrfToken:string; }
@Injectable()
export class AuthService {
 constructor(private readonly repo:AuthRepository,private readonly passwords:PasswordService,private readonly mfa:MfaService){}
 hash(value:string):string{return createHash('sha256').update(value,'utf8').digest('hex');}
 private csrfSecret():string{const secret=process.env.JWT_SECRET;if(!secret||secret.length<32)throw new Error('JWT_SECRET_MISCONFIGURED');return secret;}
 csrfForSession(token:string):string{return createHmac('sha256',this.csrfSecret()).update('microfe-csrf:'+token).digest('base64url');}
 verifyCsrf(token:string,cookieValue:string,headerValue:string):boolean{if(!token||!cookieValue||!headerValue)return false;return this.safeEqual(headerValue,cookieValue)&&this.safeEqual(headerValue,this.csrfForSession(token));}
 private safeEqual(a:string,b:string):boolean{const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
 async signUp(email:string,password:string){const current=await this.repo.findUserByEmail(email);if(current)return null;return this.repo.createUser(email,await this.passwords.hash(password));}
 async login(email:string,password:string,ip?:string,userAgent?:string):Promise<{mfaRequired:true;challenge:string;userId:string}|{mfaRequired:false;user:UserRow;session:SessionMaterial}>{
  const user=await this.repo.findUserByEmail(email);if(!user||!(await this.passwords.verify(password,user.password_hash)))throw new UnauthorizedException({code:'AUTH_INVALID',message:'Invalid credentials'});
  if(user.mfa_enabled)return {mfaRequired:true,challenge:await this.issueMfaChallenge(user.id),userId:user.id};
  return {mfaRequired:false,user,session:await this.createSession(user.id,ip,userAgent)};
 }
 async finishMfa(challenge:string,code:string,recovery=false,ip?:string,userAgent?:string):Promise<{user:UserRow;session:SessionMaterial}>{
  const userId=this.mfa.verifyChallenge(challenge);if(!userId)throw new UnauthorizedException({code:'MFA_CHALLENGE_INVALID',message:'Invalid or expired MFA challenge'});
  const user=await this.repo.findUserById(userId);if(!user?.mfa_enabled)throw new UnauthorizedException({code:'MFA_INVALID',message:'Invalid MFA configuration'});
  if(recovery) {
   // Consume both one-time credentials in the same transaction so a failed/replayed
   // challenge cannot burn a valid recovery code.
   const accepted=await this.repo.consumeRecoveryCodeAndMfaChallenge(userId,this.hash(code),this.hash(challenge));
   if(!accepted)throw new UnauthorizedException({code:'MFA_INVALID',message:'Invalid or already-used MFA credential'});
  } else {
   let valid=false;
   if(user.mfa_secret_encrypted){try{valid=this.mfa.verifyTotp(this.decryptMfaSecret(user.mfa_secret_encrypted),code);}catch{valid=false;}}
   if(!valid)throw new UnauthorizedException({code:'MFA_INVALID',message:'Invalid MFA code'});
   if(!(await this.repo.consumeMfaChallenge(this.hash(challenge),userId)))throw new UnauthorizedException({code:'MFA_CHALLENGE_INVALID',message:'Invalid, expired, or already-used MFA challenge'});
  }
  return {user,session:await this.createSession(user.id,ip,userAgent)};
 }
 private decryptMfaSecret(payload:string):string{
  const [version,iv,tag,data]=payload.split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('Invalid encrypted MFA secret');
  const raw=process.env.MFA_ENCRYPTION_KEY;if(!raw)throw new Error('MFA_ENCRYPTION_KEY_MISSING');const key=Buffer.from(raw,'base64');if(key.length!==32)throw new Error('MFA_ENCRYPTION_KEY_INVALID');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');
 }
 async issueMfaChallenge(userId:string):Promise<string>{const token=this.mfa.generateChallenge(userId);await this.repo.createMfaChallenge(userId,this.hash(token));return token;}
 async createSession(userId:string,ip?:string,userAgent?:string):Promise<SessionMaterial>{
  const token=randomBytes(48).toString('base64url');const ttl=this.sessionTtl();
  await this.repo.createSession(userId,this.hash(token),randomUUID(),new Date(Date.now()+ttl*1000),ip,userAgent);
  return {token,csrfToken:this.csrfForSession(token)};
 }
 sessionTtl():number{const ttl=Number(process.env.AUTH_SESSION_TTL_SECONDS||2592000);if(!Number.isFinite(ttl)||ttl<60||ttl>7776000)return 2592000;return Math.floor(ttl);}
}
