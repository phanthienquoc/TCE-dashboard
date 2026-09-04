'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { TradePayload } from './DashboardShell';

export default function TradeTicket({ pool, busy, error, onClose, onSubmit }: { pool: any; busy: boolean; error: string; onClose: () => void; onSubmit: (payload: TradePayload) => void }) {
  const [side, setSide] = useState<'BUY' | 'SELL'>((pool?.side ?? 'BUY') as 'BUY' | 'SELL');
  const [quantity, setQuantity] = useState(String(pool?.quantity ?? pool?.targetQuantity ?? pool?.target_quantity ?? 100));
  const [orderType, setOrderType] = useState<TradePayload['orderType']>('LO');
  const [price, setPrice] = useState(String(pool?.currentPrice ?? pool?.current_price ?? ''));
  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);
  const isNextPosition = pool?.__orderSource === 'next-position';

  return (
    <div className="trade-overlay" role="dialog" aria-modal="true">
      <Card className="trade-ticket">
        <div className="panel-head">
          <div><h2>{isNextPosition ? 'Create order' : 'Trade'} {String(pool?.symbol ?? pool?.code ?? 'asset').toUpperCase()}</h2><p>{isNextPosition ? 'Create SSI buy order from Next Position' : 'SSI order'}</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close trade ticket" disabled={busy}><X className="size-4" /></button>
        </div>
        <div className="trade-controls">
          <div className="trade-side-toggle"><button type="button" className={side === 'BUY' ? 'active' : ''} onClick={() => setSide('BUY')} disabled={busy || isNextPosition}>BUY</button><button type="button" className={side === 'SELL' ? 'active' : ''} onClick={() => setSide('SELL')} disabled={busy || isNextPosition}>SELL</button></div>
          <label>Quantity<input inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={busy} /></label>
          <label>Order type<select value={orderType} onChange={event => setOrderType(event.target.value as TradePayload['orderType'])} disabled={busy}><option value="LO">LO</option><option value="MTL">MTL</option><option value="MP">MP</option><option value="ATO">ATO</option><option value="ATC">ATC</option><option value="MOK">MOK</option><option value="MAK">MAK</option><option value="PLO">PLO</option></select></label>
          {orderType === 'LO' && <label>Price<input inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} disabled={busy} /></label>}
        </div>
        <Button type="button" onClick={() => onSubmit({ side, quantity: numericQuantity, orderType, price: orderType === 'LO' ? numericPrice : undefined })} disabled={busy || !Number.isFinite(numericQuantity) || numericQuantity <= 0 || (orderType === 'LO' && (!Number.isFinite(numericPrice) || numericPrice <= 0))}>{busy ? 'Submitting…' : 'Place order'}</Button>
        {error && <div className="error-banner">{error}</div>}
      </Card>
    </div>
  );
}
