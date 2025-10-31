import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import type { Job } from "bull";
import { TransferService } from "src/modules/transfer/transfer.service";

@Processor('global-queue')
export class ReleaseEscrowProcessor {
  private readonly logger = new Logger(ReleaseEscrowProcessor.name);

  constructor(
    private readonly transferService: TransferService,
  ) {}

  @Process('Release-escrow-funds')
  async handleReleaseEscrow(job: Job<{ escrowId: string; providerId: string; amount: number }>) {
    const { escrowId, providerId, amount } = job.data;
    try {
      await this.transferService.transferFromEscrowToProvider(escrowId, providerId, amount);
      this.logger.log(`Escrow ${escrowId} released to provider ${providerId} amount ${amount}`);
    } catch (error) {
      this.logger.error(
        `[Release-escrow-funds] Failed to release escrow ${escrowId} to provider ${providerId}`,
        error.stack || error.message,
      );
      throw error;
    }
  }
}