import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateJobDto, UpdateJobDto } from './typings/job.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { JobStatus, JobVisibility } from './typings/job.enum';
import { PaginationRequestDto } from 'src/typings/dtos/pagination.dto';
import {
  getQueryParams,
  getQueryParamsForAdmin,
} from 'src/utils/get-query-params';
import { Prisma, Visibility } from '@prisma/client';
import { QueueService } from 'src/infra/queue/queue.service';
import { EscrowsService } from '../escrows/escrows.service';
import { TWENTY_FOUR_HOURS_MS } from 'src/common/constants';
import { TransferService } from '../transfer/transfer.service';
import { TransferToEscrowDto } from '../transfer/dtos/create-transfer.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly escrowsService: EscrowsService,
    private readonly queueService: QueueService,
    private readonly transferService: TransferService,
  ) {}

  private async validateDto(dto: Partial<CreateJobDto>) {
    const result: {
      validatedSkillIds?: string[];
      preferred_start_time?: Date;
    } = {};

    if (dto.skills) {
      const existingSkills = await this.prismaService.skill.findMany({
        where: { id: { in: dto.skills } },
      });

      const validatedSkillIds = existingSkills.map((s) => s.id);
      const invalidSkillIds = dto.skills.filter(
        (id) => !validatedSkillIds.includes(id),
      );

      if (invalidSkillIds.length > 0) {
        throw new NotFoundException(
          `Invalid skill IDs: ${invalidSkillIds.join(', ')}`,
        );
      }

      result.validatedSkillIds = validatedSkillIds;
    }

    if (dto.preferred_start_time) {
      const preferred_start_time = new Date(dto.preferred_start_time);
      if (isNaN(preferred_start_time.getTime())) {
        throw new NotFoundException('Invalid preferred_start_time format');
      }

      if (preferred_start_time < new Date()) {
        throw new NotFoundException(
          'Preferred start time must be in the future',
        );
      }

      result.preferred_start_time = preferred_start_time;
    }

    return result;
  }

  async createJob(userId: string, createJobDto: CreateJobDto) {
    const { validatedSkillIds, preferred_start_time } =
      await this.validateDto(createJobDto);

    if (!validatedSkillIds || validatedSkillIds.length === 0) {
      throw new BadRequestException('Skills are required');
    }

    if (!preferred_start_time) {
      throw new BadRequestException('Preferred start time is required');
    }

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
      await tx.serviceSkill.createMany({
        data: validatedSkillIds.map((id) => ({
          service_id: job.id,
          skill_id: id,
        })),
      });
      if (createJobDto.imageUrls && createJobDto.imageUrls.length > 0) {
        for (const url of createJobDto.imageUrls) {
          const newImage = await tx.image.create({
            data: {
              url: url,
            },
          });
          await tx.serviceImage.create({
            data: {
              service_id: job.id,
              image_id: newImage.id,
            },
          });
        }
      }
      await this.escrowsService.createEscrow(userId, job.id, tx);
      return job;
    });

    await this.queueService.scheduleJob(
      'delete-pending-job',
      { jobId: job.id },
      TWENTY_FOUR_HOURS_MS,
      `delete-pending-job-${job.id}`,
    );

    return job;
  }

  async findJobCommunity(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParams(pagingInfo);

    const followingList = await this.prismaService.follow.findMany({
      where: { follower_id: userId },
      select: { followee_id: true },
    });
    const followingIds = followingList.map((f) => f.followee_id);

    const where: Prisma.ServiceWhereInput = {
      user_id: { not: userId },
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
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
          serviceSkills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.service.count({ where }),
    ]);

    const result = {
      data: items.map((item) => ({
        ...item,
        skills: item.serviceSkills.map((ss) => ss.skill),
        serviceSkills: undefined,
      })),
      metadata: {
        total,
        page: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };

    return result;
  }

  async getJobById(userId: string, jobId: string) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
        serviceSkills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        serviceImages: {
          include: {
            image: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
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

    const transformedJob = {
      ...job,
      skills: job.serviceSkills?.map((ss) => ss.skill) ?? [],
      serviceImages:
        job.serviceImages?.map((si) => ({
          id: si.image?.id ?? si.id,
          url: si.image?.url ?? null,
        })) ?? [],
      serviceSkills: undefined,
    };

    return transformedJob;
  }

  async getAllMyJobs(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParams(pagingInfo);

    const ALLOWED_STATUSES: JobStatus[] = [
      JobStatus.OPEN,
      JobStatus.MATCHED,
      JobStatus.COMPLETED,
      JobStatus.CANCELLED,
      JobStatus.EXPIRED,
    ];

    const where: Prisma.ServiceWhereInput = { user_id: userId };

    if (pagingInfo.type?.length) {
      where.status = {
        in: (pagingInfo.type as JobStatus[]).filter((s) =>
          ALLOWED_STATUSES.includes(s),
        ),
      };
    } else {
      where.status = { in: ALLOWED_STATUSES };
    }

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
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
          serviceSkills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.service.count({ where }),
    ]);

    const result = {
      data: items.map((item) => ({
        ...item,
        skills: item.serviceSkills.map((ss) => ss.skill),
        serviceSkills: undefined,
      })),
      metadata: {
        total,
        page: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };

    return result;
  }

  async getAllJobs(userId: string, pagingInfo: PaginationRequestDto) {
    const { queryParams, metadata } = getQueryParamsForAdmin(pagingInfo);

    const where: Prisma.ServiceWhereInput = {};

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
        include: {
          serviceSkills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.service.count({ where }),
    ]);

    const result = {
      data: items.map((item) => ({
        ...item,
        skills: item.serviceSkills.map((ss) => ss.skill),
        serviceSkills: undefined,
      })),
      metadata: {
        total,
        page: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: Math.ceil(total / metadata.pageSize),
      },
    };

    return result;
  }

  async getDetailMyJob(userId: string, jobId: string) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId, user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
        serviceSkills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        serviceImages: {
          include: {
            image: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
    });

    if (!job) throw new NotFoundException(`Job with ID ${jobId} not found`);
    const transformedJob = {
      ...job,
      skills: job.serviceSkills?.map((ss) => ss.skill) ?? [],
      serviceImages:
        job.serviceImages?.map((si) => ({
          id: si.image?.id ?? si.id,
          url: si.image?.url ?? null,
        })) ?? [],
      serviceSkills: undefined,
    };

    return transformedJob;
  }

  async checkUpdateJob(userId: string, jobId: string, dto: UpdateJobDto) {
    await this.validateDto(dto);

    const job = await this.prismaService.service.findUnique({
      where: { id: jobId, user_id: userId },
    });
    if (!job) throw new NotFoundException('Job not found');

    const oldRequired = job.time * job.slot;
    const newTime = dto.time ?? job.time;
    const newSlot = dto.slot ?? job.slot;
    const newRequired = newTime * newSlot;

    const delta = newRequired - oldRequired;

    if (delta == 0) {
      await this.updateMyJob(userId, jobId, dto);
      return { success: 0 };
    } else if (delta < 0) {
      await this.prismaService.$transaction(async (tx) => {
        await this.updateMyJob(userId, jobId, dto, tx);

        const escrow = await tx.escrowWallet.findUnique({
          where: { job_id: jobId },
        });
        if (!escrow) throw new NotFoundException('Escrow not found');
        await this.transferService.transferFromEscrowToProvider(
          escrow.id,
          userId,
          Math.abs(delta),
          tx,
        );
      });
      return { success: 2 };
    }

    return {
      secs: delta,
      updateJobDto: dto,
      success: 1,
    };
  }

  async updateMyJob(
    userId: string,
    jobId: string,
    dto: UpdateJobDto,
    tx?: Prisma.TransactionClient,
  ) {
    const validatedSkillIds = dto.skills;

    const execute = async (trx: Prisma.TransactionClient) => {
      const updateData = this.buildUpdateData(dto);

      if (Object.keys(updateData).length > 0) {
        await trx.service.update({
          where: { id: jobId, user_id: userId },
          data: updateData,
        });
      }
      if (validatedSkillIds) {
        await trx.serviceSkill.deleteMany({ where: { service_id: jobId } });

        await trx.serviceSkill.createMany({
          data: validatedSkillIds.map((skill) => ({
            service_id: jobId,
            skill_id: skill,
          })),
        });
      }

      if (dto.imageUrls && dto.imageUrls.length > 0) {
        await trx.serviceImage.deleteMany({ where: { service_id: jobId } });

        for (const url of dto.imageUrls) {
          const newImage = await trx.image.create({
            data: {
              url: url,
            },
          });
          await trx.serviceImage.create({
            data: {
              service_id: jobId,
              image_id: newImage.id,
            },
          });
        }
      } else if (dto.imageUrls !== undefined){
        await trx.serviceImage.deleteMany({ where: { service_id: jobId } });
      }
    };

    if (tx) {
      await execute(tx);
      return { data: true };
    }

    await this.prismaService.$transaction(async (trx) => {
      await execute(trx);
    });

    return { data: true };
  }

  private buildUpdateData(dto: UpdateJobDto) {
    const map: Record<string, any> = {
      title: dto.title,
      description: dto.description,
      region_code: dto.region_code,
      place: dto.place,
      preferred_start: dto.preferred_start_time
        ? new Date(dto.preferred_start_time)
        : undefined,
      time: dto.time,
      slot: dto.slot,
      visibility: dto.visibility,
    };

    return Object.fromEntries(
      Object.entries(map).filter(([_, v]) => v !== undefined),
    );
  }

  async confirmUpdateMyJobById(
    userId: string,
    updateJobDto: UpdateJobDto,
    transferToEscrowDto: TransferToEscrowDto,
  ) {
    await this.prismaService.$transaction(async (tx) => {
      await this.updateMyJob(
        userId,
        transferToEscrowDto.jobId,
        updateJobDto,
        tx,
      );
      await this.transferService.transferToEscrow(
        userId,
        transferToEscrowDto,
        tx,
      );
    });

    return { success: true };
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

  async blockJobById(jobId: string) {
    const existingJob = this.prismaService.service.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!existingJob) throw new NotFoundException('Not found');

    await this.prismaService.service.update({
      where: {
        id: jobId,
        status: JobStatus.OPEN || JobStatus.MATCHED,
      },
      data: {
        status: JobStatus.BANNED,
      },
    });
  }

  async unblockJobById(jobId: string) {
    const existingJob = await this.prismaService.service.findUnique({
      where: { id: jobId },
    });
    if (!existingJob) throw new NotFoundException('Job not found');
    await this.prismaService.service.update({
      where: { id: jobId },
      data: { status: JobStatus.OPEN },
    });
    return { success: true };
  }
}
