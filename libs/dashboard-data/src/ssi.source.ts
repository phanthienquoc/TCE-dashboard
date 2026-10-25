import { DashboardSourcePort, ContractResult } from '@tce/contracts';
import { BrokerPort } from '@tce/contracts';

export class SsiDashboardSource implements DashboardSourcePort {
  readonly source = 'ssi';
  constructor(private readonly broker: BrokerPort) {}
  async snapshot(_userId: string): Promise<ContractResult<unknown>> {
    const accountNo = _userId;
    const [balance, positions, orders] = await Promise.all([
      this.broker.balance(accountNo),
      this.broker.positions(accountNo),
      this.broker.orders(accountNo),
    ]);
    if (!balance.ok) return balance;
    if (!positions.ok) return positions;
    if (!orders.ok) return orders;
    return {
      ok: true,
      data: { balance: balance.data, positions: positions.data, orders: orders.data },
    };
  }
}
