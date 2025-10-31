import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateJobDto } from './typings/job.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { JobStatus, JobVisibility } from './typings/job.enum';
import { PaginationRequestDto } from 'src/typings/dtos/pagination.dto';
import { getQueryParams } from 'src/utils/get-query-params';
import { Prisma, Visibility } from '@prisma/client';
import { RedisService } from 'src/infra/redis/redis.service';
import { QueueService } from 'src/infra/queue/queue.service';
import { EscrowsService } from '../escrows/escrows.service';
import { TWENTY_FOUR_HOURS_MS } from 'src/common/constants';

@Injectable()
export class JobsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly escrowsService: EscrowsService,
    private readonly queueService: QueueService,
  ) {}

  private async validateDto(createJobDto: CreateJobDto) {
    const existingSkills = await this.prismaService.skill.findMany({
      where: { id: { in: createJobDto.skills } },
    });

    const validatedSkillIds = existingSkills.map((s) => s.id);
    const invalidSkillIds = createJobDto.skills.filter(
      (id) => !validatedSkillIds.includes(id),
    );
    if (invalidSkillIds.length > 0)
      throw new NotFoundException(
        `Invalid skill IDs: ${invalidSkillIds.join(', ')}`,
      );

    const preferred_start_time = new Date(createJobDto.preferred_start_time);
    if (preferred_start_time < new Date())
      throw new NotFoundException('Preferred start time must be in the future');

    return { validatedSkillIds, preferred_start_time };
  }

  async createJob(userId: string, createJobDto: CreateJobDto) {
    const { validatedSkillIds, preferred_start_time } =
      await this.validateDto(createJobDto);

    const job = await this.prismaService.$transaction(async (tx) => {
      const job = await tx.service.create({
        data: {
          user_id: userId,
          title: createJobDto.title,
          description: createJobDto.description,
          region_code: createJobDto.region_code,
          place: createJobDto.place,
          status: JobStatus.PENDING,
          preferred_start: preferred_start_time,
          time: createJobDto.time,
          slot: createJobDto.slot,
          visibility: createJobDto.visibility,
        },
      });

      const skill = await tx.serviceSkill.createMany({
        data: validatedSkillIds.map((id) => ({
          service_id: job.id,
          skill_id: id,
        })),
      });

      await this.escrowsService.createEscrow(userId, job.id, tx);
      return job;
    });

    await this.queueService.scheduleJob(
      'delete-pending-job',
      { jobId: job.id },
      TWENTY_FOUR_HOURS_MS,
      `delete-pending-job-${job.id}`,
    );

    await this.redisService.del(`jobs:feed:${userId}*`);
    await this.redisService.del(`jobs:my:${userId}*`);
    return { success: true };
  }

  async findAll(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParams(pagingInfo);
    const cacheKey = `jobs:feed:${userId}:page:${metadata.page}:search:${pagingInfo.search || ''}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const followingList = await this.prismaService.follow.findMany({
      where: { follower_id: userId },
      select: { followee_id: true },
    });
    const followingIds = followingList.map((f) => f.followee_id);

    const where: Prisma.ServiceWhereInput = {
      status: JobStatus.OPEN,
      OR: [
        { visibility: Visibility.public },
        { visibility: Visibility.friends, user_id: { in: followingIds } },
      ],
    };

    if (pagingInfo.search) {
      const keyword = pagingInfo.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
            { place: { contains: keyword } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prismaService.service.findMany({
        where,
        skip: queryParams.paging.skip,
        take: queryParams.paging.take,
        orderBy: queryParams.orderBy,
      }),
      this.prismaService.service.count({ where }),
    ]);

    const result = {
      data: items,
      metadata: {
        total,
        page: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };

    await this.redisService.set(cacheKey, result, 30);
    return result;
  }

  async getJobById(userId: string, jobId: string) {
    const cacheKey = `jobs:detail:${jobId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const job = await this.prismaService.service.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);

    if (job.visibility === JobVisibility.FRIENDS) {
      const isFriend = await this.prismaService.follow.findFirst({
        where: { follower_id: userId, followee_id: job.user_id },
      });
      if (!isFriend) throw new ForbiddenException('You do not have permission');
    } else if (
      job.visibility === JobVisibility.HIDDEN &&
      job.user_id !== userId
    ) {
      throw new ForbiddenException('You do not have permission');
    }

    await this.redisService.set(cacheKey, job, 300);
    return job;
  }

  async getAllMyJobs(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParams(pagingInfo);
    const cacheKey = `jobs:my:${userId}:page:${metadata.page}:search:${pagingInfo.search || ''}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const where: Prisma.ServiceWhereInput = { user_id: userId };

    if (pagingInfo.type?.length)
      where.status = { in: pagingInfo.type as JobStatus[] };

    if (pagingInfo.search) {
      const keyword = pagingInfo.search.trim();
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { place: { contains: keyword } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prismaService.service.findMany({
        where,
        skip: queryParams.paging.skip,
        take: queryParams.paging.take,
        orderBy: queryParams.orderBy,
      }),
      this.prismaService.service.count({ where }),
    ]);

    const result = {
      data: items,
      metadata: {
        total,
        page: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };

    await this.redisService.set(cacheKey, result, 30);
    return result;
  }

  async getDetailMyJob(userId: string, jobId: string) {
    const cacheKey = `jobs:my-detail:${userId}:${jobId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const job = await this.prismaService.service.findUnique({
      where: { id: jobId, user_id: userId },
    });
    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);

    await this.redisService.set(cacheKey, job, 300);
    return job;
  }

  async updateMyJob(userId: string, jobId: string, updateJobDto: CreateJobDto) {
    const { validatedSkillIds, preferred_start_time } =
      await this.validateDto(updateJobDto);
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId, user_id: userId },
    });

    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);

    await this.prismaService.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: jobId, user_id: userId },
        data: {
          title: updateJobDto.title,
          description: updateJobDto.description,
          region_code: updateJobDto.region_code,
          place: updateJobDto.place,
          preferred_start: preferred_start_time,
          time: updateJobDto.time,
          slot: updateJobDto.slot,
          visibility: updateJobDto.visibility,
        },
      });

      await tx.serviceSkill.deleteMany({ where: { service_id: jobId } });

      await tx.serviceSkill.createMany({
        data: validatedSkillIds.map((id) => ({
          service_id: jobId,
          skill_id: id,
        })),
      });
    });

    await this.redisService.del(`jobs:detail:${jobId}`);
    await this.redisService.del(`jobs:my-detail:${userId}:${jobId}`);
    await this.redisService.del(`jobs:my:${userId}*`);

    return { data: true };
  }

  async cancelJob(userId: string, jobId: string) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId, user_id: userId },
    });

    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);

    await this.prismaService.service.update({
      where: { id: jobId, user_id: userId },
      data: { status: JobStatus.CANCELLED },
    });

    await this.redisService.del(`jobs:detail:${jobId}`);
    await this.redisService.del(`jobs:my-detail:${userId}:${jobId}`);
    await this.redisService.del(`jobs:my:${userId}*`);
    await this.redisService.del(`jobs:feed:${userId}*`);

    return { data: true };
  }

  async changeJobStatus(jobId: string, status: JobStatus) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId },
    });

    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);

    return await this.prismaService.service.update({
      where: { id: jobId },
      data: { status },
    });
  }
}
