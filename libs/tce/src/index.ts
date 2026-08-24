export type TcePosition = {
  symbol: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  status: 'OPEN' | 'CLOSED';
};

export type TceOrder = {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: string;
};
