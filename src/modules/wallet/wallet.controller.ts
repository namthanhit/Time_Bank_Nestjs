import { Controller, Get, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('/me/wallet')
  getMyWallet(@UserId() userId: string) {
    return this.walletService.getMyWallet(userId);
  }
}