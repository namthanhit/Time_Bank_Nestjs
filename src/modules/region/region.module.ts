import { Module } from '@nestjs/common';
import { RegionService } from './region.service';
import { RegionController } from './region.controller';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Module({
  controllers: [RegionController],
  providers: [RegionService, PrismaService],
})
export class RegionModule {}
