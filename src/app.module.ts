import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { SignupModule } from './modules/signup/signup.module';
import { PhoneTokenModule } from './common/crypto/phone-token.module';
import { SkillsModule } from './modules/skill/skills.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule, 
    UsersModule,
    WalletModule,
    LedgerModule,
    TransferModule,
    SignupModule,
    PhoneTokenModule,
    SkillsModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 