import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisModule } from '../../infra/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [RedisModule, NotificationsModule,],
    controllers: [TransferController],
    providers: [TransferService, PrismaService],
    exports: [TransferService],
})
export class TransferModule {}
