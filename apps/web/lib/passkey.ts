'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { authApi } from './api';

export async function signInWithPasskey() {
  const options = (await authApi.passkeyLoginOptions()).data;
  const response = await startAuthentication({ optionsJSON: options });
  return (await authApi.passkeyLoginVerify(response)).data;
}

export async function registerPasskey() {
  const options = (await authApi.passkeyRegisterOptions()).data;
  const response = await startRegistration({ optionsJSON: options });
  return (await authApi.passkeyRegisterVerify(response)).data;
}
