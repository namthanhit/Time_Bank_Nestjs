import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { RedisService } from 'src/infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';

@Module({
  controllers: [OffersController],
  providers: [OffersService, RedisService, JobsService],
})
export class OffersModule {}
