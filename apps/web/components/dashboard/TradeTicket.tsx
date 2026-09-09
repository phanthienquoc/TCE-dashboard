'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { TradePayload } from './DashboardShell';

type TradeSide = 'BUY' | 'SELL';

export default function TradeTicket({
  pool,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  pool: any;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: TradePayload) => void;
}) {
  const side = (pool?.side ?? 'BUY') as TradeSide;
  const symbol = String(pool?.symbol ?? pool?.code ?? '').toUpperCase();
  const maxQuantity = side === 'SELL' ? Number(pool?.quantity ?? 0) : undefined;
  const availableQuantity = Number(maxQuantity ?? 0);
  const hasMaxQuantity = Number.isFinite(availableQuantity) && availableQuantity > 0;
  const initialQuantity = pool?.quantity ?? pool?.targetQuantity ?? pool?.target_quantity ?? 100;
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [orderType, setOrderType] = useState<TradePayload['orderType']>('LO');
  const [price, setPrice] = useState(
    String(
      pool?.currentPrice ??
        pool?.current_price ??
        pool?.marketPrice ??
        pool?.market_price ??
        pool?.price ??
        ''
    )
  );

  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);
  const isSell = side === 'SELL';
  const quantityValid =
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    (!isSell || (hasMaxQuantity && numericQuantity <= availableQuantity));
  const priceValid = orderType !== 'LO' || (Number.isFinite(numericPrice) && numericPrice > 0);
  const entryLow = pool?.entryLow ?? pool?.entry_low;
  const entryHigh = pool?.entryHigh ?? pool?.entry_high;
  const entry = formatEntry(entryLow, entryHigh);
  const targetPrice = pool?.targetPrice ?? pool?.target_price;

  return (
    <div className="trade-overlay" role="dialog" aria-modal="true">
      <Card className="trade-ticket">
        <div className="panel-head">
          <div>
            <h2>Execute Order</h2>
            <p>
              {side} {symbol || 'asset'} · {isSell ? 'Close open position' : 'Buy from TCE pool'}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close trade ticket"
            disabled={busy}
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div style={contextStyle}>
            <span style={contextLabelStyle}>Price</span>
            <strong style={contextValueStyle}>{formatNumber(price)}</strong>
          </div>
          <div style={contextStyle}>
            <span style={contextLabelStyle}>Entry</span>
            <strong style={contextValueStyle}>{entry}</strong>
          </div>
          <div style={contextStyle}>
            <span style={contextLabelStyle}>TP</span>
            <strong style={contextValueStyle}>{formatNumber(targetPrice)}</strong>
          </div>
        </div>

        <div className="trade-controls">
          <label>
            Symbol
            <input value={symbol} readOnly aria-readonly="true" disabled={busy} />
          </label>
          <label>
            Quantity
            <input
              inputMode="numeric"
              min="1"
              step="100"
              max={hasMaxQuantity ? availableQuantity : undefined}
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
              disabled={busy}
            />
            {side === 'BUY' && pool?.targetQuantity != null && (
              <span className="field-hint">Auto-calculated quantity · editable</span>
            )}
            {isSell && hasMaxQuantity && (
              <span className="field-hint">Available: {availableQuantity}</span>
            )}
          </label>
          <label>
            Order type
            <select
              value={orderType}
              onChange={event => setOrderType(event.target.value as TradePayload['orderType'])}
              disabled={busy}
            >
              <option value="LO">LO</option>
              <option value="MTL">MTL</option>
              <option value="MP">MP</option>
              <option value="ATO">ATO</option>
              <option value="ATC">ATC</option>
              <option value="MOK">MOK</option>
              <option value="MAK">MAK</option>
              <option value="PLO">PLO</option>
            </select>
          </label>
          {orderType === 'LO' && (
            <label>
              Price
              <input
                inputMode="decimal"
                min="0"
                value={price}
                onChange={event => setPrice(event.target.value)}
                disabled={busy}
              />
            </label>
          )}
        </div>

        <Button
          type="button"
          onClick={() =>
            onSubmit({
              side,
              quantity: numericQuantity,
              orderType,
              price: orderType === 'LO' ? numericPrice : undefined,
            })
          }
          disabled={busy || !symbol || !quantityValid || !priceValid}
        >
          {busy ? 'Submitting…' : `Confirm ${side === 'BUY' ? 'Buy' : 'Sell'}`}
        </Button>
        {error && <div className="error-banner">{error}</div>}
      </Card>
    </div>
  );
}

function formatNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
    : '—';
}
function formatEntry(low: any, high: any) {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${formatNumber(low)}–${formatNumber(high)}`;
  return formatNumber(low ?? high);
}
const contextStyle = {
  padding: '9px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,.08)',
  background: 'rgba(255,255,255,.025)',
};
const contextLabelStyle = { display: 'block', color: 'var(--tce-muted, #82939b)', fontSize: 9 };
const contextValueStyle = {
  display: 'block',
  color: 'var(--tce-text, #f2f7f8)',
  fontSize: 11,
  marginTop: 3,
};
