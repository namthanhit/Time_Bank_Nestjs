import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UserId } from '../../common/decorators/user-id.decorator'; // hoặc middleware bạn đang dùng
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Patch('fcm-token')
  async setFcmToken(
    @UserId() userId: string,
    @Body() body: { token: string },
  ) {
    return this.notifications.setFcmToken(userId, body.token);
  }

  @Get('activity')
  async list(
    @UserId() userId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifications.listActivity(userId, cursor);
  }

  @Patch('mark-read')
  async markRead(
    @UserId() userId: string,
    @Body() body: { ids: string[] },
  ) {
    return this.notifications.markRead(userId, body.ids ?? []);
  }

  @Patch('fcm-token/deactivate')
    async deactivateFcmToken(
        @UserId() userId: string,
        @Body() body: { token: string },
    ) {
        return this.notifications.deactivateFcmToken(userId, body.token);
  }

  @Get('unread-count')
    getUnreadCount(@UserId() userId: string) {
    return this.notifications.getUnreadCount(userId); // Trả về { count: number }
  }
}
