import assert from 'node:assert/strict';
import test from 'node:test';

import { telegramBotConfigAccountKey } from './telegram-bot-config-account';

test('Telegram bot configuration receives a distinct component key per account', () => {
  const oldAccountKey = telegramBotConfigAccountKey('old-account');
  const newAccountKey = telegramBotConfigAccountKey('new-account');

  assert.notEqual(oldAccountKey, newAccountKey);
  assert.notEqual(oldAccountKey, telegramBotConfigAccountKey(null));
  assert.equal(telegramBotConfigAccountKey(null), telegramBotConfigAccountKey(undefined));
});
