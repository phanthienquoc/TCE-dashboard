import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiApplicationService } from './ssi.application.service';

@Injectable()
export class SsiAssetSyncService {
  constructor(
    private readonly ssi: SsiApplicationService,
    private readonly db: SupabaseClientService,
  ) {}

  async sync(userId: string, environment = 'production') {
    const { data: account, error: accountError } = await this.db.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) throw new NotFoundException('TCE account is not configured');

    const result = await this.ssi.current(userId, environment, {});
    if (!result.ok) return result;

    let accountsSynced = 0;
    let assetsSynced = 0;
    for (const remoteAccount of result.data.accounts) {
      const { data: brokerAccount, error: brokerAccountError } = await this.db.db
        .from('tce_broker_accounts')
        .upsert({
          account_id: account.id,
          provider: 'ssi',
          environment,
          external_account_no: remoteAccount.accountNo,
          account_type: remoteAccount.accountType,
          raw_account: remoteAccount,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,provider,environment,external_account_no' })
        .select('id')
        .single();
      if (brokerAccountError) throw brokerAccountError;
      accountsSynced += 1;

      if (remoteAccount.accountNo !== accountIdForSync(result.data.accounts, account, remoteAccount)) {
        // Keep every returned account registered; assets below are fetched only for the selected SSI account.
      }
    }

    const selectedAccountNo = await this.selectedAccountNo(userId, environment);
    const selected = result.data.positions.filter((position) => Number(position.quantity) > 0);
    const selectedBrokerAccount = result.data.accounts.find((item) => item.accountNo === selectedAccountNo) ?? result.data.accounts[0];
    if (!selectedBrokerAccount) return { ok: true as const, data: { accountsSynced, assetsSynced, positionsSynced: 0 } };

    const { data: brokerAccountRow, error: brokerRowError } = await this.db.db
      .from('tce_broker_accounts')
      .select('id')
      .eq('account_id', account.id)
      .eq('provider', 'ssi')
      .eq('environment', environment)
      .eq('external_account_no', selectedBrokerAccount.accountNo)
      .single();
    if (brokerRowError) throw brokerRowError;

    for (const position of selected) {
      const total = Number(position.quantity ?? 0);
      const { error } = await this.db.db.from('tce_broker_assets').upsert({
        account_id: account.id,
        broker_account_id: brokerAccountRow.id,
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
        observed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'broker_account_id,asset_code' });
      if (error) throw error;
      assetsSynced += 1;
    }

    return { ok: true as const, data: { accountsSynced, assetsSynced, selectedAccountNo: selectedBrokerAccount.accountNo } };
  }

  private async selectedAccountNo(userId: string, environment: string) {
    const { data, error } = await this.db.db
      .from('platform_credentials')
      .select('ssi_account_no')
      .eq('user_id', userId)
      .eq('provider', 'ssi')
      .eq('environment', environment)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return String(data?.ssi_account_no ?? '');
  }
}

function accountIdForSync(_accounts: Array<{ accountNo: string; accountType: string }>, _account: { id: string }, remoteAccount: { accountNo: string }) {
  return remoteAccount.accountNo;
}
