import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { RedisService } from 'src/infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';
import { BookingsService } from '../bookings/bookings.service';

@Module({
  controllers: [OffersController],
  providers: [OffersService, RedisService, JobsService, BookingsService],
})
export class OffersModule {}
