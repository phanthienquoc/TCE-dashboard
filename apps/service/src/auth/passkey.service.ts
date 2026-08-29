import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { AuthRepository } from './auth.repository';
import { JwtService } from './jwt.service';
import { AuthService } from './auth.service';
import { PasskeyRepository } from './passkey.repository';

const rpName = () => process.env.PASSKEY_RP_NAME || 'TCE Treasury Cash Extraction';
const rpID = () => process.env.PASSKEY_RP_ID || 'localhost';
const origin = () => process.env.PASSKEY_ORIGIN || 'http://localhost:5173';

@Injectable()
export class PasskeyService {
  constructor(
    private readonly passkeys: PasskeyRepository,
    private readonly users: AuthRepository,
    private readonly jwt: JwtService,
    private readonly auth: AuthService
  ) {}
  private requireConfig() {
    if (!rpID() || !origin()) throw new BadRequestException('Passkey is not configured');
  }
  async registrationOptions(userId: string) {
    this.requireConfig();
    const user = await this.users.findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const existing = await this.passkeys.listForUser(userId);
    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpID(),
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials: existing.map(c => ({
        id: c.credential_id,
        transports: c.transports as any,
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    await this.passkeys.createChallenge(userId, options.challenge, 'registration');
    return options;
  }
  async registrationVerify(userId: string, response: any) {
    this.requireConfig();
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
    ) as { challenge: string };
    const record = await this.passkeys.consumeChallenge(clientData.challenge, 'registration');
    if (!record || record.user_id !== userId)
      throw new UnauthorizedException('Invalid or expired passkey challenge');
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: clientData.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo)
      throw new UnauthorizedException('Passkey registration failed');
    const credential = verification.registrationInfo.credential;
    return this.passkeys.createCredential({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (credential.transports ?? response.response.transports ?? []) as string[],
      friendly_name: 'Passkey',
    });
  }
  async authenticationOptions() {
    this.requireConfig();
    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      userVerification: 'required',
      allowCredentials: [],
    });
    await this.passkeys.createChallenge(null, options.challenge, 'authentication');
    return options;
  }
  async authenticationVerify(response: any, ip?: string, ua?: string) {
    this.requireConfig();
    const credentialId = response.id || response.rawId;
    const credential = await this.passkeys.findByCredentialId(credentialId);
    if (!credential) throw new UnauthorizedException('Passkey not registered');
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
    ) as { challenge: string };
    const challenge = await this.passkeys.consumeChallenge(clientData.challenge, 'authentication');
    if (!challenge) throw new UnauthorizedException('Invalid or expired passkey challenge');
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: clientData.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, 'base64url'),
        counter: credential.counter,
        transports: credential.transports as any,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new UnauthorizedException('Passkey authentication failed');
    await this.passkeys.updateCredential(
      credential.id,
      verification.authenticationInfo.newCounter,
      response.response.transports
    );
    const user = await this.users.findUserById(credential.user_id);
    if (!user) throw new UnauthorizedException();
    if (user.mfa_enabled) return { mfaRequired: true, userId: user.id };
    return {
      accessToken: this.jwt.issue(user.id, user.role),
      refreshToken: await this.auth.createRefreshSession(user.id, ip, ua),
    };
  }
  async list(userId: string) {
    return this.passkeys.listForUser(userId);
  }
  async rename(userId: string, id: string, name: string) {
    return this.passkeys.rename(userId, id, name.trim().slice(0, 80));
  }
  async remove(userId: string, id: string) {
    return this.passkeys.remove(userId, id);
  }
}
