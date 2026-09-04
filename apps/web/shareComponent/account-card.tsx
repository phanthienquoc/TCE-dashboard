'use client';

import * as React from 'react';

export function AccountCard({
  provider,
  identifier,
  status = 'Connected',
}: {
  provider: string;
  identifier: string;
  status?: string;
}) {
  return (
    <div className="shared-account-card">
      <div className="shared-account-icon">{provider.slice(0, 1).toUpperCase()}</div>
      <div className="shared-account-copy">
        <strong>{provider}</strong>
        <span>{identifier}</span>
      </div>
      <span className="shared-account-status">{status}</span>
    </div>
  );
}
