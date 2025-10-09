import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [PrismaModule, UsersModule, JobsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
