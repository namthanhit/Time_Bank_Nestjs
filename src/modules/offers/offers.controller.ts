import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OffersService } from './offers.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { OfferDto, UpdateOfferDto } from './typings/offers.dto';

@Controller('offers')
export class OffersController {
  constructor(
    private readonly offersService: OffersService
  ) {}

  //ofer vào job của người khác
  @Post()
  async createOffer(
    @UserId() userId: string,
    @Body() offerDto: OfferDto,
  ) {
    return this.offersService.createOffer(userId, offerDto);
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

  //update offer (chấp nhận, từ chối)
  @Patch('/:offerId/me-job/:jobId/update-offer')
  async updateOffer(
    @UserId() userId: string,
    @Param("offerId") offerId: string,
    @Param("jobId") jobId: string,
    @Body() status: UpdateOfferDto,
  ) {
    return this.offersService.updateOfferForMyJob(
      userId,
      offerId,
      jobId,
      status
    );
  }

  //hủy những offer của mình
  @Delete('me/:offerId/cancel-offer')
  async cancelMyOffer(
    @UserId() userId: string,
    @Param("offerId") offerId: string
  ){
    return this.offersService.cancelMyOffer(userId, offerId);
  }
}
