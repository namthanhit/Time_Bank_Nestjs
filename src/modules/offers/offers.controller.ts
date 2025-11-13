import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { OfferDto, UpdateOfferDto } from './typings/offers.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  //ofer vào job của người khác
  @Post()
  async createOffer(@UserId() userId: string, @Body() offerDto: OfferDto) {
    return this.offersService.createOffer(userId, offerDto);
  }

  @Get('status/:jobId')
  async getStatusOffer(
    @Param(':jobId') jobId: string,
    @UserId() userId: string
  ){
    return this.offersService.getStatusOffer(jobId, userId)
  }


  //xem những đứa ofer vào job của mình
  @Get('me-job/:jobId')
  async getOffersForMyJob(
    @UserId() userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.offersService.getOffersForMyJob(userId, jobId);
  }

  //xem những job mình đã ofer
  @Get('me')
  async getMyOffers(@UserId() userId: string) {
    return this.offersService.getMyOffers(userId);
  }

  //xem tất cả những đứa ofer vào tất cả job của mình
  @Get('me/pending-offers')
  async getAllMyPendingOffers(@UserId() userId: string) {
    return this.offersService.getMyJobsWithPendingOrWithdrawOffers(userId);
  }

  //update offer (chấp nhận, từ chối)
  @Patch('/:offerId/me-job/:jobId/accept-offer')
  async acceptOffer(
    @UserId() userId: string,
    @Param('offerId') offerId: string,
    @Param('jobId') jobId: string,
    @Body() status: UpdateOfferDto,
  ) {
    return this.offersService.acceptOfferForMyJob(
      userId,
      offerId,
      jobId,
      status,
    );
  }

  @Patch('/:offerId/me-job/:jobId/reject-offer')
  async rejectOffer(
    @UserId() userId: string,
    @Param('offerId') offerId: string,
    @Param('jobId') jobId: string,
    @Body() status: UpdateOfferDto,
  ) {
    return this.offersService.rejectOfferForMyJob(
      userId,
      offerId,
      jobId,
      status,
    );
  }

  //hủy những offer của mình
  @Delete('me/:jobId/cancel-offer')
  async cancelMyOffer(
    @UserId() userId: string,
    @Param('jobId') offerId: string,
  ) {
    return this.offersService.cancelMyOffer(userId, offerId);
  }
}
