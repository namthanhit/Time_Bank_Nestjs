import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { RedisService } from 'src/infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';
import { BookingsService } from '../bookings/bookings.service';
import { EscrowsModule } from '../escrows/escrows.module';

@Module({
  imports: [EscrowsModule],
  controllers: [OffersController],
  providers: [OffersService, RedisService, JobsService, BookingsService],
  exports: [OffersService],
})
export class OffersModule {}
