import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';

process.env.JWT_SECRET = 'test-secret-for-microfe-auth-unit-tests-at-least-32-chars';

function fakeRepo(user: any) {
 const calls: { sessions: any[]; mfaChallenges: any[]; consumedMfaChallenges: any[]; recoveryTransactions: any[] } = {
  sessions: [], mfaChallenges: [], consumedMfaChallenges: [], recoveryTransactions: [],
 };
 return { calls,
  async findUserByEmail(){return user;},
  async findUserById(){return user;},
  async createUser(email:string,password_hash:string){return {id:'user-1',email,password_hash,role:'USER',mfa_enabled:false};},
  async createSession(...args:any[]){calls.sessions.push(args);},
  async createMfaChallenge(...args:any[]){calls.mfaChallenges.push(args);},
  async consumeMfaChallenge(...args:any[]){calls.consumedMfaChallenges.push(args);return true;},
  async consumeRecoveryCode(){return true;},
  async consumeRecoveryCodeAndMfaChallenge(...args:any[]){calls.recoveryTransactions.push(args);return true;},
 } as any;
}

test('login creates a hashed opaque session for a non-MFA user',async()=>{
 const password=new PasswordService();const hash=await password.hash('long-test-password');
 const user={id:'user-1',email:'a@example.com',password_hash:hash,role:'USER',mfa_enabled:false,mfa_secret_encrypted:null};
 const repo=fakeRepo(user);const auth=new AuthService(repo,password,new MfaService());
 const result=await auth.login(user.email,'long-test-password','127.0.0.1','unit-test');
 assert.equal(result.mfaRequired,false);
 if(result.mfaRequired) throw new Error('unexpected MFA challenge');
 assert.ok(result.session.token.length>40);
 assert.equal(repo.calls.sessions.length,1);
 assert.equal(repo.calls.sessions[0][1],auth.hash(result.session.token));
 assert.equal(auth.verifyCsrf(result.session.token,result.session.csrfToken,result.session.csrfToken),true);
 assert.equal(auth.verifyCsrf(result.session.token,'wrong',result.session.csrfToken),false);
});

test('MFA-enabled login persists a hashed, time-limited challenge without creating a session',async()=>{
 const passwords=new PasswordService();
 const user={id:'user-mfa',email:'mfa@example.com',password_hash:await passwords.hash('anything'),role:'USER',mfa_enabled:true,mfa_secret_encrypted:null};
 const repo=fakeRepo(user);const mfa=new MfaService();const auth=new AuthService(repo,passwords,mfa);
 const result=await auth.login(user.email,'anything');
 assert.equal(result.mfaRequired,true);
 if(!result.mfaRequired) throw new Error('expected MFA challenge');
 assert.equal(mfa.verifyChallenge(result.challenge),user.id);
 assert.equal(repo.calls.mfaChallenges.length,1);
 assert.equal(repo.calls.mfaChallenges[0][0],user.id);
 assert.equal(repo.calls.mfaChallenges[0][1],auth.hash(result.challenge));
 assert.equal(repo.calls.sessions.length,0);
});

test('MFA completion consumes the challenge hash before issuing a session',async()=>{
 const passwords=new PasswordService();
 const user={id:'user-mfa',email:'mfa@example.com',password_hash:await passwords.hash('anything'),role:'USER',mfa_enabled:true,mfa_secret_encrypted:null};
 const repo=fakeRepo(user);const mfa=new MfaService();const auth=new AuthService(repo,passwords,mfa);
 const challenge=await auth.issueMfaChallenge(user.id);
 const result=await auth.finishMfa(challenge,'000000',true,'127.0.0.1','unit-test');
 assert.equal(repo.calls.recoveryTransactions.length,1);
 assert.equal(repo.calls.recoveryTransactions[0][0],user.id);
 assert.equal(repo.calls.recoveryTransactions[0][1],auth.hash('000000'));
 assert.equal(repo.calls.recoveryTransactions[0][2],auth.hash(challenge));
 assert.equal(repo.calls.consumedMfaChallenges.length,0);
 assert.equal(repo.calls.sessions.length,1);
 assert.equal(result.user.id,user.id);
});
