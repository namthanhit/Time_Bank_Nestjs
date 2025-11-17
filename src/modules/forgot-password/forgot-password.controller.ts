import { Body, Controller, Get, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ForgotPasswordService } from './forgot-password.service';
import { CheckPhoneForgotDto, ResetPasswordDto } from './dtos/forgot-password.dto';

@Controller('forgot-password') 
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ForgotPasswordController {
  constructor(private readonly service: ForgotPasswordService) {}

  @Get('check-phone')
  async checkPhone(@Query() q: CheckPhoneForgotDto) {
    return this.service.checkPhone(q.phone);
  }

  @Post('reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto);
  }
}