import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto, GetReportsAdminDto, UpdateReportStatusDto } from './typings/reports.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserId } from 'src/common/decorators/user-id.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createReportDto: CreateReportDto,
    @UserId() reporterId: string,
  ) {
    return this.reportsService.createReport(reporterId, createReportDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getReports(@Query() query: GetReportsAdminDto) {
    return this.reportsService.getReports(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(id);
  }

  @Patch('/admin/reports/:id')
  async updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, dto);
  }
}
