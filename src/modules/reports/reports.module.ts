import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService, NotificationsService],
  exports: [ReportsService]
})
export class ReportsModule {}
