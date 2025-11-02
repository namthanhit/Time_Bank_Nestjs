import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService, PrismaService],
})
export class RatingsModule {}
