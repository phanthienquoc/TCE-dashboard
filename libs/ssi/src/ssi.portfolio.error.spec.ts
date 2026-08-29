import { strict as assert } from 'node:assert';
import test from 'node:test';
import { SsiBrokerAdapter } from './ssi.broker.adapter';

test('SsiBrokerAdapter rejects portfolio positions when clientId is missing', async () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
  });

  const result = await adapter.positions('1234561');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error.message, /SSI_CLIENT_ID_REQUIRED_FOR_PORTFOLIO/);
  }
});

test('SsiBrokerAdapter preserves SSI HTTP status and response details', async () => {
  const adapter = new SsiBrokerAdapter({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    clientId: 'test-client',
  });

  const mockPortfolio = {
    getEquityPositions: async () => {
      throw Object.assign(new Error('API error'), {
        statusCode: 400,
        code: 'Q906031',
        responseBody: { message: 'invalid portfolio request' },
      });
    },
  };

  (adapter as unknown as { auth: object }).auth = {};
  (adapter as unknown as { tradingClient: object }).tradingClient = {
    portfolio: mockPortfolio,
  };

  const result = await adapter.positions('1234561');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error.message, /HTTP 400/);
    assert.match(result.error.message, /Q906031/);
    assert.match(result.error.message, /invalid portfolio request/);
  }
});
