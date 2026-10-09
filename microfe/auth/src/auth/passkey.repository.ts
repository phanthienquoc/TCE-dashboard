import { Injectable } from '@nestjs/common';
import { PostgresService } from './postgres.service';

export interface PasskeyCredential {
  id: string; user_id: string; credential_id: string; public_key: string;
  counter: number; transports: string[]; friendly_name: string;
  created_at: string; last_used_at: string | null;
}
export interface PasskeyChallenge {
  id: string; user_id: string | null; challenge: string;
  purpose: 'registration' | 'authentication'; expires_at: string;
}

@Injectable()
export class PasskeyRepository {
  constructor(private readonly db: PostgresService) {}

  async createChallenge(userId: string | null, challenge: string, purpose: 'registration' | 'authentication'): Promise<void> {
    await this.db.query(
      'INSERT INTO public.auth_passkey_challenges (user_id, challenge, purpose, expires_at) VALUES ($1, $2, $3, now() + interval \'5 minutes\')',
      [userId, challenge, purpose],
    );
  }

  async consumeChallenge(challenge: string, purpose: 'registration' | 'authentication'): Promise<PasskeyChallenge | null> {
    return this.db.transaction(async client => {
      const { rows } = await client.query<PasskeyChallenge>(
        'SELECT id, user_id, challenge, purpose, expires_at FROM public.auth_passkey_challenges WHERE challenge = $1 AND purpose = $2 AND expires_at > now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
        [challenge, purpose],
      );
      const row = rows[0];
      if (!row) return null;
      const { rowCount } = await client.query(
        'DELETE FROM public.auth_passkey_challenges WHERE id = $1 AND purpose = $2',
        [row.id, purpose],
      );
      return rowCount === 1 ? row : null;
    });
  }

  async listForUser(userId: string): Promise<PasskeyCredential[]> {
    const { rows } = await this.db.query<PasskeyCredential>(
      'SELECT id, user_id, credential_id, public_key, counter, transports, friendly_name, created_at, last_used_at FROM public.auth_passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows;
  }

  async findByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
    const { rows } = await this.db.query<PasskeyCredential>(
      'SELECT id, user_id, credential_id, public_key, counter, transports, friendly_name, created_at, last_used_at FROM public.auth_passkey_credentials WHERE credential_id = $1 LIMIT 1',
      [credentialId],
    );
    return rows[0] ?? null;
  }

  async createCredential(input: Omit<PasskeyCredential, 'id'|'created_at'|'last_used_at'>): Promise<PasskeyCredential> {
    const { rows } = await this.db.query<PasskeyCredential>(
      'INSERT INTO public.auth_passkey_credentials (user_id, credential_id, public_key, counter, transports, friendly_name) VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id, user_id, credential_id, public_key, counter, transports, friendly_name, created_at, last_used_at',
      [input.user_id, input.credential_id, input.public_key, input.counter, JSON.stringify(input.transports ?? []), input.friendly_name],
    );
    return rows[0];
  }

  async updateCredential(id: string, expectedCounter: number, counter: number, transports?: string[]): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'UPDATE public.auth_passkey_credentials SET counter = $3, last_used_at = now(), transports = COALESCE($4::jsonb, transports) WHERE id = $1 AND counter = $2',
      [id, expectedCounter, counter, transports ? JSON.stringify(transports) : null],
    );
    return rowCount === 1;
  }

  async rename(userId: string, id: string, name: string): Promise<void> {
    await this.db.query('UPDATE public.auth_passkey_credentials SET friendly_name = $3 WHERE id = $1 AND user_id = $2', [id, userId, name]);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.query('DELETE FROM public.auth_passkey_credentials WHERE id = $1 AND user_id = $2', [id, userId]);
  }
}
