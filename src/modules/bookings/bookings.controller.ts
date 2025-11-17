import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard)  
export class BookingsController {
  constructor(
    private readonly bookingService: BookingsService
  ){}

  @Post(':jobId/check-in')
  async checkInBooking(
    @UserId() userId: string,
    @Param('jobid') bookingId: string
  ) {
    return this.bookingService.checkInBooking(userId, bookingId);
  }

  @Get("me-offer/:offerId")
  async getBookingByOfferId(
    @UserId() userId: string,
    @Param("offerId") offerId: string
  ){
    return this.bookingService.getBookingByOfferId(userId, offerId)
  }

  @Get()
  async getListBooked(
    @UserId() userId: string
  ){
    return this.bookingService.getMyListBooked(userId)
  }

  @Get(":jobId/count-booked")
  async getCountBooked(
    @UserId() userId: string,
    @Param("jobId") jobId: string
  ){
    return this.bookingService.getCountBookedByjobId(userId, jobId)
  }
}
