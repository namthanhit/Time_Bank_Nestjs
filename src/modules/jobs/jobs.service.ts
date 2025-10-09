import { Injectable } from '@nestjs/common';

import { CreateJobDto } from './typings/jobs.dto';
import { UpdateJobDto } from './typings/jobs.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { JobStatus, JobVisibility } from './typings/jobs.enum';

@Injectable()
export class JobsService {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async createJob(userId: string, createJobDto: CreateJobDto) {
    const existingSkills = await this.prismaService.skill.findMany({
      where: {
        id: { in: createJobDto.skills },
      },
    });

    const validatedSkillIds = existingSkills.map(skill => skill.id);
    const invalidSkillIds = createJobDto.skills.filter(skillId => !validatedSkillIds.includes(skillId));
    if (invalidSkillIds.length > 0) {
      throw new Error(`Invalid skill IDs: ${invalidSkillIds.join(", ")}`);
    }

    const preferred_start_time = new Date(createJobDto.preferred_start_time);
    const currentTime = new Date();

    if (preferred_start_time <= currentTime) {
      throw new Error(`Preferred start time must be in the future`);
    }

    const job = await this.prismaService.service.create({
      data: {
        user_id: userId,
        title: createJobDto.title,
        description: createJobDto.description,
        region_code: createJobDto.region_code,
        place: createJobDto.place,
        status: JobStatus.OPEN,
        preferred_start: new Date(createJobDto.preferred_start_time),
        time: createJobDto.time,
        slot: createJobDto.slot,
        visibility: createJobDto.visibility,
      }
    });

    await this.prismaService.serviceSkill.createMany({
      data: validatedSkillIds.map(skillId => ({
        service_id: job.id,
        skill_id: skillId,
      })),
    });

    return job;
  }

  async findAll() {
    return this.prismaService.service.findMany();
  }

  async getJobById(userId: string, jobId: string) {
    const job = await this.prismaService.service.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }

    if (job.visibility === JobVisibility.FRIENDS) {
      const userIsFollower = await this.prismaService.follow.findFirst({
        where: {
          follower_id: userId,
          followee_id: job.user_id
        }
      });

      if (!userIsFollower) {
        throw new Error(`You do not have permission to view this job`);
      }

      return job;
    } else if (job.visibility === JobVisibility.HIDDEN) {
      if (job.user_id !== userId) {
        throw new Error(`You do not have permission to view this job`);
      }
    }

    return job;
  }

  async getMyJobById(userId: string, jobId: string) {
    const job = await this.prismaService.service.findFirst({
      where: {
        id: jobId,
        user_id: userId
      }
    });

    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }

    return job;
  }

  update(id: string, updateJobDto: UpdateJobDto) {
    return `This action updates a #${id} job`;
  }

  remove(id: number) {
    return `This action removes a #${id} job`;
  }
}
