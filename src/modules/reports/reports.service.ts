import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateReportDto,
  GetReportsAdminDto,
  UpdateReportStatusDto,
} from './typings/reports.dto';
import { $Enums, NotificationType, Prisma, ReportTarget } from '@prisma/client';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { getQueryParamsForAdmin } from 'src/utils/get-query-params';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService:NotificationsService
  ) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    await this.validateTargetExists(dto.target_type, dto.target_id);

    if (dto.target_type === 'user' && dto.target_id === reporterId) {
      throw new BadRequestException('Không thể tự báo cáo chính mình');
    }

    const newReport = await this.prisma.report.create({
      data: {
        reason: dto.reason,
        description: dto.description,
        target_type: dto.target_type,
        target_id: dto.target_id,
        reporter_id: reporterId,
        attachments: dto.attachments as unknown as Prisma.InputJsonValue,
      },
    });

    return newReport;
  }

  async getReports(queryDto: GetReportsAdminDto) {
    const { status, target_type, page, pageSize, sortBy, sortOrder } = queryDto;

    const { queryParams, metadata } = getQueryParamsForAdmin({
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    const where: Prisma.ReportWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (target_type) {
      where.target_type = target_type;
    }

    const selectFields: Prisma.ReportSelect = {
      id: true,
      target_type: true,
      target_id: true,
      reason: true,
      status: true,
      created_at: true,

      reporter: {
        select: {
          id: true,
          full_name: true,
        },
      },
    };

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        skip: queryParams.paging.skip,
        take: queryParams.paging.take,
        orderBy: queryParams.orderBy,
        select: selectFields,
      }),
      this.prisma.report.count({
        where,
      }),
    ]);

    return {
      data: reports,
      meta: {
        ...metadata,
        total: total,
        total_pages: Math.ceil(total / metadata.pageSize),
      },
    };
  }

  async getReportById(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Report với ID '${id}' không tồn tại.`);
    }

    let targetDetails: any = null;
    try {
      if (report.target_type === ReportTarget.user) {
        targetDetails = await this.prisma.user.findUnique({
          where: { id: report.target_id },
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            status: true,
          },
        });
      } else if (report.target_type === ReportTarget.service) {
        targetDetails = await this.prisma.service.findUnique({
          where: { id: report.target_id },
          select: {
            id: true,
            title: true,
            status: true,
            user_id: true,
          },
        });
      }
    } catch (error) {
      targetDetails = {
        error: 'Không thể tải thông tin đối tượng (có thể đã bị xóa).',
      };
    }
    return {
      ...report,
      targetDetails,
    };
  }

  async updateStatus(id: string, dto: UpdateReportStatusDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status as $Enums.ReportStatus,
        admin_note: dto.admin_note ?? null,
      },
    });

    await this.notificationsService.createOnceAndPush({
      userId: report.target_id,
      title: 'Cảnh báo tới người dùng',
      body: `${dto.admin_note}`,
      type: NotificationType.SYSTEM_ALERT,
      data: {
        jobId: report.id,
        offerId: report.target_id,
        offeringUserId: report.target_id,
        offeringUserName: report.reason || 'Người dùng',
        createdAt: new Date().toISOString(),
      },
      dedupeKey: `report:${report.id}:received`,
    });

    return updated;
  }

  private async validateTargetExists(
    type: ReportTarget,
    id: string,
  ): Promise<void> {
    let target: any;
    if (type === ReportTarget.user) {
      target = await this.prisma.user.findUnique({ where: { id } });
    } else if (type === ReportTarget.service) {
      target = await this.prisma.service.findUnique({ where: { id } });
    }

    if (!target) {
      throw new NotFoundException(
        `Đối tượng báo cáo '${type}' với ID '${id}' không tồn tại.`,
      );
    }
  }
}
