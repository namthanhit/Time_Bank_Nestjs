import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { UserId } from 'src/common/decorators/user-id.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingService: BookingsService
  ){}

  @Get("me-offer/:offerId")
  async getBookingByOfferId(
    @UserId() userId: string,
    @Param("offerId") offerId: string
  ){
    return this.bookingService.getBookingByOfferId(userId, offerId)
  }
}
