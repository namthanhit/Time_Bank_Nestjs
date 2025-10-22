import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, OfferStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client/extension';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prismaService: PrismaService
  ){}

  private async validateDtoBooking(service_id: string, offer_id: string){
    const service = await this.prismaService.service.findUnique({
      where: {
        id: service_id
      }
    })
    if (!service) throw new NotFoundException("Not found or service not exist")
    
    const offer = await this.prismaService.offer.findUnique({
      where: {
        id: offer_id
      }
    })

    if (!offer) throw new NotFoundException("Not found or offer not exist")
    
    return { service, offer }
  }

  async createBooking(service_id: string, offer_id: string, tx: PrismaClient){
    const { service, offer } = await this.validateDtoBooking(service_id, offer_id)

    if (service.preferred_start == null) {
      throw new BadRequestException('Service preferred_start is required');
    }

    await tx.booking.create({
      data:{
        service_id: service.id,
        offer_id: offer.id,
        requester_id: service.user_id,
        provider_id: offer.user_id,
        start_at: service.preferred_start,
        secs_booked: service.time,
        place: service.place,
        status: BookingStatus.scheduled
      }
    })
    return {
      success: true
    }
  }

  async cancelBooking(service_id: string, offer_id: string, tx: PrismaClient){
    const { service, offer } = await this.validateDtoBooking(service_id, offer_id)

    const result = await tx.booking.updateMany({
      where: {
        service_id: service.id,
        offer_id: offer.id
      },
      data: {
        status: BookingStatus.cancelled
      }
    })

    if (result.count === 0) {
      throw new NotFoundException('Booking not found')
    }

    return {
      success: true
    }
  }

  async getBookingByOfferId(userId: string, offer_id: string){
    const offer = await this.prismaService.offer.findFirst({
      where: {
        id: offer_id,
        user_id: userId
      }
    })
    if (!offer) throw new NotFoundException("Not found offer")
    
    const booking = await this.prismaService.booking.findFirst({
      where: {
        offer_id: offer.id
      }
    })

    if(!booking) throw new NotFoundException("Your offer has not been approved yet")
    
    return booking
  }
}
