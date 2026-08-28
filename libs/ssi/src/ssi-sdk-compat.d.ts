import '@ssi.developer/ssi-sdk';

declare module '@ssi.developer/ssi-sdk' {
  interface Token {
    refreshExpiresAt?: number;
  }

  interface EquityAccountBalance {
    availableCash?: number;
    bankBalance?: number;
    dividendMargin?: number;
    blockCash?: number;
    interestCash?: number;
    limitT0?: number;
    termDeposit?: number;
  }

  interface EquityPosition {
    blockQuantity?: number;
    dividendQuantity?: number;
    buyingQuantity?: number;
    boughtQuantity?: number;
    sellingQuantity?: number;
    soldQuantity?: number;
    t1SellQuantity?: number;
    t2SellQuantity?: number;
    mortgageQuantity?: number;
    restrictedQuantity?: number;
  }

  interface Order {
    clientRequestId?: string;
    orderId?: string;
    symbol?: string;
    side?: string;
    orderType?: string;
    price?: number;
    avgPrice?: number;
    quantity?: number;
    osQuantity?: number;
    filledQuantity?: number;
    cancelQuantity?: number;
    status?: string;
    inputTime?: string;
    modifyTime?: string;
    message?: string;
  }
}
