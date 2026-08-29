import { strict as assert } from 'node:assert';
import test from 'node:test';
import { SsiBrokerAdapter } from './ssi.broker.adapter';

test('SsiBrokerAdapter initializes with config', () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    clientId: 'test-client',
    accountNo: '1234561',
  });
  assert.equal(adapter.provider, 'ssi');
});

test('SsiBrokerAdapter filters out derivative accounts during snapshot', async () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    clientId: 'test-client',
    token: {
      accessToken: 'valid-token',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600000,
      refreshToken: 'valid-refresh',
      refreshTokenExpiresAt: Date.now() + 86400000,
    },
  });

  // Mock internal methods
  (adapter as unknown as { accountInfo: () => Promise<unknown[]> }).accountInfo = async () => [
    { accountNo: '1234561', accountType: 'Cash' },
    { accountNo: '1234566', accountType: 'Margin' },
    { accountNo: '1234568', accountType: 'Derivative' },
  ];

  (
    adapter as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }
  ).positions = async (_acc: string) => ({
    ok: true,
    data: [
      { symbol: 'SSI', quantity: 100, averagePrice: 30000, sellableQuantity: 100, source: 'ssi' },
    ],
  });

  (
    adapter as unknown as {
      balance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
    }
  ).balance = async (acc: string) => ({
    ok: true,
    data: {
      accountNo: acc,
      cash: 50000000,
      equity: 50000000,
      withdrawable: 50000000,
      availableCash: 50000000,
      totalDebt: 0,
      source: 'ssi',
    },
  });

  const result = await adapter.accountSnapshots({});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].account.accountNo, '1234561');
    assert.equal(result.data[0].account.accountType, 'Cash');
    assert.equal(result.data[1].account.accountNo, '1234566');
    assert.equal(result.data[1].account.accountType, 'Margin');
    // Derivative account (1234568) must NOT be present
    assert.equal(
      result.data.some(s => s.account.accountNo === '1234568'),
      false
    );
  }
});

test('SsiBrokerAdapter falls back to marginBalance (PPMMR) when balance fails for Margin account', async () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    token: {
      accessToken: 'valid-token',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600000,
      refreshToken: 'valid-refresh',
      refreshTokenExpiresAt: Date.now() + 86400000,
    },
  });

  (adapter as unknown as { accountInfo: () => Promise<unknown[]> }).accountInfo = async () => [
    { accountNo: '1234566', accountType: 'Margin' },
  ];

  (
    adapter as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }
  ).positions = async () => ({
    ok: true,
    data: [],
  });

  (
    adapter as unknown as {
      balance: (acc: string) => Promise<{ ok: boolean; error?: { message: string } }>;
    }
  ).balance = async () => ({
    ok: false,
    error: { message: 'Equity balance endpoint not supported for margin' },
  });

  (
    adapter as unknown as {
      marginBalance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
    }
  ).marginBalance = async (acc: string) => ({
    ok: true,
    data: {
      accountNo: acc,
      cash: 20000000,
      equity: 30000000,
      withdrawable: 20000000,
      availableCash: 50000000,
      totalDebt: 10000000,
      source: 'ssi',
    },
  });

  const result = await adapter.accountSnapshots({});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].balance.cash, 20000000);
    assert.equal(result.data[0].balance.totalDebt, 10000000);
  }
});

test('SsiBrokerAdapter syncPortfolio returns positions, orders, and balance', async () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    accountNo: '1234561',
    token: {
      accessToken: 'valid-token',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600000,
      refreshToken: 'valid-refresh',
      refreshTokenExpiresAt: Date.now() + 86400000,
    },
  });

  (
    adapter as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }
  ).positions = async () => ({
    ok: true,
    data: [
      { symbol: 'HPG', quantity: 500, averagePrice: 28000, source: 'ssi' },
      { symbol: 'VNM', quantity: 0, averagePrice: 70000, source: 'ssi' }, // should be filtered out (>0)
    ],
  });

  (
    adapter as unknown as {
      balance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
    }
  ).balance = async (acc: string) => ({
    ok: true,
    data: { accountNo: acc, cash: 10000000, source: 'ssi' },
  });

  (
    adapter as unknown as { orders: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }
  ).orders = async () => ({
    ok: true,
    data: [
      {
        externalId: 'ORD-101',
        symbol: 'HPG',
        side: 'BUY',
        quantity: 500,
        status: 'FF',
        source: 'ssi',
      },
      {
        externalId: 'ORD-102',
        symbol: 'SSI',
        side: 'SELL',
        quantity: 0,
        status: 'CL',
        source: 'ssi',
      },
    ],
  });

  const result = await adapter.syncPortfolio('1234561', {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.positions.length, 1);
    assert.equal(result.data.positions[0].symbol, 'HPG');
    assert.equal(result.data.orders.length, 1);
    assert.equal(result.data.orders[0].externalId, 'ORD-101');
    assert.equal(result.data.balance.cash, 10000000);
  }
});
