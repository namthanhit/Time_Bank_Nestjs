import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatusProcessor } from './processors/booking.processor';
import { JobStatusProcessor } from './processors/job.processor';
import { JobsModule } from 'src/modules/jobs/jobs.module';
import { BookingsModule } from 'src/modules/bookings/bookings.module';
import { ReleaseEscrowProcessor } from './processors/escrow.processor';
import { TransferModule } from 'src/modules/transfer/transfer.module';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      url: process.env.REDIS_URL,
    }),
    BullModule.registerQueue({
      name: 'global-queue',
    }),
    JobsModule,
    BookingsModule,
    TransferModule
  ],
  providers: [QueueService, PrismaService, JobStatusProcessor, BookingStatusProcessor, ReleaseEscrowProcessor],
  exports: [QueueService],
})
export class QueueModule {}
