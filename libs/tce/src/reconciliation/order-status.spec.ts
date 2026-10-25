import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProviderOrderStatus } from './order-status';

test('maps active provider statuses to SUBMITTED', () => {
  assert.equal(mapProviderOrderStatus('NEW'), 'SUBMITTED');
  assert.equal(mapProviderOrderStatus('pending-new'), 'SUBMITTED');
  assert.equal(mapProviderOrderStatus('working'), 'SUBMITTED');
});

test('maps partial and terminal provider statuses deterministically', () => {
  assert.equal(mapProviderOrderStatus('PARTIALLY_FILLED'), 'PARTIALLY_FILLED');
  assert.equal(mapProviderOrderStatus('filled'), 'FILLED');
  assert.equal(mapProviderOrderStatus('cancelled'), 'CANCELLED');
  assert.equal(mapProviderOrderStatus('REJECTED'), 'REJECTED');
  assert.equal(mapProviderOrderStatus('expired'), 'EXPIRED');
});

test('unknown provider status fails closed to UNKNOWN', () => {
  assert.equal(mapProviderOrderStatus('BROKER_NEW_STATE'), 'UNKNOWN');
  assert.equal(mapProviderOrderStatus(''), 'UNKNOWN');
});
