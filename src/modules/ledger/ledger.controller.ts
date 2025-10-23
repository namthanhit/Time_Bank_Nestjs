import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dtos/ledger-query.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class LedgerController {
    constructor(private readonly service: LedgerService) {}

    @UseGuards(JwtAuthGuard)
    @Get('/me/ledger')
    
    getMyLedger(@UserId() userId: string, @Query() q: LedgerQueryDto) {
        return this.service.getMyLedger(userId, q);
        
    }
}