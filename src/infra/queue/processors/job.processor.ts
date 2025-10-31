import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { JobsService } from 'src/modules/jobs/jobs.service';
import { JobStatus } from 'src/modules/jobs/typings/job.enum';
import { BookingsService } from 'src/modules/bookings/bookings.service';
import { OfferStatus } from '@prisma/client';
import { QueueService } from '../queue.service';

/**
 * Processor chịu trách nhiệm cập nhật trạng thái Job tự động
 * - Tự động chuyển OPEN -> MATCHED (nếu có offer)
 * - Tự động chuyển OPEN -> EXPIRED (nếu không có offer)
 * - Tự động chuyển MATCHED -> COMPLETED (khi đến thời điểm hoàn tất)
 */
@Processor('global-queue')
export class JobStatusProcessor {
  private readonly logger = new Logger(JobStatusProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobsService,
    private readonly bookingService: BookingsService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Khi đến thời điểm preferred_start của job:
   * - Nếu có offer → chuyển sang MATCHED
   * - Nếu không → chuyển sang EXPIRED
   */
  @Process('update-job-to-matched')
  async handleMatched(job: Job<{ jobId: string }>) {
    const { jobId } = job.data;
    try {
      const offers = await this.prisma.offer.findMany({
        where: {
          service_id: jobId,
          status: OfferStatus.accepted,
        },
        select: { id: true },
      });

      if (offers.length === 0) {
        await this.expireJob(jobId);
        return;
      }

      const updated = await this.prisma.service.update({
        where: { id: jobId, status: JobStatus.OPEN },
        data: { status: JobStatus.MATCHED, updated_at: new Date() },
      });

      if (updated && updated.preferred_start) {
        this.logger.log(`Job ${jobId} auto-updated to MATCHED`);
        await this.queueService.scheduleJob(
          'update-job-to-completed',
          { jobId: jobId },
          updated.preferred_start.getTime() - Date.now() + updated.time * 1000,
        );
      } else {
        this.logger.warn(
          `Job ${jobId} not updated or missing preferred start time.`,
        );
      }
    } catch (error) {
      this.handleError('MATCHED', jobId, error);
      throw error;
    }
  }

  /**
   * Khi job kết thúc (đến thời gian auto-complete):
   * - Chuyển sang trạng thái COMPLETED
   */
  @Process('update-job-to-completed')
  async handleCompleted(job: Job<{ jobId: string }>) {
    const { jobId } = job.data;

    await this.prisma.$transaction(async (tx) => {
      this.logger.debug(
        `[TX] Calling bookingService.completeBooking(${jobId})`,
      );
      await this.bookingService.completeBooking(jobId, tx);

      this.logger.debug(
        `[TX] Updating service status to COMPLETED for jobId=${jobId}`,
      );
      const updated = await tx.service.updateMany({
        where: { id: jobId, status: JobStatus.MATCHED },
        data: { status: JobStatus.COMPLETED, updated_at: new Date() },
      });

      this.logger.debug(`[TX] updateMany result count=${updated.count}`);

      if (updated.count > 0) {
        this.logger.log(`Job ${jobId} auto-updated to COMPLETED`);
      } else {
        this.logger.warn(`Job ${jobId} NOT updated -> maybe wrong state`);
      }
    });
  }

  /**
   * Đánh dấu job là EXPIRED nếu không có offer
   */
  private async expireJob(jobId: string) {
    try {
      const updated = await this.jobService.changeJobStatus(
        jobId,
        JobStatus.EXPIRED,
      );

      if (updated) {
        this.logger.log(
          `Job [${jobId}] auto-updated to EXPIRED (no offers found)`,
        );
      } else {
        this.logger.warn(
          `Job [${jobId}] could not be set to EXPIRED (already closed).`,
        );
      }
    } catch (error) {
      this.handleError('EXPIRED', jobId, error);
    }
  }

  @Process('delete-pending-job')
  async handleDelete(job: Job<{ jobId: string }>) {
    const { jobId } = job.data;

    const serviceImages = await this.prisma.serviceImage.findMany({
      where: { service_id: jobId },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.service.delete({
        where: {
          id: jobId,
          status: JobStatus.PENDING,
        },
      });

      await tx.serviceSkill.deleteMany({
        where: { service_id: jobId },
      });

      await tx.escrowWallet.delete({
        where: { job_id: jobId },
      });

      if (serviceImages.length > 0) {
        const imageIds = serviceImages.map((img) => img.id);
        await tx.serviceImage.deleteMany({
          where: { id: { in: imageIds } },
        });
      }
    });
  }

  /**
   * Ghi log lỗi thống nhất
   */
  private handleError(action: string, jobId: string, error: any) {
    this.logger.error(
      `Failed to update Job ${jobId} to ${action}: ${error.message}`,
      error.stack,
    );
  }
}
