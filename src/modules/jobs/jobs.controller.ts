import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto } from './typings/jobs.dto';
import { User } from 'src/decorators/user.decorator';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  async createJob(
    @User('id') id: string,
    @Body() createJobDto: CreateJobDto
  ) {
    return this.jobsService.createJob(id, createJobDto);
  }

  @Get()
  async findAll() {
    return this.jobsService.findAll();
  }

  @Get(':id')
  async getJobById(
    @User('id') userId: string,
    @Param('jobId') jobId: string
  ) {
    return this.jobsService.getJobById(userId, jobId);
  }

  @Get('me/:id')
  async getMyJobById(
    @User('id') userId: string,
    @Param('id') jobId: string,
  ) {
    return this.jobsService.getJobById(userId, jobId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.jobsService.remove(+id);
  }
}
