import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('global-queue') private readonly queue: Bull.Queue,
  ) {}

  /**
   * Thêm job delay (dùng chung cho nhiều mục đích)
   */
  async scheduleJob(
    jobName: string,
    payload: Record<string, any>,
    delayMs: number,
    jobId?: string,
  ) {
    const jobKey = jobId || `${jobName}-${Date.now()}`;

    await this.queue.add(jobName, payload, {
      delay: delayMs,
      jobId: jobKey,
      removeOnComplete: true,
      removeOnFail: true,
    });

    this.logger.log(`Scheduled job [${jobName}] with delay ${delayMs}ms`);
  }

  /**
   *  Xóa job cụ thể theo ID (tự động tìm trong tất cả trạng thái)
   */
  async removeJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Removed job with ID: ${jobId}`);
    } else {
      this.logger.warn(`Job with ID: ${jobId} not found`);
    }
  }
}
