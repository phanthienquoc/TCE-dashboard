import assert from 'node:assert/strict';
import test from 'node:test';

import { telegramNotificationAccountKey } from './telegram-notification-account';

test('notification page subtree key changes when authenticated account changes', () => {
  const firstAccountKey = telegramNotificationAccountKey('account-a');
  const secondAccountKey = telegramNotificationAccountKey('account-b');

  assert.notEqual(firstAccountKey, secondAccountKey);
  assert.notEqual(firstAccountKey, telegramNotificationAccountKey(null));
  assert.equal(telegramNotificationAccountKey(null), telegramNotificationAccountKey(undefined));
});
