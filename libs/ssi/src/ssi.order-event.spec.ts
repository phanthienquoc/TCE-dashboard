import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isSsiFillStatus, toAccountOrder } from './ssi.order-event';

test('recognizes SSI fill statuses', () => {
  assert.equal(isSsiFillStatus('FF'), true);
  assert.equal(isSsiFillStatus('PF'), true);
  assert.equal(isSsiFillStatus('FFPC'), true);
  assert.equal(isSsiFillStatus('CL'), false);
});

test('maps SSI order events to persisted account orders', () => {
  const order = toAccountOrder(
    {
      type: 'orderEvent',
      orderId: 'ORD-1',
      symbol: 'ssi',
      side: 'B',
      quantity: 300,
      filledQuantity: 100,
      price: 32.5,
      status: 'PF',
      inputTime: '2026-08-25T09:00:00Z',
    },
    'user-1'
  );
  assert.deepEqual(order, {
    externalId: 'ORD-1',
    symbol: 'SSI',
    side: 'BUY',
    quantity: 100,
    price: 32.5,
    status: 'PF',
    createdAt: '2026-08-25T09:00:00Z',
    source: 'ssi',
    accountId: 'user-1',
  });
});

test('ignores incomplete SSI order events', () => {
  assert.equal(toAccountOrder({ type: 'orderEvent', status: 'FF' }, 'user-1'), null);
});
