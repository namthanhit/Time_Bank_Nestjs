import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { OffersModule } from './modules/offers/offers.module';
import { RegionModule } from './modules/region/region.module';
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
    JobsModule,
    OffersModule,
    RegionModule,
    SignupModule,
    PhoneTokenModule,
    SkillsModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 