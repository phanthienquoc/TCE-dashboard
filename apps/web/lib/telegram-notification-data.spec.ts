import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { platformApi } from './api';
import { loadTelegramBots, loadTelegramNotificationData } from './telegram-notification-data';

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

test('notification data reads forward the same AbortSignal and normalize both responses', async () => {
  const originalBots = platformApi.telegramBots;
  const originalAssignments = platformApi.telegramDebugAssignments;
  const signals: Array<AbortSignal | undefined> = [];
  const bot = { id: 'bot-1', name: 'alerts', environment: 'testnet', isActive: true };
  const assignment = {
    id: 'assignment-1',
    telegram_credential_id: 'bot-1',
    service_name: 'tce-engine',
    min_level: 'INFO',
    enabled: true,
  };

  platformApi.telegramBots = ((signal?: AbortSignal) => {
    signals.push(signal);
    return Promise.resolve(response({ bots: [bot] }));
  }) as typeof platformApi.telegramBots;
  platformApi.telegramDebugAssignments = ((signal?: AbortSignal) => {
    signals.push(signal);
    return Promise.resolve(response({ assignments: [assignment] }));
  }) as typeof platformApi.telegramDebugAssignments;

  try {
    const controller = new AbortController();
    const result = await loadTelegramNotificationData(controller.signal);

    assert.deepEqual(result, { bots: [bot], assignments: [assignment] });
    assert.equal(signals.length, 2);
    assert.ok(signals.every(signal => signal === controller.signal));
  } finally {
    platformApi.telegramBots = originalBots;
    platformApi.telegramDebugAssignments = originalAssignments;
  }
});

test('single bot read forwards its signal and accepts a bare array response', async () => {
  const originalBots = platformApi.telegramBots;
  let receivedSignal: AbortSignal | undefined;
  const bot = { id: 'bot-2', name: 'alerts-2', environment: 'production', isActive: false };

  platformApi.telegramBots = ((signal?: AbortSignal) => {
    receivedSignal = signal;
    return Promise.resolve(response([bot]));
  }) as typeof platformApi.telegramBots;

  try {
    const controller = new AbortController();
    assert.deepEqual(await loadTelegramBots(controller.signal), [bot]);
    assert.equal(receivedSignal, controller.signal);
  } finally {
    platformApi.telegramBots = originalBots;
  }
});
