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

  return (
    <div className="trade-overlay" role="dialog" aria-modal="true">
      <Card className="trade-ticket">
        <div className="panel-head">
          <div>
            <h2>
              {side} {symbol || 'asset'}
            </h2>
            <p>{isSell ? 'Sell open position through SSI' : 'Buy from TCE pool through SSI'}</p>
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
          {busy ? 'Submitting…' : `Place ${side}`}
        </Button>

        {error && <div className="error-banner">{error}</div>}
      </Card>
    </div>
  );
}
