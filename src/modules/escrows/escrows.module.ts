import { forwardRef, Module } from '@nestjs/common';
import { EscrowsService } from './escrows.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Module({
  providers: [EscrowsService, PrismaService],
  exports: [EscrowsService],
})
export class EscrowsModule {}
