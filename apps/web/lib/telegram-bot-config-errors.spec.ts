import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { type InternalAxiosRequestConfig } from 'axios';

import { normalizeTelegramBotConfigError } from './telegram-bot-config-errors';

test('uses an operation-specific safe fallback for generic Telegram config failures', () => {
  const error = new Error('internal database path and credential details');

  assert.equal(
    normalizeTelegramBotConfigError(error, 'load'),
    'Unable to load Telegram bot configuration.'
  );
  assert.equal(normalizeTelegramBotConfigError(error, 'save'), 'Unable to save Telegram bot.');
  assert.equal(
    normalizeTelegramBotConfigError(error, 'pause'),
    'Unable to change Telegram state.'
  );
  assert.equal(normalizeTelegramBotConfigError(error, 'remove'), 'Unable to disconnect bot.');
  assert.equal(
    normalizeTelegramBotConfigError(error, 'assign'),
    'Unable to assign debug routing.'
  );
  assert.equal(
    normalizeTelegramBotConfigError(error, 'unassign'),
    'Unable to remove debug routing.'
  );
});

test('normalizes HTTP errors without exposing the backend response body', () => {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = {
    status: 500,
    statusText: 'Internal Server Error',
    headers: new axios.AxiosHeaders(),
    config,
    data: { message: 'sensitive database constraint and token details' },
  };
  const error = new axios.AxiosError('Internal Server Error', 'ERR_BAD_RESPONSE', config, undefined, response);
  const message = normalizeTelegramBotConfigError(error, 'save');

  assert.equal(message, 'The service is temporarily unavailable. Please try again.');
  assert.equal(message.includes('sensitive database constraint'), false);
});
