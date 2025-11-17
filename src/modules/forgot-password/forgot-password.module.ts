import { Module } from '@nestjs/common';
import { ForgotPasswordController } from './forgot-password.controller';
import { ForgotPasswordService } from './forgot-password.service';
import { PrismaService } from '../../infra/prisma/prisma.service'; 
import { PhoneTokenService } from 'src/common/crypto/phone-token.service';

@Module({
  imports: [],
  controllers: [ForgotPasswordController],
  providers: [
    ForgotPasswordService,
    PrismaService,      
    PhoneTokenService,  
  ],
})
export class ForgotPasswordModule {}