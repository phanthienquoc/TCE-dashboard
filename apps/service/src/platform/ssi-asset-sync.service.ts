import { Injectable, NotFoundException } from '@nestjs/common';
import { SsiApplicationService } from './ssi.application.service';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiAuthInput } from '@tce/contracts';

@Injectable()
export class SsiAssetSyncService {
  constructor(
    private readonly ssi: SsiApplicationService,
    private readonly db: SupabaseClientService,
  ) {}

  async sync(userId: string, environment = 'production', input: SsiAuthInput = {}) {
    const { data: account, error } = await this.db.db
      .from('tce_accounts')
      .select('id,user_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!account) throw new NotFoundException('TCE account is not configured');

    // Canonical SSI portfolio sync: discover every SSI sub-account, persist its
    // broker assets, then consolidate all current securities into tce_positions.
    // Cash itself is kept in tce_accounts.capital_available and is never turned
    // into a stock position.
    const snapshots = await this.ssi.accountSnapshots(userId, environment, input);
    if (!snapshots.ok) return snapshots;

    let accountsSynced = 0;
    let assetsSynced = 0;
    let assetsZeroed = 0;
    let positionsSynced = 0;
    let positionsClosed = 0;
    let cashSynced = 0;
    const syncedAt = new Date().toISOString();
    const aggregate = new Map<string, { quantity: number; costValue: number }>();

    for (const snapshot of snapshots.data) {
      const { data: brokerAccount, error: brokerError } = await this.db.db
        .from('tce_broker_accounts')
        .upsert(
          {
            account_id: account.id,
            provider: 'ssi',
            environment,
            external_account_no: snapshot.account.accountNo,
            account_type: snapshot.account.accountType,
            raw_account: snapshot.account,
            last_synced_at: syncedAt,
            updated_at: syncedAt,
          },
          { onConflict: 'account_id,provider,environment,external_account_no' },
        )
        .select('id')
        .single();

      if (brokerError) throw brokerError;
      accountsSynced += 1;
      cashSynced += Number(snapshot.balance.cash ?? 0);

      // getEquityPositions() is the SSI source of truth for securities held by
      // this specific account. This includes holdings in the Cash sub-account.
      const positions = new Map<string, { symbol: string; quantity: number; averagePrice: number; raw: unknown }>();
      for (const position of snapshot.positions) {
        const symbol = String(position.symbol ?? '').trim().toUpperCase();
        if (!symbol) continue;

        const quantity = Math.max(0, Number(position.quantity ?? 0));
        const averagePrice = Math.max(0, Number(position.averagePrice ?? 0));
        positions.set(symbol, { symbol, quantity, averagePrice, raw: position });

        // Only securities with a positive quantity become TCE positions.
        if (quantity > 0) {
          const current = aggregate.get(symbol) ?? { quantity: 0, costValue: 0 };
          current.quantity += quantity;
          current.costValue += quantity * averagePrice;
          aggregate.set(symbol, current);
        }
      }

      // Persist every SSI security row per broker account for audit/source data.
      for (const position of positions.values()) {
        const { error: assetError } = await this.db.db.from('tce_broker_assets').upsert(
          {
            account_id: account.id,
            broker_account_id: brokerAccount.id,
            provider: 'ssi',
            environment,
            asset_code: position.symbol,
            asset_name: position.symbol,
            available: position.quantity,
            locked: 0,
            total: position.quantity,
            market_value: null,
            currency: 'VND',
            raw_asset: position.raw,
            observed_at: syncedAt,
            updated_at: syncedAt,
          },
          { onConflict: 'broker_account_id,asset_code' },
        );

        if (assetError) throw assetError;
        assetsSynced += 1;
      }

      // A security that disappears from the latest SSI position response is no
      // longer held. Keep its row for history, but zero its current quantity.
      const { data: existingAssets, error: existingError } = await this.db.db
        .from('tce_broker_assets')
        .select('id,asset_code,total')
        .eq('broker_account_id', brokerAccount.id);

      if (existingError) throw existingError;
      const currentSymbols = new Set(positions.keys());
      const staleIds = (existingAssets ?? [])
        .filter((existing) => {
          const code = String(existing.asset_code ?? '').trim().toUpperCase();
          return code && !currentSymbols.has(code) && Number(existing.total ?? 0) !== 0;
        })
        .map((existing) => existing.id);

      if (staleIds.length) {
        const { error: zeroError } = await this.db.db
          .from('tce_broker_assets')
          .update({ available: 0, locked: 0, total: 0, market_value: null, observed_at: syncedAt, updated_at: syncedAt })
          .in('id', staleIds);
        if (zeroError) throw zeroError;
        assetsZeroed += staleIds.length;
      }
    }

    // Consolidate Cash + Margin (and any other SSI sub-account) holdings into
    // one TCE position per symbol. The same symbol is weighted by quantity.
    for (const [symbol, position] of aggregate) {
      const averagePrice = position.quantity > 0 ? position.costValue / position.quantity : 0;
      const { error: positionError } = await this.db.db
        .from('tce_positions')
        .upsert(
          {
            account_id: account.id,
            user_id: account.user_id,
            symbol,
            quantity: Math.round(position.quantity),
            avg_cost: averagePrice,
            cost_basis: position.quantity * averagePrice,
            market_price: null,
            market_value: null,
            unrealized_pnl: null,
            status: 'OPEN',
            updated_at: syncedAt,
          },
          { onConflict: 'account_id,symbol' },
        );

      if (positionError) throw positionError;
      positionsSynced += 1;
    }

    // Any previously open TCE position absent from ALL fresh SSI sub-account
    // holdings is closed. This prevents stale Cash/Margin positions lingering.
    const { data: existingPositions, error: existingPositionsError } = await this.db.db
      .from('tce_positions')
      .select('id,symbol,quantity,status')
      .eq('account_id', account.id)
      .eq('status', 'OPEN');

    if (existingPositionsError) throw existingPositionsError;
    const currentPositionSymbols = new Set(aggregate.keys());
    const stalePositionIds = (existingPositions ?? [])
      .filter((existing) => {
        const symbol = String(existing.symbol ?? '').trim().toUpperCase();
        return symbol && !currentPositionSymbols.has(symbol);
      })
      .map((existing) => existing.id);

    if (stalePositionIds.length) {
      const { error: closeError } = await this.db.db
        .from('tce_positions')
        .update({ quantity: 0, cost_basis: 0, market_price: null, market_value: null, unrealized_pnl: null, status: 'CLOSED', updated_at: syncedAt })
        .in('id', stalePositionIds);
      if (closeError) throw closeError;
      positionsClosed += stalePositionIds.length;
    }

    const { error: accountUpdateError } = await this.db.db
      .from('tce_accounts')
      .update({ capital_available: cashSynced, updated_at: syncedAt })
      .eq('id', account.id);
    if (accountUpdateError) throw accountUpdateError;

    return {
      ok: true as const,
      data: {
        accountsSynced,
        assetsSynced,
        assetsZeroed,
        positionsSynced,
        positionsClosed,
        cashSynced,
        fetchedAt: syncedAt,
      },
    };
  }
}
