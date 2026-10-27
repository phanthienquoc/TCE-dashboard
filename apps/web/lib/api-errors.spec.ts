import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { type InternalAxiosRequestConfig } from 'axios';

import { isApiRequestCancelled, normalizeApiError } from './api-errors';

test('classifies an intentional Axios cancellation as non-retryable', () => {
  const error = new axios.CanceledError();

  assert.equal(isApiRequestCancelled(error), true);
  assert.deepEqual(normalizeApiError(error), {
    kind: 'cancelled',
    message: 'Request cancelled.',
    retryable: false,
  });
});

test('normalizes timeout errors without exposing low-level details', () => {
  const error = new axios.AxiosError('socket timed out', 'ECONNABORTED');
  const failure = normalizeApiError(error);

  assert.equal(failure.kind, 'timeout');
  assert.equal(failure.retryable, true);
  assert.equal(failure.message, 'The request timed out. Please try again.');
});

test('normalizes network errors separately from HTTP errors', () => {
  const error = new axios.AxiosError('Network Error', 'ERR_NETWORK');
  const failure = normalizeApiError(error);

  assert.equal(failure.kind, 'network');
  assert.equal(failure.status, undefined);
  assert.equal(failure.retryable, true);
});

test('maps HTTP errors to safe messages instead of exposing response bodies', () => {
  const config = {
    headers: new axios.AxiosHeaders(),
  } as InternalAxiosRequestConfig;
  const response = {
    status: 403,
    statusText: 'Forbidden',
    headers: new axios.AxiosHeaders(),
    config,
    data: { message: 'internal database detail' },
  };
  const error = new axios.AxiosError(
    'Forbidden',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response
  );

  const failure = normalizeApiError(error);

  assert.equal(failure.kind, 'http');
  assert.equal(failure.status, 403);
  assert.equal(failure.retryable, false);
  assert.equal(
    failure.message,
    'You do not have permission to perform this action.'
  );
  assert.equal(failure.message.includes('internal database detail'), false);
});
