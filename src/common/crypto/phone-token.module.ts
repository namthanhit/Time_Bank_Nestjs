import { Global, Module } from '@nestjs/common';
import { PhoneTokenService } from './phone-token.service';

@Global()
@Module({
  providers: [PhoneTokenService],
  exports: [PhoneTokenService],
})
export class PhoneTokenModule {}
