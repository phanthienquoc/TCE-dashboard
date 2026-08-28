import { Injectable, NotFoundException } from '@nestjs/common';
import { SsiApplicationService } from './ssi.application.service';
import { SupabaseClientService } from '../db/supabase.client';
import { AccountPosition, SsiAuthInput } from '@tce/contracts';

const SSI_SOURCE_VERSION = 'ssi-sdk@3.2.1';

@Injectable()
export class SsiAssetSyncService {
  constructor(private readonly ssi: SsiApplicationService, private readonly db: SupabaseClientService) {}

  async sync(userId: string, environment = 'production', input: SsiAuthInput = {}) {
    const { data: account, error } = await this.db.db.from('tce_accounts').select('id,user_id').eq('user_id', userId).limit(1).maybeSingle();
    if (error) throw error;
    if (!account) throw new NotFoundException('TCE account is not configured');

    const snapshots = await this.ssi.accountSnapshots(userId, environment, input);
    if (!snapshots.ok) return snapshots;

    let accountsSynced = 0, assetsSynced = 0, assetsZeroed = 0, positionsSynced = 0, positionsClosed = 0, cashSynced = 0;
    const syncedAt = new Date().toISOString();
    const aggregate = new Map<string, { quantity: number; costValue: number }>();

    for (const snapshot of snapshots.data) {
      const accountType = String(snapshot.account.accountType ?? '');
      const accountTypeUpper = accountType.trim().toUpperCase();
      const { data: brokerAccount, error: brokerError } = await this.db.db.from('tce_broker_accounts').upsert({
        account_id: account.id,
        provider: 'ssi',
        environment,
        external_account_no: snapshot.account.accountNo,
        account_type: accountType,
        account_name: snapshot.account.accountNo,
        account_status: 'ACTIVE',
        account_currency: 'VND',
        account_sub_type: accountType,
        is_tradable: true,
        is_margin_enabled: accountTypeUpper === 'MARGIN' || accountTypeUpper === 'EQUITY_MARGIN',
        source_version: SSI_SOURCE_VERSION,
        raw_account: snapshot.account,
        raw_account_v2: snapshot.account.raw ?? snapshot.account,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      }, { onConflict: 'account_id,provider,environment,external_account_no' }).select('id').single();
      if (brokerError) throw brokerError;
      accountsSynced += 1;
      cashSynced += Number(snapshot.balance.cash ?? 0);

      const positions = new Map<string, AccountPosition>();
      for (const position of snapshot.positions) {
        const symbol = String(position.symbol ?? '').trim().toUpperCase();
        if (!symbol) continue;
        const normalized = { ...position, symbol, quantity: Math.max(0, Number(position.quantity ?? 0)), averagePrice: Math.max(0, Number(position.averagePrice ?? 0)) };
        positions.set(symbol, normalized);
        if (normalized.quantity > 0) {
          const current = aggregate.get(symbol) ?? { quantity: 0, costValue: 0 };
          current.quantity += normalized.quantity;
          current.costValue += normalized.quantity * normalized.averagePrice;
          aggregate.set(symbol, current);
        }
      }

      for (const position of positions.values()) {
        const rawAsset = position.raw ?? position;
        const { error: assetError } = await this.db.db.from('tce_broker_assets').upsert({
          account_id: account.id,
          broker_account_id: brokerAccount.id,
          provider: 'ssi',
          environment,
          asset_code: position.symbol,
          asset_name: position.symbol,
          available: position.quantity,
          locked: Math.max(0, Number(position.blockQuantity ?? 0)),
          total: position.quantity,
          market_value: position.marketValue ?? null,
          currency: 'VND',
          asset_type: 'EQUITY',
          sub_type: accountType,
          tradable_quantity: position.sellableQuantity ?? null,
          pending_quantity: Math.max(0, Number(position.buyingQuantity ?? 0)) + Math.max(0, Number(position.sellingQuantity ?? 0)),
          t_plus_quantity: Math.max(0, Number(position.t1SellQuantity ?? 0)) + Math.max(0, Number(position.t2SellQuantity ?? 0)),
          average_cost: position.averagePrice,
          last_price: position.marketPrice ?? null,
          valuation_currency: 'VND',
          market_value_source: position.marketValue != null ? 'provider' : null,
          source_version: SSI_SOURCE_VERSION,
          raw_asset: rawAsset,
          raw_asset_v2: rawAsset,
          observed_at: syncedAt,
          updated_at: syncedAt,
        }, { onConflict: 'broker_account_id,asset_code' });
        if (assetError) throw assetError;
        assetsSynced += 1;
      }

      const { data: existingAssets, error: existingError } = await this.db.db.from('tce_broker_assets').select('id,asset_code,total').eq('broker_account_id', brokerAccount.id);
      if (existingError) throw existingError;
      const currentSymbols = new Set(positions.keys());
      const staleIds = (existingAssets ?? []).filter((existing) => { const code = String(existing.asset_code ?? '').trim().toUpperCase(); return code && !currentSymbols.has(code) && Number(existing.total ?? 0) !== 0; }).map((existing) => existing.id);
      if (staleIds.length) {
        const { error: zeroError } = await this.db.db.from('tce_broker_assets').update({ available: 0, locked: 0, total: 0, market_value: null, observed_at: syncedAt, updated_at: syncedAt }).in('id', staleIds);
        if (zeroError) throw zeroError;
        assetsZeroed += staleIds.length;
      }
    }

    for (const [symbol, position] of aggregate) {
      const averagePrice = position.quantity > 0 ? position.costValue / position.quantity : 0;
      const { error: positionError } = await this.db.db.from('tce_positions').upsert({ account_id: account.id, user_id: account.user_id, symbol, quantity: Math.round(position.quantity), avg_cost: averagePrice, cost_basis: position.quantity * averagePrice, market_price: null, market_value: null, unrealized_pnl: null, status: 'OPEN', updated_at: syncedAt }, { onConflict: 'account_id,symbol' });
      if (positionError) throw positionError;
      positionsSynced += 1;
    }

    const { data: existingPositions, error: existingPositionsError } = await this.db.db.from('tce_positions').select('id,symbol,quantity,status').eq('account_id', account.id).eq('status', 'OPEN');
    if (existingPositionsError) throw existingPositionsError;
    const currentPositionSymbols = new Set(aggregate.keys());
    const stalePositionIds = (existingPositions ?? []).filter((existing) => { const symbol = String(existing.symbol ?? '').trim().toUpperCase(); return symbol && !currentPositionSymbols.has(symbol); }).map((existing) => existing.id);
    if (stalePositionIds.length) {
      const { error: closeError } = await this.db.db.from('tce_positions').update({ quantity: 0, cost_basis: 0, market_price: null, market_value: null, unrealized_pnl: null, status: 'CLOSED', updated_at: syncedAt }).in('id', stalePositionIds);
      if (closeError) throw closeError;
      positionsClosed += stalePositionIds.length;
    }

    const { error: accountUpdateError } = await this.db.db.from('tce_accounts').update({ capital_available: cashSynced, updated_at: syncedAt }).eq('id', account.id);
    if (accountUpdateError) throw accountUpdateError;
    return { ok: true as const, data: { accountsSynced, assetsSynced, assetsZeroed, positionsSynced, positionsClosed, cashSynced, fetchedAt: syncedAt } };
  }
}