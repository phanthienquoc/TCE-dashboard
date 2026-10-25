import type { DreCampaignStatus, DividendEventRef, DreCampaign } from './dre.types';

export const DEFAULT_DRE_TP_MIN_PERCENT = 7;
export const DEFAULT_DRE_TP_MAX_PERCENT = 10;

export interface DividendCampaignInput {
  event: DividendEventRef;
  status?: DreCampaignStatus;
  targetTpMinPercent?: number;
  targetTpMaxPercent?: number;
}

export interface DividendCampaign extends DreCampaign {
  targetTpMinPercent: number;
  targetTpMaxPercent: number;
}

export function campaignEventKey(event: DividendEventRef): string {
  return `${normalizeSymbol(event.symbol)}:${event.eventId.trim()}`;
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function createDividendCampaign(
  input: DividendCampaignInput,
  now = new Date()
): DividendCampaign {
  const symbol = normalizeSymbol(input.event.symbol);
  const eventId = input.event.eventId.trim();
  const eventDate = input.event.eventDate.trim();
  if (!symbol || !eventId || !eventDate) {
    throw new Error('Dividend campaign requires symbol, eventId and eventDate');
  }

  const min = input.targetTpMinPercent ?? DEFAULT_DRE_TP_MIN_PERCENT;
  const max = input.targetTpMaxPercent ?? DEFAULT_DRE_TP_MAX_PERCENT;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    throw new Error('Invalid dividend campaign TP reference range');
  }

  const timestamp = now.toISOString();
  return {
    id: campaignEventKey({ ...input.event, symbol, eventId }),
    event: { ...input.event, symbol, eventId, eventDate },
    status: input.status ?? 'ACTIVE',
    targetTpMinPercent: min,
    targetTpMaxPercent: max,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
