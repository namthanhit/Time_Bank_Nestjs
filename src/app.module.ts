import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { FakeAuthMiddleware } from './common/middlewares/fake-auth.middleware';

@Module({
  imports: [
    PrismaModule, 
    UsersModule,
    WalletModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FakeAuthMiddleware).forRoutes('');
  }
}