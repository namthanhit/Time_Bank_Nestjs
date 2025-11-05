import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './typings/job.dto';
import { UserId } from 'src/common/decorators/user-id.decorator';
import {
  PaginationRequestDto,
  PaginationTransformPipe,
} from 'src/typings/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin-guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('admin/all-job')
  @UseGuards(AdminGuard)
  async getAllJobs(
    @UserId() userId: string,
    @Query(new PaginationTransformPipe()) pagingInfo: PaginationRequestDto,
  ) {
    return this.jobsService.getAllJobs(userId, pagingInfo);
  }

  @Post()
  async createJob(
    @UserId() userId: string,
    @Body() createJobDto: CreateJobDto,
  ) {
    return this.jobsService.createJob(userId, createJobDto);
  }

  @Get()
  async findJobCommunity(
    @UserId() userId: string,
    @Query(new PaginationTransformPipe()) pagingInfo: PaginationRequestDto,
  ) {
    return this.jobsService.findJobCommunity(userId, pagingInfo);
  }

  @Get(':id')
  async getJobById(@UserId() userId: string, @Param('jobId') jobId: string) {
    return this.jobsService.getJobById(userId, jobId);
  }

  @Get('me/all-jobs')
  async getMyJobs(
    @UserId() userId: string,
    @Query(new PaginationTransformPipe()) pagingInfo: PaginationRequestDto,
  ) {
    return this.jobsService.getAllMyJobs(userId, pagingInfo);
  }

  @Get('me/detail-job/:jobId')
  async getDetailMyJob(
    @UserId() userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getDetailMyJob(userId, jobId);
  }

  @Put('/me/edit-job/:jobId')
  async updateMyJob(
    @UserId() userId: string,
    @Param('jobId') jobId: string,
    @Body() updateJobDto: CreateJobDto,
  ) {
    return this.jobsService.updateMyJob(userId, jobId, updateJobDto);
  }

  @Delete('/me/delete-job/:jobId')
  async cancelJob(@UserId() userId: string, @Param('jobId') jobId: string) {
    return this.jobsService.cancelJob(userId, jobId);
  }

  @Delete(':jobId/block-job')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async blockJob(@Param('jobId') jobId: string) {
    return this.jobsService.blockJobById(jobId);
  }

  @Patch(':jobId/unblock-job')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async unblockJob(@Param('jobId') jobId: string) {
    return this.jobsService.unblockJobById(jobId);
  }
}
