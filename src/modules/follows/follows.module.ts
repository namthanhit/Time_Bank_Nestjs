import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';

@Module({
  controllers: [],
  providers: [FollowsService],
})
export class FollowsModule {}
