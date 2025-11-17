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
import { FirebaseModule } from './infra/firebase/firebase.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { QueueModule } from './infra/queue/queue.module';
import { EscrowsModule } from './modules/escrows/escrows.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FollowsModule } from './modules/follows/follows.module';
import { ForgotPasswordModule } from './modules/forgot-password/forgot-password.module';

@Module({
  imports: [
    PrismaModule, 
    FirebaseModule,
    PrismaModule,
    QueueModule,
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
    BookingsModule,
    EscrowsModule,
    RatingsModule,
    NotificationsModule,
    FollowsModule,
    ForgotPasswordModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 
