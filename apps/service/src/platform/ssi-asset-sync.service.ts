import { Injectable, NotFoundException } from '@nestjs/common';
import { SsiApplicationService } from './ssi.application.service';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiAuthInput } from '@tce/contracts';

@Injectable()
export class SsiAssetSyncService {
  constructor(private readonly ssi: SsiApplicationService, private readonly db: SupabaseClientService) {}

  async sync(userId: string, environment = 'production', input: SsiAuthInput = {}) {
    const { data: account, error } = await this.db.db.from('tce_accounts').select('id').eq('user_id', userId).limit(1).maybeSingle();
    if (error) throw error;
    if (!account) throw new NotFoundException('TCE account is not configured');

    const snapshots = await this.ssi.accountSnapshots(userId, environment, input);
    if (!snapshots.ok) return snapshots;

    let accountsSynced = 0;
    let assetsSynced = 0;
    const syncedAt = new Date().toISOString();

    for (const snapshot of snapshots.data) {
      const { data: brokerAccount, error: brokerError } = await this.db.db.from('tce_broker_accounts').upsert({
        account_id: account.id,
        provider: 'ssi',
        environment,
        external_account_no: snapshot.account.accountNo,
        account_type: snapshot.account.accountType,
        raw_account: snapshot.account,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      }, { onConflict: 'account_id,provider,environment,external_account_no' }).select('id').single();
      if (brokerError) throw brokerError;
      accountsSynced += 1;

      const assets = snapshot.positions.filter((position) => Number(position.quantity) > 0);
      for (const position of assets) {
        const total = Number(position.quantity ?? 0);
        const { error: assetError } = await this.db.db.from('tce_broker_assets').upsert({
          account_id: account.id,
          broker_account_id: brokerAccount.id,
          provider: 'ssi',
          environment,
          asset_code: String(position.symbol).toUpperCase(),
          asset_name: String(position.symbol).toUpperCase(),
          available: total,
          locked: 0,
          total,
          market_value: null,
          currency: 'VND',
          raw_asset: position,
          observed_at: syncedAt,
          updated_at: syncedAt,
        }, { onConflict: 'broker_account_id,asset_code' });
        if (assetError) throw assetError;
        assetsSynced += 1;
      }
    }

    return { ok: true as const, data: { accountsSynced, assetsSynced, fetchedAt: syncedAt } };
  }
}
