import { forwardRef, Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { EscrowsService } from '../escrows/escrows.service';

@Module({
  imports: [],
  controllers: [JobsController],
  providers: [JobsService, PrismaService, EscrowsService],
  exports: [JobsService],
})
export class JobsModule {}
