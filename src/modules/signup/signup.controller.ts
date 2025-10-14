import { Controller, Get, Post, Query, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './signup.service';
import { CheckPhoneDto } from './dtos/check-phone.dto';
import { CreateFromPhoneTokenDto } from './dtos/signup.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('check-phone')
  async checkPhone(@Query() q: CheckPhoneDto) {
    return this.service.checkPhoneRaw(q.phone); // KHÔNG chuẩn hoá
  }

  @Post('signup/create')
  async create(@Body() dto: CreateFromPhoneTokenDto) {
    return this.service.createFromPhoneToken(dto);
  }
}
