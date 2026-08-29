export type SsiCredentials = {
  apiKey: string;
  apiSecret: string;
  privateKey?: string;
  accountNo: string;
};
export type SsiAuthInput = { otp?: string; transactionId?: string };
export * from './ssi.broker.adapter';
