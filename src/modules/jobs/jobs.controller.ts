import { Controller, Get, Post, Body, Param, Delete, Put, Query, Patch, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './typings/job.dto';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { PaginationRequestDto, PaginationTransformPipe } from 'src/typings/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  async createJob(
    @UserId() userId: string,
    @Body() createJobDto: CreateJobDto
  ) {
    return this.jobsService.createJob(userId, createJobDto);
  }

  @Get()
  async findAll(
    @UserId() userId: string,
    @Query(new PaginationTransformPipe()) pagingInfo: PaginationRequestDto
  ) {
    return this.jobsService.findAll(userId, pagingInfo);
  }

  @Get(':id')
  async getJobById(
    @UserId() userId: string,
    @Param('jobId') jobId: string
  ) {
    return this.jobsService.getJobById(userId, jobId);
  }

  @Get('me/all-jobs')
  async getMyJobs(
    @UserId() userId: string,
    @Query(new PaginationTransformPipe()) pagingInfo: PaginationRequestDto
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
    @Body() updateJobDto: CreateJobDto
  ) {
    return this.jobsService.updateMyJob(userId, jobId, updateJobDto);
  }

  @Delete('/me/delete-job/:jobId')
  async cancelJob(
    @UserId() userId: string, 
    @Param('jobId') jobId: string
  ) {
    return this.jobsService.cancelJob(userId, jobId);
  }
}