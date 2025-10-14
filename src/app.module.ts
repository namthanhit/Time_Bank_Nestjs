import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { FakeAuthMiddleware } from './common/middlewares/fake-auth.middleware';
import { TransferModule } from './modules/transfer/transfer.module';
import { SignupModule } from './modules/signup/signup.module';
import { PhoneTokenModule } from './common/crypto/phone-token.module';

@Module({
  imports: [
    PrismaModule, 
    UsersModule,
    WalletModule,
    LedgerModule,
    TransferModule,
    SignupModule,
    PhoneTokenModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} //implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(FakeAuthMiddleware).forRoutes('');
//   }
// }