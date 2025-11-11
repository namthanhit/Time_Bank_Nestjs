import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RegionService } from '../region/region.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RegionService],
})
export class UsersModule {}
