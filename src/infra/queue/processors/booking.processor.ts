import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

@Processor('global-queue')
export class BookingStatusProcessor {
  private readonly logger = new Logger(BookingStatusProcessor.name);

  constructor(private readonly prisma: PrismaService) {}
  @Process('check-no-show')
  async handleNoShow(job: Job<{ bookingId: string; providerId: string }>) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: job.data.bookingId },
    });
    if (!booking) return;

    if (booking.status === BookingStatus.scheduled && !booking.check_in_time) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.cancelled, cancelled_at: new Date() },
      });
      this.logger.log(
        `Booking ${booking.id} - Provider không check-in đúng giờ`,
      );
    }
  }
}