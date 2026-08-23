import { ContractResult } from './errors.contract';
import { SsiAuthInput } from './platform.contract';

export type SsiConnectionTest = { provider: 'ssi'; apiVersion: 'v3'; authentication: 'ok'; marketData: 'ok'; securities: number };
export interface SsiConnectionPort {
  requestOtp(): Promise<ContractResult<{ transactionId?: string; message: string }>>;
  test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>>;
  syncPortfolio(accountNo: string, input: SsiAuthInput): Promise<ContractResult<{ positionsSynced: number; ordersSynced: number }>>;
}
