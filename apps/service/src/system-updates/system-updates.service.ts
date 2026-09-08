import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, createECDH } from 'node:crypto';
import { createRequire } from 'node:module';
import webpush from 'web-push';
import { SupabaseClientService } from '../db/supabase.client';

type StoredSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushSubscriptionPayload = StoredSubscription;

type ReleaseRow = {
  id: string;
  version: string;
  title: string;
  message: string;
  release_url: string | null;
  created_at: string;
};

const require = createRequire(import.meta.url);
let packageVersion: string | undefined;
try {
  packageVersion = (require('../../../../package.json') as { version?: string }).version;
} catch {
  // Release metadata is optional at runtime; do not prevent service startup when
  // the root package manifest is not present in the production image.
}

@Injectable()
export class SystemUpdatesService implements OnModuleInit {
  private readonly logger = new Logger(SystemUpdatesService.name);
  private readonly subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@tce-dashboard.local';
  private readonly version =
    process.env.TCE_RELEASE_VERSION?.trim() || packageVersion?.trim() || 'unknown';
  private readonly releaseUrl = process.env.TCE_RELEASE_URL?.trim() || null;
  private readonly vapidPrivateKey =
    process.env.VAPID_PRIVATE_KEY?.trim() || this.deriveVapidPrivateKey();
  private readonly vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() || this.deriveVapidPublicKey();

  constructor(private readonly supabase: SupabaseClientService) {
    webpush.setVapidDetails(this.subject, this.vapidPublicKey, this.vapidPrivateKey);
  }

  async onModuleInit() {
    if (!this.version || this.version === 'unknown') return;
    try {
      const created = await this.ensureRelease();
      if (created) await this.publishRelease(created);
    } catch (error) {
      this.logger.error(`System update release publish failed: ${this.errorMessage(error)}`);
    }
  }

  getConfig() {
    return { ok: true, vapidPublicKey: this.vapidPublicKey };
  }

  async getLatest(_userId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_system_updates')
      .select('id,version,title,message,release_url,created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, data: data as ReleaseRow | null };
  }

  async saveSubscription(userId: string, payload: PushSubscriptionPayload) {
    this.validateSubscription(payload);
    const subscription = {
      endpoint: payload.endpoint,
      expirationTime: payload.expirationTime ?? null,
      keys: payload.keys,
    };
    const { error } = await this.supabase.db.from('tce_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: payload.endpoint,
        subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  async removeSubscription(userId: string, endpoint?: string) {
    if (!endpoint) return { ok: true };
    const { error } = await this.supabase.db
      .from('tce_push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  private async ensureRelease(): Promise<ReleaseRow | null> {
    const row = {
      version: this.version,
      title: 'TCE Dashboard updated',
      message: `A new TCE Dashboard version ${this.version} is available.`,
      release_url: this.releaseUrl,
    };
    const { data, error } = await this.supabase.db
      .from('tce_system_updates')
      .insert(row)
      .select('id,version,title,message,release_url,created_at')
      .single();

    if (!error) return data as ReleaseRow;
    if ((error as { code?: string }).code === '23505') return null;
    throw new Error(error.message);
  }

  private async publishRelease(release: ReleaseRow) {
    const { data, error } = await this.supabase.db
      .from('tce_push_subscriptions')
      .select('id,endpoint,subscription');
    if (error) throw new Error(error.message);

    const rows = Array.isArray(data) ? data : [];
    await Promise.all(
      rows.map(async row => {
        const subscription = row.subscription as StoredSubscription;
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              type: 'SYSTEM_UPDATE',
              title: release.title,
              body: release.message,
              version: release.version,
              url: release.release_url ?? '/dashboard',
            }),
            { TTL: 3600 }
          );
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0);
          if (statusCode === 404 || statusCode === 410) {
            await this.supabase.db.from('tce_push_subscriptions').delete().eq('id', row.id);
            return;
          }
          this.logger.warn(
            `Push delivery failed for ${String(row.endpoint).slice(0, 80)}: ${this.errorMessage(error)}`
          );
        }
      })
    );
  }

  private validateSubscription(payload: PushSubscriptionPayload) {
    if (
      !payload ||
      typeof payload.endpoint !== 'string' ||
      !payload.endpoint.startsWith('https://') ||
      !payload.keys ||
      typeof payload.keys.p256dh !== 'string' ||
      typeof payload.keys.auth !== 'string'
    ) {
      throw new Error('Invalid Web Push subscription');
    }
  }

  private deriveVapidPrivateKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'CHANGE_ME_IN_ENV')
      throw new Error('JWT_SECRET is required to derive the default VAPID key');
    return createHmac('sha256', secret).update('tce-web-push-vapid-p256').digest('base64url');
  }

  private deriveVapidPublicKey() {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(this.vapidPrivateKey, 'base64url'));
    return ecdh.getPublicKey('base64url');
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
