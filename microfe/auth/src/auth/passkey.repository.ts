import { Injectable } from '@nestjs/common';
import { PostgresService } from './postgres.service';

export interface PasskeyCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
  friendly_name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface PasskeyChallenge {
  id: string;
  user_id: string | null;
  challenge: string;
  purpose: 'registration' | 'authentication';
  expires_at: string;
}

@Injectable()
export class PasskeyRepository {
  constructor(private readonly postgres: PostgresService) {}

  async createChallenge(
    userId: string | null,
    challenge: string,
    purpose: 'registration' | 'authentication',
  ): Promise<void> {
    await this.postgres.query(
      `INSERT INTO public.auth_passkey_challenges (user_id, challenge, purpose, expires_at)
       VALUES ($1, $2, $3, now() + interval '5 minutes')`,
      [userId, challenge, purpose],
    );
  }

  async consumeChallenge(
    challenge: string,
    purpose: 'registration' | 'authentication',
  ): Promise<PasskeyChallenge | null> {
    const result = await this.postgres.query<PasskeyChallenge>(
      `WITH candidate AS (
         SELECT id
         FROM public.auth_passkey_challenges
         WHERE challenge = $1 AND purpose = $2 AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_passkey_challenges AS challenges
       USING candidate
       WHERE challenges.id = candidate.id
       RETURNING challenges.id, challenges.user_id, challenges.challenge,
                 challenges.purpose, challenges.expires_at`,
      [challenge, purpose],
    );
    return result.rows[0] ?? null;
  }

  async listForUser(userId: string): Promise<PasskeyCredential[]> {
    const result = await this.postgres.query<PasskeyCredential>(
      `SELECT id, user_id, credential_id, public_key, counter,
              transports, friendly_name, created_at, last_used_at
       FROM public.auth_passkey_credentials
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async findByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
    const result = await this.postgres.query<PasskeyCredential>(
      `SELECT id, user_id, credential_id, public_key, counter,
              transports, friendly_name, created_at, last_used_at
       FROM public.auth_passkey_credentials
       WHERE credential_id = $1
       LIMIT 1`,
      [credentialId],
    );
    return result.rows[0] ?? null;
  }

  async createCredential(
    input: Pick<PasskeyCredential, 'user_id' | 'credential_id' | 'public_key' | 'counter' | 'transports' | 'friendly_name'>,
  ): Promise<PasskeyCredential> {
    const result = await this.postgres.query<PasskeyCredential>(
      `INSERT INTO public.auth_passkey_credentials
         (user_id, credential_id, public_key, counter, transports, friendly_name)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, user_id, credential_id, public_key, counter,
                 transports, friendly_name, created_at, last_used_at`,
      [
        input.user_id,
        input.credential_id,
        input.public_key,
        input.counter,
        JSON.stringify(input.transports ?? []),
        input.friendly_name,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('PASSKEY_INSERT_RETURNED_NO_ROW');
    return row;
  }

  async updateCredential(id: string, counter: number, transports?: string[]): Promise<void> {
    await this.postgres.query(
      `UPDATE public.auth_passkey_credentials
       SET counter = GREATEST(counter, $2),
           last_used_at = now(),
           transports = COALESCE($3::jsonb, transports)
       WHERE id = $1`,
      [id, counter, transports === undefined ? null : JSON.stringify(transports)],
    );
  }

  async rename(userId: string, id: string, name: string): Promise<void> {
    await this.postgres.query(
      `UPDATE public.auth_passkey_credentials
       SET friendly_name = $3
       WHERE id = $1 AND user_id = $2`,
      [id, userId, name],
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.postgres.query(
      `DELETE FROM public.auth_passkey_credentials
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }
}
