import { Module } from '@nestjs/common';
import { RatingService } from './ratings.service';
import { RatingController} from './ratings.controller';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Module({
  controllers: [RatingController],
  providers: [RatingService, PrismaService],
})
export class RatingsModule {}
