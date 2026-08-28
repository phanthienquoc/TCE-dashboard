declare module '@ssi.developer/ssi-sdk' {
  interface EquityAccountBalance {
    availableCash: number;
    withdrawal: number;
    bankBalance: number;
    dividendMargin: number;
    blockCash: number;
    interestCash: number;
    limitT0: number;
    termDeposit: number;
  }
}
