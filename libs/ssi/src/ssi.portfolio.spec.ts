import { strict as assert } from 'node:assert';
import test from 'node:test';
import { SsiBrokerAdapter } from './ssi.broker.adapter';

const token = {
  accessToken: 'valid-token',
  tokenType: 'Bearer',
  expiresAt: Date.now() + 3600000,
  refreshToken: 'valid-refresh',
  refreshTokenExpiresAt: Date.now() + 86400000,
};

function adapter(accountNo = '1234561') {
  return new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    clientId: 'test-client',
    accountNo,
    token,
  });
}

test('SsiBrokerAdapter returns the configured account portfolio snapshot', async () => {
  const instance = adapter();

  (instance as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).positions = async () => ({
    ok: true,
    data: [{ symbol: 'SSI', quantity: 100, averagePrice: 30000, sellableQuantity: 100, source: 'ssi' }],
  });
  (instance as unknown as { balance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }> }).balance = async acc => ({
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
  (instance as unknown as { orders: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).orders = async () => ({
    ok: true,
    data: [],
  });

  const result = await instance.accountSnapshots({});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.positions.length, 1);
    assert.equal(result.data.positions[0]?.symbol, 'SSI');
    assert.equal(result.data.balance.cash, 50000000);
    assert.equal(result.data.orders.length, 0);
  }
});

test('SsiBrokerAdapter current falls back to marginBalance when balance fails for a Margin account', async () => {
  const instance = adapter('1234566');

  (instance as unknown as { accountInfo: () => Promise<unknown[]> }).accountInfo = async () => [
    { accountNo: '1234566', accountType: 'Margin' },
  ];
  (instance as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).positions = async () => ({
    ok: true,
    data: [],
  });
  (instance as unknown as { orders: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).orders = async () => ({
    ok: true,
    data: [],
  });
  (instance as unknown as { balance: (acc: string) => Promise<{ ok: boolean; error?: { message: string } }> }).balance = async () => ({
    ok: false,
    error: { message: 'Equity balance endpoint not supported for margin' },
  });
  (instance as unknown as { marginBalance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }> }).marginBalance = async acc => ({
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

  const result = await instance.current('1234566', {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.balance.cash, 20000000);
    assert.equal(result.data.balance.totalDebt, 10000000);
  }
});

test('SsiBrokerAdapter syncPortfolio returns positions, orders, and balance', async () => {
  const instance = adapter();

  (instance as unknown as { positions: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).positions = async () => ({
    ok: true,
    data: [
      { symbol: 'HPG', quantity: 500, averagePrice: 28000, source: 'ssi' },
      { symbol: 'VNM', quantity: 0, averagePrice: 70000, source: 'ssi' },
    ],
  });
  (instance as unknown as { balance: (acc: string) => Promise<{ ok: boolean; data: Record<string, unknown> }> }).balance = async acc => ({
    ok: true,
    data: { accountNo: acc, cash: 10000000, source: 'ssi' },
  });
  (instance as unknown as { orders: (acc: string) => Promise<{ ok: boolean; data: unknown[] }> }).orders = async () => ({
    ok: true,
    data: [
      { externalId: 'ORD-101', symbol: 'HPG', side: 'BUY', quantity: 500, status: 'FF', source: 'ssi' },
      { externalId: 'ORD-102', symbol: 'SSI', side: 'SELL', quantity: 0, status: 'CL', source: 'ssi' },
    ],
  });

  const result = await instance.syncPortfolio('1234561', {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.positions.length, 2);
    assert.equal(result.data.positions[0]?.symbol, 'HPG');
    assert.equal(result.data.positions[1]?.symbol, 'VNM');
    assert.equal(result.data.orders.length, 2);
    assert.equal(result.data.orders[0]?.externalId, 'ORD-101');
    assert.equal(result.data.orders[1]?.externalId, 'ORD-102');
    assert.equal(result.data.balance.cash, 10000000);
  }
});
