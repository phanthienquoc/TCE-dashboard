'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api, authApi } from './api';

export async function signInWithPasskey() {
  const options = (await authApi.passkeyLoginOptions()).data;
  const response = await startAuthentication({ optionsJSON: options });
  return (await authApi.passkeyLoginVerify(response)).data;
}

export async function registerPasskey() {
  const options = (await api.post('/auth/passkey/register/options')).data;
  const response = await startRegistration({ optionsJSON: options });
  return (await api.post('/auth/passkey/register/verify', response)).data;
}
