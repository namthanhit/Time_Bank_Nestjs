import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Nếu đã cấu hình firebase-admin ở chỗ khác, cung cấp Messaging ở đây.
// Ví dụ:
// import admin from 'firebase-admin';
// const messaging = admin.apps.length ? admin.messaging() : admin.initializeApp().messaging();

@Module({
  controllers: [NotificationsController],
  providers: [PrismaService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
