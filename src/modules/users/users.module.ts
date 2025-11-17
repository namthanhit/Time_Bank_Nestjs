import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RegionService } from '../region/region.service';
import { FollowsService } from '../follows/follows.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RegionService, FollowsService],
})
export class UsersModule {}
