'use client';

import { api } from '../lib/api';

export async function getDashboard() {
  const { data } = await api.get('/dashboard', {
    params: { _: Date.now() },
    _toastOnError: false,
  });
  return data;
}

export async function getDashboardData() {
  const params = { _: Date.now() };

  try {
    return await getDashboard();
  } catch (aggregateError) {
    if (aggregateError.response?.status === 401) throw aggregateError;

    const entries = [
      ['account', '/dashboard/account', {}],
      ['positions', '/dashboard/positions', []],
      ['strategy', '/dashboard/strategy', null],
      ['pools', '/dashboard/pools', []],
      ['nextPositions', '/dashboard/next-positions', []],
      ['orders', '/dashboard/orders', []],
      ['sources', '/dashboard/sources', []],
    ];

    const results = await Promise.all(entries.map(async ([key, url, fallback]) => {
      try {
        const response = await api.get(url, {
          params,
          _toastOnError: false,
        });
        return [key, response.data, null];
      } catch (error) {
        return [
          key,
          fallback,
          {
            status: error.response?.status ?? 0,
            message: error.response?.data?.message || error.message || 'request failed',
          },
        ];
      }
    }));

    const result = Object.fromEntries(results.map(([key, value]) => [key, value]));
    const errors = Object.fromEntries(
      results
        .filter(([, , error]) => error)
        .map(([key, , error]) => [key, error]),
    );

    if (Object.keys(errors).length) {
      result.errors = errors;
    }

    if (!result.account || result.account === null) throw aggregateError;
    return result;
  }
}
