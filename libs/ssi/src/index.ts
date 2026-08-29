export type SsiCredentials = {
  clientId: string;
  apiKey: string;
  apiSecret: string;
  privateKey: string;
  accountNo: string;
};
export type SsiAuthInput = { otp?: string; transactionId?: string };
export * from './ssi.broker.adapter';
