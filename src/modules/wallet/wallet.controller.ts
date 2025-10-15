import { Controller, Get, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; 

@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me/wallet')
  getMyWallet(@UserId() userId: string) {
    return this.walletService.getMyWallet(userId);
  }
}