import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateEscrowDto } from './typings/escrows.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { PrismaClient } from '@prisma/client/extension';

@Injectable()
export class EscrowsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createEscrow(userId: string, jobId: string, tx: PrismaClient) {
    await tx.escrowWallet.create({
      data: {
        job_id: jobId,
        secs: 0,
      },
    });

    return { success: true };
  }

  async removeEscrow(userId: string, createEscrowDto: CreateEscrowDto) {
    const escrow = await this.prismaService.escrowWallet.findUnique({
      where: { job_id: createEscrowDto.jobId },
    });
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    return this.prismaService.escrowWallet.delete({
      where: { id: escrow.id },
    });
  }
}
