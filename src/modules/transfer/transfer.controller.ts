import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { LookupDto } from './dtos/lookup.dto';
import { CheckDto } from './dtos/check.dto';
import { CreateTransferDto } from './dtos/create-transfer.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('transfers')
export class TransferController {
  constructor(private readonly service: TransferService) {}

  @UseGuards(JwtAuthGuard)
  @Get('lookup')
  lookup(@Query() q: LookupDto, @UserId() userId: string) {
    return this.service.lookupRecipient(q.phone, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('check')
  check(@Body() dto: CheckDto, @UserId() userId: string) {
    return this.service.checkWalletAndAmount(userId, dto);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateTransferDto, @UserId() userId: string) {
    return this.service.executeNoRecheck(userId, dto);
  }
}
