import { forwardRef, Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { EscrowsService } from '../escrows/escrows.service';
import { TransferService } from '../transfer/transfer.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [JobsController],
  providers: [JobsService, PrismaService, EscrowsService, TransferService],
  exports: [JobsService],
})
export class JobsModule {}
