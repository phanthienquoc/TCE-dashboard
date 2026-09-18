import type {
  TceExecutionPort,
  TceExecutionResult,
  TceExecutionSubmitCommand,
  TceRiskGateConfig,
  TceRiskGateRequest,
} from '@tce/contracts';
import { approveExecutionIntent, type TceApprovedExecutionIntent } from '../risk/guarded-execution';
import { TceExecutionOrchestrator } from './execution-orchestrator';

export type TceExecutionCommandContext = Readonly<{
  accountId: string;
  environment: string;
  clientRequestId: string;
}>;

export type GuardedSubmitPreparation =
  | Readonly<{ ok: true; approved: TceApprovedExecutionIntent; command: TceExecutionSubmitCommand }>
  | Readonly<{ ok: false; code: string; message: string }>;

/**
 * Explicit composition boundary for CRDE execution:
 * Decision/Planner -> Risk Gate -> approved intent -> Execution Orchestrator -> provider port.
 *
 * The bridge deliberately does not know anything about SSI. Provider-specific
 * credentials, sessions and broker DTOs remain behind TceExecutionPort adapters.
 */
export class TceGuardedExecutionBridge {
  private readonly orchestrator: TceExecutionOrchestrator;

  constructor(port: TceExecutionPort) {
    this.orchestrator = new TceExecutionOrchestrator(port);
  }

  prepareSubmit(
    request: TceRiskGateRequest,
    config: TceRiskGateConfig,
    context: TceExecutionCommandContext
  ): GuardedSubmitPreparation {
    const approval = approveExecutionIntent(request, config);
    if (!approval.ok) return approval;

    const { approved } = approval;
    const command: TceExecutionSubmitCommand = {
      operation: 'SUBMIT',
      accountId: context.accountId,
      environment: context.environment,
      mode: approved.intent.mode,
      authorization: {
        approvalId: approved.approvalId,
        approvedAt: approved.approvedAt,
        correlationId: approved.intent.correlationId,
        idempotencyKey: approved.intent.idempotencyKey,
      },
      intent: approved.intent,
      clientRequestId: context.clientRequestId,
    };

    return { ok: true, approved, command };
  }

  async executeApproved(command: TceExecutionSubmitCommand): Promise<TceExecutionResult> {
    return (await this.orchestrator.execute(command)).result;
  }
}
