import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { normalizeSystemUpdatePushFailure } from './system-update-push-errors';

test('system update push failures expose only safe allow-listed metadata', () => {
  const config = {
    headers: new AxiosHeaders({ Authorization: 'Bearer synthetic-system-update-token' }),
  } as InternalAxiosRequestConfig;
  const response: AxiosResponse<unknown> = {
    data: { message: 'private push subscription backend detail' },
    status: 500,
    statusText: 'Internal Server Error',
    headers: new AxiosHeaders(),
    config,
  };
  const failure = normalizeSystemUpdatePushFailure(
    new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config, undefined, response)
  );
  const serialized = JSON.stringify(failure);

  assert.deepEqual(failure, {
    kind: 'http',
    message: 'The service is temporarily unavailable. Please try again.',
    retryable: true,
    status: 500,
  });
  assert.equal(serialized.includes('synthetic-system-update-token'), false);
  assert.equal(serialized.includes('private push subscription backend detail'), false);
  assert.equal(serialized.includes('ERR_BAD_RESPONSE'), false);
});

test('browser and permission failures use a safe fallback message', () => {
  const failure = normalizeSystemUpdatePushFailure(
    new Error('private browser permission or platform details')
  );

  assert.deepEqual(failure, {
    kind: 'unknown',
    message: 'Unable to enable system update notifications.',
    retryable: false,
  });
  assert.equal(JSON.stringify(failure).includes('private browser permission'), false);
});
